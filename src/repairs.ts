/**
 * 💎 loot-json repairs (v0.2.0)
 * JSON repair utilities for common LLM output issues
 * 
 * Features:
 * - Single-pass state machine for optimal performance
 * - Configurable repair rules
 * - Enhanced repair logging with line/column info
 */

import {
  RepairLog,
  RepairResult,
  RepairOptions,
  RepairRules,
  DEFAULT_REPAIR_RULES,
} from './types';

// ============================================================================
// State Machine Types
// ============================================================================

enum State {
  Normal,
  InString,
  InStringEscape,
  InSingleQuoteString,
  InSingleQuoteStringEscape,
  InSingleLineComment,
  InMultiLineComment,
  InMultiLineCommentStar,
}

interface RepairState {
  state: State;
  output: string[];
  repairs: RepairLog[];
  line: number;
  column: number;
  position: number;
  rules: Required<RepairRules>;
  trackRepairs: boolean;
}

// ============================================================================
// Main Repair Function
// ============================================================================

/**
 * Attempt to repair malformed JSON using single-pass state machine
 * Handles common LLM mistakes like trailing commas, single quotes, comments, etc.
 *
 * @param jsonString - The malformed JSON string
 * @param options - Repair options (boolean for backward compatibility)
 * @returns Repaired JSON string, or RepairResult if trackRepairs is true
 *
 * @example
 * ```ts
 * // Simple usage
 * const fixed = repairJson('{"key": "value",}');
 *
 * // With repair tracking
 * const { text, repairs } = repairJson('{"key": "value",}', { trackRepairs: true });
 *
 * // With custom rules
 * const fixed = repairJson(input, {
 *   rules: { singleLineComments: false } // Keep comments
 * });
 * ```
 */
export function repairJson(jsonString: string, trackRepairs?: false): string;
export function repairJson(jsonString: string, trackRepairs: true): RepairResult;
export function repairJson(jsonString: string, options: RepairOptions & { trackRepairs: true }): RepairResult;
export function repairJson(jsonString: string, options: RepairOptions & { trackRepairs?: false }): string;
export function repairJson(jsonString: string, options?: RepairOptions): string | RepairResult;
export function repairJson(
  jsonString: string,
  optionsOrTrack?: boolean | RepairOptions
): string | RepairResult {
  // Handle backward compatibility
  let options: RepairOptions;
  if (typeof optionsOrTrack === 'boolean') {
    options = { trackRepairs: optionsOrTrack };
  } else {
    options = optionsOrTrack || {};
  }

  const trackRepairs = options.trackRepairs ?? false;
  const rules: Required<RepairRules> = {
    ...DEFAULT_REPAIR_RULES,
    ...options.rules,
  };

  // Initialize state machine
  const state: RepairState = {
    state: State.Normal,
    output: [],
    repairs: [],
    line: 1,
    column: 1,
    position: 0,
    rules,
    trackRepairs,
  };

  // Single-pass processing
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    const nextChar = jsonString[i + 1];
    const prevChar = i > 0 ? jsonString[i - 1] : '';

    processChar(state, char, nextChar, prevChar, i);

    // Update position tracking
    if (char === '\n') {
      state.line++;
      state.column = 1;
    } else {
      state.column++;
    }
    state.position = i + 1;
  }

  // Post-processing: fix trailing commas and unquoted keys
  let result = state.output.join('');

  if (rules.trailingComma) {
    result = fixTrailingCommas(result, state);
  }

  if (rules.unquotedKeys) {
    result = fixUnquotedKeys(result, state);
  }

  if (rules.invalidValues) {
    result = fixInvalidValues(result, state);
  }

  if (trackRepairs) {
    return { text: result, repairs: state.repairs };
  }
  return result;
}

// ============================================================================
// State Machine Character Processor
// ============================================================================

function processChar(
  state: RepairState,
  char: string,
  nextChar: string | undefined,
  _prevChar: string,
  position: number
): void {

  switch (state.state) {
    case State.Normal:
      handleNormalState(state, char, nextChar, position);
      break;

    case State.InString:
      handleStringState(state, char, position);
      break;

    case State.InStringEscape:
      state.output.push(char);
      state.state = State.InString;
      break;

    case State.InSingleQuoteString:
      handleSingleQuoteStringState(state, char, position);
      break;

    case State.InSingleQuoteStringEscape:
      state.output.push(char);
      state.state = State.InSingleQuoteString;
      break;

    case State.InSingleLineComment:
      if (char === '\n') {
        state.state = State.Normal;
        // Don't emit the newline from comment, but preserve line structure
      }
      // Skip all comment characters
      break;

    case State.InMultiLineComment:
      if (char === '*') {
        state.state = State.InMultiLineCommentStar;
      }
      break;

    case State.InMultiLineCommentStar:
      if (char === '/') {
        state.state = State.Normal;
      } else if (char !== '*') {
        state.state = State.InMultiLineComment;
      }
      break;
  }
}

function handleNormalState(
  state: RepairState,
  char: string,
  nextChar: string | undefined,
  position: number
): void {
  const { rules } = state;

  // Check for single-line comment
  if (char === '/' && nextChar === '/' && rules.singleLineComments) {
    if (state.trackRepairs) {
      state.repairs.push({
        type: 'single_line_comment',
        position,
        line: state.line,
        column: state.column,
        description: 'Removed single-line comment',
        fixed: true,
      });
    }
    state.state = State.InSingleLineComment;
    return;
  }

  // Check for multi-line comment
  if (char === '/' && nextChar === '*' && rules.multiLineComments) {
    if (state.trackRepairs) {
      state.repairs.push({
        type: 'multi_line_comment',
        position,
        line: state.line,
        column: state.column,
        description: 'Removed multi-line comment',
        fixed: true,
      });
    }
    state.state = State.InMultiLineComment;
    return;
  }

  // Check for double-quoted string start
  if (char === '"') {
    state.output.push(char);
    state.state = State.InString;
    return;
  }

  // Check for single-quoted string start
  if (char === "'" && rules.singleQuotes) {
    if (state.trackRepairs) {
      state.repairs.push({
        type: 'single_quote',
        position,
        line: state.line,
        column: state.column,
        description: 'Converted single-quoted string to double-quoted',
        fixed: true,
      });
    }
    state.output.push('"'); // Convert to double quote
    state.state = State.InSingleQuoteString;
    return;
  }

  // Default: emit character as-is
  state.output.push(char);
}

function handleStringState(state: RepairState, char: string, position: number): void {
  const { rules } = state;

  if (char === '\\') {
    state.output.push(char);
    state.state = State.InStringEscape;
    return;
  }

  if (char === '"') {
    state.output.push(char);
    state.state = State.Normal;
    return;
  }

  // Handle unescaped newlines in strings
  if ((char === '\n' || char === '\r') && rules.unescapedNewlines) {
    if (state.trackRepairs) {
      // Only log once per string
      const lastRepair = state.repairs[state.repairs.length - 1];
      if (!lastRepair || lastRepair.type !== 'unescaped_newline' || lastRepair.line !== state.line) {
        state.repairs.push({
          type: 'unescaped_newline',
          position,
          line: state.line,
          column: state.column,
          description: 'Escaped unescaped newline in string',
          fixed: true,
        });
      }
    }

    if (char === '\r') {
      state.output.push('\\r');
    } else {
      state.output.push('\\n');
    }
    return;
  }

  state.output.push(char);
}

function handleSingleQuoteStringState(state: RepairState, char: string, position: number): void {
  const { rules } = state;

  if (char === '\\') {
    state.output.push(char);
    state.state = State.InSingleQuoteStringEscape;
    return;
  }

  if (char === "'") {
    state.output.push('"'); // Convert closing quote
    state.state = State.Normal;
    return;
  }

  // Handle unescaped newlines in strings
  if ((char === '\n' || char === '\r') && rules.unescapedNewlines) {
    if (state.trackRepairs) {
      const lastRepair = state.repairs[state.repairs.length - 1];
      if (!lastRepair || lastRepair.type !== 'unescaped_newline' || lastRepair.line !== state.line) {
        state.repairs.push({
          type: 'unescaped_newline',
          position,
          line: state.line,
          column: state.column,
          description: 'Escaped unescaped newline in string',
          fixed: true,
        });
      }
    }

    if (char === '\r') {
      state.output.push('\\r');
    } else {
      state.output.push('\\n');
    }
    return;
  }

  state.output.push(char);
}

// ============================================================================
// Post-Processing Repairs
// ============================================================================

/**
 * Fix trailing commas before closing braces/brackets
 */
function fixTrailingCommas(text: string, state: RepairState): string {
  const regex = /,(\s*[}\]])/g;
  let match;

  // Calculate line/column for each match
  const lines = text.split('\n');
  while ((match = regex.exec(text)) !== null) {
    if (state.trackRepairs) {
      const pos = match.index;
      let line = 1;
      let col = 1;
      let charCount = 0;

      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= pos) {
          line = i + 1;
          col = pos - charCount + 1;
          break;
        }
        charCount += lines[i].length + 1; // +1 for newline
      }

      state.repairs.push({
        type: 'trailing_comma',
        position: pos,
        line,
        column: col,
        description: 'Removed trailing comma',
        fixed: true,
      });
    }
  }

  return text.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Fix unquoted property names in objects
 */
function fixUnquotedKeys(text: string, state: RepairState): string {
  // Match unquoted keys: { key: or , key:
  // Avoid matching inside strings by using a more careful regex
  const regex = /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g;
  let match;

  // First pass: collect repairs
  const tempText = text;
  while ((match = regex.exec(tempText)) !== null) {
    if (state.trackRepairs) {
      const pos = match.index + match[1].length;
      const lines = text.substring(0, pos).split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;

      state.repairs.push({
        type: 'unquoted_key',
        position: pos,
        line,
        column: col,
        description: `Quoted unquoted key: ${match[2]}`,
        fixed: true,
      });
    }
  }

  return text.replace(regex, '$1"$2"$3');
}

/**
 * Fix invalid JavaScript values like undefined, NaN, Infinity
 */
function fixInvalidValues(text: string, state: RepairState): string {
  let result = text;

  // Track if we're inside a string to avoid replacing inside strings
  const replacements: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /:\s*undefined\b/g, name: 'undefined' },
    { pattern: /:\s*NaN\b/g, name: 'NaN' },
    { pattern: /:\s*-?Infinity\b/g, name: 'Infinity' },
  ];

  for (const { pattern, name } of replacements) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (state.trackRepairs) {
        const pos = match.index;
        const lines = text.substring(0, pos).split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;

        state.repairs.push({
          type: 'invalid_value',
          position: pos,
          line,
          column: col,
          description: `Replaced ${name} with null`,
          fixed: true,
        });
      }
    }
    result = result.replace(pattern, ': null');
  }

  return result;
}

// ============================================================================
// Streaming Repair (v0.2.0)
// ============================================================================

/**
 * Streaming JSON repair for chunk-by-chunk processing
 * 
 * @example
 * ```ts
 * const repairer = new StreamingRepair();
 * 
 * for await (const chunk of stream) {
 *   const repaired = repairer.addChunk(chunk);
 *   process(repaired);
 * }
 * 
 * const final = repairer.flush();
 * ```
 */
export class StreamingRepair {
  private buffer: string = '';
  private state: State = State.Normal;
  private repairs: RepairLog[] = [];
  private rules: Required<RepairRules>;
  private line: number = 1;
  private position: number = 0;
  private trackRepairs: boolean;

  constructor(options: RepairOptions = {}) {
    this.rules = { ...DEFAULT_REPAIR_RULES, ...options.rules };
    this.trackRepairs = options.trackRepairs ?? false;
  }

  /**
   * Add a chunk of data and return the safely repaired portion
   */
  addChunk(chunk: string): string {
    this.buffer += chunk;
    const { safe, pending } = this.findSafeSection();
    
    if (safe.length === 0) {
      return '';
    }

    const repaired = this.repairSection(safe);
    this.buffer = pending;
    return repaired;
  }

  /**
   * Flush remaining buffer and return final repaired content
   */
  flush(): string {
    if (this.buffer.length === 0) {
      return '';
    }
    const repaired = this.repairSection(this.buffer);
    this.buffer = '';
    return repaired;
  }

  /**
   * Get all repairs performed so far
   */
  getRepairs(): RepairLog[] {
    return [...this.repairs];
  }

  /**
   * Reset the streaming repairer state
   */
  reset(): void {
    this.buffer = '';
    this.state = State.Normal;
    this.repairs = [];
    this.line = 1;
    this.position = 0;
  }

  /**
   * Find the safe-to-emit portion of the buffer
   * Keeps potential incomplete tokens in the pending buffer
   */
  private findSafeSection(): { safe: string; pending: string } {
    if (this.buffer.length === 0) {
      return { safe: '', pending: '' };
    }

    // Find the last "safe" position to split
    // Safe positions are outside strings and comments
    let safeEnd = 0;
    let tempState = this.state;
    let inEscape = false;

    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      const nextChar = this.buffer[i + 1];

      if (inEscape) {
        inEscape = false;
        continue;
      }

      switch (tempState) {
        case State.Normal:
          if (char === '"') {
            tempState = State.InString;
          } else if (char === "'" && this.rules.singleQuotes) {
            tempState = State.InSingleQuoteString;
          } else if (char === '/' && nextChar === '/') {
            tempState = State.InSingleLineComment;
          } else if (char === '/' && nextChar === '*') {
            tempState = State.InMultiLineComment;
          } else {
            // Safe to split here
            safeEnd = i + 1;
          }
          break;

        case State.InString:
          if (char === '\\') {
            inEscape = true;
          } else if (char === '"') {
            tempState = State.Normal;
            safeEnd = i + 1;
          }
          break;

        case State.InSingleQuoteString:
          if (char === '\\') {
            inEscape = true;
          } else if (char === "'") {
            tempState = State.Normal;
            safeEnd = i + 1;
          }
          break;

        case State.InSingleLineComment:
          if (char === '\n') {
            tempState = State.Normal;
            safeEnd = i + 1;
          }
          break;

        case State.InMultiLineComment:
          if (char === '*' && nextChar === '/') {
            tempState = State.Normal;
            // Will be safe after */
          }
          break;
      }
    }

    // Keep some buffer for context (potential trailing comma, etc.)
    const minPending = 10;
    if (safeEnd > minPending) {
      safeEnd = Math.max(0, safeEnd - minPending);
    } else {
      safeEnd = 0;
    }

    return {
      safe: this.buffer.substring(0, safeEnd),
      pending: this.buffer.substring(safeEnd),
    };
  }

  /**
   * Repair a section of text
   */
  private repairSection(text: string): string {
    const result = repairJson(text, {
      trackRepairs: this.trackRepairs,
      rules: this.rules,
    });

    if (this.trackRepairs && typeof result === 'object') {
      // Adjust positions for streaming context
      for (const repair of result.repairs) {
        if (repair.position !== undefined) {
          repair.position += this.position;
        }
        if (repair.line !== undefined) {
          repair.line += this.line - 1;
        }
      }
      this.repairs.push(...result.repairs);
      
      // Update position tracking
      const lines = text.split('\n');
      this.line += lines.length - 1;
      this.position += text.length;
      
      return result.text;
    }

    // Update position tracking
    const lines = text.split('\n');
    this.line += lines.length - 1;
    this.position += text.length;

    return result as string;
  }
}
