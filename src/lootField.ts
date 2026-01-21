/**
 * 💎 loot-json field extraction
 * Extract specific fields from JSON without parsing the entire document
 */

import { findJsonCandidates } from './extractors';
import { repairJson } from './repairs';
import { LootError, LootFieldOptions } from './types';

// ============================================================================
// Main Function
// ============================================================================

/**
 * Extract a specific field from JSON text without parsing the entire document
 *
 * @param text - Raw text containing JSON
 * @param path - Field path (supports dot notation for nested fields, e.g., 'user.profile.name')
 * @param options - Extraction options
 * @returns The extracted field value or undefined if not found
 *
 * @example
 * ```ts
 * // Simple field
 * const name = lootField(text, 'name');
 *
 * // Nested field
 * const city = lootField(text, 'user.address.city');
 *
 * // With type
 * const age = lootField<number>(text, 'age');
 *
 * // Get all occurrences
 * const allNames = lootField(text, 'name', { all: true });
 * ```
 */
export function lootField<T = unknown>(
  text: string,
  path: string,
  options: LootFieldOptions = {}
): T | T[] | undefined {
  const { repair = true, silent = true, all = false } = options;

  // Input validation
  if (!text || !path) {
    if (silent) return undefined;
    throw new LootError('Text and path are required', 'EMPTY_INPUT');
  }

  // Find JSON candidates
  const candidates = findJsonCandidates(text);
  const results: T[] = [];

  for (const candidate of candidates) {
    // Repair if needed
    const json = repair ? safeRepair(candidate) : candidate;

    // Extract field value
    const value = extractFieldValue<T>(json, path);

    if (value !== undefined) {
      if (!all) return value;
      results.push(value);
    }
  }

  if (all && results.length > 0) {
    return results;
  }

  if (silent) return undefined;
  throw new LootError(`Field '${path}' not found`, 'FIELD_NOT_FOUND');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely repair JSON, returning original if repair fails
 */
function safeRepair(json: string): string {
  try {
    return repairJson(json);
  } catch {
    return json;
  }
}

/**
 * Extract a field value from JSON string without full parsing
 */
function extractFieldValue<T>(json: string, path: string): T | undefined {
  const keys = parsePath(path);
  let current = json;

  for (const key of keys) {
    const result = findKeyValue(current, key);
    if (result === undefined) return undefined;
    current = result;
  }

  // Parse the final value
  try {
    return JSON.parse(current) as T;
  } catch {
    // Try with repair
    try {
      const repaired = repairJson(current);
      return JSON.parse(repaired) as T;
    } catch {
      return undefined;
    }
  }
}

/**
 * Parse a field path into keys
 * Supports: 'a.b.c' and 'a["b.c"].d' for keys with dots
 */
function parsePath(path: string): string[] {
  const keys: string[] = [];
  let current = '';
  let inBracket = false;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (inBracket) {
      if (inQuote) {
        if (char === quoteChar) {
          inQuote = false;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = true;
        quoteChar = char;
      } else if (char === ']') {
        if (current) {
          keys.push(current);
          current = '';
        }
        inBracket = false;
      } else if (char !== ' ') {
        current += char;
      }
    } else if (char === '[') {
      if (current) {
        keys.push(current);
        current = '';
      }
      inBracket = true;
    } else if (char === '.') {
      if (current) {
        keys.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    keys.push(current);
  }

  return keys;
}

/**
 * Find the value for a specific key in a JSON object string
 */
function findKeyValue(json: string, key: string): string | undefined {
  // Find the key pattern: "key":
  const escapedKey = escapeRegex(key);
  const keyPattern = new RegExp(`"${escapedKey}"\\s*:\\s*`);
  const match = keyPattern.exec(json);

  if (!match) return undefined;

  const valueStart = match.index + match[0].length;
  return extractValue(json, valueStart);
}

/**
 * Extract a JSON value starting at the given position
 */
function extractValue(json: string, start: number): string | undefined {
  // Skip whitespace
  let pos = start;
  while (pos < json.length && /\s/.test(json[pos])) {
    pos++;
  }

  if (pos >= json.length) return undefined;

  const char = json[pos];

  // String
  if (char === '"') {
    return extractString(json, pos);
  }

  // Object
  if (char === '{') {
    return extractBalanced(json, pos, '{', '}');
  }

  // Array
  if (char === '[') {
    return extractBalanced(json, pos, '[', ']');
  }

  // Primitive (number, boolean, null)
  return extractPrimitive(json, pos);
}

/**
 * Extract a string value including quotes
 */
function extractString(json: string, start: number): string {
  let end = start + 1;
  let escapeNext = false;

  while (end < json.length) {
    const char = json[end];

    if (escapeNext) {
      escapeNext = false;
      end++;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      end++;
      continue;
    }

    if (char === '"') {
      return json.slice(start, end + 1);
    }

    end++;
  }

  // Unclosed string, return what we have
  return json.slice(start);
}

/**
 * Extract balanced brackets/braces
 */
function extractBalanced(json: string, start: number, open: string, close: string): string {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < json.length; i++) {
    const char = json[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === open) depth++;
      if (char === close) {
        depth--;
        if (depth === 0) {
          return json.slice(start, i + 1);
        }
      }
    }
  }

  // Unbalanced, return what we have
  return json.slice(start);
}

/**
 * Extract a primitive value (number, boolean, null)
 */
function extractPrimitive(json: string, start: number): string {
  let end = start;

  while (end < json.length) {
    const char = json[end];
    // Value ends at comma, closing brace/bracket, or whitespace
    if (char === ',' || char === '}' || char === ']' || /\s/.test(char)) {
      break;
    }
    end++;
  }

  return json.slice(start, end).trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
