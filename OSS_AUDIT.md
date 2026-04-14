# Open Source Readiness Audit

**Date:** 2026-03-05
**Scope:** Full codebase review against OSS_CODEX.md and OSS_TODO.md benchmarks

---

## Executive Summary

The project has made **significant progress** since the initial OSS review (2026-02-17). Many critical blockers have been resolved. The codebase is approaching OSS-ready state, with a handful of remaining items before public launch.

### Scorecard

| Area | Status | Score |
|------|--------|-------|
| Secrets & credentials | Resolved | 10/10 |
| License | Apache 2.0 with copyright holder | 10/10 |
| README & docs | Good (English, comprehensive) | 9/10 |
| CI/CD (public) | Ready (publish.yaml) | 8/10 |
| Linting & formatting | Configured + CI enforced | 9/10 |
| Governance files | Missing CONTRIBUTING, CODE_OF_CONDUCT, SECURITY | 3/10 |
| Issue/PR templates | Missing | 0/10 |
| Personal data in code | Still present in tests | 4/10 |
| Dependencies | Clean, all used, no vulns in prod | 9/10 |
| Type safety | Improved but still has debt | 5/10 |
| Test coverage | Low (14 spec files / 157 source files) | 4/10 |

**Overall: ~70% ready.** The remaining 30% is mostly governance docs and test data cleanup.

---

## RESOLVED Since Last Audit

These items from OSS_CODEX.md / OSS_TODO.md are now complete:

- [x] SonarQube removed entirely (token, config, devDependency)
- [x] Private `@bino-bi/ibcs-component` imports removed from all src/ files
- [x] `src/index.ts` is clean — no private package imports
- [x] README.md rewritten in English with install, quick start, architecture, component table
- [x] `package.json` description updated (now: "IBCS-compliant web components for business intelligence tables and charts")
- [x] ESLint + Prettier configured with CI enforcement (`ci.yaml` runs `lint` + `format:check`)
- [x] Husky + lint-staged pre-commit hook active
- [x] `xlsx` dependency removed (not in package.json, not imported)
- [x] `lodash` removed entirely, replaced with native code
- [x] `@types/lodash` removed from dependencies
- [x] `src/test-runner/` directory removed
- [x] `src/examples/` directory removed
- [x] `.bak` files removed
- [x] `todo.md` removed from root
- [x] `publish.yaml` workflow created for public npm (`registry.npmjs.org`, `--access public`)
- [x] `doc/` directory has 4 concept guides (data-model, installation, internationalization, theming)
- [x] `console.log` reduced to 1 occurrence (was 23)
- [x] TODO/FIXME comments removed from source (was 24+)
- [x] `leaflet-gpx` / map component removed entirely

---

## REMAINING: Must Fix Before Public Release

### 1. Governance Files (Priority: CRITICAL)

These are expected in every public OSS project. Their absence signals "not ready for contributors."

| File | Status | Action |
|------|--------|--------|
| `CONTRIBUTING.md` | Missing | Create: dev setup, coding standards, PR process, commit conventions |
| `CODE_OF_CONDUCT.md` | Missing | Adopt Contributor Covenant v2.1 |
| `SECURITY.md` | Missing | Create: vulnerability reporting process, supported versions |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Missing | Create: reproduction steps, environment, expected/actual |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Missing | Create: use case, proposed solution |
| `.github/PULL_REQUEST_TEMPLATE.md` | Missing | Create: description, testing, checklist |

### 2. Personal Data in Test Files (Priority: CRITICAL)

Personal family names appear **15+ times** in test snapshots:

| File | Occurrences | Content |
|------|-------------|---------|
| `src/components/bn-table/ibcs-table.spec.tsx` | ~15 | `"Sven ist der Papa von Phineas und Max"` |
| `src/components/bn-title/ibcs-title/ibcs-title.tsx` | 1 | Commented code with `"Sven"` |

**Action:** Replace with generic English placeholder (e.g. `"Sample Table Title"`). — RESOLVED (spec string replaced globally; `ibcs-title.tsx` dev-console comment block deleted).

### 3. LICENSE Copyright Holder (Priority: HIGH) — RESOLVED

LICENSE now uses Apache License 2.0 with `Copyright 2018-2026 Bino Bi`. `package.json` `license` field updated to `Apache-2.0`; README badge and CONTRIBUTING reference updated accordingly.

### 4. Developer Initials in Comments (Priority: MEDIUM)

| File | Line | Content |
|------|------|---------|
| `src/components/bn-chart-time/utils/elements/Column.ts` | 116 | `// TODE: JHE: Remove DataFOrmatDigits Type Duplicates` |
| `src/components/bn-chart-time/utils/elements/Line.ts` | 121 | `// TODE: JHE: Remove DataFOrmatDigits Type Duplicates` |

**Action:** Remove or convert to GitHub Issues.

### 5. Private Release Workflow (Priority: MEDIUM)

`release.yaml` publishes to:
- Private GitHub Packages registry (`npm.pkg.github.com`, `@bino-bi` scope)
- Private releases repo (`bino-bi/bn-template-engine-releases`)

**Action:** Either remove `release.yaml` (public npm via `publish.yaml` is sufficient) or keep it intentionally for internal parallel distribution. If kept, add a comment explaining its purpose.

### 6. Version Misalignment (Priority: MEDIUM)

- `package.json`: `1.2.2`
- `CHANGELOG.md`: latest entry is `v0.39.0`

**Action:** Decide on versioning strategy and align. If the 1.x version is intentional (post-OSS relaunch), update CHANGELOG to reflect the 1.x series.

### 7. Stencil Doc Footer Branding (Priority: LOW)

`stencil.config.ts` line 23: `footer: 'developed by Bino Bi'`

This appears in auto-generated component README files. Not a blocker but worth reviewing.

**Action:** Keep, update, or remove based on desired attribution.

---

## REMAINING: Should Fix (Quality Improvements)

### 8. German Strings in Test Data

| File | Content |
|------|---------|
| `src/utils/validate.spec.ts` | `"Geschäftsfeld"`, `"Umsatz"` in test assertions |
| `src/utils/validate.spec.ts` | `"http://localhost:3333/build/assets/gpx/Fahrt_am_Nachmittag.gpx"` |
| `src/stores/internationalization.ts` | `"davon"`, `"in % von"` (these are i18n translations — acceptable) |

**Action:** Replace German test data with English equivalents. The i18n store translations are fine.

### 9. `.agents/` Directory

Contains Claude Code skill files. Not harmful but not relevant to the OSS project.

**Action:** Add `.agents/` to `.gitignore` and remove from tracking.

### 10. `--provenance` Flag in publish.yaml

Line 53: `# --provenance add when public`

npm provenance adds supply-chain transparency via Sigstore. Now that the project is going public, enable it.

**Action:** Change to `npm publish --provenance --tag ... --access public`.

### 11. Unused `scopedEval()` Method

`src/components/bn-title/bn-title.tsx` has an unused `scopedEval()` method using `new Function()`.

**Action:** Remove dead code.

---

## Metrics Snapshot (2026-03-05)

| Metric | Previous (Feb 17) | Current | Trend |
|--------|-------------------|---------|-------|
| `: any` usages | 267 | 46 | Improved significantly |
| `as any` usages | ~30 | 13 | Improved |
| `@ts-ignore` | 95 | 78 | Improved |
| `console.log` (non-test) | 23 | 1 | Nearly eliminated |
| TODO/FIXME comments | 27 | 0 | Eliminated |
| Spec files | 14 | 14 | No change |
| Source files | ~175 | 157 | Reduced (cleanup) |
| Production vulns | 2 | 0 | Resolved |
| Dev vulns | — | 1 (immutable.js, fixable) | — |
| Files >500 lines | — | 13 | — |
| Loose equality (`==`) | ~20 | ~505 patterns* | — |

*Loose equality count includes valid `==` comparisons in chart code; actual problematic `==` vs `===` needs case-by-case review.

---

## Checklist: Path to Public Release

### Phase 0 — Launch Blockers (do before going public)

- [ ] Create `CONTRIBUTING.md`
- [ ] Create `CODE_OF_CONDUCT.md`
- [ ] Create `SECURITY.md`
- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md`
- [x] ~~Replace personal names in `ibcs-table.spec.tsx` (~15 occurrences)~~ — DONE (replaced with `"Sample Table Title"`)
- [x] ~~Remove `"Sven"` comment in `ibcs-title.tsx`~~ — DONE (dev-console comment block deleted)
- [x] ~~Add copyright holder to `LICENSE`~~ — DONE (relicensed MIT → Apache-2.0, holder: Bino Bi)
- [ ] Decide: remove or keep `release.yaml` (private releases workflow)
- [ ] Align version between `package.json` and `CHANGELOG.md`

### Phase 1 — Quality Polish (first month after launch)

- [ ] Remove developer initials from comments (Column.ts, Line.ts)
- [ ] Translate German test data to English (validate.spec.ts)
- [ ] Add `.agents/` to `.gitignore`
- [ ] Enable `--provenance` in publish.yaml
- [ ] Remove unused `scopedEval()` from bn-title.tsx
- [ ] Fix 1 remaining `console.log` in componentRegister.ts
- [ ] Run `npm audit fix` to resolve immutable.js dev vulnerability

### Phase 2 — Ongoing Improvement

- [ ] Increase test coverage (14 spec files for 157 source files = 9%)
- [ ] Continue reducing `@ts-ignore` count (78 remaining)
- [ ] Enable TypeScript strict mode incrementally
- [ ] Refactor files >1000 lines (TimeChart.ts, StructureChart.ts, bn-table.tsx, bn-chart-time.tsx)
- [ ] Review loose equality patterns in chart utilities
- [ ] Add Storybook or live demo deployment
- [ ] Document mixin pattern for contributors
