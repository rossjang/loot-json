/**
 * 💎 loot-json types
 */

// ============================================================================
// Repair Types
// ============================================================================

/**
 * Types of repairs that can be performed on malformed JSON
 */
export type RepairType =
  | 'trailing_comma'
  | 'single_quote'
  | 'single_line_comment'
  | 'multi_line_comment'
  | 'unquoted_key'
  | 'invalid_value'
  | 'unescaped_newline';

/**
 * Individual repair log entry
 */
export interface RepairLog {
  /** Type of repair performed */
  type: RepairType;
  /** Character position where repair was applied (approximate) */
  position?: number;
  /** Human-readable description of the repair */
  description: string;
  /** Whether the repair was successful */
  fixed: boolean;
}

/**
 * Result of repairJson when tracking is enabled
 */
export interface RepairResult {
  /** The repaired JSON string */
  text: string;
  /** List of repairs that were applied */
  repairs: RepairLog[];
}

// ============================================================================
// Loot Options
// ============================================================================

/**
 * Configuration options for the loot function
 */
export interface LootOptions {
  /**
   * If true, returns null instead of throwing when no JSON is found
   * @default false
   */
  silent?: boolean;

  /**
   * If true, attempts to repair malformed JSON
   * @default true
   */
  repair?: boolean;

  /**
   * If true, extracts all JSON objects found in the text
   * @default false
   */
  all?: boolean;

  /**
   * If true, returns repair logs along with the result
   * @default false
   */
  reportRepairs?: boolean;
}

/**
 * Configuration options for the lootField function
 */
export interface LootFieldOptions {
  /**
   * If true, attempts to repair malformed JSON before extraction
   * @default true
   */
  repair?: boolean;

  /**
   * If true, returns undefined instead of throwing when field is not found
   * @default true
   */
  silent?: boolean;

  /**
   * If the field appears multiple times, return all occurrences
   * @default false
   */
  all?: boolean;
}

// ============================================================================
// Loot Results
// ============================================================================

/**
 * Result of a loot operation when 'all' option is true
 */
export type LootAllResult<T> = T[];

/**
 * Result when reportRepairs option is enabled
 */
export interface LootResultWithRepairs<T> {
  /** Parsed JSON result */
  result: T;
  /** List of repairs that were applied */
  repairs: RepairLog[];
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error codes for LootError
 */
export type LootErrorCode =
  | 'EMPTY_INPUT'
  | 'NO_JSON_FOUND'
  | 'PARSE_FAILED'
  | 'FIELD_NOT_FOUND'
  | 'VALIDATION_FAILED';

/**
 * Error thrown when JSON extraction fails
 */
export class LootError extends Error {
  /** Error code for programmatic handling */
  readonly code: LootErrorCode;

  constructor(message: string, code: LootErrorCode = 'PARSE_FAILED') {
    super(message);
    this.name = 'LootError';
    this.code = code;
  }
}

/**
 * Type guard to check if an error is a LootError
 *
 * @example
 * ```ts
 * try {
 *   const data = loot(text);
 * } catch (error) {
 *   if (isLootError(error)) {
 *     console.log('Loot failed:', error.code, error.message);
 *   }
 * }
 * ```
 */
export function isLootError(error: unknown): error is LootError {
  return error instanceof LootError;
}

// ============================================================================
// Convenience Type Aliases (shorter names)
// ============================================================================

/**
 * Alias for LootResultWithRepairs - shorter name
 * Result containing both parsed data and repair logs
 */
export type Looted<T> = LootResultWithRepairs<T>;

/**
 * Alias for LootOptions - shorter name
 */
export type LootOpts = LootOptions;

/**
 * Alias for LootFieldOptions - shorter name
 */
export type LootFieldOpts = LootFieldOptions;
