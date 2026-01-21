import { describe, it, expect } from 'vitest';
import { repairJson } from '../src';

describe('repairJson', () => {
  describe('trailing commas', () => {
    it('should remove trailing comma in object', () => {
      const result = repairJson('{"a": 1,}');
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('should remove trailing comma in array', () => {
      const result = repairJson('[1, 2, 3,]');
      expect(JSON.parse(result)).toEqual([1, 2, 3]);
    });

    it('should remove multiple trailing commas', () => {
      const result = repairJson('{"a": [1, 2,], "b": {"c": 3,},}');
      expect(JSON.parse(result)).toEqual({ a: [1, 2], b: { c: 3 } });
    });
  });

  describe('single quotes', () => {
    it('should replace single quotes with double quotes', () => {
      const result = repairJson("{'key': 'value'}");
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should handle mixed quotes', () => {
      const result = repairJson('{"key": \'value\'}');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });
  });

  describe('comments', () => {
    it('should remove single-line comments', () => {
      const result = repairJson('{"key": "value" // comment\n}');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should remove multi-line comments', () => {
      const result = repairJson('{"key": "value" /* comment */}');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should not remove // inside strings', () => {
      const result = repairJson('{"url": "http://example.com"}');
      expect(JSON.parse(result)).toEqual({ url: 'http://example.com' });
    });
  });

  describe('unquoted keys', () => {
    it('should quote unquoted keys', () => {
      const result = repairJson('{key: "value"}');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should handle multiple unquoted keys', () => {
      const result = repairJson('{name: "test", value: 42}');
      expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
    });
  });

  describe('invalid values', () => {
    it('should replace undefined with null', () => {
      const result = repairJson('{"value": undefined}');
      expect(JSON.parse(result)).toEqual({ value: null });
    });

    it('should replace NaN with null', () => {
      const result = repairJson('{"value": NaN}');
      expect(JSON.parse(result)).toEqual({ value: null });
    });

    it('should replace Infinity with null', () => {
      const result = repairJson('{"value": Infinity}');
      expect(JSON.parse(result)).toEqual({ value: null });
    });

    it('should replace -Infinity with null', () => {
      const result = repairJson('{"value": -Infinity}');
      expect(JSON.parse(result)).toEqual({ value: null });
    });
  });

  describe('unescaped newlines', () => {
    it('should escape newlines in strings', () => {
      const result = repairJson('{"text": "Hello,\nWorld"}');
      expect(JSON.parse(result)).toEqual({ text: 'Hello,\nWorld' });
    });

    it('should escape carriage returns', () => {
      const result = repairJson('{"text": "Hello,\rWorld"}');
      expect(JSON.parse(result)).toEqual({ text: 'Hello,\rWorld' });
    });

    it('should escape CRLF', () => {
      const result = repairJson('{"text": "Hello,\r\nWorld"}');
      expect(JSON.parse(result)).toEqual({ text: 'Hello,\r\nWorld' });
    });

    it('should not modify already escaped newlines', () => {
      const input = '{"text": "Hello,\\nWorld"}';
      const result = repairJson(input);
      expect(result).toBe(input);
    });

    it('should not modify newlines outside strings', () => {
      const input = '{\n  "key": "value"\n}';
      const result = repairJson(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });
  });

  describe('repair tracking', () => {
    it('should return repairs when tracking is enabled', () => {
      const result = repairJson('{"key": "value",}', true);
      expect(result.text).toBe('{"key": "value"}');
      expect(result.repairs.length).toBeGreaterThan(0);
      expect(result.repairs.some((r) => r.type === 'trailing_comma')).toBe(true);
    });

    it('should track multiple repairs', () => {
      const result = repairJson("{key: 'value', // comment\n}", true);
      expect(result.repairs.some((r) => r.type === 'unquoted_key')).toBe(true);
      expect(result.repairs.some((r) => r.type === 'single_quote')).toBe(true);
      expect(result.repairs.some((r) => r.type === 'single_line_comment')).toBe(true);
    });

    it('should return empty repairs for valid JSON', () => {
      const result = repairJson('{"key": "value"}', true);
      expect(result.text).toBe('{"key": "value"}');
      expect(result.repairs).toEqual([]);
    });

    it('should include position in repair logs', () => {
      const result = repairJson('{"key": "value",}', true);
      const trailingCommaRepair = result.repairs.find((r) => r.type === 'trailing_comma');
      expect(trailingCommaRepair).toBeDefined();
      expect(trailingCommaRepair?.position).toBeDefined();
    });
  });

  describe('combined repairs', () => {
    it('should handle multiple issues in one JSON', () => {
      const input = `{
        name: 'test', // this is a name
        value: undefined,
        items: [1, 2, 3,],
      }`;
      const result = repairJson(input);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        name: 'test',
        value: null,
        items: [1, 2, 3],
      });
    });
  });
});
