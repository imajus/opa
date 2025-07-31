import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { takerTokenAmount, uint256 } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * Range Amount Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Implements range limit orders where price changes linearly within a specified range
 * as the order gets filled. Price starts at priceStart and increases to priceEnd.
 * Formula: price = ((priceEnd - priceStart) / totalAmount) * filledAmount + priceStart
 */

/**
 * Encodes extraData for Range Amount Calculator
 * @param {Object} config - Range amount configuration
 * @returns {string} ABI-encoded extraData
 */
function encodeRangeAmountExtraData({ priceStart, priceEnd }) {
  // ABI encode the two uint256 values
  const priceStartHex = priceStart.toString(16).padStart(64, '0');
  const priceEndHex = priceEnd.toString(16).padStart(64, '0');
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
    [HookType.MAKER_AMOUNT]: createSchema({
      hint: 'Range pricing configuration for maker amount calculation',
      fields: {
        priceStart: {
          label: 'Price Start',
          type: takerTokenAmount,
          hint: 'Starting price (lower bound) in taker asset units per maker asset unit',
        },
        priceEnd: {
          label: 'Price End',
          type: takerTokenAmount,
          hint: 'Ending price (upper bound) in taker asset units per maker asset unit',
        },
      },
      validate: ({ priceStart, priceEnd }) => {
        // Additional build-time validation
        if (Number(priceStart) === 0) {
          throw new Error('Price Start cannot be zero');
        }
        if (priceEnd <= priceStart) {
          throw new Error('Price End must be greater than Price Start');
        }
      },
    }),
    [HookType.TAKER_AMOUNT]: createSchema({}),
  },
  /**
   * Build function that creates an Extension instance for Range Amount Calculator
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const { address } = Config.extensions.rangeAmountCalculator;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    const amountConfig = params[HookType.MAKER_AMOUNT];
    // Set making amount calculation
    const extraData = encodeRangeAmountExtraData(amountConfig);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default rangeAmountCalculatorWrapper;
