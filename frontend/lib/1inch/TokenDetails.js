/**
 * 1Inch Token Details APIs - Comprehensive token information and analytics
 */
import { apiCall } from './utils';

// ============================================================================
// Token Details and Information
// ============================================================================

/**
 * Get detailed information for native chain token
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenDetailsOptions} [options] - Options for the request
 * @returns {Promise<TokenDetailsResult>} Detailed token information
 */
export async function getNativeTokenDetails(chainId, options = {}) {
  const { provider } = options;
  return apiCall(`/token-details/v1.0/details/${chainId}`, {
    params: { provider },
  });
}

/**
 * Get detailed information for a specific token
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} contractAddress - Token contract address
 * @param {TokenDetailsOptions} [options] - Options for the request
 * @returns {Promise<TokenDetailsResult>} Detailed token information
 */
export async function getTokenDetails(chainId, contractAddress, options = {}) {
  if (!contractAddress) {
    throw new Error('contractAddress parameter is required');
  }
  const { provider } = options;
  return apiCall(`/token-details/v1.0/details/${chainId}/${contractAddress}`, {
    params: { provider },
  });
}

// ============================================================================
// Price Charts by Time Range
// ============================================================================

/**
 * Get historical native token price chart by time range
 * @param {ChainId} chainId - Chain ID of the network
 * @param {ChartRangeOptions} options - Chart range options
 * @returns {Promise<ChartDataResult>} Historical price chart data
 */
export async function getNativeTokenChartByRange(chainId, options) {
  const { from, to, provider, fromTime } = options;
  if (from === undefined || to === undefined) {
    throw new Error('from and to parameters are required');
  }
  return apiCall(`/token-details/v1.0/charts/range/${chainId}`, {
    params: { from, to, provider, from_time: fromTime },
  });
}

/**
 * Get historical token price chart by time range
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} tokenAddress - Token contract address
 * @param {ChartRangeOptions} options - Chart range options
 * @returns {Promise<ChartDataResult>} Historical price chart data
 */
export async function getTokenChartByRange(chainId, tokenAddress, options) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  const { from, to, provider, fromTime } = options;
  if (from === undefined || to === undefined) {
    throw new Error('from and to parameters are required');
  }
  return apiCall(
    `/token-details/v1.0/charts/range/${chainId}/${tokenAddress}`,
    {
      params: { from, to, provider, from_time: fromTime },
    }
  );
}

// ============================================================================
// Price Charts by Time Interval
// ============================================================================

/**
 * Get historical native token price chart by time interval
 * @param {ChainId} chainId - Chain ID of the network
 * @param {ChartIntervalOptions} options - Chart interval options
 * @returns {Promise<ChartDataResult>} Historical price chart data
 */
export async function getNativeTokenChartByInterval(chainId, options) {
  const { interval, provider, fromTime } = options;
  if (!interval) {
    throw new Error('interval parameter is required');
  }
  return apiCall(`/token-details/v1.0/charts/interval/${chainId}`, {
    params: { interval, provider, from_time: fromTime },
  });
}

/**
 * Get historical token price chart by time interval
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} tokenAddress - Token contract address
 * @param {ChartIntervalOptions} options - Chart interval options
 * @returns {Promise<ChartDataResult>} Historical price chart data
 */
export async function getTokenChartByInterval(chainId, tokenAddress, options) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  const { interval, provider, fromTime } = options;
  if (!interval) {
    throw new Error('interval parameter is required');
  }
  return apiCall(
    `/token-details/v1.0/charts/interval/${chainId}/${tokenAddress}`,
    {
      params: { interval, provider, from_time: fromTime },
    }
  );
}

// ============================================================================
// Price Change Analytics
// ============================================================================

/**
 * Get native token price change by interval
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TimeInterval} interval - Time interval for price change
 * @returns {Promise<PriceChangeResult>} Price change data
 */
export async function getNativeTokenPriceChange(chainId, interval) {
  if (!interval) {
    throw new Error('interval parameter is required');
  }
  return apiCall(`/token-details/v1.0/prices/change/${chainId}`, {
    params: { interval },
  });
}

/**
 * Get token price change by interval
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} tokenAddress - Token contract address
 * @param {TimeInterval} interval - Time interval for price change
 * @returns {Promise<PriceChangeResult>} Price change data
 */
export async function getTokenPriceChange(chainId, tokenAddress, interval) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  if (!interval) {
    throw new Error('interval parameter is required');
  }
  return apiCall(
    `/token-details/v1.0/prices/change/${chainId}/${tokenAddress}`,
    {
      params: { interval },
    }
  );
}

/**
 * Get price changes for multiple tokens by interval
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress[]} tokenAddresses - Array of token addresses
 * @param {TimeInterval} interval - Time interval for price change
 * @returns {Promise<TokenListPriceChangeResult>} Array of price change data for each token
 */
export async function getTokenListPriceChanges(
  chainId,
  tokenAddresses,
  interval
) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('tokenAddresses must be a non-empty array');
  }
  if (!interval) {
    throw new Error('interval parameter is required');
  }
  return apiCall(`/token-details/v1.0/prices/change/${chainId}`, {
    method: 'POST',
    body: { tokenAddresses, interval },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get complete token analytics including details, chart, and price change
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} tokenAddress - Token contract address
 * @param {Object} [options] - Options for the request
 * @param {TimeInterval} [options.interval='24h'] - Time interval for charts and price change
 * @param {ChartProvider} [options.provider] - Chart data provider
 * @returns {Promise<{ details: TokenDetailsResult, chart: ChartDataResult, priceChange: PriceChangeResult }>} Complete token analytics
 */
export async function getCompleteTokenAnalytics(
  chainId,
  tokenAddress,
  options = {}
) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  const { interval = '24h', provider } = options;
  const [details, chart, priceChange] = await Promise.all([
    getTokenDetails(chainId, tokenAddress, { provider }),
    getTokenChartByInterval(chainId, tokenAddress, { interval, provider }),
    getTokenPriceChange(chainId, tokenAddress, interval),
  ]);
  return {
    details,
    chart,
    priceChange,
  };
}

/**
 * Get complete native token analytics
 * @param {ChainId} chainId - Chain ID of the network
 * @param {Object} [options] - Options for the request
 * @param {TimeInterval} [options.interval='24h'] - Time interval for charts and price change
 * @param {ChartProvider} [options.provider] - Chart data provider
 * @returns {Promise<{ details: TokenDetailsResult, chart: ChartDataResult, priceChange: PriceChangeResult }>} Complete native token analytics
 */
export async function getCompleteNativeTokenAnalytics(chainId, options = {}) {
  const { interval = '24h', provider } = options;
  const [details, chart, priceChange] = await Promise.all([
    getNativeTokenDetails(chainId, { provider }),
    getNativeTokenChartByInterval(chainId, { interval, provider }),
    getNativeTokenPriceChange(chainId, interval),
  ]);
  return {
    details,
    chart,
    priceChange,
  };
}

/**
 * Get batch price changes for multiple tokens with chunking
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress[]} tokenAddresses - Array of token addresses
 * @param {TimeInterval} interval - Time interval for price change
 * @param {Object} [options] - Options for the request
 * @param {number} [options.chunkSize=50] - Number of tokens per batch
 * @returns {Promise<TokenListPriceChangeResult>} Combined price change data
 */
export async function getBatchTokenPriceChanges(
  chainId,
  tokenAddresses,
  interval,
  options = {}
) {
  const { chunkSize = 50 } = options;
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('tokenAddresses must be a non-empty array');
  }
  if (tokenAddresses.length <= chunkSize) {
    return getTokenListPriceChanges(chainId, tokenAddresses, interval);
  }
  const chunks = [];
  for (let i = 0; i < tokenAddresses.length; i += chunkSize) {
    chunks.push(tokenAddresses.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map((chunk) => getTokenListPriceChanges(chainId, chunk, interval))
  );
  return results.flat();
}

/**
 * Compare price performance between multiple tokens
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress[]} tokenAddresses - Array of token addresses to compare
 * @param {TimeInterval[]} intervals - Array of time intervals to compare
 * @returns {Promise<Record<string, Record<TimeInterval, PriceChangeResult>>>} Nested comparison data
 */
export async function compareTokenPerformance(
  chainId,
  tokenAddresses,
  intervals
) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('tokenAddresses must be a non-empty array');
  }
  if (!Array.isArray(intervals) || intervals.length === 0) {
    throw new Error('intervals must be a non-empty array');
  }
  const performanceData = {};
  // Get price changes for all tokens across all intervals
  const promises = [];
  for (const interval of intervals) {
    promises.push(
      getTokenListPriceChanges(chainId, tokenAddresses, interval).then(
        (results) => ({ interval, results })
      )
    );
  }
  const allResults = await Promise.all(promises);
  // Organize data by token address
  for (const tokenAddress of tokenAddresses) {
    performanceData[tokenAddress] = {};
    for (const { interval, results } of allResults) {
      const tokenResult = results.find((r) => r.tokenAddress === tokenAddress);
      performanceData[tokenAddress][interval] = tokenResult || {
        tokenAddress,
        inUSD: 0,
        inPercent: 0,
      };
    }
  }
  return performanceData;
}

/**
 * Get chart data with custom time range using Unix timestamps
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress} tokenAddress - Token contract address
 * @param {number} fromTimestamp - Start timestamp (Unix seconds)
 * @param {number} toTimestamp - End timestamp (Unix seconds)
 * @param {TokenDetailsOptions} [options] - Options for the request
 * @returns {Promise<ChartDataResult>} Chart data for the specified range
 */
export async function getTokenChartByTimestamps(
  chainId,
  tokenAddress,
  fromTimestamp,
  toTimestamp,
  options = {}
) {
  if (!tokenAddress) {
    throw new Error('tokenAddress parameter is required');
  }
  return getTokenChartByRange(chainId, tokenAddress, {
    from: fromTimestamp,
    to: toTimestamp,
    ...options,
  });
}

/**
 * Get native token chart data with custom time range
 * @param {ChainId} chainId - Chain ID of the network
 * @param {number} fromTimestamp - Start timestamp (Unix seconds)
 * @param {number} toTimestamp - End timestamp (Unix seconds)
 * @param {TokenDetailsOptions} [options] - Options for the request
 * @returns {Promise<ChartDataResult>} Chart data for the specified range
 */
export async function getNativeTokenChartByTimestamps(
  chainId,
  fromTimestamp,
  toTimestamp,
  options = {}
) {
  return getNativeTokenChartByRange(chainId, {
    from: fromTimestamp,
    to: toTimestamp,
    ...options,
  });
}

/**
 * Calculate price volatility from chart data
 * @param {ChartDataResult} chartData - Chart data from API
 * @returns {{ volatility: number, priceRange: { min: number, max: number, avg: number } }} Volatility metrics
 */
export function calculatePriceVolatility(chartData) {
  if (!chartData.d || chartData.d.length === 0) {
    throw new Error('Chart data is empty');
  }
  const prices = chartData.d.map((point) => point.v);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  // Calculate standard deviation as volatility measure
  const variance =
    prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) /
    prices.length;
  const volatility = Math.sqrt(variance) / avg; // Coefficient of variation
  return {
    volatility,
    priceRange: { min, max, avg },
  };
}

/**
 * Get trending tokens based on price performance
 * @param {ChainId} chainId - Chain ID of the network
 * @param {TokenAddress[]} tokenAddresses - Array of token addresses to analyze
 * @param {TimeInterval} [interval='24h'] - Time interval for analysis
 * @returns {Promise<{ trending: TokenListPriceChangeResult, declining: TokenListPriceChangeResult }>} Sorted trending and declining tokens
 */
export async function getTrendingTokens(
  chainId,
  tokenAddresses,
  interval = '24h'
) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('tokenAddresses must be a non-empty array');
  }
  const priceChanges = await getTokenListPriceChanges(
    chainId,
    tokenAddresses,
    interval
  );
  // Sort by percentage change
  const sorted = [...priceChanges].sort((a, b) => b.inPercent - a.inPercent);
  const trending = sorted.filter((token) => token.inPercent > 0);
  const declining = sorted.filter((token) => token.inPercent < 0);
  return { trending, declining };
}

// Default export with all functions
export default {
  // Core token details APIs
  getNativeTokenDetails,
  getTokenDetails,
  // Chart APIs by range
  getNativeTokenChartByRange,
  getTokenChartByRange,
  // Chart APIs by interval
  getNativeTokenChartByInterval,
  getTokenChartByInterval,
  // Price change APIs
  getNativeTokenPriceChange,
  getTokenPriceChange,
  getTokenListPriceChanges,
  // Utility functions
  getCompleteTokenAnalytics,
  getCompleteNativeTokenAnalytics,
  getBatchTokenPriceChanges,
  compareTokenPerformance,
  getTokenChartByTimestamps,
  getNativeTokenChartByTimestamps,
  calculatePriceVolatility,
  getTrendingTokens,
};
