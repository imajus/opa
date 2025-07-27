import { z } from 'zod';
import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper } from './utils/factory.js';
import { uint256 } from '../schemas/common.js';
import { HookType } from '../constants.js';

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Range Amount Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Implements range limit orders where price changes linearly within a specified range
 * as the order gets filled. Price starts at priceStart and increases to priceEnd.
 * Formula: price = ((priceEnd - priceStart) / totalAmount) * filledAmount + priceStart
 */

/**
 * Schema for Range Amount Calculator configuration
 */
const RangeAmountConfigSchema = z
  .object({
    priceStart: uint256.describe(
      'Starting price (lower bound) in taker asset units per maker asset unit'
    ),
    priceEnd: uint256.describe(
      'Ending price (upper bound) in taker asset units per maker asset unit'
    ),
  })
  .refine((data) => BigInt(data.priceEnd) > BigInt(data.priceStart), {
    message:
      'priceEnd must be greater than priceStart for correct range pricing',
  });

/**
 * Encodes extraData for Range Amount Calculator
 * @param {Object} config - Range amount configuration
 * @returns {string} ABI-encoded extraData
 */
function encodeRangeAmountExtraData(config) {
  const { priceStart, priceEnd } = config;
  // Convert to BigInt for proper handling
  const priceStartBigInt = BigInt(priceStart);
  const priceEndBigInt = BigInt(priceEnd);
  // ABI encode the two uint256 values
  const priceStartHex = priceStartBigInt.toString(16).padStart(64, '0');
  const priceEndHex = priceEndBigInt.toString(16).padStart(64, '0');
  return '0x' + priceStartHex + priceEndHex;
}

/**
 * Range Amount Calculator extension wrapper
 * Provides linear price progression within a specified range
 */
const rangeAmountCalculatorWrapper = createWrapper({
  name: 'Range Amount Calculator',
  description:
    'Linear price progression within a specified range as the order gets filled',
  hooks: {
    [HookType.MAKER_AMOUNT]: RangeAmountConfigSchema.describe(
      'Range pricing configuration for maker amount calculation'
    ),
    [HookType.TAKER_AMOUNT]: z
      .object({})
      .optional()
      .describe(
        'Maker amount configuration is used for taker amount calculation'
      ),
  },
  /**
   * Build function that creates an Extension instance for Range Amount Calculator
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const target = new Address(CONTRACT_ADDRESS);
    const builder = new ExtensionBuilder();
    const amountConfig = params[HookType.MAKER_AMOUNT];
    // Additional validation for range pricing logic
    const priceStartBigInt = BigInt(amountConfig.priceStart);
    const priceEndBigInt = BigInt(amountConfig.priceEnd);
    if (priceEndBigInt <= priceStartBigInt) {
      throw new Error('priceEnd must be greater than priceStart');
    }
    // Validate that prices are reasonable (not zero)
    if (priceStartBigInt === 0n) {
      throw new Error('priceStart cannot be zero');
    }
    // Set making amount calculation
    const extraData = encodeRangeAmountExtraData(amountConfig);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default rangeAmountCalculatorWrapper;
