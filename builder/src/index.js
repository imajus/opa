/**
 * 1inch Limit Order Protocol Extension Wrappers
 *
 * This package provides JavaScript wrappers for 1inch Limit Order Protocol extensions,
 * enabling easy creation and configuration of sophisticated trading strategies.
 */
export { z } from 'zod';

// Extension wrappers
import gasStation from './extensions/gas-station.js';
import chainlinkCalculator from './extensions/chainlink-calculator.js';
import dutchAuctionCalculator from './extensions/dutch-auction-calculator.js';
import rangeAmountCalculator from './extensions/range-amount-calculator.js';

// Utilities
export { createWrapper } from './extensions/utils/factory.js';

// Constants
export { HookType, ALL_HOOK_TYPES } from './constants.js';

/**
 * All available extension wrappers
 */
export const extensions = {
  gasStation,
  chainlinkCalculator,
  dutchAuctionCalculator,
  rangeAmountCalculator,
};
