'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useNetwork, useSigner } from 'wagmi';
import { decodeStrategy, encodeOrder, extractUrlParams } from '../../lib/utils/encoding';
import { createOrderBuilder, buildOrder, validateOrderParams } from '../../lib/utils/orderBuilder';
import { getExtensionConfig, validateExtensionParameters } from '../../lib/utils/extensions';

export default function CreateOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: signer } = useSigner();

  // State for strategy and extensions
  const [strategy, setStrategy] = useState(null);
  const [builder, setBuilder] = useState(null);
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
    nonce: '0',
    allowPartialFills: false,
    allowMultipleFills: false,
  });

  // State for extension parameters
  const [extensionParameters, setExtensionParameters] = useState({});

  // State for validation and UI
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Initialize from URL parameters
  useEffect(() => {
    const blueprintParam = searchParams.get('blueprint');
    
    if (blueprintParam) {
      try {
        const decodedStrategy = decodeStrategy(blueprintParam);
        setStrategy(decodedStrategy);
        setIsSimpleOrder(false);
        
        // Initialize builder with selected extensions
        const orderBuilder = createOrderBuilder(decodedStrategy.extensions);
        setBuilder(orderBuilder);
        
        // Initialize extension parameters
        setExtensionParameters(decodedStrategy.parameters || {});
      } catch (error) {
        console.error('Failed to decode strategy:', error);
        setIsSimpleOrder(true);
        setBuilder(createOrderBuilder([]));
      }
    } else {
      // No blueprint - simple order
      setIsSimpleOrder(true);
      setBuilder(createOrderBuilder([]));
    }
  }, [searchParams]);

  // Update maker address when wallet connects
  useEffect(() => {
    if (address && !orderParams.maker) {
      setOrderParams(prev => ({
        ...prev,
        maker: address,
        receiver: address,
      }));
    }
  }, [address, orderParams.maker]);

  // Set default expiry to 1 hour from now
  useEffect(() => {
    if (!orderParams.expiry) {
      const defaultExpiry = new Date();
      defaultExpiry.setHours(defaultExpiry.getHours() + 1);
      setOrderParams(prev => ({
        ...prev,
        expiry: defaultExpiry.toISOString().slice(0, 16), // Format for datetime-local input
      }));
    }
  }, [orderParams.expiry]);

  const handleParamChange = (field, value) => {
    setOrderParams(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleExtensionParamChange = (extensionId, paramName, value) => {
    setExtensionParameters(prev => ({
      ...prev,
      [extensionId]: {
        ...prev[extensionId],
        [paramName]: value,
      },
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    // Validate core order parameters
    const coreValidation = validateOrderParams(orderParams);
    if (!coreValidation.isValid) {
      coreValidation.errors.forEach(error => {
        const field = error.toLowerCase().includes('maker asset') ? 'makerAsset' :
                     error.toLowerCase().includes('maker amount') ? 'makerAmount' :
                     error.toLowerCase().includes('taker asset') ? 'takerAsset' :
                     error.toLowerCase().includes('taker amount') ? 'takerAmount' :
                     error.toLowerCase().includes('maker address') ? 'maker' : 'general';
        errors[field] = error;
      });
    }

    // Validate extension parameters
    if (strategy && strategy.extensions) {
      strategy.extensions.forEach(extensionId => {
        const config = getExtensionConfig(extensionId);
        if (config) {
          const extValidation = validateExtensionParameters(
            extensionId, 
            extensionParameters[extensionId] || {}
          );
          if (!extValidation.isValid) {
            errors[`extension_${extensionId}`] = extValidation.errors.join(', ');
          }
        }
      });
    }

    // Check wallet connection
    if (!isConnected) {
      errors.wallet = 'Please connect your wallet to continue';
    }

    // Check network compatibility (simplified check)
    if (isConnected && !chain) {
      errors.network = 'Please switch to a supported network';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Convert expiry to timestamp
      const expiryTimestamp = Math.floor(new Date(orderParams.expiry).getTime() / 1000);
      
      const finalOrderParams = {
        ...orderParams,
        expiry: expiryTimestamp,
        makerAmount: orderParams.makerAmount.toString(),
        takerAmount: orderParams.takerAmount.toString(),
      };

      // Build the order using the builder
      const orderData = await buildOrder(builder, signer, finalOrderParams);
      
      // Add extension parameters to the order data
      orderData.extensionParameters = extensionParameters;
      
      // Encode order data for URL
      const encodedOrder = encodeOrder(orderData);
      
      // Navigate to fill page
      router.push(`/fill?order=${encodedOrder}`);
      
    } catch (error) {
      console.error('Failed to build order:', error);
      setSubmitError('Failed to create order. Please check your parameters and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderExtensionFields = () => {
    if (!strategy || !strategy.extensions || strategy.extensions.length === 0) {
      return null;
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Extension Parameters
        </h3>
        
        {strategy.extensions.map(extensionId => {
          const config = getExtensionConfig(extensionId);
          if (!config) return null;

          return (
            <div key={extensionId} className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">
                {config.name}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.parameters.map(param => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={extensionParameters[extensionId]?.[param.name] || ''}
                      onChange={(e) => handleExtensionParamChange(extensionId, param.name, e.target.value)}
                      placeholder={param.description}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Type: {param.type} - {param.description}
                    </p>
                  </div>
                ))}
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
                <Link href="/strategy" className="text-primary-orange hover:underline">
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
          
          {!isSimpleOrder && strategy && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-blue-900 font-semibold mb-2">Selected Strategy</h3>
              <div className="flex flex-wrap gap-2">
                {strategy.extensions.map(extensionId => {
                  const config = getExtensionConfig(extensionId);
                  return config ? (
                    <span key={extensionId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Wallet Connection</h3>
              <p className="text-gray-600">
                {isConnected 
                  ? `Connected as ${address?.slice(0, 6)}...${address?.slice(-4)}` 
                  : 'Connect your wallet to create and sign orders'
                }
              </p>
              {chain && (
                <p className="text-sm text-gray-500 mt-1">Network: {chain.name}</p>
              )}
            </div>
            <ConnectButton />
          </div>
          {validationErrors.wallet && (
            <p className="text-red-600 text-sm mt-2">{validationErrors.wallet}</p>
          )}
          {validationErrors.network && (
            <p className="text-red-600 text-sm mt-2">{validationErrors.network}</p>
          )}
        </div>

        {/* Order Parameters Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Parameters</h3>
          
          <div className="space-y-6">
            {/* Core Trading Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maker Asset (Token Address) *
                </label>
                <input
                  type="text"
                  value={orderParams.makerAsset}
                  onChange={(e) => handleParamChange('makerAsset', e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                />
                {validationErrors.makerAsset && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors.makerAsset}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maker Amount *
                </label>
                <input
                  type="number"
                  value={orderParams.makerAmount}
                  onChange={(e) => handleParamChange('makerAmount', e.target.value)}
                  placeholder="Amount to sell"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                />
                {validationErrors.makerAmount && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors.makerAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taker Asset (Token Address) *
                </label>
                <input
                  type="text"
                  value={orderParams.takerAsset}
                  onChange={(e) => handleParamChange('takerAsset', e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                />
                {validationErrors.takerAsset && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors.takerAsset}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taker Amount *
                </label>
                <input
                  type="number"
                  value={orderParams.takerAmount}
                  onChange={(e) => handleParamChange('takerAmount', e.target.value)}
                  placeholder="Amount to receive"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                />
                {validationErrors.takerAmount && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors.takerAmount}</p>
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
                  onChange={(e) => handleParamChange('receiver', e.target.value)}
                  placeholder="Leave empty to use maker address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                />
              </div>
            </div>

            {/* Order Traits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Order Options</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={orderParams.allowPartialFills}
                    onChange={(e) => handleParamChange('allowPartialFills', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-orange focus:ring-primary-orange border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow partial fills</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={orderParams.allowMultipleFills}
                    onChange={(e) => handleParamChange('allowMultipleFills', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-orange focus:ring-primary-orange border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow multiple fills</span>
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
        {Object.entries(validationErrors).filter(([key]) => key.startsWith('extension_')).map(([key, error]) => (
          <div key={key} className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Extension Error: {error}</p>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link
            href={isSimpleOrder ? "/" : "/strategy"}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to {isSimpleOrder ? "Home" : "Strategy Builder"}
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