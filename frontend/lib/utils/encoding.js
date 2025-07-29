/**
 * URL Parameter Encoding Utilities
 * Provides functions for encoding/decoding complex data as URL parameters
 */

/**
 * Encodes an object to a base64 URL-safe string
 * @param {Object} data - Object to encode
 * @returns {string} Base64 encoded string
 */
export function encodeToBase64(data) {
  try {
    const jsonString = JSON.stringify(data);
    // Use btoa for base64 encoding and make it URL-safe
    return btoa(jsonString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('Error encoding to base64:', error);
    throw new Error('Failed to encode data');
  }
}

/**
 * Decodes a base64 URL-safe string to an object
 * @param {string} encodedData - Base64 encoded string
 * @returns {Object} Decoded object
 */
export function decodeFromBase64(encodedData) {
  try {
    // Restore URL-safe characters and padding
    let base64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    const jsonString = atob(base64);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error decoding from base64:', error);
    throw new Error('Failed to decode data');
  }
}

/**
 * Encodes strategy configuration for URL parameters
 * @param {Object} strategy - Strategy configuration
 * @returns {string} Encoded strategy string
 */
export function encodeStrategy(strategy) {
  const strategyData = {
    extensions: strategy.extensions || [],
    // parameters: strategy.parameters || {},
    version: '1.0',
    timestamp: Date.now(),
  };

  return encodeToBase64(strategyData);
}

/**
 * Decodes strategy configuration from URL parameters
 * @param {string} encodedStrategy - Encoded strategy string
 * @returns {Object} Strategy configuration
 */
export function decodeStrategy(encodedStrategy) {
  const strategy = decodeFromBase64(encodedStrategy);

  // Validate strategy structure
  if (!strategy.extensions || !Array.isArray(strategy.extensions)) {
    throw new Error('Invalid strategy format: missing extensions array');
  }

  // if (!strategy.parameters || typeof strategy.parameters !== 'object') {
  //   throw new Error('Invalid strategy format: missing parameters object');
  // }

  return {
    extensions: strategy.extensions,
    // parameters: strategy.parameters,
    version: strategy.version || '1.0',
    timestamp: strategy.timestamp,
  };
}

/**
 * Encodes order data for URL parameters
 * @param {Object} orderData - Complete order data including signature
 * @returns {string} Encoded order string
 */
export function encodeOrder({ order, signature, extension }) {
  const orderPayload = {
    order,
    signature,
    extension,
    version: '1.0',
    timestamp: Date.now(),
  };

  return encodeToBase64(orderPayload);
}

/**
 * Decodes order data from URL parameters
 * @param {string} encodedOrder - Encoded order string
 * @returns {Object} Order data with signature
 */
export function decodeOrder(encodedOrder) {
  const orderData = decodeFromBase64(encodedOrder);

  // Validate order structure
  if (!orderData.order || typeof orderData.order !== 'object') {
    throw new Error('Invalid order format: missing order object');
  }

  if (!orderData.signature || typeof orderData.signature !== 'string') {
    throw new Error('Invalid order format: missing signature');
  }

  return orderData;
}

/**
 * Validates that a string is a valid base64 encoded parameter
 * @param {string} param - Parameter to validate
 * @returns {boolean} True if valid base64 parameter
 */
export function isValidEncodedParam(param) {
  if (!param || typeof param !== 'string') {
    return false;
  }

  try {
    decodeFromBase64(param);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a URL with encoded parameters
 * @param {string} basePath - Base URL path
 * @param {Object} params - Parameters to encode and append
 * @returns {string} Complete URL with encoded parameters
 */
export function createUrlWithParams(basePath, params) {
  const url = new URL(basePath, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'object') {
      url.searchParams.set(key, encodeToBase64(value));
    } else {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Extracts and decodes parameters from current URL
 * @param {Array<string>} encodedParams - List of parameter names that should be decoded
 * @returns {Object} Decoded parameters
 */
export function extractUrlParams(encodedParams = []) {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};

  for (const [key, value] of urlParams.entries()) {
    if (encodedParams.includes(key)) {
      try {
        params[key] = decodeFromBase64(value);
      } catch (error) {
        console.warn(`Failed to decode parameter ${key}:`, error);
        params[key] = null;
      }
    } else {
      params[key] = value;
    }
  }

  return params;
}
