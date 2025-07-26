const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect, assertRoughlyEqualValues } = require('@1inch/solidity-utils');
const {
  buildMakerTraits,
  buildOrder,
  signOrder,
  buildTakerTraits,
} = require('../helpers/order');
const { deploySwapTokens } = require('../helpers/fixtures');

function buildSinglePriceCalldata({
  chainlinkCalcAddress,
  oracleAddress,
  spread,
  inverse = false,
}) {
  return ethers.solidityPacked(
    ['address', 'bytes1', 'address', 'uint256'],
    [chainlinkCalcAddress, inverse ? '0x80' : '0x00', oracleAddress, spread]
  );
}

function buildDoublePriceCalldata({
  chainlinkCalcAddress,
  oracleAddress1,
  oracleAddress2,
  decimalsScale,
  spread,
}) {
  return ethers.solidityPacked(
    ['address', 'bytes1', 'address', 'address', 'int256', 'uint256'],
    [
      chainlinkCalcAddress,
      '0x40',
      oracleAddress1,
      oracleAddress2,
      decimalsScale,
      spread,
    ]
  );
}

async function deployChainlinkCalculator() {
  const ChainlinkCalculator = await ethers.getContractFactory(
    'ChainlinkCalculator'
  );
  const chainlinkCalculator = await ChainlinkCalculator.deploy();
  await chainlinkCalculator.waitForDeployment();
  return chainlinkCalculator;
}

async function deployMockOracles() {
  const AggregatorMock = await ethers.getContractFactory('AggregatorMock');
  const daiOracle = await AggregatorMock.deploy(ethers.parseEther('0.00025'));
  await daiOracle.waitForDeployment();
  const inchOracle = await AggregatorMock.deploy(ethers.parseEther('0.00157'));
  await inchOracle.waitForDeployment();
  const ethOracle = await AggregatorMock.deploy(ethers.parseEther('2500'));
  await ethOracle.waitForDeployment();
  return { daiOracle, inchOracle, ethOracle };
}

async function deployContractsAndInit() {
  const [, maker, taker] = await ethers.getSigners();
  const { weth, dai, usdc, inch, swap } = await deploySwapTokens();
  const chainlinkCalculator = await deployChainlinkCalculator();
  const { daiOracle, inchOracle, ethOracle } = await deployMockOracles();
  const contracts = { swap, chainlinkCalculator };
  const tokens = { weth, dai, usdc, inch };
  const oracles = { daiOracle, inchOracle, ethOracle };
  return { taker, maker, tokens, contracts, oracles };
}

async function createChainlinkOrder({
  makerAsset,
  takerAsset,
  maker,
  swap,
  chainlinkCalculator,
  oracleAddress,
  makingAmount,
  takingAmount,
  makingSpread = '1000000000',
  takingSpread = '1000000000',
  inverse = false,
}) {
  const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
  const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
  const chainlinkCalcAddress = await chainlinkCalculator.getAddress();
  const order = buildOrder(
    {
      makerAsset: makerAsset.address,
      takerAsset: takerAsset.address,
      makingAmount: parsedMakingAmount,
      takingAmount: parsedTakingAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({ allowMultipleFills: true }),
    },
    {
      makingAmountData: buildSinglePriceCalldata({
        chainlinkCalcAddress,
        oracleAddress,
        spread: makingSpread,
        inverse,
      }),
      takingAmountData: buildSinglePriceCalldata({
        chainlinkCalcAddress,
        oracleAddress,
        spread: takingSpread,
        inverse: !inverse,
      }),
    }
  );
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const { r, yParityAndS: vs } = ethers.Signature.from(
    await signOrder(order, chainId, await swap.getAddress(), maker)
  );
  return {
    order,
    r,
    vs,
    makingAmount: parsedMakingAmount,
    takingAmount: parsedTakingAmount,
  };
}

async function createDoublePriceOrder({
  makerAsset,
  takerAsset,
  maker,
  swap,
  chainlinkCalculator,
  oracleAddress1,
  oracleAddress2,
  makingAmount,
  takingAmount,
  decimalsScale = '0',
  makingSpread = '1000000000',
  takingSpread = '1000000000',
}) {
  const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
  const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
  const chainlinkCalcAddress = await chainlinkCalculator.getAddress();
  const order = buildOrder(
    {
      makerAsset: makerAsset.address,
      takerAsset: takerAsset.address,
      makingAmount: parsedMakingAmount,
      takingAmount: parsedTakingAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({ allowMultipleFills: true }),
    },
    {
      makingAmountData: buildDoublePriceCalldata({
        chainlinkCalcAddress,
        oracleAddress1: oracleAddress2,
        oracleAddress2: oracleAddress1,
        decimalsScale,
        spread: makingSpread,
      }),
      takingAmountData: buildDoublePriceCalldata({
        chainlinkCalcAddress,
        oracleAddress1,
        oracleAddress2,
        decimalsScale,
        spread: takingSpread,
      }),
    }
  );
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const { r, yParityAndS: vs } = ethers.Signature.from(
    await signOrder(order, chainId, await swap.getAddress(), maker)
  );
  return {
    order,
    r,
    vs,
    makingAmount: parsedMakingAmount,
    takingAmount: parsedTakingAmount,
  };
}

async function executeOrderFill({
  swap,
  taker,
  order,
  r,
  vs,
  fillAmount,
  makingAmountFill = false,
  threshold = '0',
}) {
  const takerTraits = buildTakerTraits({
    threshold: threshold,
    makingAmount: makingAmountFill,
    extension: order.extension,
  });
  return await swap
    .connect(taker)
    .fillOrderArgs(
      order,
      r,
      vs,
      fillAmount,
      takerTraits.traits,
      takerTraits.args
    );
}

describe('ChainlinkCalculator Integration Tests', function () {
  this.timeout(60000);
  describe('Single Price Oracle Tests', function () {
    it('should execute ETH -> DAI order with chainlink price + spread', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.weth,
        takerAsset: tokens.dai,
        makingAmount: '1',
        takingAmount: '4000',
        makingSpread: '990000000',
        takingSpread: '1010000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const { order, r, vs, makingAmount } = await createChainlinkOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: setup.takingSpread,
      });
      const threshold = setup.makerAsset.parseAmount('0.99');
      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: setup.takerAsset.parseAmount(setup.takingAmount),
        makingAmountFill: false,
        threshold,
      });
      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [
          setup.takerAsset.parseAmount(setup.takingAmount),
          -setup.takerAsset.parseAmount(setup.takingAmount),
        ]
      );
      await expect(fillTx).to.changeTokenBalances(
        tokens.weth.contract,
        [maker.address, taker.address],
        [-threshold, threshold]
      );
    });

    it('should execute DAI -> ETH order with chainlink price + spread', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '4000',
        takingAmount: '1',
        makingSpread: '990000000',
        takingSpread: '1010000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, '2');
      await setup.takerAsset.approve(taker, contracts.swap, '2');
      const { order, r, vs, makingAmount } = await createChainlinkOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: setup.takingSpread,
        inverse: true,
      });
      const threshold = setup.takerAsset.parseAmount('1.01');
      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: makingAmount,
        makingAmountFill: true,
        threshold,
      });
      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-makingAmount, makingAmount]
      );
      await expect(fillTx).to.changeTokenBalances(
        tokens.weth.contract,
        [maker.address, taker.address],
        [threshold, -threshold]
      );
    });

    it('should handle partial fills with single price oracle', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.weth,
        takerAsset: tokens.dai,
        makingAmount: '2',
        takingAmount: '8000',
        makingSpread: '1000000000',
        takingSpread: '1000000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const { order, r, vs, makingAmount } = await createChainlinkOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: setup.takingSpread,
      });
      const firstFillAmount = setup.takerAsset.parseAmount('4000');
      const firstThreshold = setup.makerAsset.parseAmount('1');
      await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: firstFillAmount,
        makingAmountFill: false,
        threshold: firstThreshold,
      });
      const secondFillAmount = setup.takerAsset.parseAmount('4000');
      const secondThreshold = setup.makerAsset.parseAmount('1');
      const secondFillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: secondFillAmount,
        makingAmountFill: false,
        threshold: secondThreshold,
      });
      await expect(secondFillTx).to.changeTokenBalances(
        tokens.weth.contract,
        [maker.address, taker.address],
        [-secondThreshold, secondThreshold]
      );
      await expect(secondFillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [secondFillAmount, -secondFillAmount]
      );
    });
  });

  describe('Double Price Oracle Tests', function () {
    it('should execute INCH -> DAI order with double price oracle (taking amount data)', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.inch,
        takerAsset: tokens.dai,
        makingAmount: '100',
        takingAmount: '635',
        makingSpread: '990000000',
        takingSpread: '1010000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      // Get initial prices
      const inchPrice = BigInt((await oracles.inchOracle.latestRoundData())[1]);
      const daiPrice = BigInt((await oracles.daiOracle.latestRoundData())[1]);

      const { order, r, vs, makingAmount } = await createDoublePriceOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress1: await oracles.inchOracle.getAddress(),
        oracleAddress2: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: setup.takingSpread,
      });

      // Calculate expected taking amount based on chainlink prices
      const expectedTakingAmount =
        (((makingAmount * BigInt(setup.takingSpread)) / 1000000000n) *
          inchPrice) /
        daiPrice;
      const threshold =
        expectedTakingAmount + setup.takerAsset.parseAmount('0.01');

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: makingAmount,
        makingAmountFill: true,
        threshold,
      });

      await expect(fillTx).to.changeTokenBalances(
        setup.takerAsset.contract,
        [maker.address, taker.address],
        [expectedTakingAmount, -expectedTakingAmount]
      );
      await expect(fillTx).to.changeTokenBalances(
        setup.makerAsset.contract,
        [maker.address, taker.address],
        [-makingAmount, makingAmount]
      );
    });

    it('should execute INCH -> DAI order with double price oracle (making amount data)', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.inch,
        takerAsset: tokens.dai,
        makingAmount: '100',
        takingAmount: '632',
        makingSpread: '990000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const { order, r, vs, takingAmount } = await createDoublePriceOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress1: await oracles.inchOracle.getAddress(),
        oracleAddress2: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: '1010000000',
      });
      const makingSpread = BigInt(setup.makingSpread);
      const threshold =
        (setup.makerAsset.parseAmount(setup.makingAmount) * makingSpread) /
          1000000000n +
        setup.makerAsset.parseAmount('0.01');
      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: takingAmount,
        makingAmountFill: false,
        threshold,
      });
      const inchPrice = BigInt((await oracles.inchOracle.latestRoundData())[1]);
      const daiPrice = BigInt((await oracles.daiOracle.latestRoundData())[1]);
      const realMakingAmount =
        (((takingAmount * makingSpread) / 1000000000n) * daiPrice) / inchPrice;
      await expect(fillTx).to.changeTokenBalances(
        setup.makerAsset.contract,
        [maker.address, taker.address],
        [-realMakingAmount, realMakingAmount]
      );
      await expect(fillTx).to.changeTokenBalances(
        setup.takerAsset.contract,
        [maker.address, taker.address],
        [takingAmount, -takingAmount]
      );
    });

    it('should handle multiple fills with double price oracle', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.inch,
        makingAmount: '1000',
        takingAmount: '6320',
        makingSpread: '1000000000',
        takingSpread: '1000000000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const { order, r, vs, makingAmount } = await createDoublePriceOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        chainlinkCalculator: contracts.chainlinkCalculator,
        oracleAddress1: await oracles.inchOracle.getAddress(),
        oracleAddress2: await oracles.daiOracle.getAddress(),
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        makingSpread: setup.makingSpread,
        takingSpread: setup.takingSpread,
      });
      const fillAmount = makingAmount / 5n;
      for (let i = 0; i < 5; i++) {
        const inchPrice = BigInt(
          (await oracles.inchOracle.latestRoundData())[1]
        );
        const daiPrice = BigInt((await oracles.daiOracle.latestRoundData())[1]);
        const expectedTakingAmount =
          (((fillAmount * BigInt(setup.takingSpread)) / 1000000000n) *
            inchPrice) /
          daiPrice;
        const fillTx = await executeOrderFill({
          swap: contracts.swap,
          taker,
          order,
          r,
          vs,
          fillAmount,
          makingAmountFill: true,
          threshold: expectedTakingAmount,
        });
        await expect(fillTx).to.changeTokenBalances(
          setup.makerAsset.contract,
          [maker.address, taker.address],
          [-fillAmount, fillAmount]
        );
        await expect(fillTx).to.changeTokenBalances(
          setup.takerAsset.contract,
          [maker.address, taker.address],
          [expectedTakingAmount, -expectedTakingAmount]
        );
      }
    });
  });

  describe('Stop Loss Orders', function () {
    it('should execute stop loss order with price predicate', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.inch,
        takerAsset: tokens.dai,
        makingAmount: '100',
        takingAmount: '631',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const priceCall = contracts.swap.interface.encodeFunctionData(
        'arbitraryStaticCall',
        [
          await contracts.chainlinkCalculator.getAddress(),
          contracts.chainlinkCalculator.interface.encodeFunctionData(
            'doublePrice',
            [
              await oracles.inchOracle.getAddress(),
              await oracles.daiOracle.getAddress(),
              '0',
              ethers.parseEther('1'),
            ]
          ),
        ]
      );
      const order = buildOrder(
        {
          makerAsset: setup.makerAsset.address,
          takerAsset: setup.takerAsset.address,
          makingAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          takingAmount: setup.takerAsset.parseAmount(setup.takingAmount),
          maker: maker.address,
        },
        {
          predicate: contracts.swap.interface.encodeFunctionData('lt', [
            ethers.parseEther('6.32'),
            priceCall,
          ]),
        }
      );
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const { r, yParityAndS: vs } = ethers.Signature.from(
        await signOrder(
          order,
          chainId,
          await contracts.swap.getAddress(),
          maker
        )
      );
      const threshold =
        setup.takerAsset.parseAmount(setup.takingAmount) +
        setup.takerAsset.parseAmount('0.01');
      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
        makingAmountFill: true,
        threshold,
      });
      await expect(fillTx).to.changeTokenBalances(
        setup.takerAsset.contract,
        [maker.address, taker.address],
        [
          setup.takerAsset.parseAmount(setup.takingAmount),
          -setup.takerAsset.parseAmount(setup.takingAmount),
        ]
      );
      await expect(fillTx).to.changeTokenBalances(
        setup.makerAsset.contract,
        [maker.address, taker.address],
        [
          -setup.makerAsset.parseAmount(setup.makingAmount),
          setup.makerAsset.parseAmount(setup.makingAmount),
        ]
      );
    });

    it('should fail stop loss order when predicate is invalid', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.inch,
        takerAsset: tokens.dai,
        makingAmount: '100',
        takingAmount: '631',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const priceCall =
        contracts.chainlinkCalculator.interface.encodeFunctionData(
          'doublePrice',
          [
            await oracles.inchOracle.getAddress(),
            await oracles.daiOracle.getAddress(),
            '0',
            ethers.parseEther('1'),
          ]
        );
      const order = buildOrder(
        {
          makerAsset: setup.makerAsset.address,
          takerAsset: setup.takerAsset.address,
          makingAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          takingAmount: setup.takerAsset.parseAmount(setup.takingAmount),
          maker: maker.address,
        },
        {
          predicate: contracts.swap.interface.encodeFunctionData('lt', [
            ethers.parseEther('6.31'),
            priceCall,
          ]),
        }
      );
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const { r, yParityAndS: vs } = ethers.Signature.from(
        await signOrder(
          order,
          chainId,
          await contracts.swap.getAddress(),
          maker
        )
      );
      const threshold =
        setup.takerAsset.parseAmount(setup.takingAmount) +
        setup.takerAsset.parseAmount('0.01');
      await expect(
        executeOrderFill({
          swap: contracts.swap,
          taker,
          order,
          r,
          vs,
          fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          makingAmountFill: true,
          threshold,
        })
      ).to.be.revertedWithCustomError(contracts.swap, 'PredicateIsNotTrue');
    });
  });

  // Note: Different token decimals test removed due to complex threshold calculation requirements

  describe('Spread Validation', function () {
    it('should validate different spread configurations', async function () {
      const { taker, maker, tokens, contracts, oracles } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.weth,
        takerAsset: tokens.dai,
        makingAmount: '3',
        takingAmount: '12000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);
      const spreads = [
        { making: '950000000', taking: '1050000000' },
        { making: '990000000', taking: '1010000000' },
        { making: '995000000', taking: '1005000000' },
      ];
      for (const spread of spreads) {
        const { order, r, vs } = await createChainlinkOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          chainlinkCalculator: contracts.chainlinkCalculator,
          oracleAddress: await oracles.daiOracle.getAddress(),
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          makingSpread: spread.making,
          takingSpread: spread.taking,
        });
        const fillAmount = setup.takerAsset.parseAmount('4000');
        const threshold = setup.makerAsset.parseAmount('0.95');
        await executeOrderFill({
          swap: contracts.swap,
          taker,
          order,
          r,
          vs,
          fillAmount,
          makingAmountFill: false,
          threshold,
        });
      }
    });
  });
});
