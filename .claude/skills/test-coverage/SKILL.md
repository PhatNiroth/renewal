---
name: test-coverage
description: Run tests with coverage and show which files in app/actions, app/api, lib, and agents have no test coverage.
---

# Test Coverage

Run tests with coverage and report uncovered files.

## Instructions

1. Run tests with coverage:
```bash
npx vitest run --coverage 2>&1
```

2. Also find all source files that should have tests:
```bash
find app/actions app/api lib agents -name "*.ts" ! -name "*.d.ts" | grep -v node_modules | sort
```

3. Cross-reference with existing test files:
```bash
find __tests__ -name "*.test.ts" | sort
```

4. Present a report:
   - Overall coverage % (statements, branches, functions)
   - Files with 0% coverage — these need tests
   - Files with < 50% coverage — these need more tests
   - Files with good coverage (>= 80%) — celebrate these

5. For each uncovered file, suggest:
   > "Want me to generate tests for `<file>`? Run `/run-pipeline generate tests for <file>`"

## Important
- If `@vitest/coverage-v8` is not installed, run `npm install -D @vitest/coverage-v8` first
- Focus coverage report on `app/actions/`, `app/api/`, `lib/`, and `agents/` — skip UI components
