# OSS Readiness TODO

Checklist and assessment for making `bn-template-engine` open source.

---

## 1. Security & Secrets

- [x] ~~**Remove SonarQube**~~ — removed `sonar-project.properties`, `.scannerwork/`, and `sonarqube-scanner` devDependency entirely
- [ ] **Audit `.gitignore`** — confirm `.env`, credentials, and IDE-specific files are excluded (currently looks good)
- [ ] **Scan git history** for any previously committed secrets, tokens, or credentials (use `git log -p --all -S 'squ_'` or tools like `trufflehog`/`gitleaks`)

---

## 2. Personal & Proprietary Data

### Personal Information (Critical)

- [x] ~~**Replace personal names in test data**~~ — DONE. Replaced the German sentence with `"Sample Table Title"` in `src/components/bn-table/ibcs-table.spec.tsx` (15 occurrences) and deleted the dev-console comment block in `src/components/bn-title/ibcs-title/ibcs-title.tsx`. Grep across `src/` confirms no remaining occurrences (the `test-runner-*.tsx` files referenced here no longer contain the name).
- [ ] **Remove developer name references** in TODO comments (JHE, Sven) — replace with issue tracker references

### Company Branding

- [ ] **Update or remove "Bino Bi" branding** in `stencil.config.ts` footer (`'developed by Bino Bi'`)
- [ ] **Decide on package scope** — currently `@bino-bi/bn-template-engine` on GitHub Packages; for public OSS either:
  - Publish unscoped to public npm, or
  - Create a public npm org scope
- [x] ~~**Remove commented-out imports** referencing private packages (`@bino-bi/ibcs-component`, `@bino-bi/ibcs-component-interface`)~~ — removed from 30+ files across src/

---

## 3. Documentation

### Must Have

- [ ] **Rewrite `README.md`** — currently in German with minimal content. Needs:
  - Project description and purpose (IBCS visualization web components)
  - Installation instructions (npm/CDN)
  - Quick start / usage example
  - Screenshot or demo link
  - Available components list with brief descriptions
  - Link to Storybook demo
  - Build & development instructions
  - License badge
- [ ] **Create `CONTRIBUTING.md`** — contribution guidelines, development setup, coding standards, PR process
- [ ] **Create `CODE_OF_CONDUCT.md`** — adopt Contributor Covenant or similar
- [x] ~~**Update `LICENSE`**~~ — replaced MIT with Apache 2.0 and set copyright holder to `Bino Bi`
- [ ] **Update `package.json` description** — currently says `"Stencil Component Starter"`, should describe the actual project

### Should Have

- [ ] **Translate German comments to English** throughout codebase (scattered in DataQuery.ts, test files, component files)
- [ ] **Translate German test data** to English (e.g. `"Umsatz"` → `"Revenue"`)
- [ ] **Update `dataset.md`** — review for completeness and ensure it's understandable without internal context
- [ ] **Add JSDoc to public component APIs** — many `@Prop()` and `@Event()` declarations lack documentation
- [ ] **Create architecture overview diagram** — data flow from bn-datasource → bn-dataset → visualization components

---

## 4. CI/CD & Publishing

- [ ] **Update GitHub Actions workflows** for public distribution:
  - `release.yaml` — currently publishes to GitHub Packages (`npm.pkg.github.com`) and creates releases in a separate private repo (`bino-bi/bn-template-engine-releases`). Change to publish to public npm and use standard GitHub Releases
  - `pr.yaml` — currently uses `@bino-bi` scope with GitHub registry. Remove private registry config
  - `snapshot.yaml` — uploads to private S3 storage. Replace with GitHub Releases or artifact uploads
  - `deploy.yaml` — review and update for public infrastructure
- [ ] **Add GitHub Issue templates** (`.github/ISSUE_TEMPLATE/`) — bug report, feature request
- [ ] **Add GitHub PR template** (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] **Set up public CI** — ensure tests run on PRs without private infrastructure

---

## 5. Dependency Audit

### Remove Unused Dependencies

- [ ] **Remove `xlsx`** from `package.json` — not imported anywhere in `src/`; adds unnecessary bundle weight and potential license risk (SheetJS changed license in newer versions)
- [x] ~~**Remove `@types/lodash`** from `dependencies`~~ — removed along with `lodash` entirely (replaced with native implementations)

### Review Bundle Size Impact

- [ ] **Audit `alasql`** — large dependency (in-browser SQL engine), only used by `bn-table`. Consider lazy loading or making optional
- [x] ~~**Audit `lodash`**~~ — removed entirely, replaced `_.template`, `isEmpty`, `isString` with native code

### License Compatibility

- [ ] **Run license audit** (`npx license-checker --summary`) to confirm all dependencies are MIT/Apache-2.0/BSD compatible
- [ ] **Document third-party licenses** — consider adding a `THIRD_PARTY_LICENSES` file or notice

---

## 6. Cleanup

- [ ] **Remove backup files** — `src/test-runner/test-runner-table.tsx.bak`
- [ ] **Remove `todo.md`** from repo root (internal planning file)
- [x] ~~**Remove `.scannerwork/`** directory~~ — deleted and added to `.gitignore`
- [ ] **Remove `.idea/`** directory (IntelliJ settings — add to `.gitignore` if not already)
- [ ] **Remove `.agents/`** directory if internal-only
- [ ] **Remove `src/examples/`** if they contain internal test pages with German content, or translate and clean up
- [ ] **Clean up `src/test-runner/`** — contains hardcoded debug data; either remove or sanitize for public use
- [ ] **Update `.gitignore`** to exclude: `.scannerwork/`, `.idea/`, `.agents/`, `*.bak`

---

## 7. Storybook / Demo

- [ ] **Set up public Storybook deployment** (GitHub Pages, Netlify, or Chromatic) as a live demo
- [ ] **Review all 26 stories** for proprietary data or internal references
- [ ] **Add stories for undocumented components** — ensure every public component has at least one story

---

## 8. Versioning & Changelog

- [ ] **Decide on versioning strategy** — currently at `1.1.0` but `CHANGELOG.md` references `v0.39.0`. Align these
- [ ] **Clean up `CHANGELOG.md`** — ensure it reads well for external consumers (remove internal references)
- [ ] **Consider adopting conventional commits** — `standard-version` is already a devDependency

---

---

# Technical Debt & Code Quality

Critical assessment of technical issues that should be addressed for a healthy OSS project.

---

## CRITICAL

### 1. Excessive `any` Types — 267 occurrences

The codebase has 267 instances of `: any` and 10 instances of `as any`, defeating TypeScript's type safety.

**Worst offenders:**

| File | Count |
|------|-------|
| `src/components/bn-chart-time/utils/TimeChart.ts` | 40 |
| `src/components/bn-table/utils/helper/DataQuery.ts` | 36 |
| `src/components/bn-chart-structure/utils/StructureChart.ts` | 24 |

**Recommendation:** Define proper interfaces for data structures, especially `DataRow`, query results, and chart configuration objects. Start with `DataQuery.ts` since it processes all table data.

### 2. No Linting or Formatting Configuration

There is no ESLint, Prettier, or any code formatting tool configured. This leads to:
- Inconsistent code style across files
- Mixed equality operators (`==` vs `===` — 20+ instances of loose equality)
- No automated quality gates on PRs

**Recommendation:** Add ESLint with `@stencil-community/eslint-plugin`, Prettier, and a pre-commit hook via `husky` + `lint-staged`.

### 3. Low Test Coverage — 14 test files for 175 source files (8%)

Only 14 `.spec.ts/.spec.tsx` files exist. Major components lack tests:
- `bn-chart-time` — no component spec tests
- `bn-chart-structure` — no component spec tests
- `bn-dataset` — no tests
- `bn-datasource` — no tests
- All layout/utility components — no tests

**Covered:**
- `bn-table` — good coverage (~4000 line spec file)
- `bn-title` — basic coverage
- `bn-tree` — basic coverage
- Core utils (`formatter`, `validate`, `DateStringFactory`, `dataAnalyzer`) — covered

**Recommendation:** Add tests for data-flow components (`bn-dataset`, `bn-datasource`) first since they are the foundation. Then add chart component tests.

---

## HIGH

### 4. `console.log` in Production Code — 23 occurrences

Debug logging left in production code across 13 files, including:
- `TimeChart.ts` (4), `DateStringFactory.ts` (6), `componentRegister.ts` (3), `DataQuery.ts` (1)

**Recommendation:** Remove all `console.log` statements. If runtime logging is needed, implement a configurable logger utility with log levels.

### 5. Large Files Lacking Decomposition

Several files are excessively large and handle too many responsibilities:

| File | Lines |
|------|-------|
| `TimeChart.ts` | 1,136 |
| `bn-table.tsx` | 896 |
| `bn-chart-time.tsx` | 892 |
| `DataQuery.ts` | 757 |
| `StructureChart.ts` | 727 |

**Recommendation:** Extract rendering logic, data transformation, and configuration handling into separate modules. The chart utilities especially should be broken into focused classes (axis rendering, series rendering, label management, etc.).

### 6. 53 `@ts-ignore` Suppressions

Many `@ts-ignore` comments suppress genuine type errors. While some are justified by the mixin pattern (decorating classes at runtime), others hide real issues.

**Recommendation:** Address mixin typing properly with TypeScript declaration merging or typed mixin patterns. Remove unjustified suppressions.

### 7. TypeScript Strict Mode Not Enabled

`tsconfig.json` does not enable `strict: true`. Missing flags:
- `noImplicitAny`
- `strictNullChecks`
- `strictFunctionTypes`
- `strictPropertyInitialization`

**Recommendation:** Enable `strict: true` incrementally. Start with `noImplicitAny` (which will surface the 267 `any` issues) and `strictNullChecks`.

---

## MEDIUM

### 8. Unresolved TODOs — 24 items

24 TODO/FIXME comments scattered across the codebase, many tagged with developer initials (JHE, Sven) rather than issue tracker references. Notable:
- `"TODO: maybte elm.closets is the better choice!?!?"` — `src/utils/templateId.ts`
- `"FIXME: JHE: kein custom support in Luxon"` — `src/utils/DateStringFactory.ts`
- `"TODO: will not work with IE11"` — `src/components/bn-layout-card/bn-layout-card.tsx`
- `"TODO do we to clear su subscription?"` — `src/utils/styled/withStyled.ts`

**Recommendation:** Convert each TODO to a GitHub Issue and replace inline comments with issue references. Drop IE11 concerns (IE11 is EOL).

### 9. Magic Numbers

Chart and table utilities contain numerous unexplained numeric literals:
- `intervalSpanLimit: 32`, `maxBars: 28` in `TimeChart.ts`
- Hardcoded colors (`'#999999'`), padding values, scale multipliers

**Recommendation:** Extract to named constants with documenting comments explaining the rationale.

### 10. Inconsistent Error Handling

- `DataQuery.ts` catches SQL errors but only `console.log`s them
- `bn-component-style.tsx` catches JSON parse errors silently
- No consistent error propagation pattern

**Recommendation:** Define an error handling strategy: use the existing `withHasError` mixin consistently, and emit error events that consumers can handle.

### 11. Mixin Pattern Complexity

The decorator-style mixin pattern (`withDataset`, `withDatasource`, `withTranslation`, etc.) works but:
- Requires `@ts-ignore` in every consuming component
- Makes it hard to understand what properties/methods a component actually has
- Not well documented

**Recommendation:** Document the mixin pattern thoroughly. Consider TypeScript declaration merging to provide proper types. Add a "how mixins work" section to contributor docs.

### 12. `@types/lodash` in `dependencies` Instead of `devDependencies`

Type definition packages should be in `devDependencies` since they're only needed at compile time.

---

## LOW

### 13. Deprecated Patterns

- `instanceof Array` used instead of `Array.isArray()` (6 instances in `validate.ts`)
- IE11 compatibility comments still present (IE11 reached EOL in June 2022)

### 14. Missing `key` Props in JSX Lists

Some `render()` methods map over arrays without providing `key` attributes, which can cause rendering issues.

### 15. Arrow Functions in `render()` JSX

Several components create new arrow functions inside `render()` JSX (e.g. `onClick={() => this.handleClick()}`), which creates new function instances on every render cycle.

### 16. Storybook Default Content

The Storybook setup still contains default example stories (Button, Header, Page) from the Storybook template. These should be replaced with actual component stories.

---

## Prioritized Action Plan

### Phase 1 — Blockers for OSS Release
1. ~~Remove secrets from `sonar-project.properties`~~ — DONE (SonarQube removed entirely)
2. Remove personal information from test data
3. Rewrite `README.md` in English
4. ~~Update `LICENSE` with copyright holder~~ — DONE (Apache 2.0, Bino Bi)
5. Create `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
6. Clean up CI workflows for public distribution
7. Remove unused `xlsx` dependency
8. Run `git filter-branch` or `git-filter-repo` if secrets exist in git history

### Phase 2 — Quality Baseline
1. Add ESLint + Prettier configuration
2. Remove all `console.log` from production code
3. Translate remaining German content to English
4. Convert TODOs to GitHub Issues
5. Clean up repo (backup files, build artifacts, IDE configs)

### Phase 3 — Technical Improvements
1. Enable TypeScript strict mode (incremental)
2. Reduce `any` usage (start with data layer)
3. Add tests for untested core components
4. Refactor large files (>800 lines)
5. Document mixin pattern and architecture
6. Deploy public Storybook demo
