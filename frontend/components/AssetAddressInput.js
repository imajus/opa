import { useState, useEffect, useMemo, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { useAccount } from 'wagmi';
import { Token } from '../lib/1inch';

/**
 * Enhanced searchable asset address input with token suggestions
 * Features token search, logos, and manual address entry
 */
export const AssetAddressInput = ({
  label,
  value,
  onChange,
  placeholder = 'Search tokens or enter address (0x...)',
  required = false,
  error = null,
  hint = null,
}) => {
  const { chain } = useAccount();
  const [query, setQuery] = useState('');
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Search for tokens when query changes
  useEffect(() => {
    const searchForTokens = async () => {
      if (!chain?.id) {
        setTokens([]);
        return;
      }
      // If query looks like an address, don't search
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        setTokens([]);
        return;
      }
      setIsLoading(true);
      setTokens([]);
      setSearchError(null);
      try {
        let results;
        if (!query.trim() || query.length < 2) {
          // Show popular tokens when no query
          results = await Token.searchTokens(chain.id, {
            query: 'eth', // Get ETH and ETH-related tokens as defaults
            limit: 8,
            onlyPositiveRating: true,
          });
        } else {
          // Search with user query
          results = await Token.searchTokens(chain.id, {
            query: query.trim(),
            limit: 20,
            onlyPositiveRating: true,
          });
        }
        setTokens(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Token search error:', err);
        setSearchError('Failed to search tokens');
        setTokens([]);
      } finally {
        setIsLoading(false);
      }
    };
    const timeoutId = setTimeout(searchForTokens, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, chain?.id]);

  // Get display value for selected token
  const displayValue = useMemo(() => {
    if (!value) return '';
    // Check if value matches a token from our search results
    const matchedToken = tokens.find(
      (token) => token.address.toLowerCase() === value.toLowerCase()
    );
    if (matchedToken) {
      return `${matchedToken.symbol} - ${matchedToken.name}`;
    }
    // Return the raw address for manual entries
    return value;
  }, [value, tokens]);

  // Validate address format
  const validateAddress = (addr) => {
    if (!addr) return '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return 'Must be a valid Ethereum address (0x + 40 hex characters)';
    }
    return '';
  };

  const handleSelection = (selectedItem) => {
    if (selectedItem?.address) {
      onChange(selectedItem.address);
    } else if (selectedItem) {
      // Handle manual address input
      onChange(selectedItem);
    }
  };

  const handleInputChange = (inputValue) => {
    setQuery(inputValue);

    // If user is typing an address directly, update the value
    if (/^0x[a-fA-F0-9]*$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  const addressError = value ? validateAddress(value) : null;
  const finalError = error || addressError;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <Combobox value={value} onChange={handleSelection}>
        <div className="relative">
          <Combobox.Input
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500 ${
              finalError ? 'border-red-500' : 'border-gray-300'
            }`}
            displayValue={() => displayValue}
            onChange={(event) => handleInputChange(event.target.value)}
            placeholder={placeholder}
            required={required}
          />

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {isLoading && (
                <div className="px-4 py-2 text-gray-500 text-sm">
                  Searching tokens...
                </div>
              )}

              {searchError && (
                <div className="px-4 py-2 text-red-500 text-sm">
                  {searchError}
                </div>
              )}

              {!isLoading &&
                tokens.length === 0 &&
                query.length >= 2 &&
                !searchError && (
                  <div className="px-4 py-2 text-gray-500 text-sm">
                    No tokens found. You can enter a custom address.
                  </div>
                )}

              {tokens.map((token) => (
                <Combobox.Option
                  key={token.address}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-3 pr-4 ${
                      active ? 'bg-primary-orange text-white' : 'text-gray-900'
                    }`
                  }
                  value={token}
                >
                  <div className="flex items-center">
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={`${token.symbol} logo`}
                        className="h-6 w-6 rounded-full mr-3 flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">
                          {token.symbol}
                        </span>
                        {token.rating && (
                          <span className="text-xs opacity-75 ml-2">
                            ★ {token.rating}
                          </span>
                        )}
                      </div>
                      <div className="text-sm opacity-75 truncate">
                        {token.name}
                      </div>
                      <div className="text-xs opacity-50 font-mono">
                        {token.address.slice(0, 8)}...{token.address.slice(-6)}
                      </div>
                    </div>
                  </div>
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>

      {finalError && <p className="text-red-600 text-sm mt-1">{finalError}</p>}

      {hint && !finalError && (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      )}

      {!chain && (
        <p className="text-xs text-amber-600 mt-1">
          Connect wallet to enable token search
        </p>
      )}
    </div>
  );
};
