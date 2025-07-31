/**
 * 1Inch Domains APIs (ENS and other domain name services)
 */
import { apiCall } from './utils';

// ============================================================================
// Domain Name Lookup
// ============================================================================

/**
 * Returns address for domain name if it exists
 * @param {string} domainName - Domain name (e.g., "vitalik.eth")
 * @returns {Promise<DomainLookupResult>} Domain lookup result with address
 */
export async function lookupDomain(domainName) {
  if (!domainName) {
    throw new Error('domainName parameter is required');
  }
  return apiCall('/domains/v2.0/lookup', {
    params: { name: domainName },
  });
}

// ============================================================================
// Reverse Domain Lookups
// ============================================================================

/**
 * Returns domain name for address if it exists
 * @param {Address} address - Ethereum address
 * @returns {Promise<ReverseLookupResult>} Reverse lookup result with domain
 */
export async function reverseLookup(address) {
  if (!address) {
    throw new Error('address parameter is required');
  }
  return apiCall('/domains/v2.0/reverse-lookup', {
    params: { address },
  });
}

/**
 * Returns domain names for multiple addresses if they exist
 * @param {Address[]} addresses - Array of Ethereum addresses
 * @returns {Promise<BatchReverseLookupResult>} Batch reverse lookup results
 */
export async function batchReverseLookup(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('addresses must be a non-empty array');
  }
  return apiCall('/domains/v2.0/reverse-lookup-batch', {
    method: 'POST',
    body: addresses,
  });
}

// ============================================================================
// Avatar and Profile Data
// ============================================================================

/**
 * Returns provider data with avatar for address or domain
 * @param {string} addressOrDomain - Ethereum address or domain name
 * @returns {Promise<AvatarResult>} Provider data with avatar information
 */
export async function getProviderDataWithAvatar(addressOrDomain) {
  if (!addressOrDomain) {
    throw new Error('addressOrDomain parameter is required');
  }
  return apiCall('/domains/v2.0/get-providers-data-with-avatar', {
    params: { addressOrDomain },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get domain name for address with error handling
 * @param {Address} address - Ethereum address
 * @returns {Promise<string | null>} Domain name or null if not found
 */
export async function getDomainForAddress(address) {
  if (!address) {
    throw new Error('address parameter is required');
  }
  try {
    const result = await reverseLookup(address);
    return result.result?.domain || null;
  } catch (error) {
    console.warn(`Failed to get domain for address ${address}:`, error);
    return null;
  }
}

/**
 * Get address for domain with error handling
 * @param {string} domainName - Domain name
 * @returns {Promise<string | null>} Address or null if not found
 */
export async function getAddressForDomain(domainName) {
  if (!domainName) {
    throw new Error('domainName parameter is required');
  }
  try {
    const result = await lookupDomain(domainName);
    return result.result?.address || null;
  } catch (error) {
    console.warn(`Failed to get address for domain ${domainName}:`, error);
    return null;
  }
}

/**
 * Get avatar URL for address or domain
 * @param {string} addressOrDomain - Ethereum address or domain name
 * @returns {Promise<any | null>} Avatar data or null if not found
 */
export async function getAvatar(addressOrDomain) {
  if (!addressOrDomain) {
    throw new Error('addressOrDomain parameter is required');
  }
  try {
    const result = await getProviderDataWithAvatar(addressOrDomain);
    return result.result?.avatar || null;
  } catch (error) {
    console.warn(`Failed to get avatar for ${addressOrDomain}:`, error);
    return null;
  }
}

/**
 * Batch get domains for multiple addresses with chunking
 * @param {Address[]} addresses - Array of Ethereum addresses
 * @param {Object} [options] - Options for the request
 * @param {number} [options.chunkSize=50] - Number of addresses per batch
 * @returns {Promise<Record<string, string | null>>} Map of address to domain name
 */
export async function batchGetDomainsForAddresses(addresses, options = {}) {
  const { chunkSize = 50 } = options;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('addresses must be a non-empty array');
  }
  if (addresses.length <= chunkSize) {
    try {
      const result = await batchReverseLookup(addresses);
      const domainMap = {};

      for (const address of addresses) {
        const providerResponses = result[address];
        domainMap[address] = providerResponses?.[0]?.domain || null;
      }

      return domainMap;
    } catch (error) {
      console.warn('Batch reverse lookup failed:', error);
      // Fallback to individual lookups
      return batchGetDomainsIndividually(addresses);
    }
  }
  // Handle large arrays with chunking
  const chunks = [];
  for (let i = 0; i < addresses.length; i += chunkSize) {
    chunks.push(addresses.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map((chunk) => batchGetDomainsForAddresses(chunk, { chunkSize }))
  );
  return results.reduce((combined, result) => ({ ...combined, ...result }), {});
}

/**
 * Fallback function for individual domain lookups
 * @param {Address[]} addresses - Array of Ethereum addresses
 * @returns {Promise<Record<string, string | null>>} Map of address to domain name
 */
async function batchGetDomainsIndividually(addresses) {
  const results = await Promise.allSettled(
    addresses.map((address) => getDomainForAddress(address))
  );
  const domainMap = {};
  addresses.forEach((address, index) => {
    const result = results[index];
    domainMap[address] = result.status === 'fulfilled' ? result.value : null;
  });
  return domainMap;
}

/**
 * Get complete profile information for address or domain
 * @param {string} addressOrDomain - Ethereum address or domain name
 * @returns {Promise<{ address: string | null, domain: string | null, avatar: any | null, protocol: string | null }>} Complete profile
 */
export async function getCompleteProfile(addressOrDomain) {
  if (!addressOrDomain) {
    throw new Error('addressOrDomain parameter is required');
  }
  const isAddress = addressOrDomain.startsWith('0x');
  let address = null;
  let domain = null;
  let avatar = null;
  let protocol = null;
  try {
    if (isAddress) {
      // Input is an address, get domain
      address = addressOrDomain;
      const reverseLookupResult = await reverseLookup(address);
      domain = reverseLookupResult.result?.domain || null;
      protocol = reverseLookupResult.result?.protocol || null;
    } else {
      // Input is a domain, get address
      domain = addressOrDomain;
      const lookupResult = await lookupDomain(domain);
      address = lookupResult.result?.address || null;
      protocol = lookupResult.result?.protocol || null;
    }
    // Get avatar data
    try {
      const avatarResult = await getProviderDataWithAvatar(addressOrDomain);
      avatar = avatarResult.result?.avatar || null;
    } catch (avatarError) {
      console.warn(`Failed to get avatar for ${addressOrDomain}:`, avatarError);
    }
  } catch (error) {
    console.warn(`Failed to get profile for ${addressOrDomain}:`, error);
  }
  return {
    address,
    domain,
    avatar,
    protocol,
  };
}

/**
 * Check if a string is a valid domain name format
 * @param {string} input - Input string to check
 * @returns {boolean} True if input looks like a domain name
 */
export function isDomainName(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  // Check for common domain patterns
  return (
    input.includes('.') &&
    !input.startsWith('0x') &&
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)
  );
}

/**
 * Check if a string is a valid Ethereum address format
 * @param {string} input - Input string to check
 * @returns {boolean} True if input looks like an Ethereum address
 */
export function isEthereumAddress(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

/**
 * Resolve input to address, handling both addresses and domain names
 * @param {string} addressOrDomain - Ethereum address or domain name
 * @returns {Promise<string | null>} Resolved address or null if not found
 */
export async function resolveToAddress(addressOrDomain) {
  if (!addressOrDomain) {
    throw new Error('addressOrDomain parameter is required');
  }
  if (isEthereumAddress(addressOrDomain)) {
    return addressOrDomain;
  }
  if (isDomainName(addressOrDomain)) {
    return getAddressForDomain(addressOrDomain);
  }
  throw new Error('Input is neither a valid address nor domain name format');
}

/**
 * Resolve input to domain name, handling both addresses and domain names
 * @param {string} addressOrDomain - Ethereum address or domain name
 * @returns {Promise<string | null>} Resolved domain name or null if not found
 */
export async function resolveToDomain(addressOrDomain) {
  if (!addressOrDomain) {
    throw new Error('addressOrDomain parameter is required');
  }
  if (isDomainName(addressOrDomain)) {
    return addressOrDomain;
  }
  if (isEthereumAddress(addressOrDomain)) {
    return getDomainForAddress(addressOrDomain);
  }
  throw new Error('Input is neither a valid address nor domain name format');
}

// Default export with all functions
export default {
  // Core domain APIs
  lookupDomain,
  reverseLookup,
  batchReverseLookup,
  getProviderDataWithAvatar,
  // Utility functions
  getDomainForAddress,
  getAddressForDomain,
  getAvatar,
  batchGetDomainsForAddresses,
  getCompleteProfile,
  // Helper functions
  isDomainName,
  isEthereumAddress,
  resolveToAddress,
  resolveToDomain,
};
