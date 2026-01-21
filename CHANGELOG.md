# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-01-21

### Added

- **JSON Schema Validation**: `validate()` function and `SchemaValidator` class
  - Supports subset of JSON Schema Draft-07
  - Type validation (string, number, integer, boolean, object, array, null)
  - String validation (minLength, maxLength, pattern, format)
  - Number validation (minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf)
  - Object validation (properties, required, additionalProperties)
  - Array validation (items, minItems, maxItems, uniqueItems)
  - Enum and const validation

## [0.4.0] - 2025-01-21

### Added

- **Incremental/Streaming Parsing**: `IncrementalLoot` class
  - Real-time field extraction during LLM streaming
  - `onFieldComplete` callback for early processing (TTS, UI updates)
  - `onComplete` callback when JSON is fully parsed
  - Partial result access via `getPartialResult()`
  - Field completion tracking via `isFieldComplete()`

## [0.3.0] - 2025-01-21

### Added

- **Field Extraction**: `lootField()` function
  - Extract specific fields without parsing entire document
  - Dot notation support for nested fields (`user.profile.name`)
  - Bracket notation for special keys (`data["special.key"]`)
  - `all` option to extract field from all JSON objects

## [0.2.0] - 2025-01-21

### Added

- **Multiline String Repair**: Fix unescaped newlines in JSON strings
  - Handles `\n`, `\r`, and `\r\n` sequences
  - Preserves already escaped sequences

- **Repair Reporting**: `reportRepairs` option
  - Returns detailed repair logs with type, position, and description
  - Tracks all repair operations performed

### Changed

- `repairJson()` now accepts optional second parameter for tracking

## [0.1.0] - 2025-01-21

### Added

- Initial release
- `loot()` - Extract and parse JSON from messy LLM output
- `repairJson()` - Repair malformed JSON
- `findJsonCandidates()` - Find all JSON candidates in text
- `extractFromMarkdown()` - Extract from markdown code blocks
- `extractByBraces()` - Extract by balanced braces

### Repair Features

- Trailing comma removal
- Single quote to double quote conversion
- Single-line comment removal (`//`)
- Multi-line comment removal (`/* */`)
- Unquoted key quoting
- Invalid value replacement (undefined, NaN, Infinity → null)

### Options

- `silent` - Return null instead of throwing
- `repair` - Enable/disable auto-repair
- `all` - Extract all JSON objects
