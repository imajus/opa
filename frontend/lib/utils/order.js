import { formatEther, ZeroAddress } from 'ethers';
import { parseMakerTraits } from 'opa-builder';

// Helper function to get token symbol from address
const getTokenSymbol = (address) => {
  return '???';
};

// Format expiry timestamp
const formatExpiry = (timestamp) => {
  if (!timestamp) return 'No expiration';
  return new Date(Number(timestamp * 1000n)).toLocaleString();
};

/**
 * Formats order data for display in the UI
 * @param {Object} orderData - Decoded order data
 * @returns {Object} Formatted order data
 */
export function formatOrderForDisplay(orderData) {
  if (!orderData || !orderData.order) {
    throw new Error('Invalid order data provided');
  }
  const { order } = orderData;
  // Parse maker traits to get order flags
  const makerTraits = parseMakerTraits(order);
  return {
    maker: order.maker,
    receiver:
      (order.receiver === ZeroAddress ? order.maker : order.receiver) ||
      ZeroAddress,
    makerAsset: order.makerAsset || ZeroAddress,
    makerAmount: formatEther(order.makingAmount),
    makerAssetSymbol: getTokenSymbol(order.makerAsset),
    takerAsset: order.takerAsset || ZeroAddress,
    takerAmount: formatEther(order.takingAmount),
    takerAssetSymbol: getTokenSymbol(order.takerAsset),
    expiry: formatExpiry(makerTraits.expiration),
    nonce: order.nonce ? order.nonce.toString() : '0',
    salt: order.salt ? order.salt.toString() : '0',
    extensions: orderData.extension ? [orderData.extension] : [],
    // Use parsed maker traits for order flags
    allowPartialFills: makerTraits.allowPartialFills,
    allowMultipleFills: makerTraits.allowMultipleFills,
    hasPreInteraction: makerTraits.hasPreInteraction,
    hasPostInteraction: makerTraits.hasPostInteraction,
    hasExtension: makerTraits.hasExtension,
    usePermit2: makerTraits.usePermit2,
    unwrapWeth: makerTraits.unwrapWeth,
    isEpochManagerEnabled: makerTraits.isEpochManagerEnabled,
  };
}

/**
 * Formats order amounts with proper decimal handling
 * @param {string|number|bigint} amount - Raw amount
 * @param {number} decimals - Token decimals (default 18)
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount, decimals = 18) {
  if (!amount) return '0';
  try {
    // Convert to string if it's a BigInt
    const amountStr = amount.toString();
    // For demo purposes, just return a simplified version
    // In a real implementation, this would properly handle decimal conversion
    const num = parseFloat(amountStr);
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(4);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return amount.toString();
  }
}

/**
 * Gets a user-friendly description of the order
 * @param {Object} formattedOrder - Formatted order data
 * @returns {string} Order description
 */
export function getOrderDescription(formattedOrder) {
  const { makerAmount, makerAssetSymbol, takerAmount, takerAssetSymbol } =
    formattedOrder;

  return `Swap ${makerAmount} ${makerAssetSymbol} for ${takerAmount} ${takerAssetSymbol}`;
}

/**
 * Calculates the exchange rate between maker and taker assets
 * @param {Object} formattedOrder - Formatted order data
 * @returns {string} Exchange rate description
 */
export function getExchangeRate(formattedOrder) {
  const { makerAmount, makerAssetSymbol, takerAmount, takerAssetSymbol } =
    formattedOrder;

  try {
    const makerNum = parseFloat(makerAmount);
    const takerNum = parseFloat(takerAmount);

    if (makerNum === 0 || takerNum === 0) return 'N/A';

    const rate = takerNum / makerNum;
    return `1 ${makerAssetSymbol} = ${rate.toFixed(6)} ${takerAssetSymbol}`;
  } catch (error) {
    return 'N/A';
  }
}
