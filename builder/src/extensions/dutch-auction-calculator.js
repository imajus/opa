import { z } from 'zod';
import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper } from './utils/factory.js';
import { uint256, timestamp } from '../schemas/common.js';
import { HookType } from '../constants.js';
import { config } from '../config.js';

/**
 * Dutch Auction Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Implements price decay over time from max to min, commonly used in Dutch auctions
 * Price decreases linearly from start price to end price over the auction duration
 */

/**
 * Schema for Dutch Auction configuration
 */
const DutchAuctionConfigSchema = z.object({
  startTime: timestamp.describe('Auction start timestamp (Unix timestamp)'),
  endTime: timestamp.describe('Auction end timestamp (Unix timestamp)'),
  startAmount: uint256.describe(
    'Starting taker amount (highest price for taker)'
  ),
  endAmount: uint256.describe('Ending taker amount (lowest price for taker)'),
});

/**
 * Encodes extraData for Dutch Auction Calculator
 * @param {Object} config - Dutch auction configuration
 * @returns {string} ABI-encoded extraData
 */
function encodeDutchAuctionExtraData(config) {
  const { startTime, endTime, startAmount, endAmount } = config;
  // Pack start and end time into single uint256 (start in high 128 bits, end in low 128 bits)
  const startTimeBigInt = BigInt(startTime);
  const endTimeBigInt = BigInt(endTime);
  const startTimeEndTime = (startTimeBigInt << 128n) | endTimeBigInt;
  // Convert amounts to BigInt
  const startAmountBigInt = BigInt(startAmount);
  const endAmountBigInt = BigInt(endAmount);
  // ABI encode the three uint256 values
  const startTimeEndTimeHex = startTimeEndTime.toString(16).padStart(64, '0');
  const startAmountHex = startAmountBigInt.toString(16).padStart(64, '0');
  const endAmountHex = endAmountBigInt.toString(16).padStart(64, '0');
  return '0x' + startTimeEndTimeHex + startAmountHex + endAmountHex;
}

/**
 * Dutch Auction Calculator extension wrapper
 * Provides time-based price decay for limit orders
 */
const dutchAuctionCalculatorWrapper = createWrapper({
  name: 'Dutch Auction Calculator',
  description:
    'Time-based price decay from start price to end price, implementing Dutch auction mechanics',
  hooks: {
    [HookType.MAKER_AMOUNT]: DutchAuctionConfigSchema.describe(
      'Dutch auction configuration for maker amount calculation'
    ),
    [HookType.TAKER_AMOUNT]: z
      .undefined()
      .describe(
        'Maker amount configuration is used for taker amount calculation'
      ),
  },
  /**
   * Build function that creates an Extension instance for Dutch Auction Calculator
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const { address } = config.extensions.dutchAuctionCalculator;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    const amountConfig = params[HookType.MAKER_AMOUNT];
    // Validate auction parameters
    if (amountConfig.startTime >= amountConfig.endTime) {
      throw new Error('Auction start time must be before end time');
    }
    if (BigInt(amountConfig.startAmount) <= BigInt(amountConfig.endAmount)) {
      throw new Error(
        'Start amount must be greater than end amount for price decay'
      );
    }
    // Set making amount calculation
    const extraData = encodeDutchAuctionExtraData(amountConfig);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default dutchAuctionCalculatorWrapper;
