/**
 * 💎 loot-json schema types
 * JSON Schema type definitions (subset of JSON Schema Draft-07)
 */

// ============================================================================
// Schema Types
// ============================================================================

/**
 * JSON Schema type keywords
 */
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/**
 * String format keywords
 */
export type StringFormat = 'date' | 'date-time' | 'email' | 'uri' | 'uuid';

/**
 * JSON Schema subset for loot-json (v0.5.0)
 * Based on JSON Schema Draft-07 (extended)
 */
export interface LootSchema {
  // Meta
  $id?: string;
  $ref?: string;
  definitions?: Record<string, LootSchema>;

  // Type
  type?: SchemaType | SchemaType[];

  // Object
  properties?: Record<string, LootSchema>;
  required?: string[];
  additionalProperties?: boolean | LootSchema;
  patternProperties?: Record<string, LootSchema>;
  propertyNames?: LootSchema;

  // Array
  items?: LootSchema | LootSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  contains?: LootSchema;

  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: StringFormat;

  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Enum
  enum?: unknown[];
  const?: unknown;

  // Composition (v0.5.0)
  allOf?: LootSchema[];
  anyOf?: LootSchema[];
  oneOf?: LootSchema[];
  not?: LootSchema;

  // Conditional (v0.5.0)
  if?: LootSchema;
  then?: LootSchema;
  else?: LootSchema;
}

// ============================================================================
// Validation Results
// ============================================================================

/**
 * Result of schema validation
 */
export interface ValidationResult<T = unknown> {
  /** Whether the data is valid */
  valid: boolean;

  /** The validated data (same as input if valid, null if invalid) */
  data: T | null;

  /** List of validation errors */
  errors: ValidationError[];
}

/**
 * Individual validation error
 */
export interface ValidationError {
  /** JSON path to the error location */
  path: string;

  /** Human-readable error message */
  message: string;

  /** Schema keyword that failed */
  keyword: string;

  /** Expected value or constraint */
  expected?: unknown;

  /** Actual value that was found */
  actual?: unknown;
}
