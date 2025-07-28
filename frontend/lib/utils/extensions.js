import { extensions, HookType } from 'opa-builder';

/**
 * Extension Management Utilities
 * Provides functions for managing extension selection and detecting conflicts
 */

/**
 * Available extension configurations with metadata
 */
export const extensionConfigs = {
  gasStation: {
    name: 'Gas Station',
    description: 'Enables gas payment in alternative tokens instead of ETH',
    hookType: HookType.PRE_INTERACTION,
    category: 'payment',
    parameters: [
      { name: 'gasToken', type: 'address', required: true, description: 'Token to pay gas fees with' },
      { name: 'gasPrice', type: 'uint256', required: true, description: 'Gas price in token units' },
    ],
  },
  chainlinkCalculator: {
    name: 'Chainlink Calculator',
    description: 'Dynamic pricing based on Chainlink price feeds',
    hookType: HookType.INTERACTION,
    category: 'pricing',
    parameters: [
      { name: 'priceFeed', type: 'address', required: true, description: 'Chainlink price feed address' },
      { name: 'baseAmount', type: 'uint256', required: true, description: 'Base amount for calculation' },
    ],
  },
  dutchAuctionCalculator: {
    name: 'Dutch Auction Calculator',
    description: 'Time-based decreasing price auction mechanism',
    hookType: HookType.INTERACTION,
    category: 'pricing',
    parameters: [
      { name: 'startPrice', type: 'uint256', required: true, description: 'Starting auction price' },
      { name: 'endPrice', type: 'uint256', required: true, description: 'Ending auction price' },
      { name: 'duration', type: 'uint256', required: true, description: 'Auction duration in seconds' },
    ],
  },
  rangeAmountCalculator: {
    name: 'Range Amount Calculator',
    description: 'Allows flexible amount ranges for partial fills',
    hookType: HookType.INTERACTION,
    category: 'amount',
    parameters: [
      { name: 'minAmount', type: 'uint256', required: true, description: 'Minimum fill amount' },
      { name: 'maxAmount', type: 'uint256', required: true, description: 'Maximum fill amount' },
    ],
  },
};

/**
 * Gets all available extensions
 * @returns {Array<Object>} Array of extension configurations
 */
export function getAvailableExtensions() {
  return Object.entries(extensionConfigs).map(([key, config]) => ({
    id: key,
    ...config,
  }));
}

/**
 * Checks for conflicts between selected extensions
 * @param {Array<string>} selectedExtensions - Array of extension IDs
 * @returns {Object} Conflict analysis result
 */
export function checkExtensionConflicts(selectedExtensions) {
  const conflicts = [];
  const warnings = [];
  
  // Group extensions by category
  const categoryGroups = {};
  selectedExtensions.forEach(extensionId => {
    const config = extensionConfigs[extensionId];
    if (config) {
      const category = config.category;
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(extensionId);
    }
  });
  
  // Check for pricing conflicts (only one pricing extension allowed)
  if (categoryGroups.pricing && categoryGroups.pricing.length > 1) {
    conflicts.push({
      type: 'category_conflict',
      category: 'pricing',
      extensions: categoryGroups.pricing,
      message: 'Only one pricing extension can be selected at a time',
    });
  }
  
  // Check for hook type conflicts
  const hookTypeGroups = {};
  selectedExtensions.forEach(extensionId => {
    const config = extensionConfigs[extensionId];
    if (config) {
      const hookType = config.hookType;
      if (!hookTypeGroups[hookType]) {
        hookTypeGroups[hookType] = [];
      }
      hookTypeGroups[hookType].push(extensionId);
    }
  });
  
  // Warning for multiple extensions of same hook type
  Object.entries(hookTypeGroups).forEach(([hookType, extensionList]) => {
    if (extensionList.length > 1) {
      warnings.push({
        type: 'hook_type_warning',
        hookType,
        extensions: extensionList,
        message: `Multiple extensions using ${hookType} hook type may have execution order dependencies`,
      });
    }
  });
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    warnings,
    isValid: conflicts.length === 0,
  };
}

/**
 * Gets extension configuration by ID
 * @param {string} extensionId - Extension identifier
 * @returns {Object|null} Extension configuration or null if not found
 */
export function getExtensionConfig(extensionId) {
  return extensionConfigs[extensionId] || null;
}

/**
 * Validates extension parameters
 * @param {string} extensionId - Extension identifier
 * @param {Object} parameters - Parameter values to validate
 * @returns {Object} Validation result
 */
export function validateExtensionParameters(extensionId, parameters) {
  const config = getExtensionConfig(extensionId);
  if (!config) {
    return { isValid: false, errors: ['Unknown extension'] };
  }
  
  const errors = [];
  
  config.parameters.forEach(param => {
    if (param.required && (!parameters[param.name] || parameters[param.name] === '')) {
      errors.push(`${param.name} is required`);
    }
    
    // Basic type validation
    if (parameters[param.name]) {
      const value = parameters[param.name];
      if (param.type === 'address' && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
        errors.push(`${param.name} must be a valid Ethereum address`);
      }
      if (param.type === 'uint256' && (isNaN(value) || parseFloat(value) < 0)) {
        errors.push(`${param.name} must be a positive number`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates extension instances with parameters
 * @param {Array<Object>} extensionConfigs - Array of {id, parameters} objects
 * @returns {Object} Initialized extension instances
 */
export function createExtensionInstances(extensionConfigs) {
  const instances = {};
  
  extensionConfigs.forEach(({ id, parameters }) => {
    if (extensions[id]) {
      instances[id] = extensions[id](parameters);
    }
  });
  
  return instances;
} 