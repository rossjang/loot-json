import { describe, it, expect } from 'vitest';
import { loot, LootError, isLootError } from '../src';

describe('loot', () => {
  describe('basic parsing', () => {
    it('should parse valid JSON', () => {
      const result = loot('{"name": "sword", "damage": 50}');
      expect(result).toEqual({ name: 'sword', damage: 50 });
    });

    it('should parse JSON array', () => {
      const result = loot('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return typed result', () => {
      interface Item {
        name: string;
        damage: number;
      }
      const result = loot<Item>('{"name": "sword", "damage": 50}');
      expect(result.name).toBe('sword');
      expect(result.damage).toBe(50);
    });
  });

  describe('markdown extraction', () => {
    it('should extract JSON from markdown code block', () => {
      const text = `
Here's the data:
\`\`\`json
{"key": "value"}
\`\`\`
      `;
      expect(loot(text)).toEqual({ key: 'value' });
    });

    it('should extract JSON from markdown without json tag', () => {
      const text = `
\`\`\`
{"key": "value"}
\`\`\`
      `;
      expect(loot(text)).toEqual({ key: 'value' });
    });

    it('should extract JSON from tilde code blocks', () => {
      const text = `
~~~json
{"key": "value"}
~~~
      `;
      expect(loot(text)).toEqual({ key: 'value' });
    });
  });

  describe('repair functionality', () => {
    it('should fix trailing commas', () => {
      const result = loot('{"name": "test", "value": 42,}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should fix single quotes', () => {
      const result = loot("{'name': 'test'}");
      expect(result).toEqual({ name: 'test' });
    });

    it('should remove single-line comments', () => {
      const result = loot('{"name": "test" // this is a comment\n}');
      expect(result).toEqual({ name: 'test' });
    });

    it('should remove multi-line comments', () => {
      const result = loot('{"name": "test" /* comment */}');
      expect(result).toEqual({ name: 'test' });
    });

    it('should fix unquoted keys', () => {
      const result = loot('{name: "test", value: 42}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should fix undefined values', () => {
      const result = loot('{"value": undefined}');
      expect(result).toEqual({ value: null });
    });

    it('should fix NaN values', () => {
      const result = loot('{"value": NaN}');
      expect(result).toEqual({ value: null });
    });

    it('should fix Infinity values', () => {
      const result = loot('{"value": Infinity}');
      expect(result).toEqual({ value: null });
    });

    it('should fix unescaped newlines in strings', () => {
      const result = loot(`{"text": "Hello,
World"}`);
      expect(result).toEqual({ text: 'Hello,\nWorld' });
    });

    it('should not repair when repair is false', () => {
      expect(() => loot('{"name": "test",}', { repair: false })).toThrow(LootError);
    });
  });

  describe('all option', () => {
    it('should extract all JSON objects', () => {
      const text = '{"a": 1} some text {"b": 2} more text {"c": 3}';
      const result = loot(text, { all: true });
      expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    it('should return empty array when no JSON found with all option', () => {
      const result = loot('no json here', { all: true, silent: true });
      expect(result).toEqual([]);
    });
  });

  describe('silent option', () => {
    it('should return null when silent and no JSON found', () => {
      const result = loot('no json here', { silent: true });
      expect(result).toBeNull();
    });

    it('should throw when not silent and no JSON found', () => {
      expect(() => loot('no json here')).toThrow(LootError);
    });

    it('should return null for empty input with silent', () => {
      const result = loot('', { silent: true });
      expect(result).toBeNull();
    });
  });

  describe('reportRepairs option', () => {
    it('should return repairs when reportRepairs is true', () => {
      const { result, repairs } = loot('{"name": "test",}', { reportRepairs: true });
      expect(result).toEqual({ name: 'test' });
      expect(repairs.length).toBeGreaterThan(0);
      expect(repairs.some((r) => r.type === 'trailing_comma')).toBe(true);
    });

    it('should return empty repairs for valid JSON', () => {
      const { result, repairs } = loot('{"name": "test"}', { reportRepairs: true });
      expect(result).toEqual({ name: 'test' });
      expect(repairs).toEqual([]);
    });

    it('should work with all option', () => {
      const { result, repairs } = loot('{"a": 1,} {"b": 2,}', {
        reportRepairs: true,
        all: true,
      });
      expect(result).toEqual([{ a: 1 }, { b: 2 }]);
      expect(repairs.filter((r) => r.type === 'trailing_comma').length).toBe(2);
    });

    it('should report multiple repair types', () => {
      const { result, repairs } = loot("{name: 'test', // comment\n}", { reportRepairs: true });
      expect(result).toEqual({ name: 'test' });
      expect(repairs.some((r) => r.type === 'unquoted_key')).toBe(true);
      expect(repairs.some((r) => r.type === 'single_quote')).toBe(true);
      expect(repairs.some((r) => r.type === 'single_line_comment')).toBe(true);
    });
  });

  describe('error handling with isLootError', () => {
    it('should identify LootError with isLootError', () => {
      try {
        loot('no json here');
      } catch (error) {
        expect(isLootError(error)).toBe(true);
        if (isLootError(error)) {
          expect(error.code).toBe('NO_JSON_FOUND');
          expect(error.name).toBe('LootError');
        }
      }
    });

    it('should return false for non-LootError', () => {
      expect(isLootError(new Error('regular error'))).toBe(false);
      expect(isLootError('string')).toBe(false);
      expect(isLootError(null)).toBe(false);
      expect(isLootError(undefined)).toBe(false);
    });

    it('should have EMPTY_INPUT code for empty input', () => {
      try {
        loot('');
      } catch (error) {
        expect(isLootError(error)).toBe(true);
        if (isLootError(error)) {
          expect(error.code).toBe('EMPTY_INPUT');
        }
      }
    });

    it('should work in typical error handling pattern', () => {
      let errorHandled = false;

      try {
        const output = 'Some LLM output without JSON';
        loot(output);
      } catch (error) {
        if (isLootError(error)) {
          errorHandled = true;
          expect(error.code).toBeDefined();
          expect(error.message).toBeDefined();
        }
      }

      expect(errorHandled).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle nested objects', () => {
      const result = loot('{"a": {"b": {"c": 1}}}');
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    it('should handle arrays in objects', () => {
      const result = loot('{"items": [1, 2, 3]}');
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('should handle special characters in strings', () => {
      const result = loot('{"text": "say \\"hello\\""}');
      expect(result).toEqual({ text: 'say "hello"' });
    });

    it('should handle unicode', () => {
      const result = loot('{"korean": "안녕하세요", "japanese": "こんにちは", "chinese": "你好"}');
      expect(result).toEqual({ korean: '안녕하세요', japanese: 'こんにちは', chinese: '你好' });
    });

    it('should handle empty object', () => {
      const result = loot('{}');
      expect(result).toEqual({});
    });

    it('should handle empty array', () => {
      const result = loot('[]');
      expect(result).toEqual([]);
    });
  });
});
