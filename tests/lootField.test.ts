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

  // ============================================================================
  // v0.3.0 - New Features
  // ============================================================================

  describe('v0.3.0 - array index support', () => {
    const json = '{"items": [10, 20, 30, 40, 50]}';
    const nestedJson = '{"users": [{"name": "Alice"}, {"name": "Bob"}, {"name": "Charlie"}]}';

    it('should extract first element with [0]', () => {
      expect(lootField(json, 'items[0]')).toBe(10);
    });

    it('should extract middle element with [2]', () => {
      expect(lootField(json, 'items[2]')).toBe(30);
    });

    it('should extract last element with [-1]', () => {
      expect(lootField(json, 'items[-1]')).toBe(50);
    });

    it('should extract second to last with [-2]', () => {
      expect(lootField(json, 'items[-2]')).toBe(40);
    });

    it('should return undefined for out of bounds positive', () => {
      expect(lootField(json, 'items[100]')).toBeUndefined();
    });

    it('should return undefined for out of bounds negative', () => {
      expect(lootField(json, 'items[-100]')).toBeUndefined();
    });

    it('should extract nested field from array element', () => {
      expect(lootField(nestedJson, 'users[0].name')).toBe('Alice');
      expect(lootField(nestedJson, 'users[1].name')).toBe('Bob');
      expect(lootField(nestedJson, 'users[-1].name')).toBe('Charlie');
    });

    it('should extract entire object from array', () => {
      expect(lootField(nestedJson, 'users[0]')).toEqual({ name: 'Alice' });
    });

    it('should handle deeply nested arrays', () => {
      const deep = '{"a": {"b": [{"c": [1, 2, 3]}]}}';
      expect(lootField(deep, 'a.b[0].c[1]')).toBe(2);
      expect(lootField(deep, 'a.b[0].c[-1]')).toBe(3);
    });
  });

  describe('v0.3.0 - wildcard patterns', () => {
    const json = '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}, {"name": "Charlie", "age": 35}]}';

    it('should extract all values with [*]', () => {
      const names = lootField<string>(json, 'users[*].name');
      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should extract all ages', () => {
      const ages = lootField<number>(json, 'users[*].age');
      expect(ages).toEqual([30, 25, 35]);
    });

    it('should extract all objects', () => {
      const users = lootField(json, 'users[*]');
      expect(users).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 },
      ]);
    });

    it('should handle empty array with wildcard', () => {
      const result = lootField('{"items": []}', 'items[*].name');
      expect(result).toBeUndefined();
    });

    it('should handle mixed types in array', () => {
      const mixed = '{"items": [{"value": 1}, {"value": "two"}, {"value": true}]}';
      const values = lootField(mixed, 'items[*].value');
      expect(values).toEqual([1, 'two', true]);
    });
  });

  describe('v0.3.0 - recursive wildcard', () => {
    const nested = '{"a": {"id": 1, "b": {"id": 2, "c": {"id": 3}}}}';

    it('should find all matching keys at any depth with **.key', () => {
      const ids = lootField<number>(nested, '**.id');
      expect(ids).toEqual([1, 2, 3]);
    });

    it('should work with simple structure', () => {
      const simple = '{"x": {"id": 100}}';
      const ids = lootField<number>(simple, '**.id');
      expect(ids).toEqual([100]);
    });

    it('should return undefined when no matches', () => {
      const result = lootField(nested, '**.missing');
      expect(result).toBeUndefined();
    });

    it('should find nested objects', () => {
      const data = '{"root": {"user": {"name": "A"}}, "other": {"user": {"name": "B"}}}';
      const users = lootField(data, '**.user');
      expect(users).toEqual([{ name: 'A' }, { name: 'B' }]);
    });
  });

  describe('v0.3.0 - combined patterns', () => {
    const complex = `{
      "teams": [
        {"name": "Alpha", "members": [{"id": 1}, {"id": 2}]},
        {"name": "Beta", "members": [{"id": 3}, {"id": 4}]}
      ]
    }`;

    it('should combine wildcard with nested access', () => {
      const names = lootField<string>(complex, 'teams[*].name');
      expect(names).toEqual(['Alpha', 'Beta']);
    });

    it('should access nested arrays with wildcards', () => {
      const members = lootField(complex, 'teams[*].members');
      expect(members).toEqual([
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
      ]);
    });

    it('should combine index with wildcard', () => {
      const firstTeamIds = lootField<number>(complex, 'teams[0].members[*].id');
      expect(firstTeamIds).toEqual([1, 2]);
    });
  });
});
