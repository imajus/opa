'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
// import { webSocket } from 'viem';
import { /* mainnet,  */ base } from 'wagmi/chains';

// Custom localhost network configuration
// const localhost = {
//   id: 31337,
//   name: 'localhost',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'Ether',
//     symbol: 'ETH',
//   },
//   rpcUrls: {
//     default: {
//       http: ['http://localhost:8545'],
//     },
//     public: {
//       http: ['http://localhost:8545'],
//     },
//   },
//   testnet: true,
// };

// const tenderly = {
//   id: 33333,
//   name: 'tenderly',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'Virtual Ether',
//     symbol: 'ETH',
//   },
//   rpcUrls: {
//     default: {
//       http: [
//         'https://virtual.mainnet.eu.rpc.tenderly.co/f151094f-5d59-4f1a-ba0f-1e33fa7afa75',
//       ],
//       webSocket: [
//         'wss://virtual.mainnet.eu.rpc.tenderly.co/06218d81-f9ce-4585-b941-916f5937dd6f',
//       ],
//     },
//     public: {
//       http: [
//         'https://virtual.mainnet.eu.rpc.tenderly.co/f151094f-5d59-4f1a-ba0f-1e33fa7afa75',
//       ],
//       webSocket: [
//         'wss://virtual.mainnet.eu.rpc.tenderly.co/06218d81-f9ce-4585-b941-916f5937dd6f',
//       ],
//     },
//   },
//   blockExplorers: {
//     default: {
//       name: 'Tenderly Explorer',
//       url: 'https://virtual.mainnet.eu.rpc.tenderly.co/11834f49-b62d-494b-a11b-73a447b0205d',
//     },
//   },
//   testnet: true,
// };

export const config = getDefaultConfig({
  appName: 'OPA',
  projectId: 'add37cfe455e760daf15715ac60c5d37', // Get from https://cloud.walletconnect.com
  chains: [base /*mainnet, localhost, tenderly */],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
