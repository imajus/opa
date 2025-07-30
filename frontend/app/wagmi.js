'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

// Custom localhost network configuration
const localhost = {
  id: 31337,
  name: 'localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
    public: {
      http: ['http://localhost:8545'],
    },
  },
  // blockExplorers: {
  //   default: { name: 'Explorer', url: 'http://localhost:8545' },
  // },
  testnet: true,
};

export const config = getDefaultConfig({
  appName: 'OPA',
  projectId: 'YOUR_PROJECT_ID', // Get from https://cloud.walletconnect.com
  chains: [mainnet, localhost],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
