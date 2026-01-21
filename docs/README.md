# 📚 loot-json Development Documentation

> Version-specific technical documentation for the development team

---

## 📁 Document Structure

```
docs/
├── README.md                         # This file
├── v0.2.0-repair-enhancement.md      # Repair enhancement
├── v0.3.0-field-extraction.md        # Field extraction API
├── v0.4.0-incremental-parsing.md     # Streaming/Incremental parsing ⭐
└── v0.5.0-schema-validation.md       # JSON Schema validation
```

---

## 🗓️ Version Roadmap

| Version | Feature | Status | Document |
|---------|---------|--------|----------|
| v0.1.0 | Basic extraction and repair | ✅ Released | - |
| v0.2.0 | Multiline repair + Report | ✅ Released | [Doc](./v0.2.0-repair-enhancement.md) |
| v0.3.0 | lootField API | ✅ Released | [Doc](./v0.3.0-field-extraction.md) |
| v0.4.0 | IncrementalLoot | ✅ Released | [Doc](./v0.4.0-incremental-parsing.md) |
| v0.5.0 | Schema Validation | ✅ Released | [Doc](./v0.5.0-schema-validation.md) |
| v1.0.0 | Stabilization | 📋 Planned | TBD |

---

## 🎯 Priority

### ⭐⭐⭐ Highest Priority
- **v0.4.0 Streaming/Incremental Parsing**: User's top request

### ⭐⭐ Medium Priority
- v0.2.0 Multiline string repair
- v0.5.0 JSON Schema validation

### ⭐ Low Priority
- v0.2.0 Repair report
- v0.3.0 Field extraction

---

## 📖 Document Guide

Each version document contains the following sections:

1. **Overview**: Goals, background, scope of changes
2. **API Design**: Function signatures, type definitions, usage examples
3. **Implementation**: Algorithms, core code
4. **Test Cases**: Unit tests, edge cases
5. **Checklist**: Implementation, testing, documentation items
6. **Notes**: Backward compatibility, performance, future extensions

---

## 🔧 Development Environment Setup

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Build
npm run build

# Test
npm test

# Test (single run)
npm run test:run
```

---

## 📝 Contribution Guide

### Branch Strategy
- `main`: Release version
- `develop`: Development version
- `feature/v0.x.0-feature-name`: Feature development

### Commit Message Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation update
test: Add/update tests
refactor: Code refactoring
chore: Other tasks
```

### PR Checklist
- [ ] Reference related issue
- [ ] Tests pass
- [ ] Lint passes
- [ ] Documentation updated (if needed)

---

## 📞 Contact

- **Project Manager**: TBD
- **Technical Inquiries**: TBD
- **Issue Tracker**: GitHub Issues

---

*Last Updated: 2025-01-21*
