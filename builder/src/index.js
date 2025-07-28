/**
 * 1inch Limit Order Protocol Extension Wrappers
 * 
 * This package provides JavaScript wrappers for 1inch Limit Order Protocol extensions,
 * enabling easy creation and configuration of sophisticated trading strategies.
 */

// Extension wrappers
export { default as gasStation, GasStationConfigSchema } from './extensions/gas-station.js';
export { 
  default as chainlinkCalculator,
  SingleOracleConfigSchema,
  DoubleOracleConfigSchema, 
  ChainlinkConfigSchema 
} from './extensions/chainlink-calculator.js';
export { default as dutchAuctionCalculator, DutchAuctionConfigSchema } from './extensions/dutch-auction-calculator.js';
export { default as rangeAmountCalculator, RangeAmountConfigSchema } from './extensions/range-amount-calculator.js';

// Utilities
export { createWrapper } from './extensions/utils/factory.js';

// Common schemas for reuse
export * as schemas from './schemas/common.js';

// Constants
export { HookType, ALL_HOOK_TYPES } from './constants.js';

/**
 * All available extension wrappers
 */
export const extensions = {
  gasStation: gasStation,
  chainlinkCalculator: chainlinkCalculator,
  dutchAuctionCalculator: dutchAuctionCalculator,
  rangeAmountCalculator: rangeAmountCalculator
};

/**
 * Extension wrapper metadata for discovery
 */
export const extensionMeta = {
  gasStation: gasStation.meta,
  chainlinkCalculator: chainlinkCalculator.meta,
  dutchAuctionCalculator: dutchAuctionCalculator.meta,
  rangeAmountCalculator: rangeAmountCalculator.meta
};

/**
 * Extension-specific schemas for external validation
 */
export const extensionSchemas = {
  gasStation: GasStationConfigSchema,
  chainlinkCalculator: {
    single: SingleOracleConfigSchema,
    double: DoubleOracleConfigSchema,
    main: ChainlinkConfigSchema
  },
  dutchAuctionCalculator: DutchAuctionConfigSchema,
  rangeAmountCalculator: RangeAmountConfigSchema
}; 