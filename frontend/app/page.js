'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useDisconnect } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });
  const { disconnect } = useDisconnect();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to Your Web3 App
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Built with Next.js, RainbowKit, Wagmi, and TailwindCSS
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Connect Your Wallet
            </h2>
            <ConnectButton />
          </div>

          {isConnected && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
                Wallet Connected!
              </h3>
              <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                <p>
                  <span className="font-medium">Address:</span>{' '}
                  <span className="font-mono break-all">{address}</span>
                </p>
                {balance && (
                  <p>
                    <span className="font-medium">Balance:</span>{' '}
                    {Number(balance.formatted).toFixed(4)} {balance.symbol}
                  </p>
                )}
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Connect your wallet to get started with Web3 functionality.
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Features Included
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                🌈 RainbowKit
              </h4>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Beautiful wallet connection UI with support for multiple wallets
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                ⚡ Wagmi
              </h4>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                React hooks for Ethereum with TypeScript support
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                🎨 TailwindCSS
              </h4>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Utility-first CSS framework for rapid UI development
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
