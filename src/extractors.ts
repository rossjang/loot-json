/**
 * Extraction strategies for finding JSON in messy text
 */

/**
 * Extract JSON from markdown code blocks
 * Supports ```json, ``` and ~~~json, ~~~ variants
 */
export function extractFromMarkdown(text: string): string[] {
  const results: string[] = [];

  // Match ```json ... ``` or ~~~ json ... ~~~
  const codeBlockRegex = /(?:```(?:json)?\s*\n?([\s\S]*?)```|~~~(?:json)?\s*\n?([\s\S]*?)~~~)/gi;

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1] || match[2];
    if (content?.trim()) {
      results.push(content.trim());
    }
  }

  return results;
}

/**
 * Extract JSON objects/arrays by finding balanced braces
 */
export function extractByBraces(text: string): string[] {
  const results: string[] = [];
  const chars = text.split('');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === '{' || char === '[') {
      const extracted = extractBalanced(text, i, char === '{' ? ['{', '}'] : ['[', ']']);
      if (extracted) {
        results.push(extracted);
      }
    }
  }

  return results;
}

/**
 * Extract a balanced substring starting from a given position
 */
function extractBalanced(text: string, start: number, brackets: [string, string]): string | null {
  const [open, close] = brackets;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

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
      if (char === open) {
        depth++;
      } else if (char === close) {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Find all potential JSON candidates in text
 */
export function findJsonCandidates(text: string): string[] {
  const candidates: string[] = [];

  // First, try markdown code blocks (highest priority)
  const markdownResults = extractFromMarkdown(text);
  candidates.push(...markdownResults);

  // Then, try to find JSON by balanced braces
  const braceResults = extractByBraces(text);
  candidates.push(...braceResults);

  // Remove duplicates while preserving order
  return [...new Set(candidates)];
}
