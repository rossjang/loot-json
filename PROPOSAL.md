# 💎 loot-json Improvement Proposal

> **Don't just parse. Loot it.**

---

## 1. Overview

### 1.1 Project Introduction

`loot-json` is a TypeScript library designed to reliably extract and repair JSON from LLM (Large Language Model) outputs.

| Item | Value |
|------|-------|
| Package Name | `loot-json` |
| Current Version | 0.5.0 |
| npm | https://www.npmjs.com/package/loot-json |
| License | MIT |
| Dependencies | Zero Dependency |

### 1.2 Current Features

- ✅ Extract JSON from Markdown code blocks
- ✅ Extract JSON from plain text using balanced braces
- ✅ Auto-repair (trailing commas, comments, single quotes, unquoted keys, etc.)
- ✅ TypeScript generics support
- ✅ Multiple JSON extraction (`all: true` option)
- ✅ Incremental/streaming parsing
- ✅ Field extraction without full parsing
- ✅ JSON Schema validation

### 1.3 Proposal Background

This proposal was created based on actual user feedback. The evaluation document contains feedback on current features and requests for additional functionality.

---

## 2. User Feedback Summary

### 2.1 Current Usage Environment

- Planned for use in LLM-based conversation systems for JSON parsing
- Currently using `json5` + custom `IncrementalJsonParser`
- Need early extraction of specific fields (dialogue, emotion, etc.) from streaming responses

### 2.2 Feature Requests (Priority Order)

| Priority | Feature | Importance | Status |
|----------|---------|------------|--------|
| 1 | Streaming/Incremental Parsing | ⭐⭐⭐ Highest | ✅ Implemented |
| 2 | Multiline String Repair | ⭐⭐ Medium | ✅ Implemented |
| 3 | JSON Schema Validation | ⭐⭐ Medium | ✅ Implemented |
| 4 | Field Extraction API | ⭐ Low | ✅ Implemented |
| 5 | Repair Report | ⭐ Low | ✅ Implemented |

### 2.3 Expected Benefits

1. **Dependency Simplification**: Can replace `json5`
2. **Type Safety**: Improved type inference with TypeScript generics
3. **Latency Improvement**: Early TTS/UI updates with streaming parsing
4. **Maintainability**: Replace custom `IncrementalJsonParser` implementation

---

## 3. Implementation Status

All requested features have been implemented in v0.5.0:

### 3.1 Version Roadmap (Completed)

```
v0.1.0 (Initial)  → v0.2.0 → v0.3.0 → v0.4.0 → v0.5.0
    │                  │         │         │         │
    ▼                  ▼         ▼         ▼         ▼
 Basic           Repair      Field    Streaming  Schema
 Extract       Enhancement  Extract    Parsing   Validation
```

### 3.2 Implemented Features

| Version | Feature | Status |
|---------|---------|--------|
| v0.2.0 | Multiline string repair | ✅ |
| v0.2.0 | Repair report (`reportRepairs`) | ✅ |
| v0.3.0 | `lootField()` field extraction | ✅ |
| v0.4.0 | `IncrementalLoot` streaming parser | ✅ |
| v0.5.0 | JSON Schema validation | ✅ |

---

## 4. Technical Specifications

### 4.1 Project Structure

```
src/
├── index.ts              # Main entry
├── loot.ts               # Core loot function
├── lootField.ts          # Field extraction
├── extractors.ts         # JSON extraction logic
├── repairs.ts            # JSON auto-repair
├── types.ts              # Type definitions
├── incremental/          # Streaming parsing
│   ├── IncrementalLoot.ts
│   ├── FieldTracker.ts
│   └── types.ts
└── schema/               # Schema validation
    ├── validator.ts
    └── types.ts
```

### 4.2 Build Output

| Format | File | Purpose |
|--------|------|---------|
| CommonJS | `dist/index.js` | Node.js require() |
| ESM | `dist/index.mjs` | ES Modules import |
| TypeScript | `dist/index.d.ts` | Type definitions |

### 4.3 Compatibility

| Item | Requirement |
|------|-------------|
| Node.js | >= 16.0.0 |
| TypeScript | >= 5.0.0 |
| Browser | ES2020 compatible |

---

## 5. Test Coverage

### 5.1 Test Statistics

```
✓ tests/repairs.test.ts     (24 tests)
✓ tests/loot.test.ts        (35 tests)
✓ tests/schema.test.ts      (36 tests)
✓ tests/lootField.test.ts   (29 tests)
✓ tests/incremental.test.ts (22 tests)

Test Files: 5 passed
Tests:      146 passed
```

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| npm Weekly Downloads | 1,000+ |
| GitHub Stars | 100+ |
| Test Coverage | 90%+ |
| Issue Response Time | Within 48 hours |
| Zero Critical Bugs | At v1.0.0 release |

---

## 7. Conclusion

`loot-json` is a library that solves the specific problem of LLM output parsing.

Based on user feedback, all requested features have been implemented. The most important feature, **streaming/incremental parsing**, allows users to replace their custom `IncrementalJsonParser` implementation and significantly improve LLM response latency.

**Zero Dependency** while providing practical functionality is the core value of `loot-json`.

---

*Created: 2025-01-21*
*Version: 1.0*
