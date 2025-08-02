// Extension wrappers
import gasStation from './extensions/GasStation.js';
import chainlinkSingleCalculator from './extensions/ChainlinkSingleCalculator.js';
import chainlinkDoubleCalculator from './extensions/ChainlinkDoubleCalculator.js';
import dutchAuctionCalculator from './extensions/DutchAuctionCalculator.js';
import rangeAmountCalculator from './extensions/RangeAmountCalculator.js';

import uniswapCalculator from './extensions/UniswapCalculator.js';

export { getLimitOrderContract } from '@1inch/limit-order-sdk';
export * as Type from './extensions/utils/types.js';
export { OrderBuilder, HookCollisionError } from './OrderBuilder.js';
export * from './utils.js';
export { HookType, ALL_HOOK_TYPES } from './constants.js';

/**
 * All available extension wrappers
 */
export const extensions = {
  gasStation,
  chainlinkSingleCalculator,
  chainlinkDoubleCalculator,
  dutchAuctionCalculator,
  rangeAmountCalculator,

  uniswapCalculator,
};
