import humanizeString from 'humanize-string';
import { extensions, z } from 'opa-builder';

/**
 * Custom schema types from the builder package
 * We'll try to detect these by examining their properties
 */
const CUSTOM_SCHEMA_PATTERNS = {
  address: {
    type: 'address',
    detect: (schema) => {
      // Address schemas have regex validation for 0x + 40 hex chars
      return (
        schema instanceof z.ZodString &&
        schema._def.checks?.some(
          (check) =>
            check.kind === 'regex' &&
            check.regex.source.includes('0x[a-fA-F0-9]{40}')
        )
      );
    },
  },
  uint256: {
    type: 'uint256',
    detect: (schema) => {
      // uint256 schemas are strings with specific regex and refinement
      return (
        schema instanceof z.ZodString &&
        schema._def.checks?.some(
          (check) =>
            check.kind === 'regex' && check.regex.source.includes('[0-9]+')
        ) &&
        schema._def.checks?.some((check) => check.kind === 'refine')
      );
    },
  },
  bytes32: {
    type: 'bytes32',
    detect: (schema) => {
      // bytes32 schemas have regex for 0x + 64 hex chars
      return (
        schema instanceof z.ZodString &&
        schema._def.checks?.some(
          (check) =>
            check.kind === 'regex' &&
            check.regex.source.includes('0x[a-fA-F0-9]{64}')
        )
      );
    },
  },
  bytes: {
    type: 'bytes',
    detect: (schema) => {
      // bytes schemas have regex for 0x + even hex chars
      return (
        schema instanceof z.ZodString &&
        schema._def.checks?.some(
          (check) =>
            check.kind === 'regex' &&
            check.regex.source.includes('0x([a-fA-F0-9]{2})*')
        )
      );
    },
  },
  timestamp: {
    type: 'timestamp',
    detect: (schema) => {
      // timestamp is a union of number and transformed string
      return (
        schema instanceof z.ZodUnion &&
        schema._def.options.some((option) => option instanceof z.ZodNumber) &&
        schema._def.options.some(
          (option) =>
            option instanceof z.ZodEffects &&
            option._def.schema instanceof z.ZodString
        )
      );
    },
  },
  percentage: {
    type: 'percentage',
    detect: (schema) => {
      // percentage is number with min 0, max 100
      return (
        schema instanceof z.ZodNumber &&
        schema._def.checks?.some(
          (check) => check.kind === 'min' && check.value === 0
        ) &&
        schema._def.checks?.some(
          (check) => check.kind === 'max' && check.value === 100
        )
      );
    },
  },
  basisPoints: {
    type: 'basisPoints',
    detect: (schema) => {
      // basisPoints is int number with min 0, max 10000
      return (
        schema instanceof z.ZodNumber &&
        schema._def.checks?.some((check) => check.kind === 'int') &&
        schema._def.checks?.some(
          (check) => check.kind === 'min' && check.value === 0
        ) &&
        schema._def.checks?.some(
          (check) => check.kind === 'max' && check.value === 10000
        )
      );
    },
  },
};

/**
 * Extracts parameter information from a Zod schema
 * @param {Object} schema - Zod schema object
 * @returns {Array} Array of parameter objects
 */
function extractParametersFromSchema(schema) {
  if (!schema) {
    return [];
  }

  // Handle object schemas
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    return Object.entries(shape).map(([key, fieldSchema]) => {
      const description =
        fieldSchema._def.description || `${humanizeString(key)} parameter`;
      const type = getZodTypeString(fieldSchema);

      return {
        name: key,
        type: type,
        required: !fieldSchema.isOptional(),
        description: description,
        label: humanizeString(key),
      };
    });
  }

  // Handle union schemas (for complex configurations like chainlink)
  if (schema instanceof z.ZodUnion) {
    // For unions, we'll take parameters from all options
    const allParameters = [];
    const options = schema._def.options;

    for (const option of options) {
      const optionParams = extractParametersFromSchema(option);
      allParameters.push(...optionParams);
    }

    // Remove duplicates based on name
    const uniqueParams = allParameters.filter(
      (param, index, self) =>
        index === self.findIndex((p) => p.name === param.name)
    );

    return uniqueParams;
  }

  return [];
}

/**
 * Converts Zod type to string representation
 * @param {Object} schema - Zod schema
 * @returns {string} Type string
 */
function getZodTypeString(schema) {
  if (!schema) return 'unknown';

  // First check for custom schema types
  for (const [, customType] of Object.entries(CUSTOM_SCHEMA_PATTERNS)) {
    if (customType.detect(schema)) {
      return customType.type;
    }
  }

  // Handle effects/transforms (like timestamp string transforms)
  if (schema instanceof z.ZodEffects) {
    return getZodTypeString(schema._def.schema);
  }

  // Handle basic Zod types using instanceof
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodObject) return 'object';
  if (schema instanceof z.ZodArray) return 'array';
  if (schema instanceof z.ZodUnion) return 'union';
  if (schema instanceof z.ZodLiteral) return 'literal';
  if (schema instanceof z.ZodUndefined) return 'undefined';
  if (schema instanceof z.ZodOptional)
    return getZodTypeString(schema._def.innerType);
  if (schema instanceof z.ZodDefault)
    return getZodTypeString(schema._def.innerType);

  // Fallback for unknown types
  return 'unknown';
}

/**
 * Auto-generates extension configurations from real extension data
 * @returns {Object} Generated extension configurations
 */
function generateExtensionConfigs() {
  const configs = {};

  Object.entries(extensions).forEach(([extensionKey, extension]) => {
    if (!extension.meta || !extension.schemas) {
      return;
    }

    const { name, description } = extension.meta;
    const hooks = {};
    const allParameters = [];

    // Process each hook and extract parameters
    Object.entries(extension.schemas).forEach(([hookType, schema]) => {
      hooks[hookType] = true;
      // Skip undefined schemas
      if (!schema || schema._def?.typeName === 'ZodUndefined') {
        return;
      }
      const parameters = extractParametersFromSchema(schema);
      allParameters.push(...parameters);
    });

    // Remove duplicate parameters
    // const uniqueParameters = allParameters.filter(
    //   (param, index, self) =>
    //     index === self.findIndex((p) => p.name === param.name)
    // );

    configs[extensionKey] = {
      name,
      description,
      hooks: Object.keys(hooks),
      parameters: allParameters,
    };
  });

  return configs;
}

/**
 * Generated extension configurations based on real extension data
 */
export const extensionConfigs = generateExtensionConfigs();

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

  // Check for hook type conflicts
  const hookTypeGroups = {};
  selectedExtensions.forEach((extensionId) => {
    const config = extensionConfigs[extensionId];
    if (config && config.hooks) {
      // Since hooks is now an array, we need to check each hook type
      config.hooks.forEach((hookType) => {
        if (!hookTypeGroups[hookType]) {
          hookTypeGroups[hookType] = [];
        }
        hookTypeGroups[hookType].push(extensionId);
      });
    }
  });

  // Warning for multiple extensions using the same hook type
  Object.entries(hookTypeGroups).forEach(([hookType, extensionList]) => {
    if (extensionList.length > 1) {
      warnings.push({
        type: 'hook_type_overlap',
        hookType,
        extensions: extensionList,
        message: `Multiple extensions use the ${hookType} hook: ${extensionList.join(', ')}. This may cause unexpected behavior.`,
      });
    }
  });

  // Check for extension-specific conflicts
  // Gas Station conflicts
  if (selectedExtensions.includes('gasStation')) {
    const conflictingExtensions = selectedExtensions.filter((id) =>
      ['chainlinkCalculator', 'dutchAuctionCalculator'].includes(id)
    );

    if (conflictingExtensions.length > 0) {
      conflicts.push({
        type: 'gas_station_conflict',
        extensions: ['gasStation', ...conflictingExtensions],
        message:
          'Gas Station cannot be used with pricing calculators that modify amounts',
      });
    }
  }

  // Check for multiple pricing extensions
  const pricingExtensions = selectedExtensions.filter((id) =>
    [
      'chainlinkCalculator',
      'dutchAuctionCalculator',
      'rangeAmountCalculator',
    ].includes(id)
  );

  if (pricingExtensions.length > 1) {
    conflicts.push({
      type: 'multiple_pricing',
      extensions: pricingExtensions,
      message:
        'Only one pricing/amount calculation extension can be used at a time',
    });
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
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

  config.parameters.forEach((param) => {
    if (
      param.required &&
      (!parameters[param.name] || parameters[param.name] === '')
    ) {
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
