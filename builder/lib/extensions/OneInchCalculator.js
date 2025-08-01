import { parseUnits } from 'ethers';
import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * OneInch Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Enables real-time price discovery using 1inch Aggregation Router for dynamic
 * amount calculations based on current market prices with configurable spread.
 * Blob format: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
 */

/**
 * Encodes blob data for OneInch Calculator extension
 * @param {string} makerToken - Maker token contract address
 * @param {string} takerToken - Taker token contract address
 * @param {string} spread - Spread in basis points
 * @param {number} flags - Calculation flags (default: 0x00 for normal calculation)
 * @returns {string} Hex-encoded blob data
 */
function encodeOneInchExtraData(makerToken, takerToken, spread, flags = 0x00) {
  // Create blob data: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
  const flagsHex = flags.toString(16).padStart(2, '0');
  const makerTokenHex = makerToken.toLowerCase().slice(2); // Remove 0x prefix
  const takerTokenHex = takerToken.toLowerCase().slice(2); // Remove 0x prefix
  const spreadHex = BigInt(spread).toString(16).padStart(64, '0'); // 32 bytes hex
  return '0x' + flagsHex + makerTokenHex + takerTokenHex + spreadHex;
}

export const spread = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Spread must be a number');
    }
    if (Number(value) < 0) {
      throw new Error('Spread must be positive');
    }
    if (Number(value) > 100) {
      throw new Error('Spread must be less than or equal to 100');
    }
  },
  parse: (value) => parseUnits(value, 7),
};

/**
 * OneInch Calculator extension wrapper
 * Provides real-time price discovery and dynamic amount calculation
 */
const oneInchCalculatorWrapper = createWrapper({
  name: 'OneInch Calculator',
  description:
    'Enables real-time price discovery using 1inch Aggregation Router for dynamic amount calculations with configurable spread',
  hooks: {
    [HookType.MAKER_AMOUNT]: createSchema({
      fields: {
        spread: {
          label: 'Spread',
          type: spread,
          hint: 'Spread in %, e.g. 0.5 (max: 100)',
        },
      },
    }),
    [HookType.TAKER_AMOUNT]: createSchema({}),
  },
  /**
   * Build function that creates an Extension instance for OneInch Calculator
   * @param {Object} params - Validated parameters containing spread
   * @param {Object} context - Order context with makerAsset and takerAsset
   * @returns {Extension} 1inch SDK Extension instance
   */
  async build(params, context) {
    const { address } = Config.extensions.oneInchCalculator;
    const target = new Address(address);
    const makerAsset = await context.makerAsset.getAddress();
    const takerAsset = await context.takerAsset.getAddress();
    const builder = new ExtensionBuilder();
    // Get parsed spread from maker amount hook
    const { spread } = params.makerAmount;
    if (!spread) {
      throw new Error('Spread parameter is required for OneInch Calculator');
    }
    // Create blob data using the encoding function
    const makerData = encodeOneInchExtraData(
      makerAsset,
      takerAsset,
      1000000000n - spread
    );
    const takerData = encodeOneInchExtraData(
      makerAsset,
      takerAsset,
      1000000000n + spread
    );
    builder.withMakingAmountData(target, makerData);
    builder.withTakingAmountData(target, takerData);
    // Build and return the Extension
    return builder.build();
  },
});

export default oneInchCalculatorWrapper;
