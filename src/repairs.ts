/**
 * 💎 loot-json repairs
 * JSON repair utilities for common LLM output issues
 */

import { RepairLog, RepairResult } from './types';

// ============================================================================
// Main Repair Function
// ============================================================================

/**
 * Attempt to repair malformed JSON
 * Handles common LLM mistakes like trailing commas, single quotes, comments, etc.
 *
 * @param jsonString - The malformed JSON string
 * @param trackRepairs - Whether to track and return repair logs
 * @returns Repaired JSON string, or RepairResult if trackRepairs is true
 *
 * @example
 * ```ts
 * // Simple usage
 * const fixed = repairJson('{"key": "value",}');
 *
 * // With repair tracking
 * const { text, repairs } = repairJson('{"key": "value",}', true);
 * console.log(repairs); // [{ type: 'trailing_comma', ... }]
 * ```
 */
export function repairJson(jsonString: string, trackRepairs?: false): string;
export function repairJson(jsonString: string, trackRepairs: true): RepairResult;
export function repairJson(
  jsonString: string,
  trackRepairs: boolean = false
): string | RepairResult {
  const allRepairs: RepairLog[] = [];
  let result = jsonString;

  // 1. Remove single-line comments (// comment)
  const singleLineResult = removeSingleLineComments(result, trackRepairs);
  result = trackRepairs ? (singleLineResult as RepairResult).text : (singleLineResult as string);
  if (trackRepairs) {
    allRepairs.push(...(singleLineResult as RepairResult).repairs);
  }

  // 2. Remove multi-line comments (/* comment */)
  const multiLineResult = removeMultiLineComments(result, trackRepairs);
  result = trackRepairs ? (multiLineResult as RepairResult).text : (multiLineResult as string);
  if (trackRepairs) {
    allRepairs.push(...(multiLineResult as RepairResult).repairs);
  }

  // 3. Replace single quotes with double quotes
  const singleQuoteResult = replaceSingleQuotes(result, trackRepairs);
  result = trackRepairs ? (singleQuoteResult as RepairResult).text : (singleQuoteResult as string);
  if (trackRepairs) {
    allRepairs.push(...(singleQuoteResult as RepairResult).repairs);
  }

  // 4. Remove trailing commas before } or ]
  const trailingCommaResult = removeTrailingCommas(result, trackRepairs);
  result = trackRepairs
    ? (trailingCommaResult as RepairResult).text
    : (trailingCommaResult as string);
  if (trackRepairs) {
    allRepairs.push(...(trailingCommaResult as RepairResult).repairs);
  }

  // 5. Fix unquoted property names
  const unquotedKeyResult = fixUnquotedPropertyNames(result, trackRepairs);
  result = trackRepairs ? (unquotedKeyResult as RepairResult).text : (unquotedKeyResult as string);
  if (trackRepairs) {
    allRepairs.push(...(unquotedKeyResult as RepairResult).repairs);
  }

  // 6. Handle undefined and NaN values
  const invalidValueResult = fixInvalidValues(result, trackRepairs);
  result = trackRepairs
    ? (invalidValueResult as RepairResult).text
    : (invalidValueResult as string);
  if (trackRepairs) {
    allRepairs.push(...(invalidValueResult as RepairResult).repairs);
  }

  // 7. Fix unescaped newlines in strings
  const newlineResult = fixUnescapedNewlines(result, trackRepairs);
  result = trackRepairs ? (newlineResult as RepairResult).text : (newlineResult as string);
  if (trackRepairs) {
    allRepairs.push(...(newlineResult as RepairResult).repairs);
  }

  if (trackRepairs) {
    return { text: result, repairs: allRepairs };
  }
  return result;
}

// ============================================================================
// Individual Repair Functions
// ============================================================================

/**
 * Remove single-line comments while preserving strings
 */
function removeSingleLineComments(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  let result = '';
  let inString = false;
  let escapeNext = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      i++;
      continue;
    }

    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      i++;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (!inString && char === '/' && nextChar === '/') {
      if (track) {
        repairs.push({
          type: 'single_line_comment',
          position: i,
          description: 'Removed single-line comment',
          fixed: true,
        });
      }
      // Skip until end of line
      while (i < text.length && text[i] !== '\n') {
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return track ? { text: result, repairs } : result;
}

/**
 * Remove multi-line comments while preserving strings
 */
function removeMultiLineComments(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  let result = '';
  let inString = false;
  let escapeNext = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      i++;
      continue;
    }

    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      i++;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (!inString && char === '/' && nextChar === '*') {
      if (track) {
        repairs.push({
          type: 'multi_line_comment',
          position: i,
          description: 'Removed multi-line comment',
          fixed: true,
        });
      }
      // Skip until */
      i += 2;
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip */
      continue;
    }

    result += char;
    i++;
  }

  return track ? { text: result, repairs } : result;
}

/**
 * Replace single quotes with double quotes for JSON compatibility
 */
function replaceSingleQuotes(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  let result = '';
  let inDoubleString = false;
  let escapeNext = false;
  let hasReplaced = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inDoubleString = !inDoubleString;
      result += char;
      continue;
    }

    if (char === "'" && !inDoubleString) {
      if (track && !hasReplaced) {
        repairs.push({
          type: 'single_quote',
          position: i,
          description: 'Replaced single quotes with double quotes',
          fixed: true,
        });
        hasReplaced = true;
      }
      result += '"';
      continue;
    }

    result += char;
  }

  return track ? { text: result, repairs } : result;
}

/**
 * Remove trailing commas before closing braces/brackets
 */
function removeTrailingCommas(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  const regex = /,(\s*[}\]])/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    if (track) {
      repairs.push({
        type: 'trailing_comma',
        position: match.index,
        description: 'Removed trailing comma',
        fixed: true,
      });
    }
  }

  const result = text.replace(/,(\s*[}\]])/g, '$1');

  return track ? { text: result, repairs } : result;
}

/**
 * Fix unquoted property names in objects
 */
function fixUnquotedPropertyNames(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  const regex = /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g;

  let match;
  const tempText = text;
  while ((match = regex.exec(tempText)) !== null) {
    if (track) {
      repairs.push({
        type: 'unquoted_key',
        position: match.index + match[1].length,
        description: `Quoted unquoted key: ${match[2]}`,
        fixed: true,
      });
    }
  }

  const result = text.replace(regex, '$1"$2"$3');

  return track ? { text: result, repairs } : result;
}

/**
 * Fix invalid JavaScript values like undefined, NaN, Infinity
 */
function fixInvalidValues(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  let result = text;

  // Replace undefined with null
  const undefinedMatches = text.match(/:\s*undefined\b/g);
  if (undefinedMatches && track) {
    repairs.push({
      type: 'invalid_value',
      description: `Replaced ${undefinedMatches.length} undefined value(s) with null`,
      fixed: true,
    });
  }
  result = result.replace(/:\s*undefined\b/g, ': null');

  // Replace NaN with null
  const nanMatches = text.match(/:\s*NaN\b/g);
  if (nanMatches && track) {
    repairs.push({
      type: 'invalid_value',
      description: `Replaced ${nanMatches.length} NaN value(s) with null`,
      fixed: true,
    });
  }
  result = result.replace(/:\s*NaN\b/g, ': null');

  // Replace Infinity with null
  const infMatches = text.match(/:\s*-?Infinity\b/g);
  if (infMatches && track) {
    repairs.push({
      type: 'invalid_value',
      description: `Replaced ${infMatches.length} Infinity value(s) with null`,
      fixed: true,
    });
  }
  result = result.replace(/:\s*-?Infinity\b/g, ': null');

  return track ? { text: result, repairs } : result;
}

/**
 * Fix unescaped newlines inside JSON string values
 * Converts raw newlines within strings to escaped \n sequences
 */
function fixUnescapedNewlines(text: string, track: boolean): string | RepairResult {
  const repairs: RepairLog[] = [];
  let result = '';
  let inString = false;
  let escapeNext = false;
  let hasFixed = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    // Handle newlines inside strings
    if (inString) {
      if (char === '\n') {
        if (track && !hasFixed) {
          repairs.push({
            type: 'unescaped_newline',
            position: i,
            description: 'Escaped unescaped newline(s) in string',
            fixed: true,
          });
          hasFixed = true;
        }
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        // Check for \r\n sequence
        if (text[i + 1] === '\n') {
          if (track && !hasFixed) {
            repairs.push({
              type: 'unescaped_newline',
              position: i,
              description: 'Escaped unescaped newline(s) in string',
              fixed: true,
            });
            hasFixed = true;
          }
          result += '\\r\\n';
          i++; // Skip the \n
          continue;
        }
        if (track && !hasFixed) {
          repairs.push({
            type: 'unescaped_newline',
            position: i,
            description: 'Escaped unescaped carriage return in string',
            fixed: true,
          });
          hasFixed = true;
        }
        result += '\\r';
        continue;
      }
    }

    result += char;
  }

  return track ? { text: result, repairs } : result;
}
