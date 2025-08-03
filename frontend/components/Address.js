'use client';

import { useState, useEffect } from 'react';
import { Domains } from '../lib/1inch';

export default function Address({
  address,
  truncate = true,
  showCopy = true,
  className = '',
  size = 'sm',
  showDomain = true,
}) {
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState(null);
  const [loadingDomain, setLoadingDomain] = useState(false);

  // Fetch domain name for the address
  useEffect(() => {
    if (!address || !showDomain) {
      setDomain(null);
      return;
    }

    const fetchDomain = async () => {
      setLoadingDomain(true);
      try {
        const domainName = await Domains.getDomainForAddress(address);
        setDomain(domainName);
      } catch (error) {
        console.warn('Failed to fetch domain for address:', error);
        setDomain(null);
      } finally {
        setLoadingDomain(false);
      }
    };

    fetchDomain();
  }, [address, showDomain]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const formatAddress = (addr) => {
    if (!truncate || !addr) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="flex flex-col">
        {/* Domain name if available */}
        {showDomain && (domain || loadingDomain) && (
          <div className="flex items-center gap-1">
            {loadingDomain ? (
              <span
                className={`text-gray-400 ${sizeClasses[size]} animate-pulse`}
              >
                Loading...
              </span>
            ) : domain ? (
              <span
                className={`text-blue-600 font-medium ${sizeClasses[size]}`}
                title={`Domain: ${domain}`}
              >
                {domain}
              </span>
            ) : null}
          </div>
        )}

        {/* Address */}
        <span
          className={`font-mono text-gray-500 ${sizeClasses[size]}`}
          title={address}
        >
          {formatAddress(address)}
        </span>
      </div>

      {showCopy && (
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-gray-100 rounded transition-colors duration-150 group"
          title={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
