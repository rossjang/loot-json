/**
 * 💎 loot-json schema validator (v0.5.0)
 * Lightweight JSON Schema validator (zero dependency)
 *
 * Features:
 * - Composition keywords: allOf, anyOf, oneOf, not
 * - Conditional keywords: if/then/else
 * - $ref support with definitions
 * - patternProperties, propertyNames, contains
 */

import { LootSchema, SchemaType, ValidationError, ValidationResult } from './types';

/**
 * JSON Schema validator
 * Supports extended subset of JSON Schema Draft-07 keywords
 */
export class SchemaValidator {
  private errors: ValidationError[] = [];
  private path: string[] = [];
  private rootSchema: LootSchema | null = null;
  private definitions: Map<string, LootSchema> = new Map();

  /**
   * Validate data against a schema
   *
   * @example
   * ```ts
   * const validator = new SchemaValidator();
   * const result = validator.validate(data, {
   *   type: 'object',
   *   properties: {
   *     name: { type: 'string' },
   *     age: { type: 'number', minimum: 0 },
   *   },
   *   required: ['name'],
   * });
   *
   * if (result.valid) {
   *   console.log('Valid:', result.data);
   * } else {
   *   console.log('Errors:', result.errors);
   * }
   * ```
   */
  validate<T = unknown>(data: unknown, schema: LootSchema): ValidationResult<T> {
    this.errors = [];
    this.path = [];
    this.rootSchema = schema;
    this.definitions = new Map();

    // Extract definitions
    if (schema.definitions) {
      for (const [name, def] of Object.entries(schema.definitions)) {
        this.definitions.set(`#/definitions/${name}`, def);
      }
    }

    this.validateValue(data, schema);

    return {
      valid: this.errors.length === 0,
      data: this.errors.length === 0 ? (data as T) : null,
      errors: this.errors,
    };
  }

  // ============================================================================
  // Main Validation
  // ============================================================================

  private validateValue(value: unknown, schema: LootSchema): void {
    // Handle $ref
    if (schema.$ref) {
      const resolvedSchema = this.resolveRef(schema.$ref);
      if (resolvedSchema) {
        this.validateValue(value, resolvedSchema);
      } else {
        this.addError('$ref', `Cannot resolve reference: ${schema.$ref}`, {
          expected: schema.$ref,
        });
      }
      return;
    }

    // Composition keywords (v0.5.0)
    if (schema.allOf) {
      this.validateAllOf(value, schema.allOf);
    }

    if (schema.anyOf) {
      this.validateAnyOf(value, schema.anyOf);
    }

    if (schema.oneOf) {
      this.validateOneOf(value, schema.oneOf);
    }

    if (schema.not) {
      this.validateNot(value, schema.not);
    }

    // Conditional keywords (v0.5.0)
    if (schema.if) {
      this.validateConditional(value, schema);
    }

    // Type validation
    if (schema.type !== undefined) {
      this.validateType(value, schema.type);
    }

    // Const validation
    if (schema.const !== undefined) {
      this.validateConst(value, schema.const);
    }

    // Enum validation
    if (schema.enum !== undefined) {
      this.validateEnum(value, schema.enum);
    }

    // Type-specific validations
    const type = this.getType(value);

    if (type === 'string') {
      this.validateString(value as string, schema);
    } else if (type === 'number' || type === 'integer') {
      this.validateNumber(value as number, schema);
    } else if (type === 'object') {
      this.validateObject(value as Record<string, unknown>, schema);
    } else if (type === 'array') {
      this.validateArray(value as unknown[], schema);
    }
  }

  // ============================================================================
  // $ref Resolution (v0.5.0)
  // ============================================================================

  private resolveRef(ref: string): LootSchema | undefined {
    // Handle local definitions
    if (ref.startsWith('#/definitions/')) {
      return this.definitions.get(ref);
    }

    // Handle root reference
    if (ref === '#') {
      return this.rootSchema ?? undefined;
    }

    // Handle JSON pointer paths
    if (ref.startsWith('#/')) {
      return this.resolveJsonPointer(ref.slice(1));
    }

    return undefined;
  }

  private resolveJsonPointer(pointer: string): LootSchema | undefined {
    if (!this.rootSchema) return undefined;

    const parts = pointer.split('/').filter((p) => p !== '');
    let current: unknown = this.rootSchema;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      current = (current as Record<string, unknown>)[key];
    }

    return current as LootSchema | undefined;
  }

  // ============================================================================
  // Composition Keywords (v0.5.0)
  // ============================================================================

  private validateAllOf(value: unknown, schemas: LootSchema[]): void {
    for (const subSchema of schemas) {
      this.validateValue(value, subSchema);
    }
  }

  private validateAnyOf(value: unknown, schemas: LootSchema[]): void {
    let anyValid = false;

    for (const subSchema of schemas) {
      const subValidator = new SchemaValidator();
      const result = subValidator.validate(value, subSchema);
      if (result.valid) {
        anyValid = true;
        break;
      }
    }

    if (!anyValid) {
      this.addError('anyOf', 'Value must match at least one schema in anyOf', {
        actual: value,
      });
    }
  }

  private validateOneOf(value: unknown, schemas: LootSchema[]): void {
    let matchCount = 0;

    for (const subSchema of schemas) {
      const subValidator = new SchemaValidator();
      const result = subValidator.validate(value, subSchema);
      if (result.valid) {
        matchCount++;
      }
    }

    if (matchCount !== 1) {
      this.addError(
        'oneOf',
        matchCount === 0
          ? 'Value must match exactly one schema in oneOf (matched 0)'
          : `Value must match exactly one schema in oneOf (matched ${matchCount})`,
        {
          actual: value,
          expected: 1,
        }
      );
    }
  }

  private validateNot(value: unknown, schema: LootSchema): void {
    const subValidator = new SchemaValidator();
    const result = subValidator.validate(value, schema);

    if (result.valid) {
      this.addError('not', 'Value must NOT match schema in "not"', {
        actual: value,
      });
    }
  }

  // ============================================================================
  // Conditional Keywords (v0.5.0)
  // ============================================================================

  private validateConditional(value: unknown, schema: LootSchema): void {
    if (!schema.if) return;

    const subValidator = new SchemaValidator();
    const ifResult = subValidator.validate(value, schema.if);

    if (ifResult.valid) {
      // Apply "then" schema
      if (schema.then) {
        this.validateValue(value, schema.then);
      }
    } else {
      // Apply "else" schema
      if (schema.else) {
        this.validateValue(value, schema.else);
      }
    }
  }

  // ============================================================================
  // Type Validation
  // ============================================================================

  private validateType(value: unknown, type: SchemaType | SchemaType[]): void {
    const types = Array.isArray(type) ? type : [type];
    const actualType = this.getType(value);

    // Special handling: 'integer' should accept integer numbers
    const matches = types.some((t) => {
      if (t === 'integer') {
        return actualType === 'integer' || (actualType === 'number' && Number.isInteger(value));
      }
      if (t === 'number') {
        return actualType === 'number' || actualType === 'integer';
      }
      return t === actualType;
    });

    if (!matches) {
      this.addError('type', `Expected ${types.join(' or ')}, got ${actualType}`, {
        expected: types,
        actual: actualType,
      });
    }
  }

  private validateConst(value: unknown, constValue: unknown): void {
    if (!this.deepEqual(value, constValue)) {
      this.addError('const', `Expected constant value ${JSON.stringify(constValue)}`, {
        expected: constValue,
        actual: value,
      });
    }
  }

  private validateEnum(value: unknown, enumValues: unknown[]): void {
    if (!enumValues.some((e) => this.deepEqual(value, e))) {
      this.addError(
        'enum',
        `Value must be one of: ${enumValues.map((v) => JSON.stringify(v)).join(', ')}`,
        {
          expected: enumValues,
          actual: value,
        }
      );
    }
  }

  // ============================================================================
  // String Validation
  // ============================================================================

  private validateString(value: string, schema: LootSchema): void {
    // minLength
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      this.addError('minLength', `String must be at least ${schema.minLength} characters`, {
        expected: schema.minLength,
        actual: value.length,
      });
    }

    // maxLength
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      this.addError('maxLength', `String must be at most ${schema.maxLength} characters`, {
        expected: schema.maxLength,
        actual: value.length,
      });
    }

    // pattern
    if (schema.pattern !== undefined) {
      try {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          this.addError('pattern', `String must match pattern: ${schema.pattern}`, {
            expected: schema.pattern,
            actual: value,
          });
        }
      } catch {
        // Invalid regex, skip validation
      }
    }

    // format
    if (schema.format !== undefined) {
      this.validateFormat(value, schema.format);
    }
  }

  private validateFormat(value: string, format: string): void {
    const formats: Record<string, RegExp> = {
      date: /^\d{4}-\d{2}-\d{2}$/,
      'date-time':
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^[a-zA-Z][a-zA-Z\d+\-.]*:/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    };

    const regex = formats[format];
    if (regex && !regex.test(value)) {
      this.addError('format', `String must be a valid ${format}`, {
        expected: format,
        actual: value,
      });
    }
  }

  // ============================================================================
  // Number Validation
  // ============================================================================

  private validateNumber(value: number, schema: LootSchema): void {
    // integer check (only if type explicitly requires integer)
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      this.addError('type', 'Value must be an integer', {
        expected: 'integer',
        actual: value,
      });
    }

    // minimum
    if (schema.minimum !== undefined && value < schema.minimum) {
      this.addError('minimum', `Value must be >= ${schema.minimum}`, {
        expected: schema.minimum,
        actual: value,
      });
    }

    // maximum
    if (schema.maximum !== undefined && value > schema.maximum) {
      this.addError('maximum', `Value must be <= ${schema.maximum}`, {
        expected: schema.maximum,
        actual: value,
      });
    }

    // exclusiveMinimum
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      this.addError('exclusiveMinimum', `Value must be > ${schema.exclusiveMinimum}`, {
        expected: schema.exclusiveMinimum,
        actual: value,
      });
    }

    // exclusiveMaximum
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      this.addError('exclusiveMaximum', `Value must be < ${schema.exclusiveMaximum}`, {
        expected: schema.exclusiveMaximum,
        actual: value,
      });
    }

    // multipleOf
    if (schema.multipleOf !== undefined) {
      const remainder = value % schema.multipleOf;
      // Handle floating point precision
      if (Math.abs(remainder) > 1e-10 && Math.abs(remainder - schema.multipleOf) > 1e-10) {
        this.addError('multipleOf', `Value must be a multiple of ${schema.multipleOf}`, {
          expected: schema.multipleOf,
          actual: value,
        });
      }
    }
  }

  // ============================================================================
  // Object Validation
  // ============================================================================

  private validateObject(value: Record<string, unknown>, schema: LootSchema): void {
    // required
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          this.path.push(key);
          this.addError('required', `Missing required property: ${key}`, {
            expected: key,
          });
          this.path.pop();
        }
      }
    }

    // propertyNames (v0.5.0)
    if (schema.propertyNames) {
      for (const key of Object.keys(value)) {
        const subValidator = new SchemaValidator();
        const result = subValidator.validate(key, schema.propertyNames);
        if (!result.valid) {
          this.addError('propertyNames', `Property name "${key}" is invalid`, {
            actual: key,
          });
        }
      }
    }

    // properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          this.path.push(key);
          this.validateValue(value[key], propSchema);
          this.path.pop();
        }
      }
    }

    // patternProperties (v0.5.0)
    if (schema.patternProperties) {
      for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
        try {
          const regex = new RegExp(pattern);
          for (const [key, propValue] of Object.entries(value)) {
            if (regex.test(key)) {
              this.path.push(key);
              this.validateValue(propValue, propSchema);
              this.path.pop();
            }
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties === false) {
      const definedKeys = new Set(Object.keys(schema.properties || {}));
      const patternRegexes = Object.keys(schema.patternProperties || {}).map(
        (p) => {
          try {
            return new RegExp(p);
          } catch {
            return null;
          }
        }
      );

      for (const key of Object.keys(value)) {
        if (definedKeys.has(key)) continue;

        const matchesPattern = patternRegexes.some((r) => r && r.test(key));
        if (!matchesPattern) {
          this.addError('additionalProperties', `Unknown property: ${key}`, {
            actual: key,
          });
        }
      }
    } else if (typeof schema.additionalProperties === 'object') {
      const definedKeys = new Set(Object.keys(schema.properties || {}));
      const patternRegexes = Object.keys(schema.patternProperties || {}).map(
        (p) => {
          try {
            return new RegExp(p);
          } catch {
            return null;
          }
        }
      );

      for (const [key, propValue] of Object.entries(value)) {
        if (definedKeys.has(key)) continue;

        const matchesPattern = patternRegexes.some((r) => r && r.test(key));
        if (!matchesPattern) {
          this.path.push(key);
          this.validateValue(propValue, schema.additionalProperties);
          this.path.pop();
        }
      }
    }
  }

  // ============================================================================
  // Array Validation
  // ============================================================================

  private validateArray(value: unknown[], schema: LootSchema): void {
    // minItems
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      this.addError('minItems', `Array must have at least ${schema.minItems} items`, {
        expected: schema.minItems,
        actual: value.length,
      });
    }

    // maxItems
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      this.addError('maxItems', `Array must have at most ${schema.maxItems} items`, {
        expected: schema.maxItems,
        actual: value.length,
      });
    }

    // uniqueItems
    if (schema.uniqueItems) {
      const seen = new Set<string>();
      for (let i = 0; i < value.length; i++) {
        const serialized = JSON.stringify(value[i]);
        if (seen.has(serialized)) {
          this.addError(
            'uniqueItems',
            `Array items must be unique (duplicate at index ${i})`,
            {
              actual: value[i],
            }
          );
          break;
        }
        seen.add(serialized);
      }
    }

    // contains (v0.5.0)
    if (schema.contains) {
      let hasMatch = false;
      for (const item of value) {
        const subValidator = new SchemaValidator();
        const result = subValidator.validate(item, schema.contains);
        if (result.valid) {
          hasMatch = true;
          break;
        }
      }
      if (!hasMatch) {
        this.addError('contains', 'Array must contain at least one matching item', {
          expected: schema.contains,
        });
      }
    }

    // items (single schema for all items)
    if (schema.items && !Array.isArray(schema.items)) {
      for (let i = 0; i < value.length; i++) {
        this.path.push(String(i));
        this.validateValue(value[i], schema.items);
        this.path.pop();
      }
    }

    // items (tuple validation)
    if (schema.items && Array.isArray(schema.items)) {
      for (let i = 0; i < schema.items.length && i < value.length; i++) {
        this.path.push(String(i));
        this.validateValue(value[i], schema.items[i]);
        this.path.pop();
      }
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private getType(value: unknown): SchemaType {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    return typeof value as SchemaType;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (Array.isArray(a) || Array.isArray(b)) return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!this.deepEqual(aObj[key], bObj[key])) {
        return false;
      }
    }

    return true;
  }

  private addError(
    keyword: string,
    message: string,
    details: { expected?: unknown; actual?: unknown } = {}
  ): void {
    this.errors.push({
      path: this.path.length > 0 ? this.path.join('.') : '(root)',
      message,
      keyword,
      ...details,
    });
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Validate data against a JSON Schema
 *
 * @example
 * ```ts
 * const result = validate({ name: 'John', age: 30 }, {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number', minimum: 0 },
 *   },
 *   required: ['name'],
 * });
 * ```
 */
export function validate<T = unknown>(data: unknown, schema: LootSchema): ValidationResult<T> {
  const validator = new SchemaValidator();
  return validator.validate<T>(data, schema);
}
