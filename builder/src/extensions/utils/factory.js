import { z } from 'zod';

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
    meta: {
      name,
      description,
      version: '1.0.0',
    },
    schemas: hooks,
    build(params) {
      const hookEntries = Object.entries(hooks);
      const validatedParams = {};
      for (const [hookName, schema] of hookEntries) {
        if (params[hookName] !== undefined) {
          validatedParams[hookName] = schema.parse(params[hookName]);
        }
      }
      return build(validatedParams);
    },
    validate(params) {
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
