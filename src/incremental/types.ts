/**
 * 💎 loot-json incremental types
 * Type definitions for streaming/incremental JSON parsing
 */

// ============================================================================
// Parser State
// ============================================================================

/**
 * Internal state of the incremental parser
 */
export interface ParserState {
  /** Current nesting depth (braces/brackets) */
  depth: number;
  /** Whether currently inside a string literal */
  inString: boolean;
  /** Whether the next character should be escaped */
  escapeNext: boolean;
  /** Current key being parsed */
  currentKey: string;
  /** Start position of current key */
  keyStart: number;
  /** Start position of current value */
  valueStart: number;
  /** Whether JSON object has started */
  jsonStarted: boolean;
  /** Whether JSON parsing is complete */
  jsonComplete: boolean;
  /** Current value nesting depth (for nested objects/arrays) */
  valueDepth: number;
}

// ============================================================================
// Options
// ============================================================================

/**
 * Options for IncrementalLoot
 */
export interface IncrementalLootOptions {
  /**
   * Fields to track for early completion detection
   * If not specified, tracks all top-level fields
   */
  fields?: string[];

  /**
   * Whether to attempt JSON repair on values
   * @default true
   */
  repair?: boolean;

  /**
   * Callback when a tracked field is complete
   */
  onFieldComplete?: (field: string, value: unknown) => void;

  /**
   * Callback when the entire JSON is complete
   */
  onComplete?: (result: unknown) => void;

  /**
   * Callback on parsing error
   */
  onError?: (error: Error) => void;
}

// ============================================================================
// Results
// ============================================================================

/**
 * Result of addChunk operation
 */
export interface IncrementalResult<T> {
  /**
   * Check if the entire JSON is complete and valid
   */
  isComplete(): boolean;

  /**
   * Check if a specific field has been completely parsed
   */
  isFieldComplete(field: string): boolean;

  /**
   * Get the value of a completed field
   * Returns undefined if field is not yet complete
   */
  getField<F = unknown>(field: string): F | undefined;

  /**
   * Get all completed fields as a partial result
   */
  getPartialResult(): Partial<T>;

  /**
   * Get list of all completed field names
   */
  getCompletedFields(): string[];

  /**
   * Get the current buffer content (for debugging)
   */
  getBuffer(): string;
}
