import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { useMemo } from 'react';
import { useConnectorClient } from 'wagmi';

/**
 * Converts a viem Wallet Client to an ethers.js Signer
 * @param {Client} client - Viem client with account
 * @returns {JsonRpcSigner} Ethers v6 signer
 */
export function clientToSigner(client) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);
  return signer;
}

/**
 * Hook to convert a viem Wallet Client to an ethers.js Signer
 * @param {Object} options - Options object
 * @param {number} options.chainId - Optional chain ID
 * @returns {JsonRpcSigner|undefined} Ethers v6 signer or undefined
 */
export function useEthersSigner({ chainId } = {}) {
  const { data: client } = useConnectorClient({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
