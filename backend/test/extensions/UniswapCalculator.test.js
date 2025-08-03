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

  // Deploy Mock Uniswap Factory and setup pools
  const mockUniswapFactory = await ethers.getContractFactory(
    'MockUniswapFactory'
  );
  const factory = await mockUniswapFactory.deploy();
  await factory.waitForDeployment();

  // Deploy Uniswap Calculator
  const UniswapCalculator = await ethers.getContractFactory(
    'UniswapCalculator'
  );
  const uniswapCalculator = await UniswapCalculator.deploy(
    await factory.getAddress()
  );
  await uniswapCalculator.waitForDeployment();

  // Create mock pools for testing with 1:1.5 exchange ratio (1 DAI = 1.5 WETH)
  // sqrt(1.5) * 2^96 = 97034285709124580000000000000
  const sqrtPrice1_5 = '97034285709124580000000000000';

  await factory.createPoolWithPrice(
    dai.address,
    weth.address,
    3000,
    sqrtPrice1_5 // 1:1.5 ratio
  );

  await factory.createPoolWithPrice(
    dai.address,
    weth.address,
    500,
    sqrtPrice1_5 // 1:1.5 ratio
  );

  await factory.createPoolWithPrice(
    dai.address,
    weth.address,
    10000,
    sqrtPrice1_5 // 1:1.5 ratio
  );

  const tokens = { dai, weth, usdc };
  const contracts = { swap, uniswapCalculator, factory };
  const chainId = (await ethers.provider.getNetwork()).chainId;

  return {
    taker,
    maker,
    tokens,
    contracts,
    chainId,
    async createUniswapCalculatorOrder({
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      fee,
      spread,
    }) {
      const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
      const parsedTakingAmount = takerAsset.parseAmount(takingAmount);

      // Encode blob data: [fee(3)][spread(32)]
      const feeHex = fee.toString(16).padStart(6, '0');
      const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
      const blobData = feeHex + spreadHex;

      const order = buildOrder({
        makerAsset: makerAsset.address,
        takerAsset: takerAsset.address,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
        maker: maker.address,
        extension: (await uniswapCalculator.getAddress()) + blobData,
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

describe('UniswapCalculator Integration', function () {
  describe('Contract Setup', function () {
    it('should deploy with correct factory address', async function () {
      const { contracts } = await loadFixture(deployContractsAndInit);

      const factoryAddress = await contracts.uniswapCalculator.uniswapFactory();
      expect(factoryAddress).to.equal(await contracts.factory.getAddress());
    });

    it('should return supported fee tiers', async function () {
      const { contracts } = await loadFixture(deployContractsAndInit);

      const feeTiers = await contracts.uniswapCalculator.getSupportedFeeTiers();
      expect(feeTiers).to.have.length(3);
      expect(feeTiers[0]).to.equal(500);
      expect(feeTiers[1]).to.equal(3000);
      expect(feeTiers[2]).to.equal(10000);
    });

    it('should validate fee tiers correctly', async function () {
      const { contracts } = await loadFixture(deployContractsAndInit);

      expect(await contracts.uniswapCalculator.isValidFeeTier(500)).to.be.true;
      expect(await contracts.uniswapCalculator.isValidFeeTier(3000)).to.be.true;
      expect(await contracts.uniswapCalculator.isValidFeeTier(10000)).to.be
        .true;
      expect(await contracts.uniswapCalculator.isValidFeeTier(100)).to.be.false;
      expect(await contracts.uniswapCalculator.isValidFeeTier(5000)).to.be
        .false;
    });
  });

  describe.skip('Amount Calculation', function () {
    it('should calculate maker amount with spread reduction', async function () {
      const { taker, maker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '10',
        takingAmount: '15',
        fee: 3000,
        spread: '950000000', // -5% spread
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createUniswapCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        fee: setup.fee,
        spread: setup.spread,
      });

      // Test getMakingAmount
      const makingAmount = setup.makerAsset.parseAmount(setup.makingAmount);
      const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
      const calculatedMakingAmount =
        await contracts.uniswapCalculator.getMakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          takingAmount,
          makingAmount,
          blobData
        );

      // Should be greater than 0 and affected by spread
      // With 1:1.5 ratio and -5% spread, 15 WETH should give 10 DAI * 0.95 = 9.5 DAI
      const expectedAmount = (makingAmount * 95n) / 100n; // 9.5 DAI
      expect(calculatedMakingAmount).to.be.closeTo(
        expectedAmount,
        (expectedAmount * 3n) / 10000n // 0.03% fee
      );
    });

    it('should calculate taker amount with spread increase', async function () {
      const { taker, maker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '10',
        takingAmount: '15',
        fee: 3000,
        spread: '1050000000', // +5% spread
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createUniswapCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        fee: setup.fee,
        spread: setup.spread,
      });

      // Test getTakingAmount
      const makingAmount = setup.makerAsset.parseAmount(setup.makingAmount);
      const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
      const calculatedTakingAmount =
        await contracts.uniswapCalculator.getTakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          makingAmount,
          makingAmount,
          blobData
        );

      // Should be greater than 0 and affected by spread
      // With 1:1.5 ratio and +5% spread, 1000 DAI should give ~1500 WETH * 1.05 = ~1575 WETH
      // const expectedBaseAmount = (makingAmount * 3n) / 2n; // 1000 DAI -> 1500 WETH
      const expectedAmount = (takingAmount * 105n) / 100n; // Apply +5% spread
      expect(calculatedTakingAmount).to.be.closeTo(
        expectedAmount,
        (expectedAmount * 3n) / 10000n // 0.03% fee
      );
    });

    it('should handle same token scenario', async function () {
      const { taker, maker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.dai, // Same token
        makingAmount: '1000',
        takingAmount: '1000',
        fee: 3000,
        spread: '1000000000', // No spread
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, blobData } = await createUniswapCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        fee: setup.fee,
        spread: setup.spread,
      });

      const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
      const makingAmount = await contracts.uniswapCalculator.getMakingAmount(
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

    it('should handle different fee tiers', async function () {
      const { taker, maker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const feeTiers = [500, 3000, 10000];
      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1000000000', // No spread for clarity
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      // Set different prices for different fee tiers in the mock pools
      const daiAddress = setup.makerAsset.address;
      const wethAddress = setup.takerAsset.address;

      // Get pool addresses and set different prices
      const pool500 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        500
      );
      const pool3000 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        3000
      );
      const pool10000 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        10000
      );

      // Set different sqrt prices to simulate different rates
      // Base rate: 1:1.5 (1 DAI = 1.5 WETH)
      const sqrtPrice1_5 = '9701425004654631687172431560419';
      // Slightly worse rate: 1:1.45 (1 DAI = 1.45 WETH)
      const sqrtPrice1_45 = '9557425004654631687172431560419';
      // Worse rate: 1:1.4 (1 DAI = 1.4 WETH)
      const sqrtPrice1_4 = '9413425004654631687172431560419';

      const MockUniswapPool = await ethers.getContractFactory(
        'MockUniswapPool'
      );
      await MockUniswapPool.attach(pool500).setSqrtPriceX96(sqrtPrice1_5); // Best rate: 1:1.5
      await MockUniswapPool.attach(pool3000).setSqrtPriceX96(sqrtPrice1_45); // Medium rate: 1:1.45
      await MockUniswapPool.attach(pool10000).setSqrtPriceX96(sqrtPrice1_4); // Worst rate: 1:1.4

      const results = [];
      for (const fee of feeTiers) {
        const { order, blobData } = await createUniswapCalculatorOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          fee: fee,
          spread: setup.spread,
        });

        const takingAmount = setup.takerAsset.parseAmount(setup.takingAmount);
        const makingAmount = await contracts.uniswapCalculator.getMakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          takingAmount,
          setup.makerAsset.parseAmount(setup.makingAmount),
          blobData
        );

        results.push({ fee, makingAmount: makingAmount.toString() });
      }

      // Convert to BigInt for comparison
      const result0 = BigInt(results[0].makingAmount);
      const result1 = BigInt(results[1].makingAmount);
      const result2 = BigInt(results[2].makingAmount);

      // Worse rates (1:1.4 > 1:1.45 > 1:1.5) result in higher making amounts (more DAI for same WETH)
      // With getMakingAmount: WETH -> DAI, worse rates mean more DAI received
      expect(result2).to.be.gte(result1);
      expect(result1).to.be.gte(result0);
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
        contracts.uniswapCalculator.getMakingAmount(
          order,
          '0x',
          ethers.ZeroHash,
          taker.address,
          tokens.weth.parseAmount('0.5'),
          tokens.dai.parseAmount('1000'),
          invalidBlobData
        )
      ).to.be.revertedWithCustomError(
        contracts.uniswapCalculator,
        'InvalidBlobLength'
      );
    });

    it('should revert with InvalidFeeTier for unsupported fee', async function () {
      const { taker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      // Create blob data with invalid fee tier manually
      const invalidFeeHex = '001388'; // 5000 (invalid fee tier)
      const spreadHex = BigInt('1000000000').toString(16).padStart(64, '0');
      const invalidBlobData = '0x' + invalidFeeHex + spreadHex;

      const order = buildOrder({
        makerAsset: tokens.dai.address,
        takerAsset: tokens.weth.address,
        makingAmount: tokens.dai.parseAmount('1000'),
        takingAmount: tokens.weth.parseAmount('0.5'),
        maker: taker.address,
      });

      await expect(
        contracts.uniswapCalculator.getMakingAmount(
          order,
          '0x',
          ethers.ZeroHash,
          taker.address,
          tokens.weth.parseAmount('0.5'),
          tokens.dai.parseAmount('1000'),
          invalidBlobData
        )
      ).to.be.revertedWithCustomError(
        contracts.uniswapCalculator,
        'InvalidFeeTier'
      );
    });

    it('should revert with ZeroAmount for zero taking amount', async function () {
      const { taker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const { order, blobData } = await createUniswapCalculatorOrder({
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        fee: 3000,
        spread: '1000000000',
      });

      await expect(
        contracts.uniswapCalculator.getMakingAmount(
          order,
          order.extension,
          ethers.ZeroHash,
          taker.address,
          0, // Zero amount
          tokens.dai.parseAmount('1000'),
          blobData
        )
      ).to.be.revertedWithCustomError(
        contracts.uniswapCalculator,
        'ZeroAmount'
      );
    });

    it('should revert with PoolNotFound when pool does not exist', async function () {
      const { taker, tokens, contracts, createUniswapCalculatorOrder } =
        await loadFixture(deployContractsAndInit);

      const { order, blobData } = await createUniswapCalculatorOrder({
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        fee: 3000,
        spread: '1000000000',
      });

      // Remove the pool to simulate price discovery failure
      const daiAddress = tokens.dai.address;
      const wethAddress = tokens.weth.address;

      // Create a pool that doesn't exist (use DAI/USDC pair which wasn't created)
      const { order: invalidOrder, blobData: invalidBlobData } =
        await createUniswapCalculatorOrder({
          makerAsset: tokens.dai,
          takerAsset: tokens.usdc, // Using USDC instead of WETH
          makingAmount: '1000',
          takingAmount: '0.5',
          fee: 3000, // Valid fee tier, but no DAI/USDC pool exists
          spread: '1000000000',
        });

      await expect(
        contracts.uniswapCalculator.getMakingAmount(
          invalidOrder,
          invalidOrder.extension,
          ethers.ZeroHash,
          taker.address,
          tokens.weth.parseAmount('0.5'),
          tokens.dai.parseAmount('1000'),
          invalidBlobData
        )
      ).to.be.revertedWithCustomError(
        contracts.uniswapCalculator,
        'PoolNotFound'
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
        createUniswapCalculatorOrder,
        executeOrderFill,
      } = await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        fee: 3000,
        spread: '1000000000', // No spread for simplicity
      };

      await setup.makerAsset.mint(maker, setup.makingAmount);
      await setup.makerAsset.approve(maker, contracts.swap, setup.makingAmount);
      await setup.takerAsset.mint(taker, setup.takingAmount);
      await setup.takerAsset.approve(taker, contracts.swap, setup.takingAmount);

      const { order, r, vs } = await createUniswapCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        fee: setup.fee,
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

    it('should execute order with standard fee tier', async function () {
      const {
        taker,
        maker,
        tokens,
        contracts,
        createUniswapCalculatorOrder,
        executeOrderFill,
      } = await loadFixture(deployContractsAndInit);

      const setup = {
        makerAsset: tokens.dai,
        takerAsset: tokens.weth,
        makingAmount: '1000',
        takingAmount: '0.5',
        spread: '1000000000', // No spread
      };

      await setup.makerAsset.mint(maker, '10000'); // Mint more for multiple orders
      await setup.makerAsset.approve(maker, contracts.swap, '10000');
      await setup.takerAsset.mint(taker, '5'); // Mint more for multiple orders
      await setup.takerAsset.approve(taker, contracts.swap, '5');

      // Pools are already set up with consistent 1:1 rates in deployment

      // Test just one fee tier to avoid order collision issues
      const fee = 3000; // Standard fee tier

      const { order, r, vs } = await createUniswapCalculatorOrder({
        makerAsset: setup.makerAsset,
        takerAsset: setup.takerAsset,
        makingAmount: setup.makingAmount,
        takingAmount: setup.takingAmount,
        fee: fee,
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

      // Should execute successfully
      expect(fillTx).to.not.be.reverted;
    });
  });

  describe('Mock Factory Integration', function () {
    it('should handle pool creation and discovery correctly', async function () {
      const { contracts, tokens } = await loadFixture(deployContractsAndInit);

      // Test pool discovery for existing pools
      const daiAddress = tokens.dai.address;
      const wethAddress = tokens.weth.address;

      const pool500 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        500
      );
      const pool3000 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        3000
      );
      const pool10000 = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        10000
      );

      expect(pool500).to.not.equal(ethers.ZeroAddress);
      expect(pool3000).to.not.equal(ethers.ZeroAddress);
      expect(pool10000).to.not.equal(ethers.ZeroAddress);
    });

    it('should support pool price management in mock', async function () {
      const { contracts, tokens } = await loadFixture(deployContractsAndInit);

      const daiAddress = tokens.dai.address;
      const wethAddress = tokens.weth.address;

      // Enable a custom fee tier first
      await contracts.factory.enableFeeAmount(200, 20); // Enable 200 (0.02%) fee tier

      // Create new pool with custom price
      const tx = await contracts.factory.createPoolWithPrice(
        daiAddress,
        wethAddress,
        200, // Custom fee tier (0.02%)
        '9701425004654631687172431560419' // 1:1.5 price
      );
      await tx.wait();

      // Verify pool was created
      const poolAddress = await contracts.factory.getPool(
        daiAddress,
        wethAddress,
        200
      );
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
    });
  });
});
