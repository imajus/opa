import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center min-h-[80vh] max-w-6xl mx-auto space-y-8">
          {/* Logo and Project Name Section */}
          <div className="flex items-center">
            <Image
              src="/landing-logo.png"
              alt="OPA Logo"
              width={240}
              height={320}
              className="w-32 h-48 lg:w-48 lg:h-64 object-contain"
            />
            <h1 className="text-6xl lg:text-8xl font-bold text-gray-900 -ml-4">
              OPA
            </h1>
          </div>

          {/* Project Description Section */}
          <div className="text-center max-w-4xl">
            <div className="text-xl lg:text-2xl text-gray-700 leading-relaxed">
              <p className="mb-4">
                The{' '}
                <span className="text-primary-orange font-semibold">
                  Order Protocol Assistant
                </span>{' '}
                empowers traders to create sophisticated limit orders using
                1inch's Limit Order Protocol extensions.
              </p>
              <p className="mb-4">
                Build custom trading strategies with gas stations, dynamic
                pricing, dutch auctions, and flexible amount ranges.
              </p>
              <p>
                From simple swaps to complex algorithmic trading logic - all
                through an intuitive interface.
              </p>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/strategy"
              className="bg-primary-orange hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Build a Strategy
            </Link>

            <a
              href="https://github.com/1inch/limit-order-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-primary-green text-primary-green hover:bg-primary-green hover:text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
