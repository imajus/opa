// Extension wrappers
// import gasStation from './extensions/GasStation.js';
import vestingControl from './extensions/VestingControl.js';
import dutchAuctionCalculator from './extensions/DutchAuctionCalculator.js';
import rangeAmountCalculator from './extensions/RangeAmountCalculator.js';
import uniswapCalculator from './extensions/UniswapCalculator.js';

export { getLimitOrderContract } from '@1inch/limit-order-sdk';
export { default as createERC20Contract } from './contracts/ERC20.js';
export * as Type from './extensions/utils/types.js';
export { OrderBuilder, HookCollisionError } from './OrderBuilder.js';
export * from './utils.js';
export { HookType, ALL_HOOK_TYPES } from './constants.js';

/**
 * All available extension wrappers
 */
export const extensions = {
  // gasStation,
  vestingControl,
  dutchAuctionCalculator,
  rangeAmountCalculator,
  uniswapCalculator,
};
