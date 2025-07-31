/**
 * 1Inch Token API Client
 * A collection of functions for interacting with the 1Inch Token API
 */

const BASE_URL = 'https://1inch-vercel-proxy-lime.vercel.app';

/**
 * Internal function for making API calls
 * @param {string} endpoint - The API endpoint path
 * @param {ApiCallOptions} [options] - Request options
 * @returns {Promise<any>} The API response
 */
async function apiCall(endpoint, options = {}) {
  const { params = {}, method = 'GET', body } = options;
  // Build query string from parameters
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => queryParams.append(key, item));
      } else {
        queryParams.append(key, value);
      }
    }
  });
  const url = `${BASE_URL}${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  // Default headers required by the API
  const defaultHeaders = {
    // 'cf-ipcountry': 'US', // Default country
    'Content-Type': 'application/json',
  };
  const requestOptions = {
    method,
    headers: defaultHeaders,
  };
  // Add body for POST requests
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestOptions.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }
    return await response.json();
  } catch (error) {
    console.error('1Inch API Error:', error);
    throw error;
  }
}

export { apiCall };
