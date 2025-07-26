const { ethers } = require('hardhat');
const { parseUnits } = require('ethers');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('@1inch/solidity-utils');
const { ether, units } = require('./helpers/utils');
const {
  buildMakerTraits,
  buildOrder,
  signOrder,
  buildTakerTraits,
} = require('./helpers/orderUtils');
const {
  deploySwapTokens,
  deployRangeAmountCalculator,
} = require('./helpers/fixtures');

describe('RangeAmountCalculator Integration Tests', function () {
  const deployContractsAndInit = async function () {
    const [taker, maker] = await ethers.getSigners();

    const { dai, weth, usdc, swap, chainId } = await deploySwapTokens();
    const { rangeAmountCalculator } = await deployRangeAmountCalculator();

    await initContracts(taker, maker, dai, weth, usdc, swap);
    const contracts = { swap, rangeAmountCalculator };
    const tokens = { weth, dai, usdc };

    // Add parseAmount helper to tokens
    for (const token of Object.values(tokens)) {
      const metadata = token;
      const tokenDecimals = await metadata.decimals();
      token.parseAmount = (value) => parseUnits(value, tokenDecimals);
    }

    return { taker, maker, tokens, contracts, chainId };
  };

  async function initContracts(taker, maker, dai, weth, usdc, swap) {
    // Mint tokens
    await dai.mint(maker, ether('1000000'));
    await dai.mint(taker, ether('1000000'));
    await weth.connect(maker).deposit({ value: ether('100') });
    await weth.connect(taker).deposit({ value: ether('100') });
    await usdc.mint(maker, units('1000000', 6));
    await usdc.mint(taker, units('1000000', 6));

    // Approve tokens
    await dai.approve(swap, ether('1000000'));
    await dai.connect(maker).approve(swap, ether('1000000'));
    await weth.approve(swap, ether('100'));
    await weth.connect(maker).approve(swap, ether('100'));
    await usdc.approve(swap, units('1000000', 6));
    await usdc.connect(maker).approve(swap, units('1000000', 6));
  }

  async function createRangeOrder({
    makerAsset,
    takerAsset,
    maker,
    swap,
    rangeAmountCalculator,
    chainId,
    makingAmount = '10',
    takingAmount = '35000',
    startPrice = '3000',
    endPrice = '4000',
  }) {
    const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
    const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
    const parsedStartPrice = takerAsset.parseAmount(startPrice);
    const parsedEndPrice = takerAsset.parseAmount(endPrice);

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
          ['address', 'uint256', 'uint256'],
          [
            await rangeAmountCalculator.getAddress(),
            parsedStartPrice,
            parsedEndPrice,
          ]
        ),
        takingAmountData: ethers.solidityPacked(
          ['address', 'uint256', 'uint256'],
          [
            await rangeAmountCalculator.getAddress(),
            parsedStartPrice,
            parsedEndPrice,
          ]
        ),
      }
    );

    const { r, yParityAndS: vs } = ethers.Signature.from(
      await signOrder(order, chainId, await swap.getAddress(), maker)
    );

    return {
      order,
      r,
      vs,
      startPrice: parsedStartPrice,
      endPrice: parsedEndPrice,
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

  describe('Full Fill Scenarios', function () {
    it('should execute full range order fill by taking amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      const fillAmount = tokens.dai.parseAmount('35000');

      const expectedMakerAmount =
        await contracts.rangeAmountCalculator.getRangeMakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          fillAmount,
          makingAmount
        );

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
        tokens.dai,
        [maker.address, taker.address],
        [fillAmount, -fillAmount]
      );

      await expect(fillTx).to.changeTokenBalances(
        tokens.weth,
        [maker.address, taker.address],
        [-expectedMakerAmount, expectedMakerAmount]
      );
    });

    it('should execute full range order fill by making amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      const fillAmount = tokens.weth.parseAmount('10');

      const expectedTakerAmount =
        await contracts.rangeAmountCalculator.getRangeTakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          fillAmount,
          makingAmount
        );

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
        tokens.dai,
        [maker.address, taker.address],
        [expectedTakerAmount, -expectedTakerAmount]
      );

      await expect(fillTx).to.changeTokenBalances(
        tokens.weth,
        [maker.address, taker.address],
        [-fillAmount, fillAmount]
      );
    });
  });

  describe('2-Part Fill Scenarios', function () {
    it('should execute range order in 2 parts by taking amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      // First fill - 50%
      const firstFillAmount = tokens.dai.parseAmount('17500');
      const firstExpectedMakerAmount =
        await contracts.rangeAmountCalculator.getRangeMakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          firstFillAmount,
          makingAmount
        );

      await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: firstFillAmount,
        makingAmountFill: false,
        threshold: firstExpectedMakerAmount,
      });

      // Second fill - remaining 50%
      const secondFillAmount = tokens.dai.parseAmount('17500');
      const remainingMakingAmount = makingAmount - firstExpectedMakerAmount;
      const secondExpectedMakerAmount =
        await contracts.rangeAmountCalculator.getRangeMakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          secondFillAmount,
          remainingMakingAmount
        );

      const secondFillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: secondFillAmount,
        makingAmountFill: false,
        threshold: secondExpectedMakerAmount,
      });

      await expect(secondFillTx).to.changeTokenBalances(
        tokens.dai,
        [maker.address, taker.address],
        [secondFillAmount, -secondFillAmount]
      );

      await expect(secondFillTx).to.changeTokenBalances(
        tokens.weth,
        [maker.address, taker.address],
        [-secondExpectedMakerAmount, secondExpectedMakerAmount]
      );
    });

    it('should execute range order in 2 parts by making amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      // First fill - 50%
      const firstFillAmount = tokens.weth.parseAmount('5');
      const firstExpectedTakerAmount =
        await contracts.rangeAmountCalculator.getRangeTakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          firstFillAmount,
          makingAmount
        );

      await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: firstFillAmount,
        makingAmountFill: true,
        threshold: firstExpectedTakerAmount,
      });

      // Second fill - remaining 50%
      const secondFillAmount = tokens.weth.parseAmount('5');
      const remainingMakingAmount = makingAmount - firstFillAmount;
      const secondExpectedTakerAmount =
        await contracts.rangeAmountCalculator.getRangeTakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          secondFillAmount,
          remainingMakingAmount
        );

      const secondFillTx = await executeOrderFill({
        swap: contracts.swap,
        taker,
        order,
        r,
        vs,
        fillAmount: secondFillAmount,
        makingAmountFill: true,
        threshold: secondExpectedTakerAmount,
      });

      await expect(secondFillTx).to.changeTokenBalances(
        tokens.dai,
        [maker.address, taker.address],
        [secondExpectedTakerAmount, -secondExpectedTakerAmount]
      );

      await expect(secondFillTx).to.changeTokenBalances(
        tokens.weth,
        [maker.address, taker.address],
        [-secondFillAmount, secondFillAmount]
      );
    });
  });

  describe('10-Part Fill Scenarios', function () {
    it('should execute range order in 10 parts by making amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      let remainingMakingAmount = makingAmount;
      const fillAmount = tokens.weth.parseAmount('1'); // 10% each time

      // Execute 10 fills of 10% each
      for (let i = 0; i < 10; i++) {
        const expectedTakerAmount =
          await contracts.rangeAmountCalculator.getRangeTakerAmount(
            startPrice,
            endPrice,
            makingAmount,
            fillAmount,
            remainingMakingAmount
          );

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
          tokens.dai,
          [maker.address, taker.address],
          [expectedTakerAmount, -expectedTakerAmount]
        );

        await expect(fillTx).to.changeTokenBalances(
          tokens.weth,
          [maker.address, taker.address],
          [-fillAmount, fillAmount]
        );

        remainingMakingAmount -= fillAmount;
      }

      // Verify the order is completely filled
      expect(remainingMakingAmount).to.equal(0);
    });

    it('should execute range order in 10 parts by taking amount', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      let remainingMakingAmount = makingAmount;
      const fillAmount = tokens.dai.parseAmount('3500'); // 10% each time

      // Execute 10 fills of 10% each
      for (let i = 0; i < 10; i++) {
        const expectedMakerAmount =
          await contracts.rangeAmountCalculator.getRangeMakerAmount(
            startPrice,
            endPrice,
            makingAmount,
            fillAmount,
            remainingMakingAmount
          );

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
          tokens.dai,
          [maker.address, taker.address],
          [fillAmount, -fillAmount]
        );

        await expect(fillTx).to.changeTokenBalances(
          tokens.weth,
          [maker.address, taker.address],
          [-expectedMakerAmount, expectedMakerAmount]
        );

        remainingMakingAmount -= expectedMakerAmount;
      }

      // Verify the order is nearly completely filled (small rounding expected)
      expect(remainingMakingAmount).to.be.lt(ether('0.001'));
    });
  });

  describe('Different Token Decimals', function () {
    it('should handle range orders with different decimal tokens (WETH/USDC)', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.usdc,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
          makingAmount: '10',
          takingAmount: '35000',
          startPrice: '3000',
          endPrice: '4000',
        });

      // Fill 50% by making amount
      const fillAmount = tokens.weth.parseAmount('5');
      const expectedTakerAmount =
        await contracts.rangeAmountCalculator.getRangeTakerAmount(
          startPrice,
          endPrice,
          makingAmount,
          fillAmount,
          makingAmount
        );

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
        tokens.usdc,
        [maker.address, taker.address],
        [expectedTakerAmount, -expectedTakerAmount]
      );

      await expect(fillTx).to.changeTokenBalances(
        tokens.weth,
        [maker.address, taker.address],
        [-fillAmount, fillAmount]
      );
    });
  });

  describe('Price Range Validation', function () {
    it('should verify price progression through calculated amounts', async function () {
      const { taker, maker, tokens, contracts, chainId } = await loadFixture(
        deployContractsAndInit
      );

      const { order, r, vs, startPrice, endPrice, makingAmount } =
        await createRangeOrder({
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          maker,
          swap: contracts.swap,
          rangeAmountCalculator: contracts.rangeAmountCalculator,
          chainId,
        });

      const fillAmount = tokens.weth.parseAmount('1');
      let remainingMakingAmount = makingAmount;
      let lastTakerAmount = 0n;

      // Fill in multiple parts and verify taker amounts increase (indicating price increase)
      for (let i = 0; i < 5; i++) {
        const expectedTakerAmount =
          await contracts.rangeAmountCalculator.getRangeTakerAmount(
            startPrice,
            endPrice,
            makingAmount,
            fillAmount,
            remainingMakingAmount
          );

        if (i > 0) {
          // Taker amount should increase as we move through the range
          expect(expectedTakerAmount).to.be.gt(lastTakerAmount);
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

        remainingMakingAmount -= fillAmount;
      }
    });
  });
});
