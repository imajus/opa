import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { address, uint256 } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * Encodes extraData blob for Chainlink Calculator
 * @param {Object} config - Configuration object
 * @returns {string} Hex-encoded extraData
 */
function encodeChainlinkExtraData(config) {
  // Double oracle configuration
  const { oracle1, oracle2, decimalsScale, spread } = config.config;
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
  const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
  return (
    '0x' + flagsHex + oracle1Hex + oracle2Hex + decimalsScaleHex + spreadHex
  );
}

/**
 * Chainlink Calculator extension wrapper
 * Provides dynamic pricing using Chainlink oracle feeds
 */
const chainlinkCalculatorDoubleWrapper = createWrapper({
  name: 'Chainlink ETH <-> ERC20 Price Calculator',
  description:
    'Dynamic pricing using Chainlink oracle feeds with support for single oracle configurations',
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
          type: uint256,
          hint: 'Decimal scaling factor (can be negative)',
        },
        spread: {
          label: 'Spread',
          type: uint256,
          hint: 'Spread in 1e9 units (e.g., 1000000 for 0.1%)',
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
    const amountConfig = params[HookType.MAKER_AMOUNT];
    // Set making amount calculation if configured
    const extraData = encodeChainlinkExtraData(amountConfig);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default chainlinkCalculatorDoubleWrapper;
