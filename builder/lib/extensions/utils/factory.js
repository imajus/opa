/**
 * Creates a standardized extension wrapper for 1inch Limit Order Protocol extensions.
 *
 * This factory function validates the configuration and returns a wrapper object
 * that provides schema validation, parameter building, and metadata for LOP extensions.
 *
 * @param {WrapperConfig} blueprint - Wrapper configuration object
 * @returns {ExtensionWrapper} Standardized extension wrapper with validation and build capabilities
 */
export function createWrapper({ name, description, hooks, build }) {
  // Validate required parameters
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('name is required and must be a non-empty string');
  }
  if (
    !description ||
    typeof description !== 'string' ||
    description.trim() === ''
  ) {
    throw new Error('description is required and must be a non-empty string');
  }
  if (typeof build !== 'function') {
    throw new Error('build must be a function');
  }
  if (!hooks || typeof hooks !== 'object') {
    throw new Error('hooks must be an object');
  }

  return {
    meta: {
      name,
      description,
      version: '1.0.0',
    },
    schemas: hooks,
    validate(params) {
      const errors = {};
      const hookEntries = Object.entries(hooks);
      for (const [hookName, schema] of hookEntries) {
        try {
          schema.validate(params[hookName]);
        } catch (error) {
          errors[hookName] = error;
        }
      }
      return Object.keys(errors).length === 0 ? null : errors;
    },
    async build(params, context) {
      const hookEntries = Object.entries(hooks);
      const parsedParams = {};
      for (const [hookName, schema] of hookEntries) {
        if (params[hookName] !== undefined) {
          parsedParams[hookName] = await schema.parse(
            params[hookName],
            context
          );
        }
      }
      return build(parsedParams, context);
    },
  };
}

/**
 * Creates a schema from a given schema object
 * @param {ExtensionSchemaBlueprint} blueprint - Schema blueprint object
 * @returns {ExtensionSchema} Schema object with validate and parse functions
 */
export function createSchema({ hint, fields, validate }) {
  return {
    hint,
    fields,
    validate(params) {
      // First validate all individual fields
      if (fields) {
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          if (params[fieldName] !== undefined) {
            fieldDef.type.validate(params[fieldName]);
          }
        }
      }
      // If all field validations passed, call blueprint's validate if present
      if (validate) {
        validate(params);
      }
    },
    async parse(params, context) {
      const parsed = {};
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (params[fieldName] !== undefined) {
          parsed[fieldName] = await fieldDef.type.parse(
            params[fieldName],
            context
          );
        }
      }
      return parsed;
    },
  };
}
