import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { address, int256 } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';
import { parseUnits } from 'ethers';

/**
 * Encodes extraData blob for Chainlink Calculator
 * @param {Object} config - Configuration object
 * @returns {string} Hex-encoded extraData
 */
function encodeChainlinkExtraData({ oracle1, oracle2, decimalsScale, spread }) {
  // First byte: flags (bit 6 set for double price)
  const flags = 0x40;
  // Encode decimalsScale as signed 32-byte value
  let decimalsScaleHex;
  if (decimalsScale >= 0) {
    decimalsScaleHex = decimalsScale.toString(16).padStart(64, '0');
  } else {
    // Two's complement for negative numbers
    const positive = -decimalsScale;
    const complement = BigInt(2) ** BigInt(256) - BigInt(positive);
    decimalsScaleHex = complement.toString(16).padStart(64, '0');
  }
  // Encode: flags (1 byte) + oracle1 (20 bytes) + oracle2 (20 bytes) + decimalsScale (32 bytes) + spread (32 bytes)
  const flagsHex = flags.toString(16).padStart(2, '0');
  const oracle1Hex = oracle1.slice(2); // Remove 0x prefix
  const oracle2Hex = oracle2.slice(2); // Remove 0x prefix
  const spreadHex = spread.toString(16).padStart(64, '0');
  return (
    '0x' + flagsHex + oracle1Hex + oracle2Hex + decimalsScaleHex + spreadHex
  );
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
 * Chainlink Calculator extension wrapper
 * Provides dynamic pricing using Chainlink oracle feeds
 */
const chainlinkCalculatorDoubleWrapper = createWrapper({
  name: 'Chainlink ERC20 ⇄ ERC20 Price Calculator',
  description:
    'Dynamic pricing using Chainlink oracle feeds with support for double oracle configurations',
  hooks: {
    [HookType.MAKER_AMOUNT]: createSchema({
      hint: 'Chainlink oracle configuration',
      fields: {
        oracle1: {
          label: 'Oracle #1',
          type: address,
          hint: 'First Chainlink oracle aggregator address',
        },
        oracle2: {
          label: 'Oracle #2',
          type: address,
          hint: 'Second Chainlink oracle aggregator address',
        },
        decimalsScale: {
          label: 'Decimals Scale',
          type: int256,
          hint: 'Decimal scaling factor (can be negative)',
        },
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
   * Build function that creates an Extension instance for Chainlink Calculator
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const { address } = Config.extensions.chainlinkCalculator;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    const config = params[HookType.MAKER_AMOUNT];
    // Set making amount calculation if configured
    const extraData = encodeChainlinkExtraData(config);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default chainlinkCalculatorDoubleWrapper;
