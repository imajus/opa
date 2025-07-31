import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { address, uint256, boolean } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * Encodes extraData blob for Chainlink Calculator
 * @param {Object} config - Configuration object
 * @returns {string} Hex-encoded extraData
 */
function encodeChainlinkExtraData(config) {
  // Handle both single and double oracle configurations
  let oracle, spread, inverse;

  if (config.oracle) {
    // Single oracle configuration
    ({ oracle, spread, inverse } = config);
  } else if (config.oracle1) {
    // Double oracle configuration - use oracle1 as primary
    oracle = config.oracle1;
    spread = config.spread;
    inverse = false; // Double oracle doesn't use inverse flag
  } else {
    throw new Error('Invalid oracle configuration - missing oracle or oracle1');
  }

  // First byte: flags (bit 7 = inverse, bit 6 = double price)
  const flags = inverse ? 0x80 : 0x00;
  // Encode: flags (1 byte) + oracle (20 bytes) + spread (32 bytes)
  const flagsHex = flags.toString(16).padStart(2, '0');
  const oracleHex = oracle.slice(2); // Remove 0x prefix
  const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
  return '0x' + flagsHex + oracleHex + spreadHex;
}

/**
 * Chainlink Calculator extension wrapper
 * Provides dynamic pricing using Chainlink oracle feeds
 */
const chainlinkCalculatorSingleWrapper = createWrapper({
  name: 'Chainlink ETH <-> ERC20 Price Calculator',
  description:
    'Dynamic pricing using Chainlink oracle feeds with support for single oracle configurations',
  hooks: {
    [HookType.MAKER_AMOUNT]: createSchema({
      hint: 'Chainlink oracle configuration',
      fields: {
        type: {
          label: 'Configuration Type',
          type: {
            validate(value) {
              if (value !== 'single' && value !== 'double') {
                throw new Error('Type must be "single" or "double"');
              }
            },
            parse: (value) => value,
          },
          hint: 'Configuration type: "single" or "double"',
        },
        config: {
          label: 'Oracle Configuration',
          type: {
            validate(value) {
              if (!value || typeof value !== 'object') {
                throw new Error('Config must be an object');
              }
              // Validate based on structure
              if (value.oracle) {
                address.validate(value.oracle);
              }
              if (value.spread) {
                uint256.validate(value.spread);
              }
              if (value.inverse !== undefined) {
                boolean.validate(value.inverse);
              }
              // Additional validations for double oracle
              if (value.oracle1) {
                address.validate(value.oracle1);
              }
              if (value.oracle2) {
                address.validate(value.oracle2);
              }
            },
            parse: (value) => value,
          },
          hint: 'Oracle configuration object with oracle, spread, and inverse properties',
        },
      },
      validate(params) {
        if (!params.type) {
          throw new Error('Type field is required');
        }
        if (!params.config) {
          throw new Error('Config field is required');
        }
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
    const extraData = encodeChainlinkExtraData(amountConfig.config);
    builder.withMakingAmountData(target, extraData);
    builder.withTakingAmountData(target, extraData);
    // Build and return the Extension
    return builder.build();
  },
});

export default chainlinkCalculatorSingleWrapper;
