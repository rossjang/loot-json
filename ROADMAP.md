# 🗺️ loot-json Roadmap

> Improvement plan based on actual user feedback

## 📊 Version Status

| Version | Goal | Status |
|---------|------|--------|
| 0.2.0 | Multiline string repair + Repair report | ✅ Completed |
| 0.3.0 | Field extraction API | ✅ Completed |
| 0.4.0 | Streaming/Incremental parsing | ✅ Completed |
| 0.5.0 | JSON Schema validation | ✅ Completed |
| 1.0.0 | Stabilization + API finalization | 📋 Planned |

---

## ✅ Completed Features

### v0.2.0 - Repair Enhancement

- **Multiline String Repair**: Fix unescaped newlines in JSON strings
- **Repair Report**: `reportRepairs` option returns detailed repair logs

### v0.3.0 - Field Extraction API

- **lootField()**: Extract specific fields without parsing entire document
- Dot notation support for nested fields
- Bracket notation for special keys

### v0.4.0 - Streaming/Incremental Parsing ⭐

- **IncrementalLoot**: Real-time field extraction during streaming
- `onFieldComplete` callback for early processing
- Partial result access via `getPartialResult()`

### v0.5.0 - JSON Schema Validation

- **validate()**: Validate extracted JSON against schema
- Lightweight self-implemented validator (Zero Dependency)
- Supports subset of JSON Schema Draft-07

---

## 🎯 Future Plans (v1.0.0)

### API Stabilization

- Freeze all public APIs
- Minimize breaking changes
- Comprehensive documentation

### Performance Optimization

- Benchmark against json5, JSON.parse
- Memory optimization for large documents

### Additional Features (Under Consideration)

- `allOf`, `anyOf`, `oneOf` schema support
- Array index access in lootField (`items[0].name`)
- Custom format registration for schema validation

---

## 📁 Project Structure

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

---

## 🤝 Contributing

Contributions are welcome!

1. Create an issue first to discuss implementation direction
2. Include relevant test cases when creating PRs
3. Follow TypeScript strict mode
4. Maintain Zero Dependency principle (except schema validation)

---

## 📝 Changelog

- **2025-01-21**: v0.5.0 released with all planned features
- **2025-01-21**: Initial roadmap created based on user evaluation document
