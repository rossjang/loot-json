/**
 * 💎 loot-json IncrementalLoot (v0.4.0)
 * Streaming/incremental JSON parser for LLM outputs
 *
 * Features:
 * - Memory-efficient buffer management
 * - Enhanced callback system
 * - Error recovery
 * - Progress tracking
 */

import { repairJson } from '../repairs';
import { FieldTracker } from './FieldTracker';
import {
  IncrementalLootOptions,
  IncrementalResult,
  ParserState,
  ProgressInfo,
  RecoveryInfo,
} from './types';

// Default max buffer size: 64KB
const DEFAULT_MAX_BUFFER_SIZE = 64 * 1024;

/**
 * Incremental JSON parser for streaming LLM responses
 *
 * Allows extracting field values as they complete during streaming,
 * enabling early processing (e.g., starting TTS before full response)
 *
 * @example
 * ```ts
 * const parser = new IncrementalLoot<ChatResponse>({
 *   fields: ['dialogue', 'emotion'],
 *   onFieldComplete: (field, value) => {
 *     if (field === 'dialogue') startTTS(value);
 *   },
 *   onProgress: (info) => {
 *     console.log(`Progress: ${info.bytesProcessed} bytes`);
 *   },
 * });
 *
 * for await (const chunk of llmStream) {
 *   const result = parser.addChunk(chunk);
 *   if (result.isComplete()) break;
 * }
 *
 * const finalResult = parser.getResult();
 * ```
 */
export class IncrementalLoot<T = unknown> {
  private buffer: string = '';
  private fieldTracker: FieldTracker;
  private options: IncrementalLootOptions;
  private state: ParserState;
  private result: T | null = null;
  private processedIndex: number = 0;
  private bytesProcessed: number = 0;
  private jsonStartPosition: number = -1;
  private lastCompactPosition: number = 0;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;

  constructor(options: IncrementalLootOptions = {}) {
    this.options = {
      repair: true,
      maxBufferSize: DEFAULT_MAX_BUFFER_SIZE,
      recover: false,
      ...options,
    };
    this.fieldTracker = new FieldTracker(options.fields);
    this.state = this.createInitialState();
  }

  /**
   * Add a chunk of streaming data and process it
   */
  addChunk(chunk: string): IncrementalResult<T> {
    this.buffer += chunk;
    this.bytesProcessed += chunk.length;

    // Check buffer size and compact if needed
    this.maybeCompactBuffer();

    // Process the buffer
    this.processBuffer();

    // Report progress
    this.reportProgress();

    return this.createResult();
  }

  /**
   * Get the final parsed result (call after streaming is complete)
   */
  getResult(): T | null {
    if (!this.result && this.state.jsonComplete) {
      this.finalizeResult();
    }
    return this.result;
  }

  /**
   * Get current parsing statistics
   */
  getStats(): {
    bytesProcessed: number;
    bufferSize: number;
    fieldsCompleted: number;
    isComplete: boolean;
  } {
    return {
      bytesProcessed: this.bytesProcessed,
      bufferSize: this.buffer.length,
      fieldsCompleted: this.fieldTracker.getCompletedFieldNames().length,
      isComplete: this.state.jsonComplete,
    };
  }

  /**
   * Reset the parser state for reuse
   */
  reset(): void {
    this.buffer = '';
    this.state = this.createInitialState();
    this.fieldTracker.reset();
    this.result = null;
    this.processedIndex = 0;
    this.bytesProcessed = 0;
    this.jsonStartPosition = -1;
    this.lastCompactPosition = 0;
    this.recoveryAttempts = 0;
  }

  // ============================================================================
  // Buffer Management (v0.4.0)
  // ============================================================================

  private maybeCompactBuffer(): void {
    const maxSize = this.options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;

    if (this.buffer.length <= maxSize) {
      return;
    }

    // Find safe compaction point (after completed fields)
    const safePoint = this.findSafeCompactionPoint();

    if (safePoint > this.lastCompactPosition) {
      // Keep content from safePoint onwards
      const discarded = safePoint - this.lastCompactPosition;
      this.buffer = this.buffer.substring(safePoint);
      this.processedIndex = Math.max(0, this.processedIndex - safePoint);
      this.jsonStartPosition = Math.max(-1, this.jsonStartPosition - safePoint);
      this.lastCompactPosition = 0;

      // Adjust state positions
      if (this.state.keyStart !== -1) {
        this.state.keyStart -= safePoint;
      }
      if (this.state.valueStart !== -1) {
        this.state.valueStart -= safePoint;
      }

      // Log compaction if debugging
      if (discarded > 0 && this.options.onProgress) {
        // Compaction happened, but we don't interrupt progress
      }
    }
  }

  private findSafeCompactionPoint(): number {
    // Don't compact if we haven't started JSON
    if (this.jsonStartPosition === -1) {
      return 0;
    }

    // Don't compact past active key/value
    const minKeep = Math.min(
      this.state.keyStart === -1 ? this.buffer.length : this.state.keyStart,
      this.state.valueStart === -1 ? this.buffer.length : this.state.valueStart
    );

    // Keep at least from JSON start
    return Math.min(minKeep, this.jsonStartPosition);
  }

  // ============================================================================
  // Progress Reporting (v0.4.0)
  // ============================================================================

  private reportProgress(): void {
    if (!this.options.onProgress) return;

    const progress: ProgressInfo = {
      bytesProcessed: this.bytesProcessed,
      bytesBuffered: this.buffer.length,
      fieldsCompleted: this.fieldTracker.getCompletedFieldNames(),
    };

    // Estimate progress based on completed tracked fields
    const trackedFields = this.options.fields;
    if (trackedFields && trackedFields.length > 0) {
      const completedCount = progress.fieldsCompleted.length;
      progress.estimatedProgress = completedCount / trackedFields.length;
    }

    this.options.onProgress(progress);
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private createInitialState(): ParserState {
    return {
      depth: 0,
      inString: false,
      escapeNext: false,
      currentKey: '',
      keyStart: -1,
      valueStart: -1,
      jsonStarted: false,
      jsonComplete: false,
      valueDepth: 0,
    };
  }

  private processBuffer(): void {
    const { state } = this;

    for (let i = this.processedIndex; i < this.buffer.length; i++) {
      const char = this.buffer[i];

      // Handle escape sequences
      if (state.escapeNext) {
        state.escapeNext = false;
        continue;
      }

      if (char === '\\' && state.inString) {
        state.escapeNext = true;
        continue;
      }

      // Handle string boundaries
      if (char === '"' && !state.escapeNext) {
        this.handleQuote(i);
        continue;
      }

      // Skip processing inside strings
      if (state.inString) {
        continue;
      }

      // Handle structural characters
      switch (char) {
        case '{':
          this.handleOpenBrace(i);
          break;
        case '}':
          this.handleCloseBrace(i);
          break;
        case '[':
          this.handleOpenBracket(i);
          break;
        case ']':
          this.handleCloseBracket(i);
          break;
        case ':':
          this.handleColon(i);
          break;
        case ',':
          this.handleComma(i);
          break;
      }

      // Early exit if complete
      if (state.jsonComplete) {
        break;
      }
    }

    this.processedIndex = this.buffer.length;
  }

  private handleQuote(position: number): void {
    const { state, options } = this;

    if (!state.inString) {
      // Starting a string
      state.inString = true;

      // Check if this is a key (depth 1, no value started)
      if (state.depth === 1 && state.valueStart === -1 && state.currentKey === '') {
        state.keyStart = position;
      }
    } else {
      // Ending a string
      state.inString = false;

      if (state.keyStart !== -1 && state.valueStart === -1) {
        // Just finished reading a key
        const key = this.buffer.slice(state.keyStart + 1, position);
        state.currentKey = key;
        state.keyStart = -1;

        // Notify field start
        if (options.onFieldStart && this.fieldTracker.isTracking(key)) {
          options.onFieldStart(key);
        }
      } else if (state.valueStart !== -1 && state.valueDepth === 0) {
        // Finished reading a string value at top level
        this.tryCompleteField(position + 1);
      }
    }
  }

  private handleOpenBrace(position: number): void {
    const { state } = this;

    if (!state.jsonStarted) {
      state.jsonStarted = true;
      this.jsonStartPosition = position;
    }

    state.depth++;

    // Starting a nested object as a value
    if (state.depth >= 2 && state.valueStart !== -1) {
      state.valueDepth++;
    } else if (state.depth === 2 && state.currentKey && state.valueStart === -1) {
      state.valueDepth = 1;
    }
  }

  private handleCloseBrace(position: number): void {
    const { state } = this;

    if (state.valueDepth > 0) {
      state.valueDepth--;
      if (state.valueDepth === 0 && state.valueStart !== -1) {
        // Completed a nested object value
        this.tryCompleteField(position + 1);
      }
    } else if (state.depth === 1 && state.valueStart !== -1 && state.currentKey) {
      // Completed a primitive value at the end (before closing brace)
      this.tryCompleteField(position);
    }

    state.depth--;

    if (state.depth === 0 && state.jsonStarted) {
      state.jsonComplete = true;
      this.finalizeResult();
    }
  }

  private handleOpenBracket(_position: number): void {
    const { state } = this;

    if (state.valueStart !== -1) {
      state.valueDepth++;
    }

    state.depth++;
  }

  private handleCloseBracket(position: number): void {
    const { state } = this;

    if (state.valueDepth > 0) {
      state.valueDepth--;
      if (state.valueDepth === 0 && state.valueStart !== -1) {
        // Completed an array value
        this.tryCompleteField(position + 1);
      }
    }

    state.depth--;
  }

  private handleColon(position: number): void {
    const { state } = this;

    if (state.depth === 1 && state.currentKey && state.valueStart === -1) {
      // Ready to read value - find actual start after whitespace
      let valuePos = position + 1;
      while (valuePos < this.buffer.length && /\s/.test(this.buffer[valuePos])) {
        valuePos++;
      }
      state.valueStart = valuePos;
    }
  }

  private handleComma(position: number): void {
    const { state } = this;

    if (state.depth === 1 && state.valueStart !== -1 && state.valueDepth === 0) {
      // Completed a primitive value
      this.tryCompleteField(position);
    }

    // Reset for next key-value pair
    if (state.depth === 1) {
      state.currentKey = '';
      state.keyStart = -1;
      state.valueStart = -1;
      state.valueDepth = 0;
    }
  }

  private tryCompleteField(endPosition: number): void {
    const { state, options } = this;
    const key = state.currentKey;

    if (!key) return;

    // Check if this is a tracked field
    if (!this.fieldTracker.isTracking(key)) {
      this.resetFieldState();
      return;
    }

    // Already completed
    if (this.fieldTracker.isComplete(key)) {
      this.resetFieldState();
      return;
    }

    // Extract the value string
    let valueStr = this.buffer.slice(state.valueStart, endPosition).trim();

    // Try to parse the value
    try {
      let value: unknown;
      try {
        value = JSON.parse(valueStr);
      } catch {
        // Try with repair if enabled
        if (options.repair) {
          valueStr = repairJson(valueStr);
          value = JSON.parse(valueStr);
        } else {
          throw new Error('Parse failed');
        }
      }

      this.fieldTracker.completeField(key, value);

      // Invoke callback
      if (options.onFieldComplete) {
        options.onFieldComplete(key, value);
      }

      // Send final value chunk
      if (options.onValueChunk) {
        options.onValueChunk(key, JSON.stringify(value), true);
      }
    } catch (error) {
      // Value not yet complete or invalid
      if (options.recover && this.recoveryAttempts < this.maxRecoveryAttempts) {
        this.attemptRecovery(key, valueStr, error as Error);
      }
    }

    this.resetFieldState();
  }

  // ============================================================================
  // Error Recovery (v0.4.0)
  // ============================================================================

  private attemptRecovery(key: string, valueStr: string, _error: Error): void {
    this.recoveryAttempts++;

    const recoveryInfo: RecoveryInfo = {
      strategy: 'repair',
      position: this.state.valueStart,
      description: `Attempting to recover field: ${key}`,
      success: false,
    };

    try {
      // Strategy 1: Try repair
      const repaired = repairJson(valueStr);
      const value = JSON.parse(repaired);

      this.fieldTracker.completeField(key, value);
      recoveryInfo.success = true;
      recoveryInfo.description = `Recovered field ${key} using repair`;

      if (this.options.onFieldComplete) {
        this.options.onFieldComplete(key, value);
      }
    } catch {
      // Strategy 2: Skip this field
      recoveryInfo.strategy = 'skip_field';
      recoveryInfo.description = `Skipped field ${key} after failed recovery`;
    }

    if (this.options.onRecovery) {
      this.options.onRecovery(recoveryInfo);
    }
  }

  private resetFieldState(): void {
    const { state } = this;
    state.currentKey = '';
    state.keyStart = -1;
    state.valueStart = -1;
    state.valueDepth = 0;
  }

  private finalizeResult(): void {
    const { options } = this;

    try {
      let jsonStr = this.buffer;

      // Find JSON boundaries
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');

      if (start !== -1 && end !== -1 && end > start) {
        jsonStr = jsonStr.slice(start, end + 1);
      }

      // Repair if needed
      if (options.repair) {
        jsonStr = repairJson(jsonStr);
      }

      this.result = JSON.parse(jsonStr) as T;

      // Invoke callback
      if (options.onComplete) {
        options.onComplete(this.result);
      }
    } catch (error) {
      if (options.recover) {
        // Try partial result recovery
        const partial = this.fieldTracker.getAllCompleted();
        if (Object.keys(partial).length > 0) {
          this.result = partial as T;

          if (options.onRecovery) {
            options.onRecovery({
              strategy: 'partial_result',
              position: 0,
              description: 'Recovered partial result from completed fields',
              success: true,
            });
          }

          if (options.onComplete) {
            options.onComplete(this.result);
          }
          return;
        }
      }

      if (options.onError) {
        options.onError(error as Error);
      }
    }
  }

  private createResult(): IncrementalResult<T> {
    const self = this;

    return {
      isComplete(): boolean {
        return self.state.jsonComplete;
      },

      isFieldComplete(field: string): boolean {
        return self.fieldTracker.isComplete(field);
      },

      getField<F = unknown>(field: string): F | undefined {
        return self.fieldTracker.getField(field) as F | undefined;
      },

      getPartialResult(): Partial<T> {
        return self.fieldTracker.getAllCompleted() as Partial<T>;
      },

      getCompletedFields(): string[] {
        return self.fieldTracker.getCompletedFieldNames();
      },

      getBuffer(): string {
        return self.buffer;
      },
    };
  }
}
