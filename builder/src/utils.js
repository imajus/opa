import {
  TakerTraits,
  getLimitOrderContract,
  LimitOrderContract,
} from '@1inch/limit-order-sdk';
import { config } from './config.js';

/**
 * Generic function to fill a limit order
 * @param {Object} wallet - Ethers wallet instance
 * @param {Object} order - The order object to fill
 * @param {string} signature - The order signature
 * @param {string} extension - Extension address for the order
 * @param {BigInt} [amount] - Amount to fill (defaults to order.takingAmount)
 * @returns {Promise<Object>} Transaction receipt
 */
export async function fillOrder(
  wallet,
  order,
  signature,
  extension,
  amount = order.takingAmount
) {
  const lopAddress = getLimitOrderContract(config.network.chainId);
  const calldata = LimitOrderContract.getFillOrderArgsCalldata(
    order,
    signature,
    new TakerTraits(0n, {
      extension,
    }),
    amount
  );
  const tx = await wallet.sendTransaction({
    to: lopAddress,
    data: calldata,
  });
  const receipt = await tx.wait();
  return receipt;
}
