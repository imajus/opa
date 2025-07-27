import { z } from 'zod';
import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper } from './utils/factory.js';
import { address, uint256, boolean } from '../schemas/common.js';
import { HookType } from '../constants.js';

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Chainlink Calculator extension wrapper for 1inch Limit Order Protocol
 *
 * Uses Chainlink oracle feeds to calculate dynamic pricing for limit orders
 * Supports single oracle pricing, double oracle pricing, inverse pricing, and spread configuration
 */

/**
 * Schema for single oracle configuration
 */
const SingleOracleConfigSchema = z.object({
  oracle: address.describe('Chainlink oracle aggregator address'),
  spread: uint256.describe('Spread in 1e9 units (e.g., 1000000 for 0.1%)'),
  inverse: boolean
    .optional()
    .default(false)
    .describe(
      'Whether to use inverse pricing (e.g., ETH price in DAI instead of DAI price in ETH)'
    ),
});

/**
 * Schema for double oracle configuration (for cross-token pricing)
 */
const DoubleOracleConfigSchema = z.object({
  oracle1: address.describe('First Chainlink oracle aggregator address'),
  oracle2: address.describe('Second Chainlink oracle aggregator address'),
  decimalsScale: z
    .number()
    .int()
    .describe('Decimal scaling factor (can be negative)'),
  spread: uint256.describe('Spread in 1e9 units (e.g., 1000000 for 0.1%)'),
});

/**
 * Main configuration schema - either single or double oracle
 */
const ChainlinkConfigSchema = z
  .union([
    z.object({
      type: z.literal('single'),
      config: SingleOracleConfigSchema,
    }),
    z.object({
      type: z.literal('double'),
      config: DoubleOracleConfigSchema,
    }),
  ])
  .describe('Chainlink oracle configuration');

/**
 * Encodes extraData blob for Chainlink Calculator
 * @param {Object} config - Configuration object
 * @returns {string} Hex-encoded extraData
 */
function encodeChainlinkExtraData(config) {
  if (config.type === 'single') {
    const { oracle, spread, inverse } = config.config;
    // First byte: flags (bit 7 = inverse, bit 6 = double price)
    const flags = inverse ? 0x80 : 0x00;
    // Encode: flags (1 byte) + oracle (20 bytes) + spread (32 bytes)
    const flagsHex = flags.toString(16).padStart(2, '0');
    const oracleHex = oracle.slice(2); // Remove 0x prefix
    const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
    return '0x' + flagsHex + oracleHex + spreadHex;
  } else {
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
}

/**
 * Chainlink Calculator extension wrapper
 * Provides dynamic pricing using Chainlink oracle feeds
 */
const chainlinkCalculatorWrapper = createWrapper({
  name: 'Chainlink Calculator',
  description:
    'Dynamic pricing using Chainlink oracle feeds with support for single/double oracle configurations',
  hooks: {
    [HookType.MAKER_AMOUNT]: ChainlinkConfigSchema.describe(
      'Oracle configuration for maker amount calculation'
    ),
    [HookType.TAKER_AMOUNT]: z
      .object({})
      .optional()
      .describe(
        'Maker amount configuration is used for taker amount calculation'
      ),
  },
  /**
   * Build function that creates an Extension instance for Chainlink Calculator
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const target = new Address(CONTRACT_ADDRESS);
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

export default chainlinkCalculatorWrapper;

// Export schemas for external validation reuse
export { 
  SingleOracleConfigSchema, 
  DoubleOracleConfigSchema, 
  ChainlinkConfigSchema 
};
