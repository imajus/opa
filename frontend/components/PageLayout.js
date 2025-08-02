'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function PageLayout({ children }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  if (isLandingPage) {
    return children;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="">{children}</main>
    </div>
  );
}
