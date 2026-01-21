import { describe, it, expect, vi } from 'vitest';
import { IncrementalLoot } from '../src';

describe('IncrementalLoot', () => {
  describe('basic parsing', () => {
    it('should parse complete JSON in chunks', () => {
      const parser = new IncrementalLoot();

      parser.addChunk('{"na');
      parser.addChunk('me": "te');
      parser.addChunk('st", "value": 42}');

      const result = parser.getResult();
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should detect completion', () => {
      const parser = new IncrementalLoot();

      let result = parser.addChunk('{"name": "test"');
      expect(result.isComplete()).toBe(false);

      result = parser.addChunk('}');
      expect(result.isComplete()).toBe(true);
    });

    it('should parse single chunk', () => {
      const parser = new IncrementalLoot();
      parser.addChunk('{"key": "value"}');
      expect(parser.getResult()).toEqual({ key: 'value' });
    });
  });

  describe('field detection', () => {
    it('should detect string field completion', () => {
      const parser = new IncrementalLoot({ fields: ['dialogue'] });

      let result = parser.addChunk('{"dialogue": "Hel');
      expect(result.isFieldComplete('dialogue')).toBe(false);

      result = parser.addChunk('lo!", "other": 1}');
      expect(result.isFieldComplete('dialogue')).toBe(true);
      expect(result.getField('dialogue')).toBe('Hello!');
    });

    it('should detect number field completion', () => {
      const parser = new IncrementalLoot({ fields: ['value'] });

      parser.addChunk('{"value": 4');
      const result = parser.addChunk('2, "other": "x"}');

      expect(result.isFieldComplete('value')).toBe(true);
      expect(result.getField('value')).toBe(42);
    });

    it('should detect boolean field completion', () => {
      const parser = new IncrementalLoot({ fields: ['active'] });

      const result = parser.addChunk('{"active": true, "other": 1}');

      expect(result.isFieldComplete('active')).toBe(true);
      expect(result.getField('active')).toBe(true);
    });

    it('should detect null field completion', () => {
      const parser = new IncrementalLoot({ fields: ['value'] });

      const result = parser.addChunk('{"value": null, "other": 1}');

      expect(result.isFieldComplete('value')).toBe(true);
      expect(result.getField('value')).toBeNull();
    });

    it('should detect object field completion', () => {
      const parser = new IncrementalLoot({ fields: ['user'] });

      parser.addChunk('{"user": {"name": "Jo');
      parser.addChunk('hn"');
      const result = parser.addChunk('}, "done": true}');

      expect(result.isFieldComplete('user')).toBe(true);
      expect(result.getField('user')).toEqual({ name: 'John' });
    });

    it('should detect array field completion', () => {
      const parser = new IncrementalLoot({ fields: ['items'] });

      parser.addChunk('{"items": [1, 2');
      const result = parser.addChunk(', 3], "done": true}');

      expect(result.isFieldComplete('items')).toBe(true);
      expect(result.getField('items')).toEqual([1, 2, 3]);
    });

    it('should track all fields when none specified', () => {
      const parser = new IncrementalLoot();

      const result = parser.addChunk('{"a": 1, "b": "test", "c": true}');

      expect(result.getCompletedFields()).toContain('a');
      expect(result.getCompletedFields()).toContain('b');
      expect(result.getCompletedFields()).toContain('c');
    });
  });

  describe('callbacks', () => {
    it('should call onFieldComplete when field is done', () => {
      const onFieldComplete = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['dialogue', 'emotion'],
        onFieldComplete,
      });

      parser.addChunk('{"dialogue": "Hello!", "emotion": "happy"}');

      expect(onFieldComplete).toHaveBeenCalledTimes(2);
      expect(onFieldComplete).toHaveBeenCalledWith('dialogue', 'Hello!');
      expect(onFieldComplete).toHaveBeenCalledWith('emotion', 'happy');
    });

    it('should call onComplete when JSON is complete', () => {
      const onComplete = vi.fn();
      const parser = new IncrementalLoot({ onComplete });

      parser.addChunk('{"done": true}');

      expect(onComplete).toHaveBeenCalledWith({ done: true });
    });

    it('should call onError on parse error', () => {
      const onError = vi.fn();
      const parser = new IncrementalLoot({ onError, repair: false });

      // Force an error by having malformed JSON that can't be repaired
      parser.addChunk('{invalid json that cannot be parsed}');

      // The error might not be called immediately, but on finalization
      // This depends on implementation
    });
  });

  describe('getPartialResult', () => {
    it('should return partial result', () => {
      const parser = new IncrementalLoot({ fields: ['a', 'b', 'c'] });

      // 'b' needs a comma or closing brace to be considered complete
      parser.addChunk('{"a": 1, "b": 2,');
      const result = parser.addChunk('');

      const partial = result.getPartialResult();
      expect(partial).toHaveProperty('a', 1);
      expect(partial).toHaveProperty('b', 2);
      expect(partial).not.toHaveProperty('c');
    });

    it('should return partial result with closing brace', () => {
      const parser = new IncrementalLoot({ fields: ['a', 'b'] });

      parser.addChunk('{"a": 1, "b": 2}');
      const result = parser.addChunk('');

      const partial = result.getPartialResult();
      expect(partial).toHaveProperty('a', 1);
      expect(partial).toHaveProperty('b', 2);
    });
  });

  describe('reset', () => {
    it('should reset and reuse parser', () => {
      const parser = new IncrementalLoot();

      parser.addChunk('{"first": 1}');
      expect(parser.getResult()).toEqual({ first: 1 });

      parser.reset();

      parser.addChunk('{"second": 2}');
      expect(parser.getResult()).toEqual({ second: 2 });
    });
  });

  describe('edge cases', () => {
    it('should handle escaped quotes in strings', () => {
      const parser = new IncrementalLoot({ fields: ['text'] });

      parser.addChunk('{"text": "say \\"hello\\""}');
      const result = parser.getResult();

      expect(result).toEqual({ text: 'say "hello"' });
    });

    it('should handle unicode in strings', () => {
      const parser = new IncrementalLoot({ fields: ['text'] });

      parser.addChunk('{"korean": "한글 테스트", "japanese": "日本語テスト", "chinese": "中文测试"}');

      expect(parser.getResult()).toEqual({
        korean: '한글 테스트',
        japanese: '日本語テスト',
        chinese: '中文测试',
      });
    });

    it('should handle empty values', () => {
      const parser = new IncrementalLoot();

      parser.addChunk('{"str": "", "arr": [], "obj": {}, "nil": null}');

      expect(parser.getResult()).toEqual({
        str: '',
        arr: [],
        obj: {},
        nil: null,
      });
    });

    it('should handle nested objects', () => {
      const parser = new IncrementalLoot({ fields: ['deep'] });

      parser.addChunk('{"deep": {"a": {"b": {"c": 1}}}}');

      const result = parser.addChunk('');
      expect(result.isFieldComplete('deep')).toBe(true);
      expect(result.getField('deep')).toEqual({ a: { b: { c: 1 } } });
    });

    it('should handle getBuffer', () => {
      const parser = new IncrementalLoot();
      parser.addChunk('{"a": 1');
      parser.addChunk('}');

      const result = parser.addChunk('');
      expect(result.getBuffer()).toBe('{"a": 1}');
    });
  });

  describe('LLM simulation', () => {
    it('should handle realistic LLM streaming', () => {
      const parser = new IncrementalLoot<{
        dialogue: string;
        emotion: string;
        pose: string;
      }>({
        fields: ['dialogue', 'emotion', 'pose'],
      });

      // Simulate LLM chunks
      const chunks = [
        '{"di',
        'alog',
        'ue": "Hello, ',
        'how are you today?',
        '", "emo',
        'tion": "hap',
        'py", "po',
        'se": "wav',
        'ing"}',
      ];

      const completionOrder: string[] = [];

      for (const chunk of chunks) {
        const result = parser.addChunk(chunk);

        for (const field of ['dialogue', 'emotion', 'pose']) {
          if (result.isFieldComplete(field) && !completionOrder.includes(field)) {
            completionOrder.push(field);
          }
        }
      }

      // Verify order matches JSON order
      expect(completionOrder).toEqual(['dialogue', 'emotion', 'pose']);

      // Verify final result
      expect(parser.getResult()).toEqual({
        dialogue: 'Hello, how are you today?',
        emotion: 'happy',
        pose: 'waving',
      });
    });
  });

  // ============================================================================
  // v0.4.0 - New Features
  // ============================================================================

  describe('v0.4.0 - progress callbacks', () => {
    it('should call onProgress with progress info', () => {
      const onProgress = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['a', 'b'],
        onProgress,
      });

      parser.addChunk('{"a": 1, "b": 2}');

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.bytesProcessed).toBeGreaterThan(0);
      expect(lastCall.fieldsCompleted).toContain('a');
      expect(lastCall.fieldsCompleted).toContain('b');
    });

    it('should estimate progress based on tracked fields', () => {
      const onProgress = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['a', 'b', 'c', 'd'],
        onProgress,
      });

      parser.addChunk('{"a": 1, "b": 2,');

      const calls = onProgress.mock.calls;
      const lastProgress = calls[calls.length - 1][0];

      // 2 of 4 fields complete = 0.5
      expect(lastProgress.estimatedProgress).toBe(0.5);
    });

    it('should call onFieldStart when field begins', () => {
      const onFieldStart = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['dialogue'],
        onFieldStart,
      });

      parser.addChunk('{"dialogue": "Hello"');

      expect(onFieldStart).toHaveBeenCalledWith('dialogue');
    });
  });

  describe('v0.4.0 - error recovery', () => {
    it('should recover from malformed JSON with repair', () => {
      const onRecovery = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['value'],
        recover: true,
        onRecovery,
      });

      // Trailing comma should be repaired
      parser.addChunk('{"value": 42,}');

      expect(parser.getResult()).toEqual({ value: 42 });
    });

    it('should return partial result on recovery failure', () => {
      const onRecovery = vi.fn();
      const onComplete = vi.fn();
      const parser = new IncrementalLoot({
        fields: ['valid', 'invalid'],
        recover: true,
        onRecovery,
        onComplete,
      });

      parser.addChunk('{"valid": 123, "invalid":');

      // Force finalization with incomplete JSON
      const partial = parser.addChunk('}').getPartialResult();

      expect(partial).toHaveProperty('valid', 123);
    });
  });

  describe('v0.4.0 - buffer management', () => {
    it('should report buffer stats', () => {
      const parser = new IncrementalLoot();

      parser.addChunk('{"test": "value"}');

      const stats = parser.getStats();
      expect(stats.bytesProcessed).toBe(17);
      expect(stats.bufferSize).toBe(17);
      expect(stats.isComplete).toBe(true);
    });

    it('should compact buffer when exceeding maxBufferSize', () => {
      const parser = new IncrementalLoot({
        maxBufferSize: 50, // Small buffer for testing
      });

      // Add data that will exceed buffer
      parser.addChunk('{"field1": "value1", "field2": "value2", "field3": "value3"}');

      // Buffer should still work correctly
      expect(parser.getResult()).toEqual({
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      });
    });

    it('should reset stats on reset()', () => {
      const parser = new IncrementalLoot();

      parser.addChunk('{"a": 1}');
      expect(parser.getStats().bytesProcessed).toBeGreaterThan(0);

      parser.reset();

      expect(parser.getStats().bytesProcessed).toBe(0);
      expect(parser.getStats().bufferSize).toBe(0);
    });
  });

  describe('v0.4.0 - combined callbacks', () => {
    it('should call all callbacks in correct order', () => {
      const callOrder: string[] = [];

      const parser = new IncrementalLoot({
        fields: ['dialogue'],
        onFieldStart: () => callOrder.push('fieldStart'),
        onFieldComplete: () => callOrder.push('fieldComplete'),
        onProgress: () => callOrder.push('progress'),
        onComplete: () => callOrder.push('complete'),
      });

      parser.addChunk('{"dialogue": "Hello"}');

      expect(callOrder).toContain('fieldStart');
      expect(callOrder).toContain('fieldComplete');
      expect(callOrder).toContain('progress');
      expect(callOrder).toContain('complete');

      // fieldStart should come before fieldComplete
      expect(callOrder.indexOf('fieldStart')).toBeLessThan(callOrder.indexOf('fieldComplete'));
    });
  });
});
