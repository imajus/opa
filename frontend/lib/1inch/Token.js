/**
 * 1Inch Token APIs
 */
import { apiCall } from './utils';

/**
 * Get 1inch whitelisted multi-chain tokens info
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokensMap>} Multi-chain tokens info map
 */
export async function getMultiChainTokens(options = {}) {
  const { provider = '1inch', country = 'US' } = options;
  return apiCall('/token/v1.3/multi-chain', {
    params: { provider, country },
  });
}

/**
 * Get 1inch whitelisted multi-chain tokens in list format
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokenListResponseDto>} Multi-chain tokens list
 */
export async function getMultiChainTokensList(options = {}) {
  const { provider = '1inch', country = 'US' } = options;
  return apiCall('/token/v1.3/multi-chain/token-list', {
    params: { provider, country },
  });
}

/**
 * Get all supported chain ids
 * @returns {Promise<ChainId[]>} Array of supported chain IDs
 */
export async function getSupportedChains() {
  return apiCall('/token/v1.3/multi-chain/supported-chains');
}

/**
 * Search multi-chain tokens by name or symbol
 * @param {MultiChainSearchOptions} options - Search options
 * @returns {Promise<TokenDto[]>} Array of matching tokens
 */
export async function searchMultiChainTokens(options = {}) {
  const {
    query,
    ignoreListed = false,
    onlyPositiveRating,
    limit = 10,
    country = 'US',
  } = options;
  if (onlyPositiveRating === undefined || country === undefined) {
    throw new Error('onlyPositiveRating and country parameters are required');
  }
  return apiCall('/token/v1.3/search', {
    params: {
      query,
      ignore_listed: ignoreListed,
      only_positive_rating: onlyPositiveRating,
      limit,
      country,
    },
  });
}

// ============================================================================
// Single Chain Token APIs (v1.4)
// ============================================================================

/**
 * Get 1inch whitelisted tokens info for a specific chain (v1.4)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokensMap>} Tokens info map
 */
export async function getTokens(chainId, options = {}) {
  const { provider = '1inch', country = 'US' } = options;
  return apiCall(`/token/v1.4/${chainId}`, {
    params: { provider, country },
  });
}

/**
 * Get 1inch whitelisted tokens in list format for a specific chain (v1.4)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokenListResponseDto>} Tokens list
 */
export async function getTokensList(chainId, options = {}) {
  const { provider = '1inch', country = 'US' } = options;
  return apiCall(`/token/v1.4/${chainId}/token-list`, {
    params: { provider, country },
  });
}

/**
 * Search tokens by query for a specific chain (v1.4)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {SearchTokenOptions} options - Search options
 * @returns {Promise<TokenDto[]>} Array of matching tokens
 */
export async function searchTokens(chainId, options = {}) {
  const {
    query,
    ignoreListed = false,
    onlyPositiveRating = true,
    limit = 10,
    country = 'US',
  } = options;
  return apiCall(`/token/v1.4/${chainId}/search`, {
    params: {
      query,
      ignore_listed: ignoreListed,
      only_positive_rating: onlyPositiveRating,
      limit,
    },
  });
}

/**
 * Get multiple tokens info by addresses (v1.4)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenAddress[]} addresses - Array of token addresses
 * @returns {Promise<CustomTokensMap>} Tokens info map
 */
export async function getCustomTokens(chainId, addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('addresses must be a non-empty array');
  }
  return apiCall(`/token/v1.4/${chainId}/custom`, {
    params: { addresses },
  });
}

/**
 * Get single token info by address (v1.4)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenAddress} address - Token address
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokenDto>} Token info
 */
export async function getCustomToken(chainId, address) {
  if (!address) {
    throw new Error('address parameter is required');
  }
  return apiCall(`/token/v1.4/${chainId}/custom/${address}`, {});
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get token info (alias for getCustomToken for backward compatibility)
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenAddress} address - Token address
 * @param {TokenApiOptions} options - Options for the request
 * @returns {Promise<TokenDto>} Token info
 */
export async function getTokenWithFallback(chainId, address, options = {}) {
  return getCustomToken(chainId, address, options);
}

/**
 * Batch get multiple tokens with automatic chunking for large requests
 * @param {ChainId} chainId - The blockchain chain ID
 * @param {TokenAddress[]} addresses - Array of token addresses
 * @param {TokenApiOptions & { chunkSize?: number }} options - Options for the request
 * @returns {Promise<CustomTokensMap>} Combined tokens info map
 */
export async function batchGetTokens(chainId, addresses, options = {}) {
  const { chunkSize = 50, ...restOptions } = options;
  if (addresses.length <= chunkSize) {
    return getCustomTokens(chainId, addresses, restOptions);
  }
  const chunks = [];
  for (let i = 0; i < addresses.length; i += chunkSize) {
    chunks.push(addresses.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map((chunk) => getCustomTokens(chainId, chunk, restOptions))
  );
  return results.reduce((combined, result) => ({ ...combined, ...result }), {});
}

// Default export with all functions
export default {
  // Multi-chain APIs
  getMultiChainTokens,
  getMultiChainTokensList,
  getSupportedChains,
  searchMultiChainTokens,
  // Single-chain APIs (v1.4)
  getTokens,
  getTokensList,
  searchTokens,
  getCustomTokens,
  getCustomToken,
  // Utility functions
  getTokenWithFallback,
  batchGetTokens,
};
