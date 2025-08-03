import { ExtensionBuilder, Interaction, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { HookType } from '../constants.js';
import Config from '../config.js';
import createERC20Contract from '../contracts/ERC20.js';

/**
 * Gas Station extension wrapper
 * Provides gasless trading functionality for makers trading stablecoins to WETH
 */
const gasStationWrapper = createWrapper({
  name: 'Gas Station',
  description:
    'Enables gasless trading where makers can trade stablecoins to WETH without owning ETH for gas fees',
  hooks: {
    [HookType.PRE_INTERACTION]: createSchema({}),
    [HookType.POST_INTERACTION]: createSchema({}),
  },
  callbacks: {
    async onFill(signer, order) {
      const { address } = Config.extensions.gasStation;
      const asset = createERC20Contract(order.makerAsset, signer);
      const allowance = await asset.allowance(
        await signer.getAddress(),
        address
      );
      const amount = order.makingAmount;
      if (allowance >= amount) {
        return;
      }
      const tx = await asset.approve(address, amount);
      return tx.wait();
    },
  },
  /**
   * Build function that creates an Extension instance for Gas Station
   * @param {Object} params - Validated parameters
   * @returns {Extension} 1inch SDK Extension instance
   */
  build() {
    const { address } = Config.extensions.gasStation;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    // Set pre-/post-interaction (flash loan & swap)
    const data = new Interaction(target, '0x00');
    builder.withPreInteraction(data);
    builder.withPostInteraction(data);
    // Build and return the Extension
    return builder.build();
  },
});

export default gasStationWrapper;
