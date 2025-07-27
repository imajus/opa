/**
 * Constants for 1inch Limit Order Protocol hooks
 * These represent the four supported hook types that can be used in extensions
 */

/**
 * Hook types supported by the Limit Order Protocol
 */
export const HookType = {
  MAKER_AMOUNT: 'makerAmount',
  TAKER_AMOUNT: 'takerAmount',
  PRE_INTERACTION: 'preInteraction',
  POST_INTERACTION: 'postInteraction',
};

/**
 * Array of all supported hook types for iteration
 */
export const ALL_HOOK_TYPES = Object.values(HookType);
