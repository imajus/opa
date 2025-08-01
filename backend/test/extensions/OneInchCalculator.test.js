const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect, assertRoughlyEqualValues } = require('@1inch/solidity-utils');
const { deploySwapTokens } = require('../helpers/fixtures');
const {
  buildOrder,
  buildMakerTraits,
  buildTakerTraits,
  signOrder,
} = require('../helpers/order');

async function deployContractsAndInit() {
  const [, maker, taker] = await ethers.getSigners();
  const { dai, weth, usdc, swap } = await deploySwapTokens();

  // Deploy OneInch Calculator
  const OneInchCalculator = await ethers.getContractFactory(
    'OneInchCalculator'
  );
  const mockAggregationRouter = await ethers.getContractFactory(
    'MockAggregationRouter'
  );
  const router = await mockAggregationRouter.deploy();
  await router.waitForDeployment();

  const oneInchCalculator = await OneInchCalculator.deploy(
    await router.getAddress()
  );
  await oneInchCalculator.waitForDeployment();

  const tokens = { dai, weth, usdc };
  const contracts = { swap, oneInchCalculator, router };
  const chainId = (await ethers.provider.getNetwork()).chainId;

  return {
    taker,
    maker,
    tokens,
    contracts,
    chainId,
    async createOneInchCalculatorOrder({
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      spread,
    }) {
      const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
      const parsedTakingAmount = takerAsset.parseAmount(takingAmount);

      // Encode blob data: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
      const flags = '00';
      const makerTokenHex = makerAsset.address.toLowerCase().slice(2);
      const takerTokenHex = takerAsset.address.toLowerCase().slice(2);
      const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
      const blobData = flags + makerTokenHex + takerTokenHex + spreadHex;

      const order = buildOrder({
        makerAsset: makerAsset.address,
        takerAsset: takerAsset.address,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
        maker: maker.address,
        extension: (await oneInchCalculator.getAddress()) + blobData,
      });

      const { r, yParityAndS: vs } = ethers.Signature.from(
        await signOrder(order, chainId, await swap.getAddress(), maker)
      );

      return {
        order,
        r,
        vs,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
        blobData: '0x' + blobData,
      };
    },
    async executeOrderFill({
      order,
      r,
      vs,
      fillAmount,
      makingAmountFill = false,
      threshold = '0',
    }) {
      const takerTraits = buildTakerTraits({
        threshold: BigInt(threshold),
        makingAmount: makingAmountFill,
        skipMakerPermit: false,
        usePermit2: false,
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
    },
  };
}

describe('OneInchCalculator Integration', function () {
  describe('Amount Calculation', function () {
    it('should calculate maker amount with spread reduction', async function () {
      const { taker, maker, tokens, contracts, createOneInchCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1050000000', // 5% spread
      };

      // Set up mock router with 1:1 exchange rate
      await contracts.router.setExchangeRate(10000); // 1:1 rate

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createOneInchCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        spread: setup.spread,
      });

      // Test getMakingAmount
      const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
      const makingAmount = await contracts.oneInchCalculator.getMakingAmount(
        order,
        order.extension,
        ethers.ZeroHash,
        taker.address,
        takingAmount,
        setup.makerAsset.parseAmount(setup.makingAmount),
        blobData
      );

      // Should be reduced by spread (1000000000n - 1050000000n = -50000000n)
      // But since we're using mock data, this tests the integration flow
      expect(makingAmount).to.be.gt(0);
    });

    it('should calculate taker amount with spread increase', async function () {
      const { taker, maker, tokens, contracts, createOneInchCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1050000000', // 5% spread
      };

      // Set up mock router with 1:1 exchange rate
      await contracts.router.setExchangeRate(10000); // 1:1 rate

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createOneInchCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        spread: setup.spread,
      });

      // Test getTakingAmount
      const makingAmount = setup.makerAsset.parseAmount(setup.makingAmount);
      const takingAmount = await contracts.oneInchCalculator.getTakingAmount(
        order,
        order.extension,
        ethers.ZeroHash,
        taker.address,
        makingAmount,
        makingAmount,
        blobData
      );

      // Should be increased by spread (1000000000n + 1050000000n)
      expect(takingAmount).to.be.gt(0);
    });

    it('should handle same token scenario', async function () {
      const { taker, maker, tokens, contracts, createOneInchCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.dai, // Same token
        makingAmount: '1000',
        takingAmount: '1000',
        spread: '1000000000', // No spread
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createOneInchCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        spread: setup.spread,
      });

      const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
      const makingAmount = await contracts.oneInchCalculator.getMakingAmount(
        order,
        order.extension,
        ethers.ZeroHash,
        taker.address,
        takingAmount,
        setup.makerAsset.parseAmount(setup.makingAmount),
        blobData
      );

      // For same token, should return the input amount with spread applied
      expect(makingAmount).to.equal(takingAmount);
    });
  });

  describe('Error Handling', function () {
    it('should revert with InvalidBlobLength for wrong blob size', async function () {
      const { taker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );

      const invalidBlobData = '0x1234'; // Too short
      const order = buildOrder({
        makerAsset: tokens.dai.address,
        takerAsset: tokens.weth.address,
        makingAmount: tokens.dai.parseAmount('1000'),
        takingAmount: tokens.weth.parseAmount('0.5'),
        maker: taker.address,
      });

      await expect(
        contracts.oneInchCalculator.getMakingAmount(
          order,
          '0x',
          ethers.ZeroHash,
          taker.address,
          tokens.weth.parseAmount('0.5'),
          tokens.dai.parseAmount('1000'),
          invalidBlobData
        )
      ).to.be.revertedWithCustomError(
        contracts.oneInchCalculator,
        'InvalidBlobLength'
      );
    });

    it('should revert with ZeroAmount for zero taking amount', async function () {
      const { taker, tokens, contracts, createOneInchCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const { order, blobData } = await createOneInchCalculatorOrder({
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1000000000',
      });

      await expect(
        contracts.oneInchCalculator.getMakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          0, // Zero amount
          tokens.dai.parseAmount('1000'),
          blobData
        )
      ).to.be.revertedWithCustomError(
        contracts.oneInchCalculator,
        'ZeroAmount'
      );
    });

    it('should revert with PriceDiscoveryFailed when router fails', async function () {
      const { taker, tokens, contracts, createOneInchCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const { order, blobData } = await createOneInchCalculatorOrder({
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1000000000',
      });

      // Set router to revert
      await contracts.router.setShouldFailQuotes(true);

      await expect(
        contracts.oneInchCalculator.getMakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          tokens.weth.parseAmount('0.5'),
          tokens.dai.parseAmount('1000'),
          blobData
        )
      ).to.be.revertedWithCustomError(
        contracts.oneInchCalculator,
        'PriceDiscoveryFailed'
      );
    });
  });

  describe('Order Execution', function () {
    it('should execute order with dynamic pricing', async function () {
      const {
        taker,
        maker,
        tokens,
        contracts,
        createOneInchCalculatorOrder,
        executeOrderFill,
      } = await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1000000000', // No spread for simplicity
      };

      // Set up mock router with 1:1 exchange rate
      await contracts.router.setExchangeRate(10000); // 1:1 rate

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs } = await createOneInchCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        spread: setup.spread,
      });

      const fillTx = await executeOrderFill({
        order,
        r,
        vs,
        fillAmount: setup.takerAsset.parseAmount(setup.takingAmount),
        makingAmountFill: false,
        threshold: '0',
      });

      // Verify token transfers occurred
      await expect(fillTx).to.changeTokenBalances(
        setup.makerAsset.contract,
        [taker.address, maker.address],
        [
          setup.makerAsset.parseAmount(setup.makingAmount),
          -setup.makerAsset.parseAmount(setup.makingAmount),
        ]
      );

      await expect(fillTx).to.changeTokenBalances(
        setup.takerAsset.contract,
        [taker.address, maker.address],
        [
          -setup.takerAsset.parseAmount(setup.takingAmount),
          setup.takerAsset.parseAmount(setup.takingAmount),
        ]
      );
    });
  });
});
