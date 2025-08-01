import { ExtensionBuilder, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { address, boolean } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';
import { parseUnits } from 'ethers';

/**
 * Encodes extraData blob for Chainlink Calculator
 * @param {Object} config - Configuration object
 * @returns {string} Hex-encoded extraData
 */
function encodeChainlinkExtraData({ oracle, spread, inverse }) {
  // First byte: flags (bit 7 = inverse, bit 6 = double price)
  const flags = inverse ? 0x80 : 0x00;
  // Encode: flags (1 byte) + oracle (20 bytes) + spread (32 bytes)
  const flagsHex = flags.toString(16).padStart(2, '0');
  const oracleHex = oracle.slice(2); // Remove 0x prefix
  const spreadHex = spread.toString(16).padStart(64, '0');
  return '0x' + flagsHex + oracleHex + spreadHex;
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
const chainlinkCalculatorSingleWrapper = createWrapper({
  name: 'Chainlink WETH ⇄ ERC20 Price Calculator',
  description:
    'Dynamic pricing using Chainlink oracle feeds with support for single oracle configurations',
  hooks: {
    [HookType.MAKER_AMOUNT]: createSchema({
      hint: 'Chainlink oracle configuration',
      fields: {
        oracle: {
          label: 'Oracle',
          type: address,
          hint: 'Chainlink oracle aggregator address',
        },
        inverse: {
          label: 'Inverse',
          type: boolean,
          hint: 'Inverse price calculation',
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
    const makerData = encodeChainlinkExtraData({
      oracle: config.oracle,
      inverse: config.inverse,
      spread: 1000000000n + config.spread,
    });
    const takerData = encodeChainlinkExtraData({
      oracle: config.oracle,
      spread: 1000000000n + config.spread,
      inverse: !config.inverse,
    });
    builder.withMakingAmountData(target, makerData);
    builder.withTakingAmountData(target, takerData);
    // Build and return the Extension
    return builder.build();
  },
});

export default chainlinkCalculatorSingleWrapper;
