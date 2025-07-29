import { z } from 'zod';
import { ExtensionBuilder, Interaction, Address } from '@1inch/limit-order-sdk';
import { createWrapper } from './utils/factory.js';
import { HookType } from '../constants.js';
import { config } from '../config.js';

/**
 * Gas Station extension wrapper for 1inch Limit Order Protocol
 *
 * Enables gasless trading where makers can trade stablecoins -> WETH without owning ETH for gas fees.
 * Takers pay gas upfront and get reimbursed via flash loan, swap, and repayment mechanism.
 */

/**
 * Gas Station extension wrapper
 * Provides gasless trading functionality for makers trading stablecoins to WETH
 */
const gasStationWrapper = createWrapper({
  name: 'Gas Station',
  description:
    'Enables gasless trading where makers can trade stablecoins to WETH without owning ETH for gas fees',
  hooks: {
    [HookType.MAKER_AMOUNT]: z.undefined().describe('Uses dynamic calculation'),
    [HookType.TAKER_AMOUNT]: z.undefined().describe('Uses dynamic calculation'),
    [HookType.PRE_INTERACTION]: z.undefined().describe('Perform flash loan'),
    [HookType.POST_INTERACTION]: z
      .undefined()
      .describe('Perform swap, and repayment'),
  },
  /**
   * Build function that creates an Extension instance for Gas Station
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build() {
    const { address } = config.extensions.gasStation;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    builder.withMakingAmountData(
      target,
      '0x00' // Empty data - Gas Station uses view functions for calculation
    );
    // Set taking amount calculation (reverse calculation for required maker asset)
    builder.withTakingAmountData(
      target,
      '0x00' // Empty data - Gas Station uses view functions for calculation
    );
    // Set pre-interaction (flash loan initiation)
    const preInteraction = new Interaction(target, '0x00');
    builder.withPreInteraction(preInteraction);
    // Set post-interaction (swap and repayment)
    const postInteraction = new Interaction(target, '0x00');
    builder.withPostInteraction(postInteraction);
    // Build and return the Extension
    return builder.build();
  },
});

export default gasStationWrapper;
