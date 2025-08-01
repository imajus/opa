const { expect } = require('chai');
const { ethers } = require('hardhat');
const { buildOrder } = require('../helpers/order');

describe('OneInchCalculator', function () {
  let oneInchCalculator;
  let mockAggregationRouter;
  let tokenMock1;
  let tokenMock2;
  let owner;
  let user1;
  let user2;

  const SPREAD_DENOMINATOR = ethers.parseUnits('1', 9); // 1e9
  const DEFAULT_SPREAD = ethers.parseUnits('1', 9); // 1:1 ratio (no spread)

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const TokenMock = await ethers.getContractFactory('TokenMock');
    tokenMock1 = await TokenMock.deploy('Token1', 'TK1');
    tokenMock2 = await TokenMock.deploy('Token2', 'TK2');

    // Deploy mock aggregation router
    const MockAggregationRouter = await ethers.getContractFactory(
      'MockAggregationRouter'
    );
    mockAggregationRouter = await MockAggregationRouter.deploy();

    // Deploy OneInchCalculator
    const OneInchCalculator = await ethers.getContractFactory(
      'OneInchCalculator'
    );
    oneInchCalculator = await OneInchCalculator.deploy(
      await mockAggregationRouter.getAddress()
    );
  });

  describe('Deployment', function () {
    it('Should set the correct aggregation router address', async function () {
      const routerAddress = await oneInchCalculator.aggregationRouter();
      expect(routerAddress).to.equal(await mockAggregationRouter.getAddress());
    });

    it('Should revert if aggregation router is zero address', async function () {
      const OneInchCalculator = await ethers.getContractFactory(
        'OneInchCalculator'
      );
      await expect(
        OneInchCalculator.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith('OneInchCalculator: invalid router');
    });
  });

  describe('Blob encoding/decoding', function () {
    it('Should correctly encode and decode blob data', async function () {
      const makerToken = await tokenMock1.getAddress();
      const takerToken = await tokenMock2.getAddress();
      const spread = ethers.parseUnits('1.05', 9); // 5% spread
      const flags = 0x00; // Normal calculation

      // Encode blob: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
      const blob = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(flags), 1),
        ethers.zeroPadValue(makerToken, 20),
        ethers.zeroPadValue(takerToken, 20),
        ethers.zeroPadValue(ethers.toBeHex(spread), 32),
      ]);

      // The blob should be 73 bytes: 1 + 20 + 20 + 32
      expect(ethers.getBytes(blob).length).to.equal(73);
    });

    it('Should revert with invalid blob length', async function () {
      const invalidBlob = ethers.randomBytes(50); // Wrong length
      const amount = ethers.parseEther('1');

      await expect(
        oneInchCalculator.getMakingAmount(
          await createMockOrder(),
          '0x',
          ethers.randomBytes(32),
          user1.address,
          amount,
          amount,
          invalidBlob
        )
      ).to.be.revertedWithCustomError(oneInchCalculator, 'InvalidBlobLength');
    });
  });

  describe('getMakingAmount', function () {
    it('Should calculate making amount with 1:1 ratio', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      // Mock 1inch to return 1:1 ratio (10000 basis points = 1:1)
      await mockAggregationRouter.setExchangeRate(10000);

      const result = await oneInchCalculator.getMakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      expect(result).to.equal(amount);
    });

    it('Should calculate making amount with spread', async function () {
      const amount = ethers.parseEther('1');
      const spread = ethers.parseUnits('1.1', 9); // 10% spread
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        spread,
        0x00
      );

      // Mock 1inch to return 1:1 ratio (10000 basis points = 1:1)
      await mockAggregationRouter.setExchangeRate(10000);

      const result = await oneInchCalculator.getMakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      // Expected: amount * spread / SPREAD_DENOMINATOR
      const expected = (amount * spread) / SPREAD_DENOMINATOR;
      expect(result).to.equal(expected);
    });

    it('Should handle inverse calculation', async function () {
      const amount = ethers.parseEther('1');
      const spread = ethers.parseUnits('1.1', 9); // 10% spread
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        spread,
        0x80
      ); // Inverse flag

      // Mock 1inch to return 1:1 ratio (10000 basis points = 1:1)
      await mockAggregationRouter.setExchangeRate(10000);

      const result = await oneInchCalculator.getMakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      // For inverse: (amount * SPREAD_DENOMINATOR) / (amount * spread / SPREAD_DENOMINATOR)
      const spreadedAmount = (amount * spread) / SPREAD_DENOMINATOR;
      const expected = (amount * SPREAD_DENOMINATOR) / spreadedAmount;
      expect(result).to.equal(expected);
    });

    it('Should handle same token case', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock1.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      const result = await oneInchCalculator.getMakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      expect(result).to.equal(amount);
    });

    it('Should revert with zero amount', async function () {
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      await expect(
        oneInchCalculator.getMakingAmount(
          await createMockOrder(),
          '0x',
          ethers.randomBytes(32),
          user1.address,
          0,
          0,
          blob
        )
      ).to.be.revertedWithCustomError(oneInchCalculator, 'ZeroAmount');
    });

    it('Should revert when 1inch returns zero', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      // Mock 1inch to return 0 (exchange rate 0)
      await mockAggregationRouter.setExchangeRate(0);

      await expect(
        oneInchCalculator.getMakingAmount(
          await createMockOrder(),
          '0x',
          ethers.randomBytes(32),
          user1.address,
          amount,
          amount,
          blob
        )
      ).to.be.revertedWithCustomError(
        oneInchCalculator,
        'InsufficientLiquidity'
      );
    });

    it('Should revert when 1inch call fails', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      // Mock 1inch to revert
      await mockAggregationRouter.setShouldFailQuotes(true);

      await expect(
        oneInchCalculator.getMakingAmount(
          await createMockOrder(),
          '0x',
          ethers.randomBytes(32),
          user1.address,
          amount,
          amount,
          blob
        )
      ).to.be.revertedWithCustomError(
        oneInchCalculator,
        'PriceDiscoveryFailed'
      );
    });
  });

  describe('getTakingAmount', function () {
    it('Should calculate taking amount with 1:1 ratio', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      // Mock 1inch to return 1:1 ratio (10000 basis points = 1:1)
      await mockAggregationRouter.setExchangeRate(10000);

      const result = await oneInchCalculator.getTakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      expect(result).to.equal(amount);
    });

    it('Should calculate taking amount with spread', async function () {
      const amount = ethers.parseEther('1');
      const spread = ethers.parseUnits('0.95', 9); // 5% discount
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        spread,
        0x00
      );

      // Mock 1inch to return 1:1 ratio (10000 basis points = 1:1)
      await mockAggregationRouter.setExchangeRate(10000);

      const result = await oneInchCalculator.getTakingAmount(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      // Expected: amount * spread / SPREAD_DENOMINATOR
      const expected = (amount * spread) / SPREAD_DENOMINATOR;
      expect(result).to.equal(expected);
    });

    it('Should revert with zero amount', async function () {
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );

      await expect(
        oneInchCalculator.getTakingAmount(
          await createMockOrder(),
          '0x',
          ethers.randomBytes(32),
          user1.address,
          0,
          0,
          blob
        )
      ).to.be.revertedWithCustomError(oneInchCalculator, 'ZeroAmount');
    });
  });

  describe('Gas optimization', function () {
    it('Should use reasonable gas for getMakingAmount', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );
      await mockAggregationRouter.setExchangeRate(10000);

      const gasEstimate = await oneInchCalculator.getMakingAmount.estimateGas(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      expect(gasEstimate).to.be.lt(100000n); // Less than 100k gas
    });

    it('Should use reasonable gas for getTakingAmount', async function () {
      const amount = ethers.parseEther('1');
      const blob = createBlob(
        await tokenMock1.getAddress(),
        await tokenMock2.getAddress(),
        DEFAULT_SPREAD,
        0x00
      );
      await mockAggregationRouter.setExchangeRate(10000);

      const gasEstimate = await oneInchCalculator.getTakingAmount.estimateGas(
        await createMockOrder(),
        '0x',
        ethers.randomBytes(32),
        user1.address,
        amount,
        amount,
        blob
      );

      expect(gasEstimate).to.be.lt(100000n); // Less than 100k gas
    });
  });

  // Helper functions
  async function createMockOrder() {
    return buildOrder({
      maker: owner.address,
      makerAsset: await tokenMock1.getAddress(),
      takerAsset: await tokenMock2.getAddress(),
      makingAmount: ethers.parseEther('1'),
      takingAmount: ethers.parseEther('1'),
    });
  }

  function createBlob(makerToken, takerToken, spread, flags) {
    return ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(flags), 1),
      ethers.zeroPadValue(makerToken, 20),
      ethers.zeroPadValue(takerToken, 20),
      ethers.zeroPadValue(ethers.toBeHex(spread), 32),
    ]);
  }
});
