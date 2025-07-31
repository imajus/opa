/**
 * 1Inch Balance APIs for Ethereum Network
 */
import { apiCall } from './utils';

// ============================================================================
// Aggregated Balances and Allowances
// ============================================================================

/**
 * Get balances and allowances by spender for list of wallets addresses
 * @param {number} chainId - Chain ID
 * @param {SpenderAddress} spender - Spender address
 * @param {AggregatedBalancesOptions} options - Options for the request
 * @returns {Promise<AggregatedBalancesAndAllowancesResponse[]>} Aggregated balances and allowances by tokens
 */
export async function getAggregatedBalancesAndAllowances(
  chainId,
  spender,
  options = {}
) {
  const { wallets, filterEmpty } = options;
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!spender) {
    throw new Error('spender parameter is required');
  }
  if (!Array.isArray(wallets) || wallets.length === 0) {
    throw new Error('wallets must be a non-empty array');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/aggregatedBalancesAndAllowances/${spender}`,
    {
      params: { wallets, filterEmpty },
    }
  );
}

// ============================================================================
// Token Balances
// ============================================================================

/**
 * Get balances of tokens for walletAddress
 * @param {number} chainId - Chain ID
 * @param {WalletAddress} walletAddress - Wallet address
 * @returns {Promise<BalancesMap>} Token balances map (tokenAddress -> balance)
 */
export async function getBalances(chainId, walletAddress) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  return apiCall(`/balance/v1.2/${chainId}/balances/${walletAddress}`);
}

/**
 * Get balances of custom tokens for walletAddress
 * @param {number} chainId - Chain ID
 * @param {WalletAddress} walletAddress - Wallet address
 * @param {TokenAddress[]} tokens - List of custom token addresses
 * @returns {Promise<BalancesMap>} Token balances map (tokenAddress -> balance)
 */
export async function getCustomBalances(chainId, walletAddress, tokens) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  return apiCall(`/balance/v1.2/${chainId}/balances/${walletAddress}`, {
    method: 'POST',
    body: { tokens },
  });
}

/**
 * Get balances of custom tokens for list of wallets addresses
 * @param {number} chainId - Chain ID
 * @param {WalletAddress[]} wallets - List of wallet addresses
 * @param {TokenAddress[]} tokens - List of custom token addresses
 * @returns {Promise<MultiWalletBalancesMap>} Nested balances map (walletAddress -> tokenAddress -> balance)
 */
export async function getBalancesByMultipleWallets(chainId, wallets, tokens) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!Array.isArray(wallets) || wallets.length === 0) {
    throw new Error('wallets must be a non-empty array');
  }
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/balances/multiple/walletsAndTokens`,
    {
      method: 'POST',
      body: { wallets, tokens },
    }
  );
}

// ============================================================================
// Token Allowances and Balances
// ============================================================================

/**
 * Get balances and allowances of tokens by spender for walletAddress
 * @param {number} chainId - Chain ID
 * @param {SpenderAddress} spender - Spender address
 * @param {WalletAddress} walletAddress - Wallet address
 * @returns {Promise<BalancesAndAllowancesMap>} Token balances and allowances map (tokenAddress -> {balance, allowance})
 */
export async function getAllowancesAndBalances(
  chainId,
  spender,
  walletAddress
) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!spender) {
    throw new Error('spender parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/allowancesAndBalances/${spender}/${walletAddress}`
  );
}

/**
 * Get balances and allowances of custom tokens by spender for walletAddress
 * @param {number} chainId - Chain ID
 * @param {SpenderAddress} spender - Spender address
 * @param {WalletAddress} walletAddress - Wallet address
 * @param {TokenAddress[]} tokens - List of custom token addresses
 * @returns {Promise<BalancesAndAllowancesMap>} Token balances and allowances map (tokenAddress -> {balance, allowance})
 */
export async function getCustomAllowancesAndBalances(
  chainId,
  spender,
  walletAddress,
  tokens
) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!spender) {
    throw new Error('spender parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/allowancesAndBalances/${spender}/${walletAddress}`,
    {
      method: 'POST',
      body: { tokens },
    }
  );
}

// ============================================================================
// Token Allowances
// ============================================================================

/**
 * Get allowances of tokens by spender for walletAddress
 * @param {number} chainId - Chain ID
 * @param {SpenderAddress} spender - Spender address
 * @param {WalletAddress} walletAddress - Wallet address
 * @returns {Promise<AllowancesMap>} Token allowances map (tokenAddress -> allowance)
 */
export async function getAllowances(chainId, spender, walletAddress) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!spender) {
    throw new Error('spender parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/allowances/${spender}/${walletAddress}`
  );
}

/**
 * Get allowances of custom tokens by spender for walletAddress
 * @param {number} chainId - Chain ID
 * @param {SpenderAddress} spender - Spender address
 * @param {WalletAddress} walletAddress - Wallet address
 * @param {TokenAddress[]} tokens - List of custom token addresses
 * @returns {Promise<AllowancesMap>} Token allowances map (tokenAddress -> allowance)
 */
export async function getCustomAllowances(
  chainId,
  spender,
  walletAddress,
  tokens
) {
  if (!chainId) {
    throw new Error('chainId parameter is required');
  }
  if (!spender) {
    throw new Error('spender parameter is required');
  }
  if (!walletAddress) {
    throw new Error('walletAddress parameter is required');
  }
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('tokens must be a non-empty array');
  }
  return apiCall(
    `/balance/v1.2/${chainId}/allowances/${spender}/${walletAddress}`,
    {
      method: 'POST',
      body: { tokens },
    }
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get complete wallet overview including balances and allowances for a spender
 * @param {number} chainId - Chain ID
 * @param {WalletAddress} walletAddress - Wallet address
 * @param {SpenderAddress} spender - Spender address
 * @param {TokenAddress[]} [customTokens] - Optional list of custom tokens to include
 * @returns {Promise<WalletOverview>} Complete wallet overview with balances and allowances
 */
export async function getWalletOverview(
  chainId,
  walletAddress,
  spender,
  customTokens = []
) {
  const promises = [
    getBalances(chainId, walletAddress),
    getAllowances(chainId, spender, walletAddress),
  ];
  // Add custom tokens if provided
  if (customTokens.length > 0) {
    promises.push(
      getCustomBalances(chainId, walletAddress, customTokens),
      getCustomAllowances(chainId, spender, walletAddress, customTokens)
    );
  }
  const [balances, allowances, customBalances = {}, customAllowances = {}] =
    await Promise.all(promises);
  return {
    balances: { ...balances, ...customBalances },
    allowances: { ...allowances, ...customAllowances },
    walletAddress,
    spender,
  };
}

/**
 * Batch get wallet overviews for multiple wallets
 * @param {number} chainId - Chain ID
 * @param {WalletAddress[]} walletAddresses - List of wallet addresses
 * @param {SpenderAddress} spender - Spender address
 * @param {TokenAddress[]} [customTokens] - Optional list of custom tokens to include
 * @returns {Promise<WalletOverview[]>} Array of wallet overviews
 */
export async function getBatchWalletOverviews(
  chainId,
  walletAddresses,
  spender,
  customTokens = []
) {
  if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
    throw new Error('walletAddresses must be a non-empty array');
  }
  return Promise.all(
    walletAddresses.map((address) =>
      getWalletOverview(chainId, address, spender, customTokens)
    )
  );
}

// Default export with all functions
export default {
  // Aggregated APIs
  getAggregatedBalancesAndAllowances,
  // Balance APIs
  getBalances,
  getCustomBalances,
  getBalancesByMultipleWallets,
  // Allowances and Balances APIs
  getAllowancesAndBalances,
  getCustomAllowancesAndBalances,
  // Allowances APIs
  getAllowances,
  getCustomAllowances,
  // Utility functions
  getWalletOverview,
  getBatchWalletOverviews,
};
