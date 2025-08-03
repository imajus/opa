import { useState, useMemo } from 'react';
import AsyncSelect from 'react-select/async';
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
  const [cachedTokens, setCachedTokens] = useState(new Map());

  // Validate address format
  const validateAddress = (addr) => {
    if (!addr) return '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return 'Must be a valid Ethereum address (0x + 40 hex characters)';
    }
    return '';
  };

  // Load options function for AsyncSelect
  const loadOptions = async (inputValue) => {
    if (!chain?.id) {
      return [];
    }

    const query = inputValue.trim();

    // If input looks like an address, create an option for it
    if (/^0x[a-fA-F0-9]+$/.test(query)) {
      const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
      return [
        {
          value: query,
          label: isValidAddress
            ? `Address: ${query}`
            : 'Invalid address format',
          address: query,
          isAddress: true,
          isValid: isValidAddress,
        },
      ];
    }

    // Check cache first
    const cacheKey = `${chain.id}-${query}`;
    if (cachedTokens.has(cacheKey)) {
      return cachedTokens.get(cacheKey);
    }

    try {
      let results;
      if (!query || query.length < 2) {
        // Show popular tokens when no query
        results = await Token.searchTokens(chain.id, {
          query: 'eth',
          limit: 8,
          onlyPositiveRating: true,
        });
      } else {
        // Search with user query
        results = await Token.searchTokens(chain.id, {
          query: query,
          limit: 20,
          onlyPositiveRating: true,
        });
      }

      const options = (Array.isArray(results) ? results : []).map((token) => ({
        value: token.address,
        label: token.symbol,
        token: token,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI,
        rating: token.rating,
      }));

      // Cache the results
      setCachedTokens((prev) => new Map(prev).set(cacheKey, options));

      return options;
    } catch (err) {
      console.error('Token search error:', err);
      return [];
    }
  };

  // Get the current selected option for display
  const selectedOption = useMemo(() => {
    if (!value) return null;

    // First check if it's a cached token
    for (const options of cachedTokens.values()) {
      const found = options.find(
        (opt) => opt.value.toLowerCase() === value.toLowerCase()
      );
      if (found) return found;
    }

    // If it's an address, create an option for it
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return {
        value: value,
        label: `Address: ${value}`,
        address: value,
        isAddress: true,
        isValid: true,
      };
    }

    return null;
  }, [value, cachedTokens]);

  // Handle selection
  const handleChange = (selectedOption) => {
    if (selectedOption) {
      onChange(selectedOption.value);
    } else {
      onChange('');
    }
  };

  // Handle manual input (for addresses)
  const handleInputChange = (inputValue) => {
    // If user is typing an address directly, update the value
    if (/^0x[a-fA-F0-9]*$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  const addressError = value ? validateAddress(value) : null;
  const finalError = error || addressError;

  // Custom option component with token details
  const CustomOption = ({
    innerRef,
    innerProps,
    data,
    isSelected,
    isFocused,
  }) => (
    <div
      ref={innerRef}
      {...innerProps}
      className={`relative cursor-pointer select-none py-2 pl-3 pr-4 ${
        isFocused ? 'bg-primary-orange text-white' : 'text-gray-900'
      } ${isSelected ? 'bg-blue-50' : ''}`}
    >
      <div className="flex items-center">
        {data.logoURI && !data.isAddress && (
          <img
            src={data.logoURI}
            alt={`${data.symbol} logo`}
            className="h-6 w-6 rounded-full mr-3 flex-shrink-0"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          {data.isAddress ? (
            <div>
              <div className="font-medium truncate text-sm">
                {data.isValid ? 'Custom Address' : 'Invalid Address'}
              </div>
              <div className="text-xs opacity-75 font-mono truncate">
                {data.address}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{data.symbol}</span>
                {data.rating && (
                  <span className="text-xs opacity-75 ml-2">
                    ★ {data.rating}
                  </span>
                )}
              </div>
              <div className="text-sm opacity-75 truncate">{data.name}</div>
              <div className="text-xs opacity-50 font-mono">
                {data.address.slice(0, 8)}...{data.address.slice(-6)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Custom styles for React Select
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '40px',
      border: finalError
        ? '1px solid #ef4444'
        : state.isFocused
          ? '2px solid #f97316'
          : '1px solid #d1d5db',
      borderRadius: '0.375rem',
      boxShadow: state.isFocused ? '0 0 0 1px #f97316' : 'none',
      '&:hover': {
        border: finalError ? '1px solid #ef4444' : '1px solid #9ca3af',
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#9ca3af',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 10,
      maxHeight: '240px',
    }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: '240px',
    }),
    loadingMessage: (provided) => ({
      ...provided,
      color: '#6b7280',
      fontSize: '0.875rem',
      padding: '8px 16px',
    }),
    noOptionsMessage: (provided) => ({
      ...provided,
      color: '#6b7280',
      fontSize: '0.875rem',
      padding: '8px 16px',
    }),
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <AsyncSelect
        value={selectedOption}
        onChange={handleChange}
        onInputChange={handleInputChange}
        loadOptions={loadOptions}
        placeholder={placeholder}
        isClearable
        isSearchable
        cacheOptions
        defaultOptions
        styles={customStyles}
        components={{ Option: CustomOption }}
        loadingMessage={() => 'Searching tokens...'}
        noOptionsMessage={({ inputValue }) =>
          !inputValue
            ? 'Start typing to search tokens or enter an address'
            : inputValue.length < 2
              ? 'Type at least 2 characters'
              : 'No tokens found. You can enter a custom address.'
        }
        isDisabled={!chain}
        getOptionLabel={(option) =>
          option.isAddress
            ? `Address: ${option.address.slice(0, 8)}...${option.address.slice(-6)}`
            : `${option.symbol} - ${option.name}`
        }
        getOptionValue={(option) => option.value}
      />

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
