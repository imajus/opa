'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Domains } from '../lib/1inch';

/**
 * Generic Ethereum address input component with ENS/domain support
 * Automatically resolves domain names (like .eth) to addresses
 *
 * @example
 * <AddressInput
 *   label="Recipient Address"
 *   value={address}
 *   onChange={(resolvedAddress) => setAddress(resolvedAddress)}
 *   placeholder="Enter address or domain (e.g., vitalik.eth)"
 *   required={true}
 *   hint="Supports ENS domains and other name services"
 *   debounceMs={300} // Custom throttling delay
 * />
 *
 * Features:
 * - Automatic domain resolution (e.g., vitalik.eth → 0x123...)
 * - Preserves user input (displays domain name, resolves to address)
 * - Real-time validation for Ethereum addresses
 * - Throttled API requests (500ms debounce) to prevent excessive calls
 * - Loading states during domain resolution
 * - Error handling for invalid domains
 * - Visual feedback with icons and status messages
 * - Full accessibility support
 */
export default function AddressInput({
  label,
  value,
  onChange,
  placeholder = 'Enter Ethereum address or domain (e.g., vitalik.eth)',
  required = false,
  error = null,
  hint = null,
  className = '',
  disabled = false,
  debounceMs = 500, // Configurable debounce delay for API throttling
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const resolveTimeoutRef = useRef(null);
  const lastResolvedAddressRef = useRef(null);
  const isUserTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Initialize input value from prop (but don't interfere with user typing)
  useEffect(() => {
    // Only update if user is not actively typing and it's a genuinely new external value
    if (
      !isUserTypingRef.current &&
      value &&
      value !== lastResolvedAddressRef.current
    ) {
      // Only update if the current input is empty or significantly different
      if (
        !inputValue ||
        (value !== inputValue && value.trim() !== inputValue.trim())
      ) {
        setInputValue(value);
        setResolvedAddress(null);
        setResolveError(null);
      }
    }
  }, [value]);

  // Check if input looks like a domain name
  const isDomainName = useCallback((input) => {
    if (!input || typeof input !== 'string') return false;
    return (
      input.includes('.') &&
      !input.startsWith('0x') &&
      /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)
    );
  }, []);

  // Check if input looks like an Ethereum address
  const isEthereumAddress = useCallback((input) => {
    if (!input || typeof input !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(input);
  }, []);

  // Resolve domain to address
  const resolveDomain = useCallback(
    async (domain) => {
      setIsResolving(true);
      setResolveError(null);
      setResolvedAddress(null);

      try {
        const address = await Domains.getAddressForDomain(domain);
        if (address) {
          setResolvedAddress(address);
          lastResolvedAddressRef.current = address;
          // Call onChange with the resolved address
          onChange?.(address);
          return address;
        } else {
          setResolveError('Domain not found');
          lastResolvedAddressRef.current = null;
          return null;
        }
      } catch (error) {
        console.warn('Failed to resolve domain:', error);
        setResolveError('Failed to resolve domain');
        lastResolvedAddressRef.current = null;
        return null;
      } finally {
        setIsResolving(false);
      }
    },
    [onChange]
  );

  // Debounced domain resolution to throttle API calls
  const debouncedResolveDomain = useCallback(
    (domain) => {
      // Clear any existing timeout
      if (resolveTimeoutRef.current) {
        clearTimeout(resolveTimeoutRef.current);
        setIsResolving(false);
      }

      // Set loading state immediately for UX feedback
      setIsResolving(true);
      setResolveError(null);
      setResolvedAddress(null);

      // Set new timeout for the API call
      resolveTimeoutRef.current = setTimeout(() => {
        resolveDomain(domain);
      }, debounceMs);
    },
    [resolveDomain, debounceMs]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (resolveTimeoutRef.current) {
        clearTimeout(resolveTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      lastResolvedAddressRef.current = null;
      isUserTypingRef.current = false;
    };
  }, []);

  // Handle input changes
  const handleInputChange = useCallback(
    (e) => {
      const rawValue = e.target.value;
      const trimmedValue = rawValue.trim();

      // Mark that user is actively typing
      isUserTypingRef.current = true;

      // Always update input with raw value to preserve user typing experience
      setInputValue(rawValue);

      // Clear any pending resolution when input changes
      if (resolveTimeoutRef.current) {
        clearTimeout(resolveTimeoutRef.current);
        setIsResolving(false);
      }

      setResolvedAddress(null);
      setResolveError(null);
      lastResolvedAddressRef.current = null;

      // Clear typing flag after a brief delay
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);

      // Use trimmed value for validation and processing
      if (!trimmedValue) {
        onChange?.('');
        return;
      }

      if (isEthereumAddress(trimmedValue)) {
        // Valid Ethereum address - use directly
        onChange?.(trimmedValue);
      } else if (isDomainName(trimmedValue)) {
        // Domain name - resolve to address (debounced)
        debouncedResolveDomain(trimmedValue);
      } else if (trimmedValue.startsWith('0x')) {
        // Looks like an incomplete address
        onChange?.(trimmedValue);
      } else {
        // Neither address nor domain - pass as is for now
        onChange?.(trimmedValue);
      }
    },
    [onChange, isEthereumAddress, isDomainName, debouncedResolveDomain]
  );

  // Determine validation status
  const getValidationStatus = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return null;
    if (isResolving) return 'resolving';
    if (resolveError) return 'error';
    if (isEthereumAddress(trimmedValue)) return 'valid-address';
    if (isDomainName(trimmedValue) && resolvedAddress) return 'resolved-domain';
    if (trimmedValue.startsWith('0x')) return 'incomplete-address';
    return 'unknown';
  };

  const validationStatus = getValidationStatus();

  // Get input styling based on validation status
  const getInputClassName = () => {
    let baseClasses =
      'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors duration-150';

    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed`;
    }

    switch (validationStatus) {
      case 'valid-address':
      case 'resolved-domain':
        return `${baseClasses} border-green-300 focus:ring-green-500 focus:border-green-500 bg-green-50 text-gray-900`;
      case 'error':
        return `${baseClasses} border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 text-gray-900`;
      case 'resolving':
        return `${baseClasses} border-blue-300 focus:ring-blue-500 focus:border-blue-500 bg-blue-50 text-gray-900`;
      default:
        return `${baseClasses} border-gray-300 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500`;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={getInputClassName()}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Loading indicator */}
        {isResolving && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Validation icons */}
        {!isResolving && validationStatus === 'valid-address' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
          </div>
        )}

        {!isResolving && validationStatus === 'resolved-domain' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
        )}

        {!isResolving && validationStatus === 'error' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Status messages */}
      <div className="min-h-[1rem]">
        {validationStatus === 'resolved-domain' && resolvedAddress && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Resolved to: {resolvedAddress.slice(0, 6)}...
            {resolvedAddress.slice(-4)}
          </p>
        )}

        {validationStatus === 'resolving' && (
          <p className="text-xs text-blue-600 flex items-center gap-1">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></div>
            Resolving domain...
          </p>
        )}

        {resolveError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {resolveError}
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            {error}
          </p>
        )}

        {hint &&
          !error &&
          !resolveError &&
          validationStatus !== 'resolved-domain' && (
            <p className="text-xs text-gray-500">{hint}</p>
          )}
      </div>
    </div>
  );
}
