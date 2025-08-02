import { parseUnits } from 'ethers';
import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * Uniswap Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Enables real-time price discovery using Uniswap V3 Factory and pools for dynamic
 * amount calculations based on current market prices with configurable fee tiers and spread.
 * Blob format: [fee(3)][spread(32)]
 */

/**
 * Encodes blob data for Uniswap Calculator extension
 * @param {number} feeTier - Uniswap V3 fee tier (500, 3000, or 10000)
 * @param {BigInt} spread - Spread in basis points
 * @returns {string} Hex-encoded blob data
 */
function encodeUniswapExtraData(feeTier, spread) {
  // Create blob data: [fee(3)][spread(32)]
  const feeHex = feeTier.toString(16).padStart(6, '0'); // 3 bytes = 6 hex chars
  const spreadHex = spread.toString(16).padStart(64, '0'); // 32 bytes hex
  return '0x' + feeHex + spreadHex;
}

// export const feeTier = {
//   validate(value) {
//     const numValue = Number(value);
//     if (isNaN(numValue)) {
//       throw new Error('Fee tier must be a number');
//     }
//     const validFeeTiers = [500, 3000, 10000];
//     if (!validFeeTiers.includes(numValue)) {
//       throw new Error(
//         `Fee tier must be one of: ${validFeeTiers.join(', ')} (0.05%, 0.3%, 1%)`
//       );
//     }
//   },
//   parse: (value) => Number(value),
// };

export const spread = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Spread must be a number');
    }
    if (Number(value) < 0) {
      throw new Error('Spread must be positive');
    }
    if (Number(value) > 1000) {
      throw new Error(
        'Spread must be less than or equal to 1000% (validation range: 10% to 1000%)'
      );
    }
    if (Number(value) < 0.1) {
      throw new Error(
        'Spread must be at least 0.1% (validation range: 10% to 1000%)'
      );
    }
  },
  parse: (value) => parseUnits(value, 7), // Convert percentage to basis points with 7 decimals
};

/**
 * Uniswap Calculator extension wrapper
 * Provides real-time price discovery and dynamic amount calculation using Uniswap V3
 */
const uniswapCalculatorWrapper = createWrapper({
  name: 'Uniswap Calculator',
  description:
    'Enables real-time price discovery using Uniswap V3 Factory and pools for dynamic amount calculations with configurable spread',
  hooks: {
    [HookType.MAKER_AMOUNT]: createSchema({
      fields: {
        //XXX: Not needed, feeTier is hardcoded to 3000
        // feeTier: {
        //   label: 'Fee Tier',
        //   type: feeTier,
        //   hint: 'Uniswap V3 fee tier: 500 (0.05%), 3000 (0.3%), or 10000 (1%)',
        // },
        spread: {
          label: 'Spread',
          type: spread,
          hint: 'Spread in %, e.g. 5 (range: 0.1% to 1000%)',
        },
      },
    }),
    [HookType.TAKER_AMOUNT]: createSchema({}),
  },
  /**
   * Build function that creates an Extension instance for Uniswap Calculator
   * @param {Object} params - Validated parameters containing feeTier and spread
   * @param {OrderBuilderContext} context - Order context with makerAsset and takerAsset
   * @returns {Extension} 1inch SDK Extension instance
   */
  async build(params, context) {
    const { address } = Config.extensions.uniswapCalculator;
    const target = new Address(address);
    const makerAsset = await context.makerAsset.getAddress();
    const takerAsset = await context.takerAsset.getAddress();
    const builder = new ExtensionBuilder();
    // Get parsed parameters from maker amount hook
    const { feeTier = 3000, spread } = params.makerAmount || {};
    if (!spread) {
      throw new Error('Spread parameter is required for Uniswap Calculator');
    }
    // Create blob data using the encoding function
    // For maker amount: reduce spread (more favorable to maker)
    const makerData = encodeUniswapExtraData(feeTier, 1000000000n - spread);
    // For taker amount: increase spread (more favorable to taker)
    const takerData = encodeUniswapExtraData(feeTier, 1000000000n + spread);
    builder.withMakingAmountData(target, makerData);
    builder.withTakingAmountData(target, takerData);
    // Build and return the Extension
    return builder.build();
  },
});

export default uniswapCalculatorWrapper;
