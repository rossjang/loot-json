/**
 * 💎 loot-json field extraction (v0.3.0)
 * Extract specific fields from JSON without parsing the entire document
 *
 * Features:
 * - Array index support: items[0], items[-1]
 * - Wildcard patterns: items[*], **.id
 * - Lazy parsing for performance
 */

import { findJsonCandidates } from './extractors';
import { repairJson } from './repairs';
import { LootError, LootFieldOptions } from './types';

// ============================================================================
// Types
// ============================================================================

type PathSegment =
  | { type: 'key'; value: string }
  | { type: 'index'; value: number }
  | { type: 'wildcard' }
  | { type: 'recursive' }; // **

// ============================================================================
// Main Function
// ============================================================================

/**
 * Extract a specific field from JSON text without parsing the entire document
 *
 * @param text - Raw text containing JSON
 * @param path - Field path with support for:
 *   - Dot notation: 'user.profile.name'
 *   - Bracket notation: 'data["special.key"]'
 *   - Array index: 'items[0]', 'items[-1]' (negative = from end)
 *   - Wildcards: 'items[*].name' (all array items)
 *   - Recursive: '**.id' (find at any depth)
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
 * // Array index
 * const first = lootField(text, 'items[0]');
 * const last = lootField(text, 'items[-1]');
 *
 * // Wildcard - returns array of all matching values
 * const allNames = lootField(text, 'users[*].name');
 *
 * // Recursive - find 'id' at any depth
 * const allIds = lootField(text, '**.id');
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

  // Parse the path
  const segments = parsePath(path);
  const hasWildcard = segments.some((s) => s.type === 'wildcard' || s.type === 'recursive');

  // Find JSON candidates
  const candidates = findJsonCandidates(text);
  const results: T[] = [];

  // For wildcard patterns, only use the first (largest) JSON candidate to avoid duplicates
  const candidatesToSearch = hasWildcard && !all ? candidates.slice(0, 1) : candidates;

  for (const candidate of candidatesToSearch) {
    // Repair if needed
    const json = repair ? safeRepair(candidate) : candidate;

    // Extract field value(s)
    if (hasWildcard) {
      // Wildcard extraction returns multiple values
      const values = extractWithWildcard<T>(json, segments);
      results.push(...values);
    } else {
      // Normal extraction
      const value = extractFieldValue<T>(json, segments);
      if (value !== undefined) {
        if (!all && !hasWildcard) return value;
        results.push(value);
      }
    }
  }

  // Return results based on options
  if (hasWildcard) {
    return results.length > 0 ? results : (silent ? undefined : throwNotFound(path));
  }

  if (all && results.length > 0) {
    return results;
  }

  if (results.length > 0) {
    return results[0];
  }

  if (silent) return undefined;
  throw new LootError(`Field '${path}' not found`, 'FIELD_NOT_FOUND');
}

function throwNotFound(path: string): never {
  throw new LootError(`Field '${path}' not found`, 'FIELD_NOT_FOUND');
}

// ============================================================================
// Path Parsing
// ============================================================================

/**
 * Parse a field path into segments
 * Supports: 'a.b.c', 'a["b.c"].d', 'a[0]', 'a[-1]', 'a[*]', '**.id'
 */
function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let current = '';
  let inBracket = false;
  let inQuote = false;
  let quoteChar = '';
  let i = 0;

  // Check for recursive wildcard at start
  if (path.startsWith('**.')) {
    segments.push({ type: 'recursive' });
    i = 3;
  }

  while (i < path.length) {
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
          const segment = parseBracketContent(current);
          segments.push(segment);
          current = '';
        }
        inBracket = false;
      } else if (char !== ' ') {
        current += char;
      }
    } else if (char === '[') {
      if (current) {
        segments.push({ type: 'key', value: current });
        current = '';
      }
      inBracket = true;
    } else if (char === '.') {
      if (current) {
        segments.push({ type: 'key', value: current });
        current = '';
      }
      // Check for recursive wildcard
      if (path.substring(i).startsWith('.**')) {
        segments.push({ type: 'recursive' });
        i += 3;
        continue;
      }
    } else {
      current += char;
    }

    i++;
  }

  if (current) {
    segments.push({ type: 'key', value: current });
  }

  return segments;
}

/**
 * Parse content inside brackets
 */
function parseBracketContent(content: string): PathSegment {
  if (content === '*') {
    return { type: 'wildcard' };
  }

  // Try to parse as number (index)
  const num = parseInt(content, 10);
  if (!isNaN(num)) {
    return { type: 'index', value: num };
  }

  // Otherwise treat as key
  return { type: 'key', value: content };
}

// ============================================================================
// Field Extraction
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
 * Extract a field value from JSON string using path segments
 */
function extractFieldValue<T>(json: string, segments: PathSegment[]): T | undefined {
  let current = json;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    switch (segment.type) {
      case 'key':
        const keyResult = findKeyValue(current, segment.value);
        if (keyResult === undefined) return undefined;
        current = keyResult;
        break;

      case 'index':
        const indexResult = findArrayIndex(current, segment.value);
        if (indexResult === undefined) return undefined;
        current = indexResult;
        break;

      default:
        // Wildcards handled separately
        return undefined;
    }
  }

  // Parse the final value
  return parseValue<T>(current);
}

/**
 * Extract with wildcard support
 */
function extractWithWildcard<T>(json: string, segments: PathSegment[]): T[] {
  const results: T[] = [];

  function extract(current: string, segmentIndex: number): void {
    if (segmentIndex >= segments.length) {
      const value = parseValue<T>(current);
      if (value !== undefined) {
        results.push(value);
      }
      return;
    }

    const segment = segments[segmentIndex];

    switch (segment.type) {
      case 'key':
        const keyResult = findKeyValue(current, segment.value);
        if (keyResult !== undefined) {
          extract(keyResult, segmentIndex + 1);
        }
        break;

      case 'index':
        const indexResult = findArrayIndex(current, segment.value);
        if (indexResult !== undefined) {
          extract(indexResult, segmentIndex + 1);
        }
        break;

      case 'wildcard':
        // Iterate all array elements
        const elements = extractAllArrayElements(current);
        for (const element of elements) {
          extract(element, segmentIndex + 1);
        }
        break;

      case 'recursive':
        // Find matching key at any depth
        const nextSegment = segments[segmentIndex + 1];
        if (nextSegment && nextSegment.type === 'key') {
          findAllMatchingUnique(current, nextSegment.value, segmentIndex + 2);
        }
        break;
    }
  }

  function findAllMatchingUnique(text: string, key: string, nextIndex: number): void {
    // Parse the JSON first to traverse it properly
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      try {
        parsed = JSON.parse(repairJson(text));
      } catch {
        return;
      }
    }

    // Recursively find all matching keys
    function findInObject(obj: unknown): void {
      if (obj === null || typeof obj !== 'object') {
        return;
      }

      if (Array.isArray(obj)) {
        for (const item of obj) {
          findInObject(item);
        }
      } else {
        const record = obj as Record<string, unknown>;
        for (const [k, v] of Object.entries(record)) {
          if (k === key) {
            if (nextIndex >= segments.length) {
              results.push(v as T);
            } else {
              // Continue extraction on the value
              const valueStr = JSON.stringify(v);
              extract(valueStr, nextIndex);
            }
          }
          // Continue searching in nested objects
          findInObject(v);
        }
      }
    }

    findInObject(parsed);
  }

  extract(json, 0);
  return results;
}

/**
 * Parse a JSON value string
 */
function parseValue<T>(valueStr: string): T | undefined {
  try {
    return JSON.parse(valueStr) as T;
  } catch {
    // Try with repair
    try {
      const repaired = repairJson(valueStr);
      return JSON.parse(repaired) as T;
    } catch {
      return undefined;
    }
  }
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
 * Find array element by index (supports negative indices)
 */
function findArrayIndex(json: string, index: number): string | undefined {
  // Find the array start
  const arrayStart = json.indexOf('[');
  if (arrayStart === -1) return undefined;

  const elements = extractAllArrayElements(json);

  // Handle negative indices
  const actualIndex = index < 0 ? elements.length + index : index;

  if (actualIndex < 0 || actualIndex >= elements.length) {
    return undefined;
  }

  return elements[actualIndex];
}

/**
 * Extract all elements from an array
 */
function extractAllArrayElements(json: string): string[] {
  const elements: string[] = [];

  // Find array start
  let start = json.indexOf('[');
  if (start === -1) return elements;

  start++; // Skip [

  while (start < json.length) {
    // Skip whitespace
    while (start < json.length && /\s/.test(json[start])) {
      start++;
    }

    if (start >= json.length || json[start] === ']') break;

    // Extract the element
    const element = extractValue(json, start);
    if (element === undefined) break;

    elements.push(element);

    // Move past the element
    start += element.length;

    // Skip whitespace and comma
    while (start < json.length && /[\s,]/.test(json[start])) {
      start++;
    }
  }

  return elements;
}

// ============================================================================
// Value Extraction Helpers
// ============================================================================

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
