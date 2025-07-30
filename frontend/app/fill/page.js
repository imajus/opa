'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../../lib/utils/ethers';
import { decodeOrder } from '../../lib/utils/encoding';
import { formatOrderForDisplay } from '../../lib/utils/order';
import { getExtensionConfig } from '../../lib/utils/extensions';
import { fillOrder, getLimitOrderContract } from 'opa-builder';
import { Contract, parseUnits, formatUnits } from 'ethers';

// ERC20 ABI for token interactions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export default function FillOrderPage() {
  const searchParams = useSearchParams();
  const { address, isConnected, chain } = useAccount();
  const signer = useEthersSigner();

  // State for order data
  const [orderData, setOrderData] = useState(null);
  const [formattedOrder, setFormattedOrder] = useState(null);
  const [isValidOrder, setIsValidOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  // State for filling process
  const [currentStep, setCurrentStep] = useState(1); // 1: Approve, 2: Fill
  const [isApproving, setIsApproving] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState('');
  const [fillTxHash, setFillTxHash] = useState('');
  const [stepErrors, setStepErrors] = useState({});
  const [isApprovalComplete, setIsApprovalComplete] = useState(false);
  const [isFillComplete, setIsFillComplete] = useState(false);

  // State for custom fill amounts
  const [customFillAmount, setCustomFillAmount] = useState('');
  const [fillPercentage, setFillPercentage] = useState(100);
  const [isPartialFill, setIsPartialFill] = useState(false);

  // State for ERC20 token information
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);

  // Initialize from URL parameters
  useEffect(() => {
    const orderParam = searchParams.get('order');

    if (!orderParam) {
      setOrderError('No order data provided. Please create an order first.');
      setIsValidOrder(false);
      return;
    }

    try {
      const decodedOrder = decodeOrder(orderParam);
      setOrderData(decodedOrder);
      // Format order for display
      const formatted = formatOrderForDisplay(decodedOrder);
      setFormattedOrder(formatted);
      setIsValidOrder(true);
    } catch (error) {
      setOrderError(
        'Invalid order data. Please check the order link and try again.'
      );
      setIsValidOrder(false);
    }
  }, [searchParams]);

  // Reset steps when wallet changes
  useEffect(() => {
    if (address) {
      setCurrentStep(1);
      setIsApprovalComplete(false);
      setIsFillComplete(false);
      setApprovalTxHash('');
      setFillTxHash('');
      setStepErrors({});
    }
  }, [address]);

  // Initialize custom fill amount when order data loads
  useEffect(() => {
    if (formattedOrder) {
      setCustomFillAmount(formattedOrder.takerAmount);
      setFillPercentage(100);
      setIsPartialFill(false);
    }
  }, [formattedOrder]);

  // Load token information and check allowance
  useEffect(() => {
    const loadTokenInfo = async () => {
      if (!signer || !orderData || !address) return;

      setIsLoadingTokenInfo(true);
      try {
        const tokenContract = new Contract(
          orderData.order.takerAsset,
          ERC20_ABI,
          signer
        );
        // Get token info and user's balance
        const [name, symbol, decimals, balance] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.decimals(),
          tokenContract.balanceOf(address),
        ]);
        setTokenInfo({ name, symbol, decimals });
        setTokenBalance(balance.toString());
        // Note: We always require explicit approval, regardless of current allowance
        // This ensures users are aware of the spending approval step
      } catch (error) {
        setStepErrors({
          approve:
            'Failed to load token information. Please check your connection.',
        });
      } finally {
        setIsLoadingTokenInfo(false);
      }
    };

    loadTokenInfo();
  }, [signer, orderData, address]);

  // Note: We always require explicit approval for each order fill
  // Users must go through the approval step regardless of existing allowance

  // Calculate actual fill amounts based on custom fill amount or percentage
  const calculateFillAmounts = () => {
    if (!formattedOrder) return { takerAmount: '0', makerAmount: '0' };
    let actualTakerAmount;
    let actualMakerAmount;
    if (isPartialFill && customFillAmount && parseFloat(customFillAmount) > 0) {
      // Use custom amount
      actualTakerAmount = customFillAmount;
      // Calculate proportional maker amount
      const ratio =
        parseFloat(customFillAmount) / parseFloat(formattedOrder.takerAmount);
      actualMakerAmount = (
        parseFloat(formattedOrder.makerAmount) * ratio
      ).toString();
    } else if (isPartialFill && fillPercentage < 100) {
      // Use percentage
      const ratio = fillPercentage / 100;
      actualTakerAmount = (
        parseFloat(formattedOrder.takerAmount) * ratio
      ).toString();
      actualMakerAmount = (
        parseFloat(formattedOrder.makerAmount) * ratio
      ).toString();
    } else {
      // Full fill
      actualTakerAmount = formattedOrder.takerAmount;
      actualMakerAmount = formattedOrder.makerAmount;
    }
    return {
      takerAmount: actualTakerAmount,
      makerAmount: actualMakerAmount,
    };
  };

  // Validate custom fill amount
  const isValidFillAmount = () => {
    if (!formattedOrder) return false;
    if (!isPartialFill) return true; // Full fills are always valid
    const amount = parseFloat(customFillAmount || '0');
    const maxAmount = parseFloat(formattedOrder.takerAmount);
    return amount > 0 && amount <= maxAmount;
  };

  // Check if user has sufficient token balance for current fill amount
  const hasSufficientBalance = () => {
    if (!tokenInfo || !tokenBalance) return false;

    try {
      const { takerAmount } = calculateFillAmounts();
      const amountInWei = parseUnits(takerAmount, tokenInfo.decimals);
      const balance = BigInt(tokenBalance);
      return balance >= amountInWei;
    } catch {
      return false;
    }
  };

  const handleCustomAmountChange = (value) => {
    setCustomFillAmount(value);
    if (formattedOrder && value && parseFloat(value) > 0) {
      // Calculate percentage based on custom amount
      const maxAmount = parseFloat(formattedOrder.takerAmount);
      const currentAmount = parseFloat(value);
      // Clamp the amount to not exceed the maximum
      const clampedAmount = Math.min(currentAmount, maxAmount);
      const percentage = (clampedAmount / maxAmount) * 100;
      setFillPercentage(Math.min(percentage, 100));
      // Update the input if it was clamped
      if (clampedAmount !== currentAmount) {
        setCustomFillAmount(clampedAmount.toString());
      }
    }
  };

  const handlePercentageChange = (percentage) => {
    setFillPercentage(percentage);

    if (formattedOrder) {
      // Calculate custom amount based on percentage
      const amount = (
        (parseFloat(formattedOrder.takerAmount) * percentage) /
        100
      ).toString();
      setCustomFillAmount(amount);
    }
  };

  const handleApproveToken = async () => {
    if (!signer || !orderData) {
      setStepErrors({ approve: 'Please connect your wallet first' });
      return;
    }
    setIsApproving(true);
    setStepErrors({});
    try {
      const { chainId } = await signer.provider.getNetwork();
      const { takerAmount } = calculateFillAmounts();
      const lopAddress = getLimitOrderContract(Number(chainId));
      // Create ERC20 contract instance
      const tokenContract = new Contract(
        orderData.order.takerAsset,
        ERC20_ABI,
        signer
      );
      // Get token decimals and user balance for validation
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(address);
      // Convert amount to wei using token decimals
      const amountInWei = parseUnits(takerAmount, decimals);
      // Check if user has sufficient balance
      if (balance < amountInWei) {
        throw new Error(
          `Insufficient balance. You need ${takerAmount} ${formattedOrder?.takerAssetSymbol} but only have ${formatUnits(balance, decimals)} ${formattedOrder?.takerAssetSymbol}`
        );
      }
      // Submit approval transaction
      const approveTx = await tokenContract.approve(lopAddress, amountInWei);
      // Wait for transaction confirmation
      await approveTx.wait();
      setApprovalTxHash(approveTx.hash);
      setIsApprovalComplete(true);
      setCurrentStep(2);
    } catch (error) {
      // Handle user rejection specifically
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        setStepErrors({ approve: 'Transaction was rejected by user' });
      } else if (error.message?.includes('insufficient funds')) {
        setStepErrors({ approve: 'Insufficient ETH for gas fees' });
      } else {
        setStepErrors({ approve: error.message || 'Token approval failed' });
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleFillOrder = async () => {
    if (!signer || !orderData) {
      setStepErrors({ fill: 'Please connect your wallet first' });
      return;
    }
    if (!isApprovalComplete) {
      setStepErrors({ fill: 'Please approve the token first' });
      return;
    }
    setIsFilling(true);
    setStepErrors({});
    try {
      const { takerAmount, makerAmount } = calculateFillAmounts();
      // Create ERC20 contract instance
      const tokenContract = new Contract(
        orderData.order.takerAsset,
        ERC20_ABI,
        signer
      );
      const decimals = await tokenContract.decimals();
      const receipt = await fillOrder(
        signer,
        orderData.order,
        orderData.signature,
        orderData.extension,
        parseUnits(takerAmount, decimals) // Pass the custom fill amount
      );
      setFillTxHash(receipt.hash);
      setIsFillComplete(true);
    } catch (error) {
      setStepErrors({ fill: error.message || 'Order fill failed' });
    } finally {
      setIsFilling(false);
    }
  };

  const getNetworkInfo = () => {
    if (!chain) return null;

    // Get the current chain's block explorer URL from Wagmi configuration
    const explorerUrl = chain.blockExplorers?.default?.url;

    return {
      name: chain.name,
      explorerUrl: explorerUrl || null, // Return null if no explorer is configured
    };
  };

  const renderTransactionLink = (txHash, label) => {
    const networkInfo = getNetworkInfo();
    if (!networkInfo || !txHash || !networkInfo.explorerUrl) {
      // If no block explorer is configured (e.g., localhost), show just the transaction hash
      if (txHash && !networkInfo?.explorerUrl) {
        return (
          <div className="text-sm text-gray-600">
            Transaction Hash:{' '}
            <span className="font-mono text-xs break-all">{txHash}</span>
          </div>
        );
      }
      return null;
    }

    // Get explorer name from chain configuration or use a fallback
    const explorerName =
      chain.blockExplorers?.default?.name || `${networkInfo.name} Explorer`;

    return (
      <a
        href={`${networkInfo.explorerUrl}/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline text-sm"
      >
        View {label} on {explorerName} ↗
      </a>
    );
  };

  const renderOrderSummary = () => {
    if (!formattedOrder) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Order Summary
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Maker Side */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-600 mb-3">
              MAKER WANTS
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {formattedOrder.makerAmount}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {formattedOrder.makerAssetSymbol}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {formattedOrder.makerAsset}
              </div>
            </div>
          </div>

          {/* Taker Side */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-600 mb-3">
              TAKER GIVES
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {formattedOrder.takerAmount}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {formattedOrder.takerAssetSymbol}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {formattedOrder.takerAsset}
              </div>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Maker:</span>
              <p className="font-mono text-gray-900">
                {formattedOrder.maker.slice(0, 6)}...
                {formattedOrder.maker.slice(-4)}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Receiver:</span>
              <p className="font-mono text-gray-900">
                {formattedOrder.receiver.slice(0, 6)}...
                {formattedOrder.receiver.slice(-4)}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Expires:</span>
              <p className="text-gray-900">{formattedOrder.expiry}</p>
            </div>
          </div>
        </div>

        {/* Order Flags */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Order Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <div
                className={`w-4 h-4 rounded mr-2 flex items-center justify-center text-xs ${
                  formattedOrder.allowPartialFills
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {formattedOrder.allowPartialFills ? '✓' : '✗'}
              </div>
              <span className="text-sm text-gray-700">
                Partial fills{' '}
                {formattedOrder.allowPartialFills ? 'allowed' : 'disabled'}
              </span>
            </div>
            <div className="flex items-center">
              <div
                className={`w-4 h-4 rounded mr-2 flex items-center justify-center text-xs ${
                  formattedOrder.allowMultipleFills
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {formattedOrder.allowMultipleFills ? '✓' : '✗'}
              </div>
              <span className="text-sm text-gray-700">
                Multiple fills{' '}
                {formattedOrder.allowMultipleFills ? 'allowed' : 'disabled'}
              </span>
            </div>
            {formattedOrder.hasPreInteraction && (
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-2 flex items-center justify-center text-xs bg-blue-100 text-blue-600">
                  ✓
                </div>
                <span className="text-sm text-gray-700">
                  Pre-interaction enabled
                </span>
              </div>
            )}
            {formattedOrder.hasPostInteraction && (
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-2 flex items-center justify-center text-xs bg-blue-100 text-blue-600">
                  ✓
                </div>
                <span className="text-sm text-gray-700">
                  Post-interaction enabled
                </span>
              </div>
            )}
            {formattedOrder.usePermit2 && (
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-2 flex items-center justify-center text-xs bg-purple-100 text-purple-600">
                  ✓
                </div>
                <span className="text-sm text-gray-700">Uses Permit2</span>
              </div>
            )}
            {formattedOrder.unwrapWeth && (
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-2 flex items-center justify-center text-xs bg-orange-100 text-orange-600">
                  ✓
                </div>
                <span className="text-sm text-gray-700">
                  WETH unwrapping enabled
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {!formattedOrder.allowPartialFills &&
              !formattedOrder.allowMultipleFills && (
                <p>
                  This order must be filled completely in a single transaction.
                </p>
              )}
            {formattedOrder.allowPartialFills &&
              !formattedOrder.allowMultipleFills && (
                <p>This order can be filled partially but only once.</p>
              )}
            {!formattedOrder.allowPartialFills &&
              formattedOrder.allowMultipleFills && (
                <p>
                  This order must be filled completely but can have multiple
                  fills.
                </p>
              )}
            {formattedOrder.allowPartialFills &&
              formattedOrder.allowMultipleFills && (
                <p>
                  This order supports both partial and multiple fills for
                  maximum flexibility.
                </p>
              )}
          </div>
        </div>

        {/* Strategy Information */}
        {formattedOrder.extensions && formattedOrder.extensions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Strategy Extensions
            </h4>
            <div className="flex flex-wrap gap-2">
              {formattedOrder.extensions.map((extensionId, index) => {
                const config = getExtensionConfig(extensionId);
                return config ? (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    {config.name}
                  </span>
                ) : null;
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This order uses advanced extensions for enhanced functionality.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderCustomFillControls = () => {
    if (!formattedOrder || !formattedOrder.allowPartialFills) return null;

    const { takerAmount, makerAmount } = calculateFillAmounts();
    const maxTakerAmount = parseFloat(formattedOrder.takerAmount);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Fill Amount
        </h3>

        <div className="space-y-6">
          {/* Full vs Partial Toggle */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setIsPartialFill(false);
                setFillPercentage(100);
                setCustomFillAmount(formattedOrder.takerAmount);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !isPartialFill
                  ? 'bg-primary-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fill Complete Order
            </button>
            <button
              onClick={() => {
                setIsPartialFill(true);
                setFillPercentage(50);
                setCustomFillAmount((maxTakerAmount * 0.5).toString());
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isPartialFill
                  ? 'bg-primary-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Partial Fill
            </button>
          </div>

          {/* Partial Fill Controls */}
          {isPartialFill && (
            <div className="space-y-4">
              {/* Percentage Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fill Percentage: {fillPercentage.toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="0.1"
                  value={fillPercentage}
                  onChange={(e) =>
                    handlePercentageChange(parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Custom Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Fill Amount ({formattedOrder.takerAssetSymbol})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={customFillAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="0.0"
                    step="any"
                    min="0"
                    max={formattedOrder.takerAmount}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-600"
                  />
                  <button
                    onClick={() => {
                      setCustomFillAmount(formattedOrder.takerAmount);
                      setFillPercentage(100);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {formattedOrder.takerAmount}{' '}
                  {formattedOrder.takerAssetSymbol}
                </p>
                {customFillAmount &&
                  parseFloat(customFillAmount) >
                    parseFloat(formattedOrder.takerAmount) && (
                    <p className="text-xs text-red-500 mt-1">
                      Amount exceeds order maximum
                    </p>
                  )}
                {customFillAmount && parseFloat(customFillAmount) <= 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Amount must be greater than 0
                  </p>
                )}
              </div>

              {/* Quick Percentage Buttons */}
              <div className="flex gap-2">
                {[25, 50, 75].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => handlePercentageChange(percent)}
                    className="px-3 py-1 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fill Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Fill Preview
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">You will pay:</span>
                <p className="font-semibold text-gray-900">
                  {parseFloat(takerAmount).toFixed(6)}{' '}
                  {formattedOrder.takerAssetSymbol}
                </p>
              </div>
              <div>
                <span className="text-gray-600">You will receive:</span>
                <p className="font-semibold text-gray-900">
                  {parseFloat(makerAmount).toFixed(6)}{' '}
                  {formattedOrder.makerAssetSymbol}
                </p>
              </div>
            </div>
            {isPartialFill && fillPercentage < 100 && (
              <p className="text-xs text-gray-500 mt-2">
                Filling {fillPercentage.toFixed(1)}% of the total order
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFillInterface = () => {
    if (!isConnected) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-yellow-800 font-semibold mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-yellow-700">
                You need to connect your wallet to fill this order.
              </p>
            </div>
            <ConnectButton />
          </div>
        </div>
      );
    }

    //TODO: Check network compatibility
    const isWrongNetwork = false;

    if (isWrongNetwork) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">Wrong Network</h3>
          <p className="text-red-700 mb-4">
            Please switch to Ethereum Mainnet to fill this order.
          </p>
          <p className="text-sm text-red-600">Current network: {chain.name}</p>
        </div>
      );
    }

    if (isFillComplete) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <h3 className="text-green-800 font-semibold text-xl mb-2">
              Order Filled Successfully!
            </h3>
            <p className="text-green-700 mb-4">
              The limit order has been executed successfully.
            </p>
            {fillTxHash && (
              <div className="mb-4">
                {renderTransactionLink(fillTxHash, 'Fill Transaction')}
              </div>
            )}
            <Link
              href="/"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Another Order
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Fill Order</h3>

        {/* Step 1: Token Approval */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                isApprovalComplete
                  ? 'bg-green-100 text-green-800'
                  : currentStep === 1
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isApprovalComplete ? '✓' : '1'}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                Approve {formattedOrder?.takerAssetSymbol || 'Token'}
              </h4>
              <div>
                <p className="text-sm text-gray-600">
                  Allow the protocol to spend{' '}
                  {(() => {
                    const { takerAmount } = calculateFillAmounts();
                    return `${parseFloat(takerAmount).toFixed(6)} ${formattedOrder?.takerAssetSymbol || 'tokens'}`;
                  })()}
                </p>
                {tokenInfo && (
                  <div className="mt-1 text-gray-400 text-xs">
                    <div>
                      Balance: {formatUnits(tokenBalance, tokenInfo.decimals)}{' '}
                      {tokenInfo.symbol}
                      {!hasSufficientBalance() && (
                        <span className="text-red-600 ml-1">
                          ⚠ Insufficient
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentStep === 1 && !isApprovalComplete && (
            <div className="ml-11">
              <button
                onClick={handleApproveToken}
                disabled={
                  isApproving ||
                  !isValidFillAmount() ||
                  !hasSufficientBalance() ||
                  isLoadingTokenInfo
                }
                className={`w-full sm:w-auto font-semibold py-3 px-6 rounded-lg transition-colors ${
                  isApproving ||
                  !isValidFillAmount() ||
                  !hasSufficientBalance() ||
                  isLoadingTokenInfo
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-orange hover:bg-orange-600 text-white'
                }`}
              >
                {isLoadingTokenInfo
                  ? 'Loading...'
                  : isApproving
                    ? 'Approving...'
                    : (() => {
                        if (!hasSufficientBalance()) {
                          return 'Insufficient Balance';
                        }
                        const { takerAmount } = calculateFillAmounts();
                        const isPartial = isPartialFill && fillPercentage < 100;
                        return `Approve ${isPartial ? parseFloat(takerAmount).toFixed(4) : ''} ${formattedOrder?.takerAssetSymbol || 'Token'}${isPartial ? ` (${fillPercentage.toFixed(1)}%)` : ''}`;
                      })()}
              </button>

              {stepErrors.approve && (
                <p className="text-red-600 text-sm mt-2">
                  {stepErrors.approve}
                </p>
              )}

              {!isValidFillAmount() && isPartialFill && (
                <p className="text-red-600 text-sm mt-2">
                  Please enter a valid fill amount
                </p>
              )}

              {!hasSufficientBalance() && tokenInfo && (
                <p className="text-red-600 text-sm mt-2">
                  Insufficient {tokenInfo.symbol} balance. You need{' '}
                  {(() => {
                    const { takerAmount } = calculateFillAmounts();
                    return parseFloat(takerAmount).toFixed(6);
                  })()}{' '}
                  {tokenInfo.symbol} but only have{' '}
                  {formatUnits(tokenBalance, tokenInfo.decimals)}{' '}
                  {tokenInfo.symbol}
                </p>
              )}
            </div>
          )}

          {isApprovalComplete && approvalTxHash && (
            <div className="ml-11">
              <p className="text-green-600 text-sm mb-2">
                ✓ Approval completed
              </p>
              {renderTransactionLink(approvalTxHash, 'Approval Transaction')}
            </div>
          )}
        </div>

        {/* Step 2: Fill Order */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                isFillComplete
                  ? 'bg-green-100 text-green-800'
                  : currentStep === 2
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isFillComplete ? '✓' : '2'}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Fill Order</h4>
              <p className="text-sm text-gray-600">
                {(() => {
                  const { takerAmount, makerAmount } = calculateFillAmounts();
                  const isPartial = isPartialFill && fillPercentage < 100;
                  return `Execute the ${isPartial ? 'partial ' : ''}limit order: pay ${parseFloat(takerAmount).toFixed(6)} ${formattedOrder?.takerAssetSymbol} to receive ${parseFloat(makerAmount).toFixed(6)} ${formattedOrder?.makerAssetSymbol}`;
                })()}
              </p>
            </div>
          </div>

          {currentStep === 2 && !isFillComplete && (
            <div className="ml-11">
              <button
                onClick={handleFillOrder}
                disabled={
                  isFilling || !isApprovalComplete || !isValidFillAmount()
                }
                className={`w-full sm:w-auto font-semibold py-3 px-6 rounded-lg transition-colors ${
                  isFilling || !isApprovalComplete || !isValidFillAmount()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-green hover:bg-green-600 text-white'
                }`}
              >
                {isFilling
                  ? 'Filling Order...'
                  : (() => {
                      const isPartial = isPartialFill && fillPercentage < 100;
                      return `Fill ${isPartial ? 'Partial ' : ''}Order${isPartial ? ` (${fillPercentage.toFixed(1)}%)` : ''}`;
                    })()}
              </button>

              {stepErrors.fill && (
                <p className="text-red-600 text-sm mt-2">{stepErrors.fill}</p>
              )}

              {!isApprovalComplete && (
                <p className="text-gray-500 text-sm mt-2">
                  Complete token approval first
                </p>
              )}

              {!isValidFillAmount() && isPartialFill && (
                <p className="text-red-600 text-sm mt-2">
                  Please enter a valid fill amount
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isValidOrder) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Invalid Order
            </h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <p className="text-red-800">{orderError}</p>
            </div>
            <Link
              href="/"
              className="inline-block bg-primary-orange text-white font-semibold py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm breadcrumbs mb-4">
            <Link href="/" className="text-primary-orange hover:underline">
              Home
            </Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-gray-600">Fill Order</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Fill Limit Order
          </h1>
          <p className="text-xl text-gray-600">
            Review the order details and execute the trade.
          </p>
        </div>

        {/* Order Summary */}
        {renderOrderSummary()}

        {/* Custom Fill Controls */}
        {renderCustomFillControls()}

        {/* Fill Interface */}
        {renderFillInterface()}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to Home
          </Link>

          {isFillComplete && (
            <Link
              href="/strategy"
              className="bg-primary-orange text-white font-semibold py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Create New Strategy →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
