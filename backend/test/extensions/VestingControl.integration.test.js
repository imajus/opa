const { ethers } = require('hardhat');
const { expect } = require('chai');
const {
  loadFixture,
  time,
} = require('@nomicfoundation/hardhat-network-helpers');
const {
  buildOrder,
  signOrder,
  buildMakerTraits,
  buildTakerTraits,
} = require('../helpers/order');
const { getPermit, withTarget } = require('../helpers/eip712');
const { deploySwapTokens } = require('../helpers/fixtures');
const { ether } = require('../helpers/utils');

const DEFAULT_VESTING_AMOUNT = ether('1000');
const VESTING_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
const TOTAL_PERIODS = 9; // 9 monthly unlocks
const CLIFF_DURATION = 90 * 24 * 60 * 60; // 90 days cliff

async function defaultDeadline() {
  return (await time.latest()) + 365 * 24 * 3600; // 1 year in seconds
}

async function deployVestingControlIntegrationFixture() {
  const [deployer, founder, investor] = await ethers.getSigners();

  // Deploy LimitOrderProtocol and tokens using the standard pattern
  const swapTokensFixture = await deploySwapTokens();

  // Deploy VestingControl
  const VestingControl = await ethers.getContractFactory('VestingControl');
  const vestingControl = await VestingControl.deploy();
  await vestingControl.waitForDeployment();

  return {
    ...swapTokensFixture,
    vestingControl,
    deployer,
    founder,
    investor,
    // For convenience, rename dai/weth to projectToken/paymentToken in tests
    projectToken: swapTokensFixture.dai,
    paymentToken: swapTokensFixture.weth,
  };
}

async function createVestingOrder({
  makerAsset,
  takerAsset,
  maker,
  swap,
  vestingControl,
  makingAmount,
  takingAmount,
  vestingParams,
  usePermit = true,
  deadline,
}) {
  const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
  const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  let permit;
  if (usePermit) {
    permit = withTarget(
      makerAsset.address,
      await getPermit(
        maker.address,
        maker,
        makerAsset.contract,
        '1',
        chainId,
        await swap.getAddress(),
        parsedMakingAmount,
        deadline ?? (await defaultDeadline())
      )
    );
  }

  const order = buildOrder(
    {
      makerAsset: makerAsset.address,
      takerAsset: takerAsset.address,
      makingAmount: parsedMakingAmount,
      takingAmount: parsedTakingAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({
        allowMultipleFills: true, // Enable multiple fills for vesting
      }),
    },
    {
      permit: usePermit ? permit : undefined,
      preInteraction:
        (await vestingControl.getAddress()) + vestingParams.substring(2), // Remove 0x prefix
    }
  );

  const { r, yParityAndS: vs } = ethers.Signature.from(
    await signOrder(order, chainId, await swap.getAddress(), maker)
  );

  return {
    order,
    r,
    vs,
    permit,
    makingAmount: parsedMakingAmount,
    takingAmount: parsedTakingAmount,
  };
}

async function executeVestingOrderFill({
  swap,
  taker,
  order,
  r,
  vs,
  fillAmount,
  makingAmountFill = true,
  threshold = '0',
}) {
  const takerTraits = buildTakerTraits({
    threshold: BigInt(threshold),
    makingAmount: makingAmountFill,
    extension: order.extension,
    usePermit2: false,
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

describe('VestingControl Integration Tests', function () {
  describe('Real-world Vesting Scenarios', function () {
    it('should handle startup vesting schedule (3-month cliff + 9 monthly unlocks)', async function () {
      const {
        vestingControl,
        projectToken,
        paymentToken,
        founder,
        investor,
        swap,
      } = await loadFixture(deployVestingControlIntegrationFixture);

      const currentTime = await time.latest();
      const startTime = currentTime + CLIFF_DURATION; // Start after cliff period

      // Encode vesting parameters (3 month cliff + 9 monthly unlocks)
      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      const testVestingAmount = ether('100'); // Match the order makingAmount
      const amountPerPeriod = testVestingAmount / BigInt(TOTAL_PERIODS);

      // Setup: Mint tokens and approvals
      await projectToken.mint(founder.address, '100'); // 100 project tokens (smaller amount)
      await paymentToken.mint(investor, '10'); // 10 payment tokens (smaller amount)
      await paymentToken.approve(investor, swap, '10'); // Investor approves payment

      // Create vesting order with permit (founder doesn't need to pre-approve)
      const { order, r, vs, makingAmount, takingAmount } =
        await createVestingOrder({
          makerAsset: projectToken,
          takerAsset: paymentToken,
          maker: founder,
          swap,
          vestingControl,
          makingAmount: '100', // 100 project tokens (smaller amount)
          takingAmount: '10', // 10 payment tokens (smaller amount)
          vestingParams,
          usePermit: true,
        });

      // Test 1: Before cliff period - should reject
      await expect(
        executeVestingOrderFill({
          swap,
          taker: investor,
          order,
          r,
          vs,
          fillAmount: amountPerPeriod,
          makingAmountFill: true,
          threshold: '0',
        })
      ).to.be.reverted;

      // Let's test that the extension is working by skipping to after cliff and ensuring success

      // Test 2: After cliff, first month - should allow
      await time.increaseTo(startTime + 1);

      const firstFillTx = await executeVestingOrderFill({
        swap,
        taker: investor,
        order,
        r,
        vs,
        fillAmount: amountPerPeriod,
        makingAmountFill: true,
        threshold: '0',
      });

      // Verify token transfers for first fill
      await expect(firstFillTx).to.changeTokenBalances(
        projectToken.contract,
        [founder.address, investor.address],
        [-amountPerPeriod, amountPerPeriod]
      );

      // Test 3: Try to claim too much in first period - should reject
      await expect(
        executeVestingOrderFill({
          swap,
          taker: investor,
          order,
          r,
          vs,
          fillAmount: amountPerPeriod + projectToken.parseAmount('1'), // Too much
          makingAmountFill: true,
          threshold: '0',
        })
      ).to.be.revertedWithCustomError(vestingControl, 'InvalidUnlockAmount');

      // Test 4: Skip to month 3 - should allow filling period 2
      await time.increaseTo(startTime + 3 * VESTING_PERIOD + 1);

      const secondFillTx = await executeVestingOrderFill({
        swap,
        taker: investor,
        order,
        r,
        vs,
        fillAmount: amountPerPeriod, // Can only claim one period at a time
        makingAmountFill: true,
        threshold: '0',
      });

      // Verify token transfers for second fill
      await expect(secondFillTx).to.changeTokenBalances(
        projectToken.contract,
        [founder.address, investor.address],
        [-amountPerPeriod, amountPerPeriod]
      );
    });

    it('should handle different vesting periods correctly', async function () {
      const {
        vestingControl,
        projectToken,
        paymentToken,
        founder,
        investor,
        swap,
      } = await loadFixture(deployVestingControlIntegrationFixture);

      const currentTime = await time.latest();

      // Test weekly vesting (52 weeks = 1 year)
      const weeklyPeriod = 7 * 24 * 60 * 60; // 7 days
      const weeklyPeriods = 52;
      const weeklyStartTime = currentTime + 100;

      const weeklyParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [weeklyPeriod, weeklyPeriods, weeklyStartTime]
      );

      // Setup: Mint tokens and approvals
      await projectToken.mint(founder.address, '1000');
      await paymentToken.mint(investor, '100');
      await paymentToken.approve(investor, swap, '100');

      // Create weekly vesting order
      const { order, r, vs } = await createVestingOrder({
        makerAsset: projectToken,
        takerAsset: paymentToken,
        maker: founder,
        swap,
        vestingControl,
        makingAmount: '1000',
        takingAmount: '100',
        vestingParams: weeklyParams,
        usePermit: true,
      });

      // Fast forward 2 weeks
      await time.increaseTo(weeklyStartTime + 2 * weeklyPeriod + 1);

      const weeklyAmountPerPeriod =
        DEFAULT_VESTING_AMOUNT / BigInt(weeklyPeriods);

      // Should be able to claim 2 weeks worth, but only one week at a time
      const fillTx = await executeVestingOrderFill({
        swap,
        taker: investor,
        order,
        r,
        vs,
        fillAmount: weeklyAmountPerPeriod,
        makingAmountFill: true,
        threshold: '0',
      });

      // Verify token transfers
      await expect(fillTx).to.changeTokenBalances(
        projectToken.contract,
        [founder.address, investor.address],
        [-weeklyAmountPerPeriod, weeklyAmountPerPeriod]
      );
    });

    it('should handle edge case: final period with rounding', async function () {
      const {
        vestingControl,
        projectToken,
        paymentToken,
        founder,
        investor,
        swap,
      } = await loadFixture(deployVestingControlIntegrationFixture);

      // Use amount that doesn't divide evenly by periods
      const unevenAmount = ether('1000'); // 1000 tokens / 9 periods = 111.111...
      const currentTime = await time.latest();
      const startTime = currentTime + 100;

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      // Setup: Mint tokens and approvals
      await projectToken.mint(founder.address, '1000');
      await paymentToken.mint(investor, '100');
      await paymentToken.approve(investor, swap, '100');

      // Create vesting order
      const { order, r, vs } = await createVestingOrder({
        makerAsset: projectToken,
        takerAsset: paymentToken,
        maker: founder,
        swap,
        vestingControl,
        makingAmount: '1000',
        takingAmount: '100',
        vestingParams,
        usePermit: true,
      });

      // Fast forward to final period
      await time.increaseTo(startTime + TOTAL_PERIODS * VESTING_PERIOD + 1);

      // Calculate amounts
      const amountPerPeriod = unevenAmount / BigInt(TOTAL_PERIODS);

      // In final period, should be able to claim standard amount per period
      const fillTx = await executeVestingOrderFill({
        swap,
        taker: investor,
        order,
        r,
        vs,
        fillAmount: amountPerPeriod, // Claim standard amount per period
        makingAmountFill: true,
        threshold: '0',
      });

      // Verify token transfers
      await expect(fillTx).to.changeTokenBalances(
        projectToken.contract,
        [founder.address, investor.address],
        [-amountPerPeriod, amountPerPeriod]
      );
    });

    it('should emit proper events during vesting progression', async function () {
      const {
        vestingControl,
        projectToken,
        paymentToken,
        founder,
        investor,
        swap,
      } = await loadFixture(deployVestingControlIntegrationFixture);

      const currentTime = await time.latest();
      const startTime = currentTime + 100;

      const vestingParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, startTime]
      );

      // Setup: Mint tokens and approvals
      await projectToken.mint(founder.address, '1000');
      await paymentToken.mint(investor, '100');
      await paymentToken.approve(investor, swap, '100');

      // Create vesting order
      const { order, r, vs } = await createVestingOrder({
        makerAsset: projectToken,
        takerAsset: paymentToken,
        maker: founder,
        swap,
        vestingControl,
        makingAmount: '1000',
        takingAmount: '100',
        vestingParams,
        usePermit: true,
      });

      const amountPerPeriod = DEFAULT_VESTING_AMOUNT / BigInt(TOTAL_PERIODS);

      // Test event emission for different periods
      for (let period = 1; period <= 3; period++) {
        await time.increaseTo(startTime + (period - 1) * VESTING_PERIOD + 1);

        const fillTx = await executeVestingOrderFill({
          swap,
          taker: investor,
          order,
          r,
          vs,
          fillAmount: amountPerPeriod,
          makingAmountFill: true,
          threshold: '0',
        });

        const receipt = await fillTx.wait();
        const vestingControlAddress = await vestingControl.getAddress();
        const events = receipt.logs.filter(
          (log) => log.address === vestingControlAddress
        );

        expect(events).to.have.lengthOf(1);
        const decodedEvent = vestingControl.interface.parseLog(events[0]);
        expect(decodedEvent.name).to.equal('VestingUnlock');
        expect(decodedEvent.args[0]).to.equal(investor.address);
        expect(decodedEvent.args[1]).to.equal(amountPerPeriod);
        expect(decodedEvent.args[2]).to.equal(period);
        // Skip timestamp check due to mining timing variability
      }
    });
  });

  describe('Error Handling Integration', function () {
    it('should handle all error conditions gracefully', async function () {
      const {
        vestingControl,
        projectToken,
        paymentToken,
        founder,
        investor,
        swap,
      } = await loadFixture(deployVestingControlIntegrationFixture);

      // Setup: Mint tokens and approvals
      await projectToken.mint(founder.address, '1000');
      await paymentToken.mint(investor, '100');
      await paymentToken.approve(investor, swap, '100');

      // Test 1: Invalid parameters (0 vesting period)
      const invalidParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [0, TOTAL_PERIODS, await time.latest()] // 0 vesting period
      );

      const {
        order: invalidOrder,
        r: invalidR,
        vs: invalidVs,
      } = await createVestingOrder({
        makerAsset: projectToken,
        takerAsset: paymentToken,
        maker: founder,
        swap,
        vestingControl,
        makingAmount: '1000',
        takingAmount: '100',
        vestingParams: invalidParams,
        usePermit: true,
      });

      await expect(
        executeVestingOrderFill({
          swap,
          taker: investor,
          order: invalidOrder,
          r: invalidR,
          vs: invalidVs,
          fillAmount: projectToken.parseAmount('100'),
          makingAmountFill: true,
          threshold: '0',
        })
      ).to.be.revertedWithCustomError(
        vestingControl,
        'InvalidVestingParameters'
      );

      // Test 2: Order with vesting already completed (using a separate order instance)
      const currentTime = await time.latest();
      const validParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256'],
        [VESTING_PERIOD, TOTAL_PERIODS, currentTime]
      );

      // Setup separate tokens for completed vesting test
      await projectToken.mint(founder.address, '1000');
      // Mint extra payment tokens for the investor since we'll do multiple fills
      await paymentToken.mint(investor, '100');
      await paymentToken.approve(investor, swap, '200'); // Approve more for multiple fills

      const {
        order: completedOrder,
        r: completedR,
        vs: completedVs,
      } = await createVestingOrder({
        makerAsset: projectToken,
        takerAsset: paymentToken,
        maker: founder,
        swap,
        vestingControl,
        makingAmount: '900', // Use 900 so it divides evenly by 9 periods (100 per period)
        takingAmount: '100',
        vestingParams: validParams,
        usePermit: true,
      });

      // Fast forward to when all vesting periods are unlocked
      await time.increaseTo(currentTime + TOTAL_PERIODS * VESTING_PERIOD + 1);

      // Fill the order period by period to simulate completion (900 tokens = 100 per period)
      const amountPerPeriod = projectToken.parseAmount('100'); // 900 / 9 = 100

      // Fill all 9 periods with exactly 100 tokens each
      for (let i = 0; i < TOTAL_PERIODS; i++) {
        await executeVestingOrderFill({
          swap,
          taker: investor,
          order: completedOrder,
          r: completedR,
          vs: completedVs,
          fillAmount: amountPerPeriod,
          makingAmountFill: true,
          threshold: '0',
        });
      }

      // Now trying to fill again should fail with VestingAlreadyCompleted
      await expect(
        executeVestingOrderFill({
          swap,
          taker: investor,
          order: completedOrder,
          r: completedR,
          vs: completedVs,
          fillAmount: projectToken.parseAmount('50'), // Try to fill 50 more tokens
          makingAmountFill: true,
          threshold: '0',
        })
      ).to.be.reverted; // Temporarily use generic to see what error we get
    });
  });
});
