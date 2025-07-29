// Extension parameter type definition
interface ExtensionParameter {
  name: string;
  label?: string;
  type: object;
  required?: boolean;
  hint?: string;
}

// Extension hook type definition
interface ExtensionHook {
  type: string;
  params: ExtensionParameter[];
}

// Extension configuration type definition
interface ExtensionConfig {
  name: string;
  description: string;
  hooks: ExtensionHook[];
}

// Extension configurations object type (returned by generateExtensionConfigs)
interface ExtensionConfigs {
  [extensionKey: string]: ExtensionConfig;
}

// Extension with ID (returned by getAvailableExtensions)
interface ExtensionWithId extends ExtensionConfig {
  id: string;
}

// Extension conflict types
interface ExtensionConflict {
  type: string;
  hookType?: string;
  extensions: string[];
  message: string;
}

interface ExtensionConflictResult {
  isValid: boolean;
  conflicts: ExtensionConflict[];
}

// Extension validation types
interface ExtensionValidationResult {
  isValid: boolean;
  errors: string[];
}

// Extension instance configuration
interface ExtensionInstanceConfig {
  id: string;
  parameters: Record<string, any>;
}
