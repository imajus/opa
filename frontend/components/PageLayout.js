'use client';

import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Header from './Header';

export default function PageLayout({ children }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const { isConnected } = useAccount();

  if (isLandingPage) {
    return children;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="flex items-center justify-center min-h-[calc(100vh-120px)]">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-orange-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Wallet Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to access this feature and interact
              with the OPA platform.
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="">{children}</main>
    </div>
  );
}
