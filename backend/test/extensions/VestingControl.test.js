const { ethers } = require('hardhat');
const { expect } = require('chai');
const {
  loadFixture,
  time,
} = require('@nomicfoundation/hardhat-network-helpers');
const { buildOrder } = require('../helpers/order');
const { ether } = require('../helpers/utils');

const DEFAULT_VESTING_AMOUNT = ether('1000');
const VESTING_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
const TOTAL_PERIODS = 9; // 9 monthly unlocks
const CLIFF_DURATION = 90 * 24 * 60 * 60; // 90 days cliff (added to startTime)

async function deployVestingControlFixture() {
  const [deployer, founder, investor] = await ethers.getSigners();

  // Deploy VestingControl
  const VestingControl = await ethers.getContractFactory('VestingControl');
  const vestingControl = await VestingControl.deploy();

  // Deploy mock ERC20 tokens
  const TokenMock = await ethers.getContractFactory('TokenMock');
  const projectToken = await TokenMock.deploy('ProjectToken', 'PT');
  const paymentToken = await TokenMock.deploy('PaymentToken', 'PAY');

  return {
    vestingControl,
    projectToken,
    paymentToken,
    deployer,
    founder,
    investor,
  };
}

describe('VestingControl', function () {
  describe('Deployment', function () {
    it('should deploy successfully', async function () {
      const { vestingControl } = await loadFixture(deployVestingControlFixture);
      expect(await vestingControl.getAddress()).to.be.properAddress;
    });
  });

  describe('Parameter Encoding/Decoding', function () {
    it('should encode and decode vesting parameters correctly', async function () {
      const { vestingControl } = await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();
      const startTimeAfterCliff = startTime + CLIFF_DURATION;

      // Encode parameters manually (as would be done in frontend)
      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTimeAfterCliff]
      );

      // Decode and verify
      const decoded = await vestingControl.decodeVestingParams(vestingParams);
      expect(decoded.vestingPeriod).to.equal(VESTING_PERIOD);
      expect(decoded.totalPeriods).to.equal(TOTAL_PERIODS);
      expect(decoded.startTime).to.equal(startTimeAfterCliff);
    });
  });

  describe('PreInteraction Validation', function () {
    async function createMockOrder(
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      maker
    ) {
      return buildOrder({
        makerAsset: makerAsset,
        takerAsset: takerAsset,
        makingAmount: makingAmount,
        takingAmount: takingAmount,
        maker: maker,
      });
    }

    it('should revert when vesting has not started', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const futureTime = (await time.latest()) + 3600; // 1 hour in future

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, futureTime]
      );

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      await expect(
        vestingControl.preInteraction(
          order,
          '0x',
          ethers.ZeroHash,
          investor.address,
          ether('100'),
          ether('10'),
          DEFAULT_VESTING_AMOUNT,
          vestingParams
        )
      ).to.be.revertedWithCustomError(vestingControl, 'VestingNotStarted');
    });

    it('should allow valid fill after start time', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      // Fast forward past start time
      await time.increaseTo(startTime + VESTING_PERIOD + 1);

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      const amountPerPeriod = DEFAULT_VESTING_AMOUNT / BigInt(TOTAL_PERIODS);

      // This should not revert
      await vestingControl.preInteraction(
        order,
        '0x',
        ethers.ZeroHash,
        investor.address,
        amountPerPeriod,
        ether('10'),
        DEFAULT_VESTING_AMOUNT,
        vestingParams
      );
    });

    it('should revert when trying to fill more than one period', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      // Fast forward past start time
      await time.increaseTo(startTime + VESTING_PERIOD + 1);

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      const amountPerPeriod = DEFAULT_VESTING_AMOUNT / BigInt(TOTAL_PERIODS);
      const tooLargeAmount = amountPerPeriod + ether('1');

      await expect(
        vestingControl.preInteraction(
          order,
          '0x',
          ethers.ZeroHash,
          investor.address,
          tooLargeAmount,
          ether('10'),
          DEFAULT_VESTING_AMOUNT,
          vestingParams
        )
      ).to.be.revertedWithCustomError(vestingControl, 'InvalidUnlockAmount');
    });

    it('should revert with invalid vesting parameters', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      // Invalid parameters: 0 periods
      const invalidParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, 0, startTime] // 0 periods is invalid
      );

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      await expect(
        vestingControl.preInteraction(
          order,
          '0x',
          ethers.ZeroHash,
          investor.address,
          ether('100'),
          ether('10'),
          DEFAULT_VESTING_AMOUNT,
          invalidParams
        )
      ).to.be.revertedWithCustomError(
        vestingControl,
        'InvalidVestingParameters'
      );

      // Invalid parameters: 0 vesting period
      const invalidParams2 = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [0, TOTAL_PERIODS, startTime] // 0 vesting period is invalid
      );

      await expect(
        vestingControl.preInteraction(
          order,
          '0x',
          ethers.ZeroHash,
          investor.address,
          ether('100'),
          ether('10'),
          DEFAULT_VESTING_AMOUNT,
          invalidParams2
        )
      ).to.be.revertedWithCustomError(
        vestingControl,
        'InvalidVestingParameters'
      );
    });

    it('should revert when vesting is already completed', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      await expect(
        vestingControl.preInteraction(
          order,
          '0x',
          ethers.ZeroHash,
          investor.address,
          ether('100'),
          ether('10'),
          0, // 0 remaining = already completed
          vestingParams
        )
      ).to.be.revertedWithCustomError(
        vestingControl,
        'VestingAlreadyCompleted'
      );
    });
  });

  describe('PreInteraction Events', function () {
    it('should emit VestingUnlock event on successful validation', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      const amountPerPeriod = DEFAULT_VESTING_AMOUNT / BigInt(TOTAL_PERIODS);

      const tx = await vestingControl.preInteraction(
        order,
        '0x',
        ethers.ZeroHash,
        investor.address,
        amountPerPeriod,
        ether('10'),
        DEFAULT_VESTING_AMOUNT,
        vestingParams
      );

      const receipt = await tx.wait();
      const vestingControlAddress = await vestingControl.getAddress();
      const events = receipt.logs.filter(
        (log) => log.address === vestingControlAddress
      );

      expect(events).to.have.lengthOf(1);
      const decodedEvent = vestingControl.interface.parseLog(events[0]);
      expect(decodedEvent.name).to.equal('VestingUnlock');
      expect(decodedEvent.args[0]).to.equal(investor.address); // taker
      expect(decodedEvent.args[1]).to.equal(amountPerPeriod); // amount
      expect(decodedEvent.args[2]).to.equal(1); // period
      // Skip timestamp check (args[3]) due to mining timing variability
    });

    it('should calculate correct period number', async function () {
      const { vestingControl, projectToken, paymentToken, founder, investor } =
        await loadFixture(deployVestingControlFixture);

      const startTime = await time.latest();

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      // Fast forward to third period
      await time.increaseTo(startTime + 2 * VESTING_PERIOD + 1);

      const order = await createMockOrder(
        projectToken.target,
        paymentToken.target,
        DEFAULT_VESTING_AMOUNT,
        ether('100'),
        founder.address
      );

      const amountPerPeriod = DEFAULT_VESTING_AMOUNT / BigInt(TOTAL_PERIODS);

      const tx = await vestingControl.preInteraction(
        order,
        '0x',
        ethers.ZeroHash,
        investor.address,
        amountPerPeriod,
        ether('10'),
        DEFAULT_VESTING_AMOUNT - amountPerPeriod * 2n,
        vestingParams
      );

      const receipt = await tx.wait();
      const vestingControlAddress = await vestingControl.getAddress();
      const events = receipt.logs.filter(
        (log) => log.address === vestingControlAddress
      );

      expect(events).to.have.lengthOf(1);
      const decodedEvent = vestingControl.interface.parseLog(events[0]);
      expect(decodedEvent.name).to.equal('VestingUnlock');
      expect(decodedEvent.args[0]).to.equal(investor.address); // taker
      expect(decodedEvent.args[1]).to.equal(amountPerPeriod); // amount
      expect(decodedEvent.args[2]).to.equal(3); // period (should be period 3)
      // Skip timestamp check (args[3]) due to mining timing variability
    });
  });

  async function createMockOrder(
    makerAsset,
    takerAsset,
    makingAmount,
    takingAmount,
    maker
  ) {
    return buildOrder({
      makerAsset: makerAsset,
      takerAsset: takerAsset,
      makingAmount: makingAmount,
      takingAmount: takingAmount,
      maker: maker,
    });
  }
});
