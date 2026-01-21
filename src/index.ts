/**
 * 💎 loot-json
 *
 * Don't just parse. Loot it.
 * The ultimate JSON extractor for unstable LLM outputs.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Functions
// ============================================================================

export { loot } from './loot';
export { lootField } from './lootField';

// ============================================================================
// Incremental Parsing
// ============================================================================

export { IncrementalLoot } from './incremental';
export type { IncrementalLootOptions, IncrementalResult } from './incremental';

// ============================================================================
// Schema Validation
// ============================================================================

export { validate, SchemaValidator } from './schema';
export type { LootSchema, ValidationResult, ValidationError } from './schema';

// ============================================================================
// Types
// ============================================================================

export type {
  LootOptions,
  LootFieldOptions,
  LootResultWithRepairs,
  RepairLog,
  RepairType,
  RepairResult,
  RepairOptions,
  RepairRules,
  LootErrorCode,
  // Convenience aliases (shorter names)
  Looted,
  LootOpts,
  LootFieldOpts,
} from './types';

export { DEFAULT_REPAIR_RULES } from './types';

export { LootError, isLootError } from './types';

// ============================================================================
// Utilities (Advanced Usage)
// ============================================================================

export { repairJson, StreamingRepair } from './repairs';
export { findJsonCandidates, extractFromMarkdown, extractByBraces } from './extractors';
