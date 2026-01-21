/**
 * 💎 loot-json core
 * Extract and parse JSON from messy LLM output
 */

import { findJsonCandidates } from './extractors';
import { repairJson } from './repairs';
import { LootError, LootOptions, LootResultWithRepairs, RepairLog } from './types';

// ============================================================================
// Type Overloads
// ============================================================================

// Basic overloads
export function loot<T = unknown>(text: string, options?: LootOptions & { all?: false }): T;
export function loot<T = unknown>(text: string, options: LootOptions & { all: true }): T[];

// Silent overloads
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { silent: true; all?: false }
): T | null;
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { silent: true; all: true }
): T[] | null;

// Report repairs overloads
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { reportRepairs: true; all?: false; silent?: false }
): LootResultWithRepairs<T>;
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { reportRepairs: true; all: true; silent?: false }
): LootResultWithRepairs<T[]>;
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { reportRepairs: true; silent: true; all?: false }
): LootResultWithRepairs<T> | null;
export function loot<T = unknown>(
  text: string,
  options: LootOptions & { reportRepairs: true; silent: true; all: true }
): LootResultWithRepairs<T[]> | null;

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Extract and parse JSON from messy LLM output
 *
 * @param text - The raw text containing JSON (possibly mixed with markdown, comments, etc.)
 * @param options - Configuration options
 * @returns Parsed JSON object/array, or result with repairs if reportRepairs is true
 * @throws LootError if no valid JSON is found and silent mode is off
 *
 * @example
 * ```ts
 * // Basic usage
 * const item = loot<Item>('{"name": "sword", "damage": 50}');
 *
 * // From markdown
 * const data = loot('```json\n{"key": "value"}\n```');
 *
 * // With repair report
 * const { result, repairs } = loot(text, { reportRepairs: true });
 *
 * // Extract all JSON objects
 * const items = loot(text, { all: true });
 * ```
 */
export function loot<T = unknown>(
  text: string,
  options: LootOptions = {}
): T | T[] | null | LootResultWithRepairs<T> | LootResultWithRepairs<T[]> {
  const { silent = false, repair = true, all = false, reportRepairs = false } = options;

  // Input validation
  if (!text || typeof text !== 'string') {
    if (silent) {
      return reportRepairs ? { result: (all ? [] : null) as T, repairs: [] } : all ? [] : null;
    }
    throw new LootError('Input must be a non-empty string', 'EMPTY_INPUT');
  }

  const candidates = findJsonCandidates(text);
  const results: T[] = [];
  const allRepairs: RepairLog[] = [];

  for (const candidate of candidates) {
    const parseResult = tryParse<T>(candidate, repair, reportRepairs);

    if (parseResult !== undefined) {
      if (reportRepairs) {
        const { result: parsed, repairs } = parseResult as { result: T; repairs: RepairLog[] };
        allRepairs.push(...repairs);

        if (!all) {
          return { result: parsed, repairs: allRepairs };
        }
        results.push(parsed);
      } else {
        if (!all) {
          return parseResult as T;
        }
        results.push(parseResult as T);
      }
    }
  }

  // Handle 'all' mode
  if (all) {
    if (reportRepairs) {
      return { result: results, repairs: allRepairs };
    }
    return results;
  }

  // No valid JSON found
  if (silent) {
    if (reportRepairs) {
      return null;
    }
    return null;
  }

  throw new LootError('No valid JSON found in the provided text', 'NO_JSON_FOUND');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Attempt to parse a JSON string, optionally repairing it first
 */
function tryParse<T>(
  jsonString: string,
  shouldRepair: boolean,
  trackRepairs: boolean
): T | { result: T; repairs: RepairLog[] } | undefined {
  const repairs: RepairLog[] = [];

  // First, try parsing as-is
  try {
    const parsed = JSON.parse(jsonString) as T;
    if (trackRepairs) {
      return { result: parsed, repairs: [] };
    }
    return parsed;
  } catch {
    // If repair is disabled, give up
    if (!shouldRepair) {
      return undefined;
    }
  }

  // Try with repairs
  try {
    if (trackRepairs) {
      const repairResult = repairJson(jsonString, true);
      repairs.push(...repairResult.repairs);
      const parsed = JSON.parse(repairResult.text) as T;
      return { result: parsed, repairs };
    } else {
      const repaired = repairJson(jsonString);
      return JSON.parse(repaired) as T;
    }
  } catch {
    return undefined;
  }
}
