/**
 * 1Inch Spot Price APIs for Ethereum Network
 */
import { apiCall } from './utils';

// ============================================================================
// Whitelisted Token Prices
// ============================================================================

/**
 * Get prices for whitelisted tokens
 * @param {PriceApiOptions} [options] - Options for the request
 * @returns {Promise<PricesMap>} Prices for whitelisted tokens (address -> price)
 */
export async function getWhitelistPrices(options = {}) {
  const { currency } = options;
  return apiCall('/price/v1.1/1', {
    params: { currency },
  });
}

// ============================================================================
// Custom Token Prices
// ============================================================================

/**
 * Get prices for requested tokens via POST request
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress[]} tokens - Array of token addresses
 * @param {string} currency - Currency code (e.g. 'USD')
 * @returns {Promise<PricesMap>} Prices for requested tokens (address -> price)
 */
export async function getPrices(chainId, tokens, currency = 'USD') {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  return apiCall(`/price/v1.1/${chainId}`, {
    method: 'POST',
    body: { tokens, currency },
  });
}

/**
 * Get prices for specific token addresses via GET request
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress | TokenAddress[]} addresses - Single address or array of token addresses
 * @param {string} currency - Currency code (e.g. 'USD')
 * @returns {Promise<PricesMap>} Prices for requested tokens (address -> price)
 */
export async function getPricesByAddresses(
  chainId,
  addresses,
  currency = 'USD'
) {
  if (!addresses) {
    throw new Error('addresses parameter is required');
  }
  // Convert single address to array for consistent handling
  const addressArray = Array.isArray(addresses) ? addresses : [addresses];
  const addressesParam = addressArray.join(',');
  return apiCall(`/price/v1.1/${chainId}/${addressesParam}`, {
    params: { currency },
  });
}

// ============================================================================
// Currency Support
// ============================================================================

/**
 * Get list of supported currencies
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @returns {Promise<CurrenciesResponseDto>} List of supported currency codes
 */
export async function getSupportedCurrencies(chainId) {
  return apiCall(`/price/v1.1/${chainId}/currencies`);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get price for a single token with error handling
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress} tokenAddress - Token address
 * @param {string} currency - Currency code (e.g. 'USD')
 * @returns {Promise<string | null>} Token price or null if not found
 */
export async function getSingleTokenPrice(
  chainId,
  tokenAddress,
  currency = 'USD'
) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  try {
    const prices = await getPricesByAddresses(chainId, tokenAddress, currency);
    return prices[tokenAddress] || null;
  } catch (error) {
    console.warn(`Failed to get price for token ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Get prices with automatic chunking for large token lists
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress[]} tokens - Array of token addresses
 * @param {number} chunkSize - Chunk size for batching
 * @returns {Promise<PricesMap>} Combined prices map
 */
export async function getBatchPrices(
  chainId,
  tokens,
  currency = 'USD',
  chunkSize = 100
) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  if (tokens.length <= chunkSize) {
    return getPrices(chainId, tokens, currency);
  }
  const chunks = [];
  for (let i = 0; i < tokens.length; i += chunkSize) {
    chunks.push(tokens.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map((chunk) => getPrices(chainId, chunk, currency))
  );
  return results.reduce((combined, result) => ({ ...combined, ...result }), {});
}

/**
 * Get prices in multiple currencies for comparison
 * @param {TokenAddress[]} tokens - Array of token addresses
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {SupportedCurrency[]} currencies - Array of currencies to get prices in
 * @returns {Promise<Record<SupportedCurrency, PricesMap>>} Prices by currency
 */
export async function getMultiCurrencyPrices(chainId, tokens, currencies) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  if (!Array.isArray(currencies) || currencies.length === 0) {
    throw new Error('currencies must be a non-empty array');
  }
  const pricePromises = currencies.map((currency) =>
    getPrices(chainId, tokens, currency).then((prices) => ({
      currency,
      prices,
    }))
  );
  const results = await Promise.all(pricePromises);
  return results.reduce((combined, { currency, prices }) => {
    combined[currency] = prices;
    return combined;
  }, {});
}

/**
 * Get price with fallback to whitelisted prices if custom token fails
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress} tokenAddress - Token address
 * @param {string} currency - Currency code (e.g. 'USD')
 * @returns {Promise<string | null>} Token price or null if not found
 */
export async function getPriceWithFallback(
  chainId,
  tokenAddress,
  currency = 'USD'
) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  try {
    // Try to get price via specific address endpoint
    const prices = await getPricesByAddresses(chainId, tokenAddress, currency);
    if (prices[tokenAddress]) {
      return prices[tokenAddress];
    }
  } catch (error) {
    console.warn(
      `Custom price lookup failed for ${tokenAddress}, trying whitelist...`
    );
  }
  try {
    // Fallback to whitelist prices
    const whitelistPrices = await getWhitelistPrices(chainId, currency);
    return whitelistPrices[tokenAddress] || null;
  } catch (error) {
    console.warn(`Whitelist price lookup failed for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Calculate price differences between two currencies
 * @param {number} chainId - Chain ID (e.g. 1 for Ethereum)
 * @param {TokenAddress[]} tokens - Array of token addresses
 * @param {string} baseCurrency - Base currency for comparison
 * @param {string} targetCurrency - Target currency for comparison
 * @returns {Promise<Record<string, { base: string, target: string, ratio: number }>>} Price comparison data
 */
export async function comparePricesAcrossCurrencies(
  chainId,
  tokens,
  baseCurrency,
  targetCurrency
) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  const [basePrices, targetPrices] = await Promise.all([
    getPrices(chainId, tokens, baseCurrency),
    getPrices(chainId, tokens, targetCurrency),
  ]);
  const comparison = {};
  for (const token of tokens) {
    const basePrice = basePrices[token];
    const targetPrice = targetPrices[token];
    if (basePrice && targetPrice) {
      comparison[token] = {
        base: basePrice,
        target: targetPrice,
        ratio: parseFloat(targetPrice) / parseFloat(basePrice),
      };
    }
  }
  return comparison;
}

// Default export with all functions
export default {
  // Core price APIs
  getWhitelistPrices,
  getPrices,
  getPricesByAddresses,
  getSupportedCurrencies,
  // Utility functions
  getSingleTokenPrice,
  getBatchPrices,
  getMultiCurrencyPrices,
  getPriceWithFallback,
  comparePricesAcrossCurrencies,
};
