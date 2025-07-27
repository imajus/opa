import { z } from 'zod';

/**
 * @typedef {Object} ExtensionMeta
 * @property {string} name - Extension name
 * @property {string} description - Extension description
 * @property {string} version - Extension version
 */

/**
 * @typedef {Object} ExtensionWrapper
 * @property {ExtensionMeta} meta - Extension metadata
 * @property {Object} schemas - Hook parameter schemas
 * @property {Function} build - Function to build Extension instance
 * @property {Function} validate - Function to validate parameters
 */

/**
 * @typedef {Object} WrapperConfig
 * @property {string} name - Extension name
 * @property {string} description - Extension description
 * @property {Object.<string, import('zod').ZodSchema>} hooks - Hook schemas
 * @property {Function} build - Function to build Extension instance
 */

/**
 * Schema for extension wrapper configuration validation
 * @type {import('zod').ZodSchema<WrapperConfig>}
 */
const WrapperConfigSchema = z.object({
  name: z.string().min(1, 'Extension name is required'),
  description: z.string().min(1, 'Extension description is required'),
  hooks: z.object({}).passthrough(), // Will be validated by specific hook schemas
  build: z.function().args(z.any()).returns(z.any()),
});

/**
 * Creates a standardized extension wrapper for 1inch Limit Order Protocol extensions.
 *
 * This factory function validates the configuration and returns a wrapper object
 * that provides schema validation, parameter building, and metadata for LOP extensions.
 *
 * @param {WrapperConfig} config - Wrapper configuration object
 * @param {string} config.name - Unique identifier for the extension
 * @param {string} config.description - Human-readable description of the extension's purpose
 * @param {Object.<string, import('zod').ZodSchema>} config.hooks - Object mapping hook names to their Zod validation schemas
 * @param {Function} config.build - Function that transforms validated parameters into an Extension instance
 * @returns {ExtensionWrapper} Standardized extension wrapper with validation and build capabilities
 * @throws {import('zod').ZodError} When configuration is invalid
 *
 * @example
 * ```javascript
 * import { createWrapper } from './factory.js';
 * import { address, uint256 } from '../../schemas/common.js';
 *
 * const gasStationWrapper = createWrapper({
 *   name: 'gasStation',
 *   description: 'Automated gas payment for limit orders',
 *   hooks: {
 *     preInteraction: z.object({
 *       gasPrice: uint256,
 *       gasLimit: uint256
 *     })
 *   },
 *   build: (params) => new Extension(params)
 * });
 * ```
 */
export function createWrapper(config) {
  const validatedConfig = WrapperConfigSchema.parse(config);
  const { name, description, hooks, build } = validatedConfig;

  return {
    /** @type {ExtensionMeta} Extension metadata */
    meta: {
      name,
      description,
      version: '1.0.0',
    },
    /** @type {Object.<string, import('zod').ZodSchema>} Hook parameter schemas */
    schemas: hooks,
    /**
     * Builds an Extension instance with validated parameters
     * @param {Object} params - Parameters for each hook
     * @returns {*} Extension instance created by the configured build function
     * @throws {import('zod').ZodError} When parameters fail validation
     */
    build: function (params) {
      const hookEntries = Object.entries(hooks);
      const validatedParams = {};
      for (const [hookName, schema] of hookEntries) {
        if (params[hookName] !== undefined) {
          validatedParams[hookName] = schema.parse(params[hookName]);
        }
      }
      return build(validatedParams);
    },
    /**
     * Validates parameters against hook schemas without building
     * @param {Object} params - Parameters to validate
     * @returns {Object|null} Validation errors object or null if valid
     */
    validate: function (params) {
      const errors = {};
      const hookEntries = Object.entries(hooks);
      for (const [hookName, schema] of hookEntries) {
        if (params[hookName] !== undefined) {
          try {
            schema.parse(params[hookName]);
          } catch (error) {
            errors[hookName] = error.errors;
          }
        }
      }
      return Object.keys(errors).length === 0 ? null : errors;
    },
  };
}
