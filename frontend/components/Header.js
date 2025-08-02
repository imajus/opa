'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="top-0 z-50">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/landing-logo.png"
              alt="OPA Logo"
              width={32}
              height={48}
              className="w-8 h-12 object-contain"
            />
            <span className="text-xl font-bold text-gray-900">OPA</span>
          </Link>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
