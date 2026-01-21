import { describe, it, expect } from 'vitest';
import { validate, SchemaValidator } from '../src';

describe('SchemaValidator', () => {
  describe('type validation', () => {
    const validator = new SchemaValidator();

    it('should validate string type', () => {
      expect(validator.validate('hello', { type: 'string' }).valid).toBe(true);
      expect(validator.validate(123, { type: 'string' }).valid).toBe(false);
    });

    it('should validate number type', () => {
      expect(validator.validate(123, { type: 'number' }).valid).toBe(true);
      expect(validator.validate(123.45, { type: 'number' }).valid).toBe(true);
      expect(validator.validate('123', { type: 'number' }).valid).toBe(false);
    });

    it('should validate integer type', () => {
      expect(validator.validate(123, { type: 'integer' }).valid).toBe(true);
      expect(validator.validate(123.45, { type: 'integer' }).valid).toBe(false);
    });

    it('should validate boolean type', () => {
      expect(validator.validate(true, { type: 'boolean' }).valid).toBe(true);
      expect(validator.validate(false, { type: 'boolean' }).valid).toBe(true);
      expect(validator.validate('true', { type: 'boolean' }).valid).toBe(false);
    });

    it('should validate null type', () => {
      expect(validator.validate(null, { type: 'null' }).valid).toBe(true);
      expect(validator.validate(undefined, { type: 'null' }).valid).toBe(false);
    });

    it('should validate array type', () => {
      expect(validator.validate([1, 2, 3], { type: 'array' }).valid).toBe(true);
      expect(validator.validate({}, { type: 'array' }).valid).toBe(false);
    });

    it('should validate object type', () => {
      expect(validator.validate({}, { type: 'object' }).valid).toBe(true);
      expect(validator.validate([], { type: 'object' }).valid).toBe(false);
    });

    it('should validate multiple types', () => {
      const schema = { type: ['string', 'null'] as const };
      expect(validator.validate('hello', schema).valid).toBe(true);
      expect(validator.validate(null, schema).valid).toBe(true);
      expect(validator.validate(123, schema).valid).toBe(false);
    });
  });

  describe('string validation', () => {
    const validator = new SchemaValidator();

    it('should validate minLength', () => {
      const schema = { type: 'string' as const, minLength: 3 };
      expect(validator.validate('hello', schema).valid).toBe(true);
      expect(validator.validate('hi', schema).valid).toBe(false);
    });

    it('should validate maxLength', () => {
      const schema = { type: 'string' as const, maxLength: 5 };
      expect(validator.validate('hello', schema).valid).toBe(true);
      expect(validator.validate('hello!', schema).valid).toBe(false);
    });

    it('should validate pattern', () => {
      const schema = { type: 'string' as const, pattern: '^[a-z]+$' };
      expect(validator.validate('hello', schema).valid).toBe(true);
      expect(validator.validate('Hello', schema).valid).toBe(false);
    });

    it('should validate email format', () => {
      const schema = { type: 'string' as const, format: 'email' as const };
      expect(validator.validate('test@example.com', schema).valid).toBe(true);
      expect(validator.validate('invalid', schema).valid).toBe(false);
    });

    it('should validate date format', () => {
      const schema = { type: 'string' as const, format: 'date' as const };
      expect(validator.validate('2024-01-15', schema).valid).toBe(true);
      expect(validator.validate('01-15-2024', schema).valid).toBe(false);
    });

    it('should validate uuid format', () => {
      const schema = { type: 'string' as const, format: 'uuid' as const };
      expect(validator.validate('123e4567-e89b-12d3-a456-426614174000', schema).valid).toBe(true);
      expect(validator.validate('not-a-uuid', schema).valid).toBe(false);
    });
  });

  describe('number validation', () => {
    const validator = new SchemaValidator();

    it('should validate minimum', () => {
      const schema = { type: 'number' as const, minimum: 0 };
      expect(validator.validate(5, schema).valid).toBe(true);
      expect(validator.validate(0, schema).valid).toBe(true);
      expect(validator.validate(-1, schema).valid).toBe(false);
    });

    it('should validate maximum', () => {
      const schema = { type: 'number' as const, maximum: 100 };
      expect(validator.validate(50, schema).valid).toBe(true);
      expect(validator.validate(100, schema).valid).toBe(true);
      expect(validator.validate(101, schema).valid).toBe(false);
    });

    it('should validate exclusiveMinimum', () => {
      const schema = { type: 'number' as const, exclusiveMinimum: 0 };
      expect(validator.validate(1, schema).valid).toBe(true);
      expect(validator.validate(0, schema).valid).toBe(false);
    });

    it('should validate exclusiveMaximum', () => {
      const schema = { type: 'number' as const, exclusiveMaximum: 100 };
      expect(validator.validate(99, schema).valid).toBe(true);
      expect(validator.validate(100, schema).valid).toBe(false);
    });

    it('should validate multipleOf', () => {
      const schema = { type: 'number' as const, multipleOf: 5 };
      expect(validator.validate(10, schema).valid).toBe(true);
      expect(validator.validate(15, schema).valid).toBe(true);
      expect(validator.validate(7, schema).valid).toBe(false);
    });
  });

  describe('object validation', () => {
    const validator = new SchemaValidator();

    it('should validate required properties', () => {
      const schema = {
        type: 'object' as const,
        required: ['name', 'age'],
      };

      expect(validator.validate({ name: 'John', age: 30 }, schema).valid).toBe(true);
      expect(validator.validate({ name: 'John' }, schema).valid).toBe(false);
    });

    it('should validate nested properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          age: { type: 'number' as const, minimum: 0 },
        },
      };

      expect(validator.validate({ name: 'John', age: 30 }, schema).valid).toBe(true);
      expect(validator.validate({ name: 'John', age: -1 }, schema).valid).toBe(false);
    });

    it('should validate additionalProperties false', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
        },
        additionalProperties: false,
      };

      expect(validator.validate({ name: 'John' }, schema).valid).toBe(true);
      expect(validator.validate({ name: 'John', extra: true }, schema).valid).toBe(false);
    });

    it('should validate additionalProperties with schema', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
        },
        additionalProperties: { type: 'number' as const },
      };

      expect(validator.validate({ name: 'John', age: 30 }, schema).valid).toBe(true);
      expect(validator.validate({ name: 'John', extra: 'string' }, schema).valid).toBe(false);
    });
  });

  describe('array validation', () => {
    const validator = new SchemaValidator();

    it('should validate minItems/maxItems', () => {
      const schema = { type: 'array' as const, minItems: 1, maxItems: 3 };

      expect(validator.validate([1], schema).valid).toBe(true);
      expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
      expect(validator.validate([], schema).valid).toBe(false);
      expect(validator.validate([1, 2, 3, 4], schema).valid).toBe(false);
    });

    it('should validate items schema', () => {
      const schema = {
        type: 'array' as const,
        items: { type: 'number' as const },
      };

      expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
      expect(validator.validate([1, 'two', 3], schema).valid).toBe(false);
    });

    it('should validate uniqueItems', () => {
      const schema = { type: 'array' as const, uniqueItems: true };

      expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
      expect(validator.validate([1, 2, 2], schema).valid).toBe(false);
    });

    it('should validate tuple items', () => {
      const schema = {
        type: 'array' as const,
        items: [
          { type: 'string' as const },
          { type: 'number' as const },
        ],
      };

      expect(validator.validate(['hello', 42], schema).valid).toBe(true);
      expect(validator.validate([42, 'hello'], schema).valid).toBe(false);
    });
  });

  describe('enum/const validation', () => {
    const validator = new SchemaValidator();

    it('should validate enum', () => {
      const schema = { enum: ['happy', 'sad', 'neutral'] };

      expect(validator.validate('happy', schema).valid).toBe(true);
      expect(validator.validate('angry', schema).valid).toBe(false);
    });

    it('should validate const', () => {
      const schema = { const: 'fixed-value' };

      expect(validator.validate('fixed-value', schema).valid).toBe(true);
      expect(validator.validate('other', schema).valid).toBe(false);
    });

    it('should validate object const', () => {
      const schema = { const: { a: 1 } };

      expect(validator.validate({ a: 1 }, schema).valid).toBe(true);
      expect(validator.validate({ a: 2 }, schema).valid).toBe(false);
    });
  });

  describe('error reporting', () => {
    const validator = new SchemaValidator();

    it('should report path in errors', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          user: {
            type: 'object' as const,
            properties: {
              age: { type: 'number' as const, minimum: 0 },
            },
          },
        },
      };

      const result = validator.validate({ user: { age: -1 } }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('user.age');
    });

    it('should report keyword in errors', () => {
      const schema = { type: 'string' as const, minLength: 5 };
      const result = validator.validate('hi', schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0].keyword).toBe('minLength');
    });

    it('should report expected and actual values', () => {
      const schema = { type: 'string' as const };
      const result = validator.validate(123, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0].expected).toContain('string');
      expect(result.errors[0].actual).toBe('integer');
    });
  });

  describe('validate convenience function', () => {
    it('should work as standalone function', () => {
      const result = validate({ name: 'John', age: 30 }, {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
        },
        required: ['name'],
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should return typed data', () => {
      interface User {
        name: string;
        age: number;
      }

      const result = validate<User>({ name: 'John', age: 30 }, {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.data?.name).toBe('John');
    });
  });

  describe('complex schemas', () => {
    const validator = new SchemaValidator();

    it('should validate complex nested schema', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          dialogue: { type: 'string' as const, minLength: 1 },
          emotion: {
            type: 'string' as const,
            enum: ['happy', 'sad', 'angry', 'neutral'],
          },
          affinity: {
            type: 'number' as const,
            minimum: -10,
            maximum: 10,
          },
          actions: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                type: { type: 'string' as const },
                target: { type: 'string' as const },
              },
              required: ['type'],
            },
          },
        },
        required: ['dialogue', 'emotion'],
      };

      const validData = {
        dialogue: 'Hello!',
        emotion: 'happy',
        affinity: 5,
        actions: [
          { type: 'wave', target: 'player' },
        ],
      };

      expect(validator.validate(validData, schema).valid).toBe(true);

      const invalidData = {
        dialogue: '',
        emotion: 'excited', // not in enum
        affinity: 15, // exceeds maximum
      };

      const result = validator.validate(invalidData, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
