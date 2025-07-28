import { extensions } from 'opa-builder';

/**
 * Order Builder Utilities
 * Provides functions for creating and managing limit orders with extensions
 */

/**
 * Creates a new order builder instance with selected extensions
 * @param {Array<string>} selectedExtensions - Array of extension names
 * @returns {Object} Builder instance with extensions configured
 */
export function createOrderBuilder(selectedExtensions = []) {
  const builderInstance = {
    extensions: {},
    selectedExtensions: selectedExtensions,
  };

  // Initialize selected extensions
  selectedExtensions.forEach((extensionName) => {
    if (extensions[extensionName]) {
      builderInstance.extensions[extensionName] = extensions[extensionName]();
    }
  });

  return builderInstance;
}

/**
 * Builds and signs a limit order
 * @param {Object} builder - Builder instance
 * @param {Object} signer - Wallet signer
 * @param {Object} orderParams - Order parameters
 * @returns {Promise<Object>} Signed order with extension data
 */
export async function buildOrder(builder, signer, orderParams) {
  try {
    // This would integrate with the actual 1inch LOP SDK
    // For now, return a mock structure that matches the expected format
    const order = {
      maker: orderParams.maker,
      makerAsset: orderParams.makerAsset,
      makerAmount: orderParams.makerAmount,
      takerAsset: orderParams.takerAsset,
      takerAmount: orderParams.takerAmount,
      receiver: orderParams.receiver || orderParams.maker,
      salt: orderParams.salt || Date.now(),
      expiry: orderParams.expiry || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
      nonce: orderParams.nonce || 0,
      allowedSender:
        orderParams.allowedSender ||
        '0x0000000000000000000000000000000000000000',
      interactions: orderParams.interactions || '0x',
      extensions: builder.selectedExtensions,
    };

    // Mock signature for testing
    const signature = '0x' + '0'.repeat(130); // Mock signature

    return {
      order,
      signature,
      extensionData: builder.extensions,
    };
  } catch (error) {
    console.error('Error building order:', error);
    throw error;
  }
}

/**
 * Validates order parameters
 * @param {Object} params - Order parameters to validate
 * @returns {Object} Validation result with errors if any
 */
export function validateOrderParams(params) {
  const errors = [];

  if (!params.makerAsset) errors.push('Maker asset is required');
  if (!params.makerAmount || params.makerAmount <= 0)
    errors.push('Maker amount must be positive');
  if (!params.takerAsset) errors.push('Taker asset is required');
  if (!params.takerAmount || params.takerAmount <= 0)
    errors.push('Taker amount must be positive');
  if (!params.maker) errors.push('Maker address is required');

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Formats order for display
 * @param {Object} order - Order object
 * @returns {Object} Formatted order data for UI display
 */
export function formatOrderForDisplay(order) {
  return {
    maker: order.maker,
    makerAsset: order.makerAsset,
    makerAmount: order.makerAmount,
    takerAsset: order.takerAsset,
    takerAmount: order.takerAmount,
    receiver: order.receiver,
    expiry: new Date(order.expiry * 1000).toLocaleString(),
    extensions: order.extensions || [],
  };
}
