'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../../lib/utils/ethers';
import {
  OrderBuilder,
  HookCollisionError,
  extensions,
  HookType,
} from 'opa-builder';
import { decodeStrategy, encodeOrder } from '../../lib/utils/encoding';
import {
  flatExtensionConfigParams,
  getExtensionConfig,
  validateExtensionParameters,
} from '../../lib/utils/extensions';
import {
  getFieldComponent,
  TokenAmountField,
} from '../../components/SchemaFields';
import { AssetAddressInput } from '../../components/AssetAddressInput';

export default function CreateOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected, chain } = useAccount();
  const signer = useEthersSigner();

  // State for strategy and extensions
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  const [isSimpleOrder, setIsSimpleOrder] = useState(false);

  // State for order parameters
  const [orderParams, setOrderParams] = useState({
    maker: '',
    makerAsset: '',
    makerAmount: '',
    takerAsset: '',
    takerAmount: '',
    receiver: '',
    expiry: '',
    nonce: '',
    allowPartialFills: true,
    allowMultipleFills: false,
    // DEBUG
    // makerAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    // makerAmount: '3.5',
    // takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // takerAmount: '0.001',
  });

  // State for extension parameters
  const [extensionParameters, setExtensionParameters] = useState({
    //DEBUG
    // [HookType.MAKER_AMOUNT]: {
    //   startTime: Math.floor(Date.now() / 1000),
    //   endTime: Math.floor(Date.now() / 1000) + 60 * 60,
    //   startAmount: '0.0015',
    //   endAmount: '0.0005',
    // },
  });

  // State for validation and UI
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Initialize from URL parameters
  useEffect(() => {
    const blueprintParam = searchParams.get('blueprint');
    if (blueprintParam) {
      try {
        const { extensions } = decodeStrategy(blueprintParam);
        // Store selected extensions instead of creating builder immediately
        if (extensions?.length > 0) {
          setSelectedExtensions(extensions);
          setIsSimpleOrder(false);
        } else {
          setSelectedExtensions([]);
          setIsSimpleOrder(true);
        }
      } catch (error) {
        console.error('Failed to decode strategy:', error);
        setIsSimpleOrder(true);
        setSelectedExtensions([]);
      }
    } else {
      // No blueprint - simple order
      setIsSimpleOrder(true);
      setSelectedExtensions([]);
    }
  }, [searchParams]);

  // Update maker address when wallet connects
  useEffect(() => {
    if (address && !orderParams.maker) {
      setOrderParams((prev) => ({
        ...prev,
        maker: address,
      }));
    }
  }, [address, orderParams.maker]);

  // Set default expiry to 1 hour from now
  useEffect(() => {
    if (!orderParams.expiry) {
      const defaultExpiry = new Date();
      defaultExpiry.setHours(defaultExpiry.getHours() + 1);
      const offsetMs = defaultExpiry.getTimezoneOffset() * 60 * 1000;
      const localDate = new Date(defaultExpiry.getTime() - offsetMs);
      setOrderParams((prev) => ({
        ...prev,
        expiry: localDate.toISOString().slice(0, 16), // Format for datetime-local input
      }));
    }
  }, [orderParams.expiry]);

  const handleParamChange = (field, value) => {
    setOrderParams((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleExtensionParamChange = (hookType, param, value) => {
    setExtensionParameters((prev) => ({
      ...prev,
      [hookType]: {
        ...prev[hookType],
        [param]: value,
      },
    }));
  };

  const validateForm = () => {
    const errors = {};
    // Validate core order parameters
    if (!orderParams.makerAsset) errors.makerAsset = 'Maker asset is required';
    if (!orderParams.makerAmount || orderParams.makerAmount <= 0)
      errors.makerAmount = 'Maker amount must be positive';
    if (!orderParams.takerAsset) errors.takerAsset = 'Taker asset is required';
    if (!orderParams.takerAmount || orderParams.takerAmount <= 0)
      errors.takerAmount = 'Taker amount must be positive';
    if (!orderParams.maker) errors.maker = 'Maker address is required';
    // Validate extension parameters
    selectedExtensions.forEach((extensionId) => {
      const config = getExtensionConfig(extensionId);
      if (config) {
        const validation = validateExtensionParameters(
          extensionId,
          extensionParameters
        );
        if (!validation.isValid) {
          errors[`extension_${extensionId}`] = validation.errors.join(' | ');
        }
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    if (!signer) {
      setSubmitError('Please connect your wallet first');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // Convert expiry to timestamp
      const expiryTimestamp = BigInt(
        Math.floor(new Date(orderParams.expiry).getTime() / 1000)
      );
      // Create OrderBuilder instance with the order parameters
      const builder = new OrderBuilder(
        orderParams.makerAsset,
        orderParams.makerAmount,
        orderParams.takerAsset,
        orderParams.takerAmount,
        orderParams.receiver || undefined // Use undefined if no custom receiver
      );
      // Configure maker traits
      const traits = builder.getMakerTraits();
      if (expiryTimestamp) {
        traits.withExpiration(expiryTimestamp);
      }
      if (orderParams.nonce && orderParams.nonce !== '0') {
        traits.withNonce(BigInt(orderParams.nonce));
      }
      if (orderParams.allowPartialFills) {
        traits.allowPartialFills();
      } else {
        traits.disablePartialFills();
      }
      if (orderParams.allowMultipleFills) {
        traits.allowMultipleFills();
      } else {
        traits.disableMultipleFills();
      }
      // Add selected extensions
      try {
        selectedExtensions.forEach((extensionId) => {
          if (extensions[extensionId]) {
            builder.addExtension(extensions[extensionId]);
          }
        });
      } catch (error) {
        if (error instanceof HookCollisionError) {
          throw new Error(`Extension conflict: ${error.message}`);
        }
        throw error;
      }
      // Build the order using the OrderBuilder API
      const result = await builder.build(signer, extensionParameters);
      // Create order data in the format expected by the frontend
      const orderData = {
        order: result.order,
        signature: result.signature,
        // orderHash: result.orderHash,
        extension: result.extension,
      };
      // Encode order data for URL
      const encodedOrder = encodeOrder(orderData);
      // Navigate to fill page
      router.push(`/fill?order=${encodedOrder}`);
    } catch (error) {
      console.error('Failed to build order:', error);
      setSubmitError(
        error.message ||
          'Failed to create order. Please check your parameters and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderExtensionFields = () => {
    if (selectedExtensions.length === 0) {
      return null;
    }
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Extension Parameters
        </h3>
        {selectedExtensions.map((extensionId) => {
          const config = getExtensionConfig(extensionId);
          if (!config) return null;
          return (
            <div key={extensionId} className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">
                {config.name}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {flatExtensionConfigParams(config).map((param) => {
                  const FieldComponent = getFieldComponent(param.type);
                  return (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {param.label}
                        {param.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <FieldComponent
                        value={
                          extensionParameters[param.hookType]?.[param.name] ||
                          ''
                        }
                        onChange={(value) =>
                          handleExtensionParamChange(
                            param.hookType,
                            param.name,
                            value
                          )
                        }
                        // placeholder={param.placeholder}
                        required={param.required}
                      />
                      <p className="text-xs text-gray-500 mt-1">{param.hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
            {!isSimpleOrder && (
              <>
                <Link
                  href="/strategy"
                  className="text-primary-orange hover:underline"
                >
                  Strategy Builder
                </Link>
                <span className="mx-2 text-gray-400">/</span>
              </>
            )}
            <span className="text-gray-600">Create Order</span>
          </nav>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {isSimpleOrder ? 'Create Simple Order' : 'Create Strategy Order'}
          </h1>
          {!isSimpleOrder && selectedExtensions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-blue-900 font-semibold mb-2">
                Selected Strategy
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedExtensions.map((extensionId) => {
                  const config = getExtensionConfig(extensionId);
                  return config ? (
                    <span
                      key={extensionId}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      {config.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Wallet Connection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Wallet Connection
              </h3>
              <p className="text-gray-600">
                {isConnected
                  ? `Connected as ${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : 'Connect your wallet to create and sign orders'}
              </p>
              {chain && (
                <p className="text-sm text-gray-500 mt-1">
                  Network: {chain.name}
                </p>
              )}
            </div>
            <ConnectButton />
          </div>
          {validationErrors.wallet && (
            <p className="text-red-600 text-sm mt-2">
              {validationErrors.wallet}
            </p>
          )}
          {validationErrors.network && (
            <p className="text-red-600 text-sm mt-2">
              {validationErrors.network}
            </p>
          )}
        </div>

        {/* Order Parameters Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Order Parameters
          </h3>
          <div className="space-y-6">
            {/* Core Trading Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AssetAddressInput
                label="Maker Asset (Token Address)"
                value={orderParams.makerAsset}
                onChange={(value) => handleParamChange('makerAsset', value)}
                placeholder="Search tokens or enter address (0x...)"
                required={true}
                error={validationErrors.makerAsset}
                hint="Search for a token or enter its contract address"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maker Amount *
                </label>
                <TokenAmountField
                  value={orderParams.makerAmount}
                  onChange={(value) => handleParamChange('makerAmount', value)}
                  placeholder="Amount to sell (e.g. 1.5)"
                  required
                />
                {validationErrors.makerAmount && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.makerAmount}
                  </p>
                )}
              </div>

              <AssetAddressInput
                label="Taker Asset (Token Address)"
                value={orderParams.takerAsset}
                onChange={(value) => handleParamChange('takerAsset', value)}
                placeholder="Search tokens or enter address (0x...)"
                required={true}
                error={validationErrors.takerAsset}
                hint="Search for a token or enter its contract address"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taker Amount *
                </label>
                <TokenAmountField
                  value={orderParams.takerAmount}
                  onChange={(value) => handleParamChange('takerAmount', value)}
                  placeholder="Amount to receive (e.g. 1.5)"
                  required
                />
                {validationErrors.takerAmount && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.takerAmount}
                  </p>
                )}
              </div>
            </div>

            {/* Additional Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receiver Address
                </label>
                <input
                  type="text"
                  value={orderParams.receiver}
                  onChange={(e) =>
                    handleParamChange('receiver', e.target.value)
                  }
                  placeholder="Leave empty to use maker address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Time *
                </label>
                <input
                  type="datetime-local"
                  value={orderParams.expiry}
                  onChange={(e) => handleParamChange('expiry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nonce
                </label>
                <input
                  type="number"
                  value={orderParams.nonce}
                  onChange={(e) => handleParamChange('nonce', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>

            {/* Order Traits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Order Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={orderParams.allowPartialFills}
                    onChange={(e) =>
                      handleParamChange('allowPartialFills', e.target.checked)
                    }
                    className="mr-2 h-4 w-4 text-primary-orange focus:ring-primary-orange border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Allow partial fills
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={orderParams.allowMultipleFills}
                    onChange={(e) =>
                      handleParamChange('allowMultipleFills', e.target.checked)
                    }
                    className="mr-2 h-4 w-4 text-primary-orange focus:ring-primary-orange border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Allow multiple fills
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Extension Parameters */}
        {renderExtensionFields()}

        {/* Error Display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{submitError}</p>
          </div>
        )}

        {/* Extension Validation Errors */}
        {Object.entries(validationErrors)
          .filter(([key]) => key.startsWith('extension_'))
          .map(([key, error]) => (
            <div
              key={key}
              className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
            >
              <p className="text-red-800">Extension Error: {error}</p>
            </div>
          ))}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link
            href={isSimpleOrder ? '/' : '/strategy'}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to {isSimpleOrder ? 'Home' : 'Strategy Builder'}
          </Link>

          <button
            onClick={handleSubmit}
            disabled={!isConnected || isSubmitting}
            className={`font-semibold py-3 px-8 rounded-lg transition-colors ${
              isConnected && !isSubmitting
                ? 'bg-primary-orange hover:bg-orange-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Creating Order...' : 'Review & Sign Order →'}
          </button>
        </div>
      </div>
    </div>
  );
}
