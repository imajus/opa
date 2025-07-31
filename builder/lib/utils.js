import {
  TakerTraits,
  getLimitOrderContract,
  LimitOrderContract,
  Extension,
} from '@1inch/limit-order-sdk';
import { Signature } from 'ethers';
import { ErrorDecoder } from 'ethers-decode-error';
import errorsABI from './errors.abi.json' with { type: 'json' };

/**
 * Parse maker traits from a limit order to extract order flags and settings
 * Based on 1inch LOP SDK MakerTraits implementation
 * @param {import('@1inch/limit-order-sdk').LimitOrderV4Struct} order - The order object
 * @returns {Object} Parsed maker traits with boolean flags
 */
export function parseMakerTraits(order) {
  const makerTraits = BigInt(order.makerTraits);
  // Bit flag positions (as defined in MakerTraits.ts)
  const NO_PARTIAL_FILLS_FLAG = 255n;
  const ALLOW_MULTIPLE_FILLS_FLAG = 254n;
  const PRE_INTERACTION_CALL_FLAG = 252n;
  const POST_INTERACTION_CALL_FLAG = 251n;
  const NEED_CHECK_EPOCH_MANAGER_FLAG = 250n;
  const HAS_EXTENSION_FLAG = 249n;
  const USE_PERMIT2_FLAG = 248n;
  const UNWRAP_WETH_FLAG = 247n;
  // Helper function to check if a bit is set
  const getBit = (value, bitPosition) => {
    return (value >> bitPosition) & 1n;
  };
  // Helper function to extract a range of bits (mask)
  const getMask = (value, startBit, endBit) => {
    const mask = (1n << (endBit - startBit)) - 1n;
    return (value >> startBit) & mask;
  };
  // Extract bit flags
  const allowPartialFills = getBit(makerTraits, NO_PARTIAL_FILLS_FLAG) === 0n; // NOT set means partial fills allowed
  const allowMultipleFills =
    getBit(makerTraits, ALLOW_MULTIPLE_FILLS_FLAG) === 1n; // Set means multiple fills allowed
  const hasPreInteraction =
    getBit(makerTraits, PRE_INTERACTION_CALL_FLAG) === 1n;
  const hasPostInteraction =
    getBit(makerTraits, POST_INTERACTION_CALL_FLAG) === 1n;
  const hasExtension = getBit(makerTraits, HAS_EXTENSION_FLAG) === 1n;
  const usePermit2 = getBit(makerTraits, USE_PERMIT2_FLAG) === 1n;
  const unwrapWeth = getBit(makerTraits, UNWRAP_WETH_FLAG) === 1n;
  const isEpochManagerEnabled =
    getBit(makerTraits, NEED_CHECK_EPOCH_MANAGER_FLAG) === 1n;
  // Extract low 200 bits for allowed sender, expiration, nonce/epoch, and series
  const allowedSenderMask = getMask(makerTraits, 0n, 80n); // Last 10 bytes of allowed sender (0 if any)
  const expirationMask = getMask(makerTraits, 80n, 120n); // Expiration timestamp (0 if none)
  const nonceOrEpochMask = getMask(makerTraits, 120n, 160n); // Nonce or epoch
  const seriesMask = getMask(makerTraits, 160n, 200n); // Series
  return {
    allowPartialFills,
    allowMultipleFills,
    hasPreInteraction,
    hasPostInteraction,
    hasExtension,
    usePermit2,
    unwrapWeth,
    isEpochManagerEnabled,
    expiration: expirationMask === 0n ? null : expirationMask,
    allowedSender:
      allowedSenderMask === 0n
        ? null
        : allowedSenderMask.toString(16).padStart(20, '0'),
    nonceOrEpoch: nonceOrEpochMask,
    series: seriesMask,
  };
}

/**
 * Get a permit for an asset
 *
 * @param {import('ethers').Signer} signer - Signer to use for the permit
 * @param {import('ethers').Contract} asset - Asset contract
 * @param {BigInt} value - Amount to permit
 * @param {BigInt} [deadline] - Deadline for the permit
 *
 * @returns {string} Permit calldata with selector cut off
 */
export async function makeAssetPermit(
  signer,
  asset,
  value,
  deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 1 week
) {
  const { chainId } = await signer.provider.getNetwork();
  const owner = await signer.getAddress();
  const nonce = await asset.nonces(owner);
  const name = await asset.name();
  const version = await asset.version();
  const verifyingContract = await asset.getAddress();
  const spender = getLimitOrderContract(chainId);
  const typedData = {
    domain: {
      name,
      version,
      chainId,
      verifyingContract,
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    value: { owner, spender, value, nonce, deadline },
  };
  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.value
  );
  const { v, r, s } = Signature.from(signature);
  const calldata = asset.interface.encodeFunctionData('permit', [
    owner,
    spender,
    value,
    deadline,
    v,
    r,
    s,
  ]);
  // Cut selector from the permit call
  return verifyingContract + calldata.substring(10);
}

/**
 * Generic function to fill a limit order
 * @param {import('ethers').Signer} signer - Ethers signer instance
 * @param {import('@1inch/limit-order-sdk').LimitOrderV4Struct} order - The order object to fill
 * @param {string} signature - The order signature
 * @param {object} extension - Extension data
 * @param {BigInt} [amount] - Amount to fill (defaults to order.takingAmount)
 * @returns {Promise<import('ethers').TransactionReceipt>} Transaction receipt
 */
export async function fillOrder(
  signer,
  order,
  signature,
  extension,
  amount = order.takingAmount
) {
  const { chainId } = await signer.provider.getNetwork();
  const lopAddress = getLimitOrderContract(chainId);
  try {
    const calldata = LimitOrderContract.getFillOrderArgsCalldata(
      order,
      signature,
      new TakerTraits(0n, {
        extension: new Extension(extension),
      }),
      amount
    );
    const tx = await signer.sendTransaction({
      to: lopAddress,
      data: calldata,
    });
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    const errorDecoder = ErrorDecoder.create([errorsABI]);
    const { reason, type } = await errorDecoder.decode(error);
    console.error(error);
    throw new Error(`Error filling order: ${reason} (${type})`);
  }
}
