'use client';

import { useState } from 'react';

/**
 * TokenSymbol component renders a token symbol with logo
 * @param {Object} props
 * @param {string} props.address - Token contract address
 * @param {string} props.symbol - Token symbol (e.g., 'USDC', 'ETH')
 * @param {Object} props.tokenData - Optional token data object with logo info
 * @param {string} props.size - Size variant: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param {string} props.textColor - Text color class (e.g., 'text-gray-500')
 * @param {string} props.fontWeight - Font weight class (e.g., 'font-medium')
 * @param {boolean} props.showLogo - Whether to show the token logo
 * @param {string} props.className - Additional CSS classes
 */
export default function TokenSymbol({
  address,
  symbol = '???',
  tokenData,
  size = 'md',
  textColor = 'text-gray-500',
  fontWeight = 'font-normal',
  showLogo = true,
  className = '',
}) {
  const [logoError, setLogoError] = useState(false);

  // Size configurations
  const sizeConfigs = {
    xs: {
      logoSize: 'w-3 h-3',
      textSize: 'text-xs',
      gap: 'gap-1',
    },
    sm: {
      logoSize: 'w-4 h-4',
      textSize: 'text-sm',
      gap: 'gap-1',
    },
    md: {
      logoSize: 'w-5 h-5',
      textSize: 'text-base',
      gap: 'gap-1',
    },
    lg: {
      logoSize: 'w-6 h-6',
      textSize: 'text-lg',
      gap: 'gap-2',
    },
    xl: {
      logoSize: 'w-8 h-8',
      textSize: 'text-xl',
      gap: 'gap-3',
    },
  };

  const config = sizeConfigs[size] || sizeConfigs.md;

  // Generate token logo URL
  const getTokenLogoUrl = () => {
    if (!address || logoError) return null;

    // Use token data logo if available
    if (tokenData?.logoURI) {
      return tokenData.logoURI;
    }

    // Fallback to common token logo services
    if (address) {
      // Try Trust Wallet assets first (most comprehensive)
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
    }

    return null;
  };

  const logoUrl = getTokenLogoUrl();

  // Fallback icon for when logo fails or is not available
  const FallbackIcon = () => (
    <div
      className={`${config.logoSize} rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center`}
    >
      <span
        className={`${size === 'xs' ? 'text-[8px]' : size === 'sm' ? 'text-[10px]' : 'text-xs'} font-bold text-gray-600`}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );

  return (
    <span className={`inline-flex items-center ${config.gap} ${className}`}>
      {showLogo && (
        <div className="flex-shrink-0">
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={`${symbol} logo`}
              className={`${config.logoSize} rounded-full`}
              onError={() => setLogoError(true)}
              onLoad={() => setLogoError(false)}
            />
          ) : (
            <FallbackIcon />
          )}
        </div>
      )}
      <span className={`${config.textSize} ${textColor} ${fontWeight}`}>
        {symbol}
      </span>
    </span>
  );
}

/**
 * Utility function to get token data for TokenSymbol component
 * @param {string} tokenAddress - Token contract address
 * @param {Object} tokensData - Tokens data object
 * @returns {Object} Token data for the component
 */
export function getTokenDataForSymbol(tokenAddress, tokensData) {
  if (!tokensData || !tokenAddress) return null;
  return tokensData[tokenAddress.toLowerCase()];
}
