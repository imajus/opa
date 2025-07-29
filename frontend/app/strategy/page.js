'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAvailableExtensions,
  checkExtensionConflicts,
  getExtensionConfig,
  flatExtensionConfigParams,
  getSchemaTypeName,
} from '../../lib/utils/extensions';
import { encodeStrategy } from '../../lib/utils/encoding';

export default function StrategyPage() {
  const router = useRouter();
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  // const [extensionParameters, setExtensionParameters] = useState({});
  const [conflictAnalysis, setConflictAnalysis] = useState({
    isValid: true,
    conflicts: [],
    warnings: [],
  });
  const [availableExtensions] = useState(getAvailableExtensions());

  // Check for conflicts whenever selected extensions change
  useEffect(() => {
    const analysis = checkExtensionConflicts(selectedExtensions);
    setConflictAnalysis(analysis);
  }, [selectedExtensions]);

  const handleExtensionToggle = (extensionId) => {
    setSelectedExtensions((prev) => {
      if (prev.includes(extensionId)) {
        // Remove extension and its parameters
        // const newParams = { ...extensionParameters };
        // delete newParams[extensionId];
        // setExtensionParameters(newParams);
        // return prev.filter((id) => id !== extensionId);
      } else {
        // Add extension and initialize its parameters
        // const config = getExtensionConfig(extensionId);
        // const defaultParams = config.hooks.map(({ params }) => params).flat();
        // setExtensionParameters((prev) => ({
        //   ...prev,
        //   [extensionId]: defaultParams,
        // }));
        return [...prev, extensionId];
      }
    });
  };

  const handleContinue = () => {
    if (!conflictAnalysis.isValid) {
      return; // Don't proceed if there are conflicts
    }

    const strategy = {
      extensions: selectedExtensions,
      // parameters: extensionParameters,
    };

    const encodedStrategy = encodeStrategy(strategy);
    router.push(`/create?blueprint=${encodedStrategy}`);
  };

  const getHookTypeColor = (hookType) => {
    const colors = {
      makerAmount: 'bg-purple-100 text-purple-800',
      takerAmount: 'bg-blue-100 text-blue-800',
      preInteraction: 'bg-green-100 text-green-800',
      postInteraction: 'bg-orange-100 text-orange-800',
    };
    return colors[hookType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm breadcrumbs mb-4">
            <Link href="/" className="text-primary-orange hover:underline">
              Home
            </Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-gray-600">Strategy Builder</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Build Your Strategy
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Select and configure extensions to create sophisticated limit order
            strategies. Extensions can add features like alternative gas
            payment, dynamic pricing, and flexible amounts.
          </p>
        </div>

        {/* Conflict Alerts */}
        {conflictAnalysis.conflicts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-2">
              ⚠️ Extension Conflicts Detected
            </h3>
            {conflictAnalysis.conflicts.map((conflict, index) => (
              <p key={index} className="text-red-700 text-sm mb-1">
                {conflict.message} ({conflict.extensions.join(', ')})
              </p>
            ))}
          </div>
        )}

        {/* {conflictAnalysis.warnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Warnings</h3>
            {conflictAnalysis.warnings.map((warning, index) => (
              <p key={index} className="text-yellow-700 text-sm mb-1">
                {warning.message}
              </p>
            ))}
          </div>
        )} */}

        {/* Extension Selection Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {availableExtensions.map((extension) => {
            const isSelected = selectedExtensions.includes(extension.id);
            const extensionParams = flatExtensionConfigParams(extension);
            return (
              <div
                key={extension.id}
                className={`border-2 rounded-xl p-6 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-primary-orange bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => handleExtensionToggle(extension.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {extension.name}
                      </h3>
                    </div>
                    <p className="text-gray-600 mb-3">
                      {extension.description}
                    </p>
                    <p className="text-sm text-gray-500">
                      Hook Types:{' '}
                      {extension.hooks && extension.hooks.length > 0
                        ? extension.hooks.map((hook) => (
                            <span
                              key={hook.type}
                              className={`inline-block px-2 py-0.5 rounded mr-1 ${getHookTypeColor(hook.type)}`}
                            >
                              {hook.type}
                            </span>
                          ))
                        : 'None'}
                    </p>
                  </div>

                  <div className="flex-shrink-0 ml-4">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-primary-orange bg-primary-orange'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* Parameters Preview (Read-only) */}
                {extensionParams.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Required Parameters:
                    </h4>
                    <div className="space-y-2">
                      {extensionParams.map((param) => (
                        <div
                          key={param.name}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-600">
                            {param.label || param.name}
                            {param.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </span>
                          <span className="text-gray-500 font-mono text-xs">
                            {getSchemaTypeName(param.type)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Parameters will be configured in the next step.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Extensions Summary */}
        {selectedExtensions.length > 0 && (
          <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Selected Extensions ({selectedExtensions.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedExtensions.map((extensionId) => {
                const extension = getExtensionConfig(extensionId);
                return (
                  <span
                    key={extensionId}
                    className="px-3 py-1 rounded-full text-sm bg-primary-orange text-white"
                  >
                    {extension?.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to Home
          </Link>

          <div className="flex gap-4">
            {selectedExtensions.length === 0 && (
              <Link
                href="/create"
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Create Simple Order
              </Link>
            )}

            <button
              onClick={handleContinue}
              disabled={
                selectedExtensions.length === 0 || !conflictAnalysis.isValid
              }
              className={`font-semibold py-3 px-6 rounded-lg transition-colors ${
                selectedExtensions.length > 0 && conflictAnalysis.isValid
                  ? 'bg-primary-orange hover:bg-orange-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue to Order Creation →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
