const { task } = require('hardhat/config');

// Utility functions for price extraction from sqrtPriceX96
function getPriceFromSqrtPriceX96(
  sqrtPriceX96,
  token0Decimals = 18,
  token1Decimals = 18
) {
  // sqrtPriceX96 = sqrt(price) * 2^96
  // price = (sqrtPriceX96 / 2^96)^2 * (10^token1Decimals / 10^token0Decimals)
  const Q96 = 2n ** 96n;
  const sqrtPrice = BigInt(sqrtPriceX96);

  // To avoid precision loss, we'll multiply by a large factor first
  const PRECISION_MULTIPLIER = 10n ** 18n;

  // Calculate: (sqrtPrice^2 * PRECISION_MULTIPLIER * 10^token1Decimals) / (Q96^2 * 10^token0Decimals)
  const numerator =
    sqrtPrice *
    sqrtPrice *
    PRECISION_MULTIPLIER *
    10n ** BigInt(token1Decimals);
  const denominator = Q96 * Q96 * 10n ** BigInt(token0Decimals);

  return numerator / denominator;
}

function formatPriceFromSlot0(price, token1Decimals = 18) {
  // Convert to human readable format
  // Note: price already includes PRECISION_MULTIPLIER (10^18)
  const priceNumber = Number(price) / 10 ** 18; // Remove PRECISION_MULTIPLIER
  return priceNumber;
}

function calculateTheoreticalAmount(
  inputAmount,
  price,
  token0Decimals = 18,
  token1Decimals = 18
) {
  // Calculate theoretical output amount based on slot0 price
  // Note: This doesn't account for fees or slippage
  // price includes PRECISION_MULTIPLIER, so we need to divide by it
  const PRECISION_MULTIPLIER = 10n ** 18n;
  return (BigInt(inputAmount) * price) / PRECISION_MULTIPLIER;
}

task('get-expected-return', 'Get market price from Uniswap V3 Pool slot0')
  .addParam('srctoken', 'Source token address')
  .addParam('dsttoken', 'Destination token address')
  .addParam('amount', 'Amount of source tokens (in wei)')
  .addOptionalParam('fee', 'Pool fee tier (500, 3000, 10000)', '3000')
  .addOptionalParam(
    'factory',
    'Uniswap V3 Factory address',
    '0x1F98431c8aD98523631AE4a59f267346ea31F984'
  )
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    console.log('🔍 Getting market price from Uniswap V3 Pool slot0...');
    console.log('━'.repeat(60));

    // Validate inputs
    if (!ethers.isAddress(taskArgs.srctoken)) {
      throw new Error(`Invalid source token address: ${taskArgs.srctoken}`);
    }
    if (!ethers.isAddress(taskArgs.dsttoken)) {
      throw new Error(
        `Invalid destination token address: ${taskArgs.dsttoken}`
      );
    }
    if (!ethers.isAddress(taskArgs.factory)) {
      throw new Error(`Invalid factory address: ${taskArgs.factory}`);
    }

    // Validate fee tier
    const validFees = ['500', '3000', '10000'];
    if (!validFees.includes(taskArgs.fee)) {
      throw new Error(
        `Invalid fee tier: ${taskArgs.fee}. Must be one of: ${validFees.join(
          ', '
        )}`
      );
    }

    // Define minimal interfaces inline (from @uniswap packages)
    const factoryAbi = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
    ];

    const poolAbi = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
    ];

    // Connect to contracts
    const factory = new ethers.Contract(
      taskArgs.factory,
      factoryAbi,
      ethers.provider
    );

    const amount = BigInt(taskArgs.amount);
    const fee = parseInt(taskArgs.fee);

    console.log('📊 Parameters:');
    console.log(`   Source Token:      ${taskArgs.srctoken}`);
    console.log(`   Destination Token: ${taskArgs.dsttoken}`);
    console.log(`   Amount:            ${amount.toString()} wei`);
    console.log(`   Fee Tier:          ${fee} (${fee / 10000}%)`);
    console.log(`   Factory:           ${taskArgs.factory}`);
    console.log();

    try {
      // Check if pool exists
      console.log('🔄 Finding Uniswap V3 pool...');
      const poolAddress = await factory.getPool(
        taskArgs.srctoken,
        taskArgs.dsttoken,
        fee
      );

      if (poolAddress === ethers.ZeroAddress) {
        throw new Error(
          `No Uniswap V3 pool found for this token pair with fee tier ${fee}`
        );
      }

      console.log(`   Pool Found:        ${poolAddress}`);

      // Get pool info and extract price from slot0
      console.log('\n🔍 Extracting price from Pool slot0()...');
      const pool = new ethers.Contract(poolAddress, poolAbi, ethers.provider);
      const [sqrtPriceX96, tick] = await pool.slot0();
      const token0 = await pool.token0();
      const token1 = await pool.token1();

      console.log(`   Token0 (address):  ${token0}`);
      console.log(`   Token1 (address):  ${token1}`);
      console.log(`   Source Token:      ${taskArgs.srctoken}`);
      console.log(`   Dest Token:        ${taskArgs.dsttoken}`);

      // Determine if we need to invert the price based on token ordering
      const isToken0ToToken1 =
        taskArgs.srctoken.toLowerCase() === token0.toLowerCase();
      console.log(
        `   Trading Direction: ${
          isToken0ToToken1 ? 'token0 → token1' : 'token1 → token0'
        }`
      );

      // Extract actual price from sqrtPriceX96
      let currentPrice = getPriceFromSqrtPriceX96(sqrtPriceX96);

      // slot0 price is always token1/token0, so if we're trading token1 → token0, we need to invert
      if (!isToken0ToToken1) {
        // We're trading token1 → token0, so we need the inverse price
        const PRECISION_MULTIPLIER = 10n ** 18n;
        currentPrice =
          (PRECISION_MULTIPLIER * PRECISION_MULTIPLIER) / currentPrice;
      }

      const humanPrice = formatPriceFromSlot0(currentPrice);

      // Calculate theoretical output amount (without fees/slippage)
      const theoreticalAmount = calculateTheoreticalAmount(
        amount,
        currentPrice
      );

      console.log(`   sqrtPriceX96:      ${sqrtPriceX96.toString()}`);
      console.log(`   Current Tick:      ${tick.toString()}`);
      console.log(`   Extracted Price:   ${currentPrice.toString()} (raw)`);
      console.log(
        `   Human Price:       ${humanPrice.toFixed(8)} (dst/src, adjusted)`
      );
      console.log(`   Theoretical Out:   ${theoreticalAmount.toString()} wei`);
      console.log(
        `   Theoretical Human: ${(Number(theoreticalAmount) / 1e18).toFixed(6)}`
      );
      console.log(
        `   Price Inverted:    ${
          !isToken0ToToken1 ? 'Yes' : 'No'
        } (for token ordering)`
      );

      if (!isToken0ToToken1) {
        const originalPrice = getPriceFromSqrtPriceX96(sqrtPriceX96);
        const originalHuman = formatPriceFromSlot0(originalPrice);
        console.log(
          `   Original slot0:    ${originalHuman.toFixed(8)} (token1/token0)`
        );
      }

      console.log('━'.repeat(60));
      console.log('✨ Task completed successfully!');

      return {
        // slot0 results
        sqrtPriceX96: sqrtPriceX96.toString(),
        currentPrice: currentPrice.toString(),
        humanPrice: humanPrice,
        theoreticalAmount: theoreticalAmount.toString(),
        tick: tick.toString(),
        token0: token0,
        token1: token1,
        isToken0ToToken1: isToken0ToToken1,
        priceInverted: !isToken0ToToken1,

        // General
        poolAddress: poolAddress,
        fee: fee,
        success: true,
      };
    } catch (error) {
      console.error('❌ Error getting market price from slot0:');
      console.error(`   ${error.message}`);

      if (
        error.message.includes('call revert exception') ||
        error.message.includes('No Uniswap V3 pool found')
      ) {
        console.error('💡 Possible causes:');
        console.error(
          '   - No Uniswap V3 pool exists for this token pair and fee tier'
        );
        console.error(
          '   - Try different fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)'
        );
        console.error('   - Invalid token addresses');
        console.error('   - Network connectivity issues');
        console.error('   - Factory contract address may be incorrect');
      }

      throw error;
    }
  });

module.exports = {};
