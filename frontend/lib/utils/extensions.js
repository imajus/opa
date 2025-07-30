import { extensions, Type } from 'opa-builder/lib';
import { parseEther } from 'ethers';

/**
 * Parses amount values for token amounts
 * @param {string} asset - Asset address (currently unused)
 * @param {string} value - Value to parse
 * @returns {string} Parsed amount in wei as string
 */
export function parseAmount(asset, value) {
  // Skip the asset parameter for now as requested
  return parseEther(value).toString();
}

export function getSchemaTypeName(type) {
  if (type === Type.address) return 'Address';
  if (type === Type.uint256) return 'Integer';
  if (type === Type.timestamp) return 'Date & Time';
  if (type === Type.boolean) return 'Boolean';
  if (type === Type.makerTokenAmount) return 'Maker Token Amount';
  if (type === Type.takerTokenAmount) return 'Taker Token Amount';
  return 'unknown';
}

/**
 * Auto-generates extension configurations from real extension data
 * @returns {ExtensionConfigs} Generated extension configurations
 */
function generateExtensionConfigs() {
  const configs = {};
  Object.entries(extensions).forEach(([extensionKey, extension]) => {
    if (!extension.meta || !extension.schemas) {
      return;
    }
    const { name, description } = extension.meta;
    const hooks = [];
    // Process each hook and extract parameters
    Object.entries(extension.schemas).forEach(([type, schema]) => {
      hooks.push({
        type,
        params: Object.entries(schema.fields || {}).map(([name, param]) => ({
          name,
          ...param,
        })),
      });
    });
    configs[extensionKey] = {
      name,
      description,
      hooks,
    };
  });
  return configs;
}

/**
 * @type {ExtensionConfigs}
 * Generated extension configurations based on real extension data
 */
export const extensionConfigs = generateExtensionConfigs();

/**
 * Gets all available extensions
 * @returns {Array<ExtensionWithId>} Array of extension configurations
 */
export function getAvailableExtensions() {
  return Object.entries(extensionConfigs).map(([key, config]) => ({
    id: key,
    ...config,
  }));
}

/**
 * Checks for conflicts between selected extensions
 * @param {Array<string>} extensions - Array of extension IDs
 * @returns {Object} Conflict analysis result
 */
export function checkExtensionConflicts(extensions) {
  const conflicts = [];

  // Check for hook type conflicts
  const hookTypeGroups = {};
  extensions.forEach((extensionId) => {
    const config = extensionConfigs[extensionId];
    if (config && config.hooks) {
      // Since hooks is now an array, we need to check each hook type
      config.hooks.forEach(({ type }) => {
        if (!hookTypeGroups[type]) {
          hookTypeGroups[type] = [];
        }
        hookTypeGroups[type].push(extensionId);
      });
    }
  });

  // Warning for multiple extensions using the same hook type
  Object.entries(hookTypeGroups).forEach(([hookType, extensionList]) => {
    if (extensionList.length > 1) {
      conflicts.push({
        type: 'hook_type_overlap',
        hookType,
        extensions: extensionList,
        message: `Multiple extensions use the ${hookType} hook: ${extensionList.join(', ')}. This may cause unexpected behavior.`,
      });
    }
  });

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Gets extension configuration by ID
 * @param {string} extensionId - Extension identifier
 * @returns {ExtensionConfig|null} Extension configuration or null if not found
 */
export function getExtensionConfig(extensionId) {
  return extensionConfigs[extensionId] || null;
}

/**
 * Validates extension parameters
 * @param {string} extensionId - Extension identifier
 * @param {Object} params - Parameter values to validate
 * @returns {Object} Validation result
 */
export function validateExtensionParameters(extensionId, params) {
  // Get the extension wrapper from the builder package
  const extension = extensions[extensionId];
  if (!extension) {
    return { isValid: false, errors: ['Unknown extension'] };
  }
  // Use the extension's built-in validate method
  const errors = extension.validate(params);
  if (!errors) {
    // No errors - validation passed
    return { isValid: true, errors: [] };
  }
  // Convert validation errors to flat error message array
  return {
    isValid: false,
    errors: Object.entries(errors).map(
      ([hookName, error]) => `${hookName}: ${error.message || error}`
    ),
  };
}

/**
 *
 * @param {ExtensionConfig} config
 * @returns {Array<{ hookType: string } & ExtensionParameter>}
 */
export const flatExtensionConfigParams = (config) =>
  config.hooks
    .map(({ type, params }) =>
      params.map((param) => ({ hookType: type, ...param }))
    )
    .flat();
