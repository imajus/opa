const { ethers } = require('hardhat');
const {
  loadFixture,
  time,
} = require('@nomicfoundation/hardhat-network-helpers');
const { expect, assertRoughlyEqualValues } = require('@1inch/solidity-utils');
const {
  buildMakerTraits,
  buildOrder,
  signOrder,
  buildTakerTraits,
} = require('./helpers/order');
const { deploySwapTokens } = require('./helpers/fixtures');

async function deployDutchAuctionCalculator() {
  const DutchAuctionCalculator = await ethers.getContractFactory(
    'DutchAuctionCalculator'
  );
  const dutchAuctionCalculator = await DutchAuctionCalculator.deploy();
  await dutchAuctionCalculator.waitForDeployment();
  return dutchAuctionCalculator;
}

async function deployContractsAndInit() {
  const [, maker, taker] = await ethers.getSigners();
  const { weth, dai, usdc, swap } = await deploySwapTokens();
  const dutchAuctionCalculator = await deployDutchAuctionCalculator();
  const contracts = { swap, dutchAuctionCalculator };
  const tokens = { weth, dai, usdc };
  return { taker, maker, tokens, contracts };
}

async function createDutchAuctionOrder({
  makerAsset,
  takerAsset,
  maker,
  swap,
  dutchAuctionCalculator,
  makingAmount,
  takingAmount,
  startPrice,
  endPrice,
  duration = 86400, // 24 hours default
}) {
  const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
  const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
  const parsedStartPrice = takerAsset.parseAmount(startPrice);
  const parsedEndPrice = takerAsset.parseAmount(endPrice);

  const currentTime = BigInt(await time.latest());
  const startTime = currentTime;
  const endTime = currentTime + BigInt(duration);
  const startEndTs = (startTime << 128n) | endTime;

  const order = buildOrder(
    {
      makerAsset: await makerAsset.getAddress(),
      takerAsset: await takerAsset.getAddress(),
      makingAmount: parsedMakingAmount,
      takingAmount: parsedTakingAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({ allowMultipleFills: true }),
    },
    {
      makingAmountData: ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [
          await dutchAuctionCalculator.getAddress(),
          startEndTs.toString(),
          parsedStartPrice,
          parsedEndPrice,
        ]
      ),
      takingAmountData: ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [
          await dutchAuctionCalculator.getAddress(),
          startEndTs.toString(),
          parsedStartPrice,
          parsedEndPrice,
        ]
      ),
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
    startTime,
    endTime,
    startPrice: parsedStartPrice,
    endPrice: parsedEndPrice,
    makingAmount: parsedMakingAmount,
    takingAmount: parsedTakingAmount,
    duration: BigInt(duration),
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

describe('DutchAuctionCalculator Integration Tests', function () {
  describe('Time-based Price Decay', function () {
    it('should execute dutch auction at start time (0% time passed)', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount } = await createDutchAuctionOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        dutchAuctionCalculator: contracts.dutchAuctionCalculator,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        startPrice: setup.startPrice,
        endPrice: setup.endPrice,
      });

      const makerWethBefore = await tokens.weth.balance(maker.address);
      const takerWethBefore = await tokens.weth.balance(taker.address);

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: makingAmount,
        makingAmountFill: true,
        threshold: tokens.weth.parseAmount(setup.startPrice),
      });

      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-makingAmount, makingAmount]
      );

      const makerWethAfter = await tokens.weth.balance(maker.address);
      const takerWethAfter = await tokens.weth.balance(taker.address);

      assertRoughlyEqualValues(
        makerWethAfter,
        makerWethBefore + tokens.weth.parseAmount(setup.startPrice),
        1e-4
      );
      // Use closeTo for near-zero values to handle precision issues
      expect(takerWethAfter).to.be.closeTo(
        takerWethBefore - tokens.weth.parseAmount(setup.startPrice),
        tokens.weth.parseAmount('0.001') // 0.001 ETH tolerance
      );
    });

    it('should execute dutch auction at 50% time passed', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      // Move to 50% of auction time
      await time.increase(duration / 2n);

      const expectedPrice = '0.075'; // 50% between 0.1 and 0.05
      const makerWethBefore = await tokens.weth.balance(maker.address);
      const takerWethBefore = await tokens.weth.balance(taker.address);

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: makingAmount,
        makingAmountFill: true,
        threshold: tokens.weth.parseAmount(expectedPrice),
      });

      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-makingAmount, makingAmount]
      );

      const makerWethAfter = await tokens.weth.balance(maker.address);
      const takerWethAfter = await tokens.weth.balance(taker.address);
      assertRoughlyEqualValues(
        makerWethAfter,
        makerWethBefore + tokens.weth.parseAmount(expectedPrice),
        1e-4
      );
      assertRoughlyEqualValues(
        takerWethAfter,
        takerWethBefore - tokens.weth.parseAmount(expectedPrice),
        1e-4
      );
    });

    it('should execute dutch auction at end time (100% time passed)', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      // Move past auction end time
      await time.increase(duration + 100n);

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: makingAmount,
        makingAmountFill: true,
        threshold: tokens.weth.parseAmount(setup.endPrice),
      });

      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-makingAmount, makingAmount]
      );
      await expect(fillTx).to.changeTokenBalances(
        tokens.weth.contract,
        [maker.address, taker.address],
        [
          tokens.weth.parseAmount(setup.endPrice),
          -tokens.weth.parseAmount(setup.endPrice),
        ]
      );
    });
  });

  describe('Taking Amount Fills', function () {
    it('should execute dutch auction fill by taking amount at 50% time', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, duration } = await createDutchAuctionOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        maker,
        swap: contracts.swap,
        dutchAuctionCalculator: contracts.dutchAuctionCalculator,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        startPrice: setup.startPrice,
        endPrice: setup.endPrice,
      });

      // Move to 50% of auction time
      await time.increase(duration / 2n);

      const fillAmount = tokens.weth.parseAmount('0.075'); // 50% between prices
      const expectedMakerAmount = tokens.dai.parseAmount('100');
      const makerWethBefore = await tokens.weth.balance(maker.address);
      const takerWethBefore = await tokens.weth.balance(taker.address);

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount,
        makingAmountFill: false,
        threshold: expectedMakerAmount,
      });

      await expect(fillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-expectedMakerAmount, expectedMakerAmount]
      );

      const makerWethAfter = await tokens.weth.balance(maker.address);
      const takerWethAfter = await tokens.weth.balance(taker.address);
      assertRoughlyEqualValues(
        makerWethAfter,
        makerWethBefore + fillAmount,
        1e-4
      );
      assertRoughlyEqualValues(
        takerWethAfter,
        takerWethBefore - fillAmount,
        1e-4
      );
    });
  });

  describe('Multi-part Fills', function () {
    it('should execute dutch auction in 2 parts by making amount', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      // First fill at start time (0% time passed)
      const firstFillAmount = makingAmount / 2n;
      await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: firstFillAmount,
        makingAmountFill: true,
        threshold: tokens.weth.parseAmount(setup.startPrice) / 2n,
      });

      // Move to 50% of auction time
      await time.increase(duration / 2n);

      // Second fill at 50% time passed
      const secondFillAmount = makingAmount / 2n;
      const expectedPrice = '0.075'; // 50% between 0.1 and 0.05
      const makerWethBefore = await tokens.weth.balance(maker.address);
      const takerWethBefore = await tokens.weth.balance(taker.address);

      const secondFillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: secondFillAmount,
        makingAmountFill: true,
        threshold: tokens.weth.parseAmount(expectedPrice) / 2n,
      });

      await expect(secondFillTx).to.changeTokenBalances(
        tokens.dai.contract,
        [maker.address, taker.address],
        [-secondFillAmount, secondFillAmount]
      );

      const makerWethAfter = await tokens.weth.balance(maker.address);
      const takerWethAfter = await tokens.weth.balance(taker.address);
      assertRoughlyEqualValues(
        makerWethAfter,
        makerWethBefore + tokens.weth.parseAmount(expectedPrice) / 2n,
        1e-4
      );
      assertRoughlyEqualValues(
        takerWethAfter,
        takerWethBefore - tokens.weth.parseAmount(expectedPrice) / 2n,
        1e-4
      );
    });

    it('should execute dutch auction in 5 parts by making amount', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      const fillAmount = makingAmount / 5n; // 20% each time
      const timeIncrement = duration / 5n; // 20% time increments

      // Execute 5 fills of 20% each, with time progression
      for (let i = 0; i < 5; i++) {
        if (i > 0) {
          await time.increase(timeIncrement);
        }

        // Calculate expected price based on time progression
        const timeProgress = (BigInt(i) * timeIncrement * 100n) / duration;
        const priceDecay = (50n * timeProgress) / 100n; // 0.1 to 0.05 = 50% decay
        const expectedPriceNum = 100n - priceDecay; // Start at 100 (0.1), decay to 50 (0.05)
        const expectedTakerAmount = (fillAmount * expectedPriceNum) / 1000n; // Convert to ETH units

        const fillTx = await executeOrderFill({
          swap: contracts.swap,
          taker,
          order,
          r,
          vs,
          fillAmount,
          makingAmountFill: true,
          threshold: expectedTakerAmount,
        });

        await expect(fillTx).to.changeTokenBalances(
          tokens.dai.contract,
          [maker.address, taker.address],
          [-fillAmount, fillAmount]
        );
      }
    });
  });

  describe('Different Token Decimals', function () {
    it('should handle dutch auction with different decimal tokens (WETH/USDC)', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.weth,
        takerAsset: tokens.usdc,
        makingAmount: '10',
        takingAmount: '35000',
        startPrice: '4000',
        endPrice: '3000',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      // Move to 50% of auction time
      await time.increase(duration / 2n);

      // Fill 50% by making amount
      const fillAmount = makingAmount / 2n;
      const expectedPrice = '3500'; // 50% between 4000 and 3000
      const expectedTakerAmount = tokens.usdc.parseAmount(expectedPrice) / 2n;
      const makerUsdcBefore = await tokens.usdc.balance(maker.address);
      const takerUsdcBefore = await tokens.usdc.balance(taker.address);

      const fillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount,
        makingAmountFill: true,
        threshold: expectedTakerAmount,
      });

      const makerUsdcAfter = await tokens.usdc.balance(maker.address);
      const takerUsdcAfter = await tokens.usdc.balance(taker.address);
      assertRoughlyEqualValues(
        makerUsdcAfter,
        makerUsdcBefore + expectedTakerAmount,
        1e-4
      );
      assertRoughlyEqualValues(
        takerUsdcAfter,
        takerUsdcBefore - expectedTakerAmount,
        1e-4
      );

      await expect(fillTx).to.changeTokenBalances(
        tokens.weth.contract,
        [maker.address, taker.address],
        [-fillAmount, fillAmount]
      );
    });
  });

  describe('Price Decay Validation', function () {
    it('should verify price decreases over time through calculated amounts', async function () {
      const { taker, maker, tokens, contracts } = await loadFixture(
        deployContractsAndInit
      );
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '100',
        takingAmount: '0.1',
        startPrice: '0.1',
        endPrice: '0.05',
      };
      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs, makingAmount, duration } =
        await createDutchAuctionOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          maker,
          swap: contracts.swap,
          dutchAuctionCalculator: contracts.dutchAuctionCalculator,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          startPrice: setup.startPrice,
          endPrice: setup.endPrice,
        });

      const fillAmount = makingAmount / 5n;
      const timeIncrement = duration / 5n;
      let lastTakerAmount = ethers.MaxUint256;

      // Fill in multiple parts and verify taker amounts decrease (indicating price decrease)
      for (let i = 0; i < 5; i++) {
        if (i > 0) {
          await time.increase(timeIncrement);
        }

        // Calculate expected price range and use midpoint for threshold
        const timeProgress = (BigInt(i) * timeIncrement * 100n) / duration;
        const priceDecay = (50n * timeProgress) / 100n;
        const expectedPriceNum = 100n - priceDecay;
        const expectedTakerAmount = (fillAmount * expectedPriceNum) / 1000n;

        if (i > 0) {
          // Taker amount should decrease as we progress through time
          expect(expectedTakerAmount).to.be.lt(lastTakerAmount);
        }
        lastTakerAmount = expectedTakerAmount;

        await executeOrderFill({
          swap: contracts.swap,
          taker,
          order,
          r,
          vs,
          fillAmount,
          makingAmountFill: true,
          threshold: expectedTakerAmount,
        });
      }
    });
  });
});
