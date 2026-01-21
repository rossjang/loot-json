import { describe, it, expect } from 'vitest';
import { lootField, LootError } from '../src';

describe('lootField', () => {
  describe('basic extraction', () => {
    const json = '{"name": "sword", "damage": 50, "active": true}';

    it('should extract string field', () => {
      expect(lootField(json, 'name')).toBe('sword');
    });

    it('should extract number field', () => {
      expect(lootField(json, 'damage')).toBe(50);
    });

    it('should extract boolean field', () => {
      expect(lootField(json, 'active')).toBe(true);
    });

    it('should return undefined for missing field', () => {
      expect(lootField(json, 'missing')).toBeUndefined();
    });

    it('should return typed result', () => {
      const damage = lootField<number>(json, 'damage');
      expect(damage).toBe(50);
    });
  });

  describe('nested fields', () => {
    const json = '{"user": {"profile": {"name": "John", "age": 30}}}';

    it('should extract nested field', () => {
      expect(lootField(json, 'user.profile.name')).toBe('John');
    });

    it('should extract nested number', () => {
      expect(lootField(json, 'user.profile.age')).toBe(30);
    });

    it('should extract nested object', () => {
      expect(lootField(json, 'user.profile')).toEqual({ name: 'John', age: 30 });
    });

    it('should extract root level object', () => {
      expect(lootField(json, 'user')).toEqual({ profile: { name: 'John', age: 30 } });
    });
  });

  describe('arrays', () => {
    const json = '{"items": [1, 2, 3], "nested": {"list": ["a", "b"]}}';

    it('should extract array', () => {
      expect(lootField(json, 'items')).toEqual([1, 2, 3]);
    });

    it('should extract nested array', () => {
      expect(lootField(json, 'nested.list')).toEqual(['a', 'b']);
    });
  });

  describe('markdown extraction', () => {
    const markdown = `
Here's the data:
\`\`\`json
{"dialogue": "Hello!", "emotion": "happy"}
\`\`\`
    `;

    it('should extract from markdown', () => {
      expect(lootField(markdown, 'dialogue')).toBe('Hello!');
      expect(lootField(markdown, 'emotion')).toBe('happy');
    });
  });

  describe('repair functionality', () => {
    it('should repair trailing comma', () => {
      const json = '{"name": "test",}';
      expect(lootField(json, 'name')).toBe('test');
    });

    it('should repair single quotes', () => {
      const json = "{'name': 'test'}";
      expect(lootField(json, 'name')).toBe('test');
    });

    it('should skip repair when disabled', () => {
      const json = '{"name": "test",}';
      // When repair is off and JSON is invalid, it may still work if we can extract the field
      // But the overall JSON repair won't happen
      expect(lootField(json, 'name', { repair: false })).toBe('test');
    });
  });

  describe('all option', () => {
    const text = '{"a": 1} {"a": 2} {"a": 3}';

    it('should return first match by default', () => {
      expect(lootField(text, 'a')).toBe(1);
    });

    it('should return all matches with all option', () => {
      expect(lootField(text, 'a', { all: true })).toEqual([1, 2, 3]);
    });
  });

  describe('error handling', () => {
    it('should throw when silent is false and field not found', () => {
      expect(() => {
        lootField('{"a": 1}', 'b', { silent: false });
      }).toThrow(LootError);
    });

    it('should return undefined for invalid JSON', () => {
      expect(lootField('not json', 'field')).toBeUndefined();
    });

    it('should return undefined for empty input', () => {
      expect(lootField('', 'field')).toBeUndefined();
    });
  });

  describe('special path syntax', () => {
    it('should handle bracket notation', () => {
      const json = '{"a.b": {"c": 1}}';
      // This should work with bracket notation
      expect(lootField(json, '["a.b"].c')).toBe(1);
    });

    it('should handle mixed notation', () => {
      const json = '{"user": {"full.name": "John Doe"}}';
      expect(lootField(json, 'user["full.name"]')).toBe('John Doe');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string value', () => {
      expect(lootField('{"a": ""}', 'a')).toBe('');
    });

    it('should handle null value', () => {
      expect(lootField('{"a": null}', 'a')).toBeNull();
    });

    it('should handle zero value', () => {
      expect(lootField('{"a": 0}', 'a')).toBe(0);
    });

    it('should handle false value', () => {
      expect(lootField('{"a": false}', 'a')).toBe(false);
    });

    it('should handle empty array', () => {
      expect(lootField('{"a": []}', 'a')).toEqual([]);
    });

    it('should handle empty object', () => {
      expect(lootField('{"a": {}}', 'a')).toEqual({});
    });

    it('should handle unicode keys', () => {
      const json = '{"이름": "홍길동", "名前": "田中", "姓名": "王伟"}';
      expect(lootField(json, '이름')).toBe('홍길동');
      expect(lootField(json, '名前')).toBe('田中');
      expect(lootField(json, '姓名')).toBe('王伟');
    });
  });
});
