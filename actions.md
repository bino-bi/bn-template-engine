# 10-Point Action Plan for BN-Template-Engine Improvement

## Overview

This action plan addresses the critical issues identified in the code quality review and provides a roadmap to transform bn-template-engine into a maintainable, secure, and extensible visualization component library.

**Estimated Total Effort**: 6-8 developer-weeks
**Priority Scale**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)

---

## Action 1: Fix Critical Security Vulnerabilities

**Priority**: P0 - Critical
**Effort**: 3-4 days
**Risk if Ignored**: Data breach, XSS attacks, compliance violations

### Problem Statement

The library contains multiple XSS vulnerabilities through unsafe `innerHTML` usage and dynamic code execution via `scopedEval`. These are exploitable attack vectors that could allow malicious script injection.

### Affected Files

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/bn-chart-structure/ibcs-chart-structure.tsx` | 45-46 | innerHTML without sanitization |
| `src/components/bn-chart-time/ibcs-chart-time.tsx` | 51-52 | innerHTML without sanitization |
| `src/components/bn-text/bn-text.tsx` | 78 | innerHTML + scopedEval |
| `src/utils/withTranslation.ts` | 57 | lodash template injection |

### Detailed Recommendations

#### 1.1 Install DOMPurify for HTML Sanitization

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

#### 1.2 Create Centralized Sanitization Utility

```typescript
// src/utils/security/sanitizer.ts
import DOMPurify from 'dompurify';

export interface SanitizeOptions {
  allowSvg?: boolean;
  allowMathMl?: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  allowSvg: true,  // Required for chart rendering
  allowMathMl: false,
  allowedTags: ['svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'tspan', 'defs', 'pattern', 'use'],
  allowedAttributes: ['class', 'id', 'd', 'fill', 'stroke', 'transform', 'x', 'y', 'width', 'height']
};

export function sanitizeHtml(dirty: string, options: SanitizeOptions = {}): string {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const purifyConfig: DOMPurify.Config = {
    USE_PROFILES: { svg: config.allowSvg, mathMl: config.allowMathMl },
    ALLOWED_TAGS: config.allowedTags,
    ALLOWED_ATTR: config.allowedAttributes,
    KEEP_CONTENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  };

  return DOMPurify.sanitize(dirty, purifyConfig);
}

export function sanitizeSvg(svgString: string): string {
  return sanitizeHtml(svgString, { allowSvg: true });
}
```

#### 1.3 Refactor innerHTML Usage

```typescript
// BEFORE (src/components/bn-chart-time/ibcs-chart-time.tsx:51-52)
<div innerHTML={this.pattern?.toString()} class="hidePatternContainer" />
<div innerHTML={this.chart?.toString()}></div>

// AFTER
import { sanitizeSvg } from '../../utils/security/sanitizer';

<div innerHTML={sanitizeSvg(this.pattern?.toString() || '')} class="hidePatternContainer" />
<div innerHTML={sanitizeSvg(this.chart?.toString() || '')}></div>
```

#### 1.4 Remove or Sandbox scopedEval

```typescript
// REMOVE this dangerous pattern from src/components/bn-text/bn-text.tsx
// scopedEval(scope: any, script: string): string {
//   return Function(`"use strict"; ...`)...

// REPLACE with safe template interpolation
import { template } from 'lodash';

private safeInterpolate(templateStr: string, data: Record<string, unknown>): string {
  // Only allow simple variable substitution, no code execution
  const safeTemplate = template(templateStr, {
    interpolate: /\{\{([\w.]+)\}\}/g,  // Only word characters and dots
    evaluate: null,  // Disable code execution
    escape: /\{\{\{([\w.]+)\}\}\}/g   // HTML-escape with triple braces
  });
  return safeTemplate(data);
}
```

#### 1.5 Add Security Tests

```typescript
// src/utils/security/__tests__/sanitizer.spec.ts
describe('sanitizeHtml', () => {
  it('should remove script tags', () => {
    const input = '<div><script>alert("xss")</script>Hello</div>';
    expect(sanitizeHtml(input)).toBe('<div>Hello</div>');
  });

  it('should remove event handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(input)).toBe('<img src="x">');
  });

  it('should preserve safe SVG elements', () => {
    const input = '<svg><rect width="100" height="100"/></svg>';
    expect(sanitizeSvg(input)).toContain('rect');
  });
});
```

### Success Criteria

- [ ] All innerHTML usages wrapped with sanitization
- [ ] scopedEval removed or replaced with safe alternative
- [ ] Security test suite passing
- [ ] Manual XSS penetration testing passed
- [ ] No SAST tool findings for injection vulnerabilities

---

## Action 2: Establish Comprehensive Testing Infrastructure

**Priority**: P0 - Critical
**Effort**: 5-7 days
**Risk if Ignored**: Regressions, silent failures, unstable releases

### Problem Statement

Current test coverage is approximately 11%, with two major chart systems (bn-chart-structure, bn-chart-time) having 0% coverage. Component tests are disabled due to ESM module configuration issues.

### Current Test Statistics

| Area | Files | Tests | Coverage |
|------|-------|-------|----------|
| Utilities | 44 | 6 | 14% |
| Components | 33 | 4 | 12% |
| Critical Chart Systems | 46 | 0 | 0% |

### Detailed Recommendations

#### 2.1 Fix Jest ESM Configuration

```javascript
// jest.config.js
module.exports = {
  preset: '@stencil/core/testing',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^nanoid$': '<rootDir>/node_modules/nanoid/index.cjs',
    '^nanoid/(.*)$': '<rootDir>/node_modules/nanoid/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|@svgdotjs|lodash-es)/)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
```

#### 2.2 Create Test Utilities Library

```typescript
// src/test-utils/component-helpers.ts
import { newSpecPage, SpecPage } from '@stencil/core/testing';

export async function renderComponent<T>(
  component: any,
  html: string
): Promise<{ page: SpecPage; instance: T }> {
  const page = await newSpecPage({
    components: [component],
    html
  });
  return {
    page,
    instance: page.rootInstance as T
  };
}

export function mockDataset(name: string, data: any[]) {
  return {
    name,
    data,
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  };
}

export function mockComponentStyle(overrides: Partial<Style> = {}) {
  return {
    global: { scaleFactor: 1 },
    'bn-chart-time': { /* defaults */ },
    ...overrides
  };
}
```

#### 2.3 Prioritized Test Implementation Plan

**Phase 1 - Critical (Week 1)**:
```
1. src/components/bn-chart-time/utils/TimeChart.spec.ts
2. src/components/bn-chart-structure/utils/StructureChart.spec.ts
3. src/utils/security/sanitizer.spec.ts
4. Re-enable src/components/bn-chart-tree/test/bn-chart-tree.spec.tsx
```

**Phase 2 - High Priority (Week 2)**:
```
5. src/utils/withDataset.spec.ts
6. src/utils/withComponentStyle.spec.ts
7. src/stores/componentStyles.spec.ts
8. src/components/bn-table/bn-table.spec.tsx
```

**Phase 3 - Medium Priority (Week 3)**:
```
9. HOC unit tests (withTranslation, withHasError, etc.)
10. Integration tests for component + store interaction
11. E2E tests for critical user flows
```

#### 2.4 Component Test Template

```typescript
// src/components/bn-chart-time/test/bn-chart-time.spec.tsx
import { newSpecPage } from '@stencil/core/testing';
import { BnChartTime } from '../bn-chart-time';
import { mockDataset, mockComponentStyle } from '../../../test-utils/component-helpers';

describe('bn-chart-time', () => {
  describe('Rendering', () => {
    it('should render with minimum required props', async () => {
      const page = await newSpecPage({
        components: [BnChartTime],
        html: `<bn-chart-time scenarios="ac"></bn-chart-time>`
      });
      expect(page.root).toEqualHtml(`
        <bn-chart-time scenarios="ac">
          <mock:shadow-root>
            <!-- expected output -->
          </mock:shadow-root>
        </bn-chart-time>
      `);
    });
  });

  describe('Validation', () => {
    it('should emit error for invalid scenario', async () => {
      const page = await newSpecPage({
        components: [BnChartTime],
        html: `<bn-chart-time scenarios="invalid"></bn-chart-time>`
      });
      const errors = page.rootInstance.errors.list();
      expect(errors).toContainEqual(
        expect.objectContaining({ id: 'ERR_scenario' })
      );
    });
  });

  describe('Data Processing', () => {
    it('should handle empty dataset gracefully', async () => {
      const page = await newSpecPage({
        components: [BnChartTime],
        html: `<bn-chart-time scenarios="ac" data="[]"></bn-chart-time>`
      });
      expect(page.rootInstance.chart).toBeDefined();
    });
  });
});
```

#### 2.5 Add Pre-commit Test Hook

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:staged"
    }
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "jest --bail --findRelatedTests"
    ]
  }
}
```

### Success Criteria

- [ ] Jest ESM configuration fixed
- [ ] Test coverage > 60% for all components
- [ ] Test coverage > 80% for utilities
- [ ] CI pipeline enforces coverage thresholds
- [ ] Pre-commit hooks prevent untested code

---

## Action 3: Refactor Large Components (God Objects)

**Priority**: P1 - High
**Effort**: 5-7 days
**Risk if Ignored**: Unmaintainable code, testing difficulties, developer frustration

### Problem Statement

Several components exceed 700 lines with 30+ properties, violating Single Responsibility Principle and making maintenance extremely difficult.

### Affected Components

| Component | Lines | Props | Validators | Complexity |
|-----------|-------|-------|------------|------------|
| bn-chart-time.tsx | 880 | 34 | 14 | Very High |
| bn-table.tsx | 771 | 28 | 11 | Very High |
| bn-chart-structure.tsx | 623 | 26 | 10 | High |

### Detailed Recommendations

#### 3.1 Extract Validation Layer

```typescript
// src/components/bn-chart-time/validation/TimeChartValidator.ts
import { ErrorItem } from '../../../utils/withHasError';
import { validateScenarioList, validateVariancesList } from '../../../utils/validate';

export interface ValidationResult {
  isValid: boolean;
  errors: ErrorItem[];
  warnings: ErrorItem[];
}

export class TimeChartValidator {
  constructor(
    private readonly addError: (error: ErrorItem) => void,
    private readonly removeError: (id: string) => void
  ) {}

  validateScenarios(value: string): string[] {
    const errId = 'ERR_scenario';
    const invalidScenarios = validateScenarioList(value);

    if (invalidScenarios.length > 0) {
      this.addError({
        id: errId,
        type: 'warning',
        message: `scenarios: Invalid values '${JSON.stringify(invalidScenarios)}'. ` +
                 `Valid options: ac, ac1, ac2, fc, pp, py, bud, bud1, bud2.`
      });
      return invalidScenarios;
    }

    this.removeError(errId);
    return [];
  }

  validateVariances(value: string): string[] {
    const errId = 'ERR_variances';
    const invalidVariances = validateVariancesList(value);

    if (invalidVariances.length > 0) {
      this.addError({
        id: errId,
        type: 'error',
        message: `variances: Invalid values '${JSON.stringify(invalidVariances)}'. ` +
                 `Valid format: 'ac%pp', 'fc%py', 'deltaAC%FC'.`
      });
      return invalidVariances;
    }

    this.removeError(errId);
    return [];
  }

  // Additional validators...
}
```

#### 3.2 Extract Data Processing Layer

```typescript
// src/components/bn-chart-time/processing/TimeChartProcessor.ts
import { DataFormatDigits } from '../../../utils/model/DataFormatDigits';
import { DateDistance } from '../../../utils/constants';

export interface ProcessedTimeChartData {
  scenarios: string[];
  variances: string[];
  dateRange: { start: Date; end: Date };
  aggregatedData: Map<string, number[]>;
}

export class TimeChartProcessor {
  prepareScenarios(scenariosString: string): string[] {
    if (!scenariosString?.trim()) {
      return [];
    }
    return scenariosString
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  prepareVariances(variancesString: string): string[] {
    if (!variancesString?.trim()) {
      return [];
    }
    return variancesString
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  calculateDateInterval(interval: string): DateDistance {
    const normalized = interval?.toUpperCase();
    if (normalized && normalized in DateDistance) {
      return DateDistance[normalized as keyof typeof DateDistance];
    }
    console.warn(`Invalid date interval: ${interval}, defaulting to AUTO`);
    return DateDistance.AUTO;
  }

  aggregateByInterval(
    data: any[],
    interval: DateDistance,
    scenarios: string[]
  ): ProcessedTimeChartData {
    // Data aggregation logic
  }
}
```

#### 3.3 Refactored Component Structure

```typescript
// src/components/bn-chart-time/bn-chart-time.tsx (Refactored - ~200 lines)
import { Component, Prop, Watch, State, h } from '@stencil/core';
import { TimeChartValidator } from './validation/TimeChartValidator';
import { TimeChartProcessor } from './processing/TimeChartProcessor';
import { TimeChartRenderer } from './rendering/TimeChartRenderer';
import { withDataset, withComponentStyle, withTranslation } from '../../utils';

@Component({
  tag: 'bn-chart-time',
  styleUrl: 'bn-chart-time.scss',
  shadow: true
})
export class BnChartTime {
  // Props grouped by concern
  // --- Data Props ---
  @Prop() scenarios: string = '';
  @Prop() variances: string = '';
  @Prop() dataset: string = '';

  // --- Appearance Props ---
  @Prop() chartWidth: number = 400;
  @Prop() chartHeight: number = 300;
  @Prop() theme: string = '_default';

  // --- Behavior Props ---
  @Prop() dateInterval: string = 'AUTO';
  @Prop() maxBars: number = 28;

  // Internal State
  @State() private processedData: ProcessedTimeChartData | null = null;

  // Dependencies (injected via constructor)
  private validator: TimeChartValidator;
  private processor: TimeChartProcessor;
  private renderer: TimeChartRenderer;

  constructor() {
    const errors = withHasError(this);
    this.validator = new TimeChartValidator(errors.addOrReplace, errors.remove);
    this.processor = new TimeChartProcessor();
    this.renderer = new TimeChartRenderer();

    withDataset(this, this.onDataUpdate.bind(this));
    withComponentStyle(this);
    withTranslation(this);
  }

  // Watchers delegate to validator
  @Watch('scenarios')
  watchScenarios(newValue: string) {
    this.validator.validateScenarios(newValue);
    this.updateChart();
  }

  // Lifecycle hooks
  componentWillLoad() {
    this.validator.validateAll(this);
    this.processedData = this.processor.process(this.rawData, this.scenarios);
  }

  private onDataUpdate(name: string, data: any) {
    if (name === this.dataset) {
      this.processedData = this.processor.process(data, this.scenarios);
    }
  }

  render() {
    return this.renderer.render(this.processedData, this.componentStyle);
  }
}
```

#### 3.4 File Structure After Refactor

```
bn-chart-time/
├── bn-chart-time.tsx              # Main component (200 lines)
├── bn-chart-time.scss             # Styles
├── validation/
│   ├── TimeChartValidator.ts      # All validation (150 lines)
│   └── TimeChartValidator.spec.ts # Validation tests
├── processing/
│   ├── TimeChartProcessor.ts      # Data processing (200 lines)
│   └── TimeChartProcessor.spec.ts # Processing tests
├── rendering/
│   ├── TimeChartRenderer.tsx      # SVG rendering (200 lines)
│   └── ibcs-chart-time.tsx        # IBCS variant
├── types/
│   ├── props.interface.ts         # Prop type definitions
│   └── data.interface.ts          # Data structure types
└── test/
    ├── bn-chart-time.spec.tsx     # Integration tests
    └── bn-chart-time.e2e.ts       # E2E tests
```

### Success Criteria

- [ ] No component file exceeds 300 lines
- [ ] Each file has single responsibility
- [ ] Validation logic reusable across components
- [ ] Test coverage > 80% for extracted modules
- [ ] No functionality regression

---

## Action 4: Eliminate Code Duplication

**Priority**: P1 - High
**Effort**: 3-4 days
**Risk if Ignored**: Bug fixes needed in multiple places, inconsistent behavior

### Problem Statement

15+ methods are duplicated across chart components, including scenario validation, data preparation, and formatting logic.

### Duplicated Code Analysis

| Method | Occurrences | Lines Duplicated |
|--------|-------------|------------------|
| prepareScenarios() | 4 | 24 |
| prepareVariances() | 4 | 20 |
| validateScenarioList() | 4 | 32 |
| prepareI18n() | 3 | 18 |
| prepareDateInterval() | 2 | 12 |

### Detailed Recommendations

#### 4.1 Create Shared Chart Utilities

```typescript
// src/core/chart/ChartDataHelpers.ts
import { isBlankInput } from '../../utils/validate';
import { Scenarios, Variances, DateDistance } from '../../utils/constants';

export class ChartDataHelpers {
  /**
   * Parse comma-separated scenario string into validated array
   */
  static parseScenarios(scenariosString: string | null | undefined): string[] {
    if (isBlankInput(scenariosString)) {
      return [];
    }
    return scenariosString!
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s in Scenarios);
  }

  /**
   * Parse comma-separated variance string into validated array
   */
  static parseVariances(variancesString: string | null | undefined): string[] {
    if (isBlankInput(variancesString)) {
      return [];
    }
    return variancesString!
      .split(',')
      .map(v => v.trim())
      .filter(v => this.isValidVariance(v));
  }

  /**
   * Parse date interval with fallback
   */
  static parseDateInterval(interval: string | null | undefined): DateDistance {
    const normalized = interval?.toUpperCase();
    if (normalized && normalized in DateDistance) {
      return DateDistance[normalized as keyof typeof DateDistance];
    }
    return DateDistance.AUTO;
  }

  /**
   * Validate variance format (e.g., "ac%pp", "deltaAC%FC")
   */
  private static isValidVariance(variance: string): boolean {
    const variancePattern = /^(delta)?[a-z0-9]+%[a-z0-9]+$/i;
    return variancePattern.test(variance);
  }
}
```

#### 4.2 Create Base Chart Validator

```typescript
// src/core/chart/BaseChartValidator.ts
import { ErrorManager } from '../../utils/withHasError';
import { validateScenarioList, validateVariancesList, validateOrderList } from '../../utils/validate';

export interface ValidationConfig {
  scenariosRequired?: boolean;
  variancesRequired?: boolean;
  ordersRequired?: boolean;
}

export abstract class BaseChartValidator {
  constructor(
    protected readonly errors: ErrorManager,
    protected readonly config: ValidationConfig = {}
  ) {}

  validateScenarios(value: string): boolean {
    const errId = 'ERR_scenario';
    const invalid = validateScenarioList(value);

    if (invalid.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: this.formatScenarioError(invalid)
      });
      return false;
    }

    this.errors.remove(errId);
    return true;
  }

  validateVariances(value: string): boolean {
    const errId = 'ERR_variances';
    const invalid = validateVariancesList(value);

    if (invalid.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'error',
        message: this.formatVarianceError(invalid)
      });
      return false;
    }

    this.errors.remove(errId);
    return true;
  }

  validateOrders(value: string): boolean {
    const errId = 'ERR_orders';
    const invalid = validateOrderList(value);

    if (invalid.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'error',
        message: this.formatOrderError(invalid)
      });
      return false;
    }

    this.errors.remove(errId);
    return true;
  }

  protected formatScenarioError(invalid: string[]): string {
    return `scenarios: Invalid values ${JSON.stringify(invalid)}. ` +
           `Valid: ac, ac1, ac2, fc, pp, py, bud, bud1, bud2.`;
  }

  protected formatVarianceError(invalid: string[]): string {
    return `variances: Invalid values ${JSON.stringify(invalid)}. ` +
           `Format: 'scenario1%scenario2' (e.g., 'ac%pp').`;
  }

  protected formatOrderError(invalid: string[]): string {
    return `orders: Invalid values ${JSON.stringify(invalid)}. ` +
           `Valid: asc, desc, none.`;
  }
}
```

#### 4.3 Create Shared Null/Empty Checker

```typescript
// src/core/utils/type-guards.ts
/**
 * Check if value is null, undefined, empty string, or whitespace-only
 */
export function isEmpty(value: unknown): value is null | undefined | '' {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid number (not NaN, not Infinity)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
```

#### 4.4 Refactor Components to Use Shared Code

```typescript
// BEFORE (bn-chart-time.tsx)
private prepareScenarios(): string[] {
  if (isBlankInput(this.scenarios)) {
    return [];
  }
  return this.scenarios?.split(",").map(entry => entry.trim());
}

// AFTER (bn-chart-time.tsx)
import { ChartDataHelpers } from '../../core/chart/ChartDataHelpers';

private prepareScenarios(): string[] {
  return ChartDataHelpers.parseScenarios(this.scenarios);
}
```

### Success Criteria

- [ ] Zero duplicated validation logic across components
- [ ] Shared utilities have 100% test coverage
- [ ] All chart components use BaseChartValidator
- [ ] Consistent error messages across components

---

## Action 5: Improve Type Safety

**Priority**: P1 - High
**Effort**: 3-4 days
**Risk if Ignored**: Runtime errors, debugging difficulty, developer confusion

### Problem Statement

The codebase contains 47+ instances of explicit `any` type, defeating TypeScript's type checking benefits and allowing type-related bugs to slip through.

### Affected Areas

| Area | `any` Count | Impact |
|------|-------------|--------|
| HOC Functions | 12 | High - Core functionality |
| Component Methods | 18 | High - API surface |
| Utility Functions | 9 | Medium |
| Store Definitions | 8 | Medium |

### Detailed Recommendations

#### 5.1 Define Component Interface

```typescript
// src/core/types/StencilComponent.interface.ts
import { EventEmitter } from '@stencil/core';

export interface StencilComponentBase {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  componentWillLoad?(): void | Promise<void>;
  componentDidLoad?(): void;
  componentWillRender?(): void | Promise<void>;
  componentDidRender?(): void;
  componentWillUpdate?(): void | Promise<void>;
  componentDidUpdate?(): void;
}

export interface DatasetConsumer extends StencilComponentBase {
  dataset?: string;
  onDatasetUpdate?(name: string, data: unknown[]): void;
}

export interface StyleConsumer extends StencilComponentBase {
  theme?: string;
}

export interface TranslationConsumer extends StencilComponentBase {
  locale?: string;
  namespace?: string;
}

export interface ChartComponent extends DatasetConsumer, StyleConsumer, TranslationConsumer {
  scenarios?: string;
  variances?: string;
  chartWidth?: number;
  chartHeight?: number;
}
```

#### 5.2 Refactor HOC with Proper Types

```typescript
// BEFORE (src/utils/withComponentStyle.ts)
const withComponentStyle = (component: any) => {
  let subscription: () => void;
  let selectedStyle: string;
  let style: Style = state["_system"]
  // ...
}

// AFTER (src/utils/withComponentStyle.ts)
import { StyleConsumer } from '../core/types/StencilComponent.interface';
import { Style, StyleStore } from '../stores/componentStyles';

type StyleSelector<T> = (style: Style) => T;

export function withComponentStyle<C extends StyleConsumer>(
  component: C
): <T>(selector: StyleSelector<T>) => T {
  let subscription: (() => void) | null = null;
  let selectedTheme: string = '_default';
  let computedStyle: Style = StyleStore.get('_system');

  const updateStyle = (): void => {
    computedStyle = mergeStyles(
      StyleStore.get('_system'),
      StyleStore.get('_default'),
      StyleStore.get(selectedTheme)
    );
  };

  const originalConnected = component.connectedCallback?.bind(component);
  component.connectedCallback = function(): void {
    selectedTheme = this.theme || '_default';
    subscription = StyleStore.subscribe(updateStyle);
    updateStyle();
    originalConnected?.();
  };

  const originalDisconnected = component.disconnectedCallback?.bind(component);
  component.disconnectedCallback = function(): void {
    subscription?.();
    subscription = null;
    originalDisconnected?.();
  };

  return function selectStyle<T>(selector: StyleSelector<T>): T {
    return selector(computedStyle);
  };
}
```

#### 5.3 Replace any with Generics

```typescript
// BEFORE (src/components/bn-chart-time/bn-chart-time.tsx:752)
public getDataStructure(): any {
  let dataSetStructure: any = { ... }

// AFTER
export interface TimeChartDataSchema {
  ITimeChartDataRow: {
    setName: FieldDefinition;
    date: FieldDefinition;
    value: FieldDefinition;
    scenario: FieldDefinition;
  };
}

export interface FieldDefinition {
  type: 'string' | 'number' | 'date' | 'boolean';
  isOptional: boolean;
  description: string;
  validValues?: string[];
}

public getDataStructure(): TimeChartDataSchema {
  return {
    ITimeChartDataRow: {
      setName: { type: 'string', isOptional: true, description: 'Data set name' },
      date: { type: 'date', isOptional: false, description: 'Data point date' },
      value: { type: 'number', isOptional: false, description: 'Data value' },
      scenario: {
        type: 'string',
        isOptional: false,
        description: 'Scenario identifier',
        validValues: ['ac', 'fc', 'pp', 'py', 'bud']
      }
    }
  };
}
```

#### 5.4 Add Type Guards for Runtime Validation

```typescript
// src/core/utils/type-guards.ts
import { TreeConfig, TreeEdge, TreeNode } from '../components/bn-chart-tree/types';

export function isTreeConfig(value: unknown): value is TreeConfig {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.edges) &&
    obj.edges.every(isTreeEdge)
  );
}

export function isTreeEdge(value: unknown): value is TreeEdge {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.from === 'string' &&
    typeof obj.to === 'string'
  );
}

// Usage in component
const parsed = JSON.parse(edgesJson);
if (!isTreeConfig(parsed)) {
  throw new TypeError('Invalid tree configuration structure');
}
```

#### 5.5 Enable Strict TypeScript Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Success Criteria

- [ ] Zero explicit `any` types in codebase
- [ ] TypeScript strict mode enabled
- [ ] All public APIs fully typed
- [ ] Type guards for runtime validation
- [ ] No TypeScript errors with strict mode

---

## Action 6: Implement Proper Error Handling

**Priority**: P1 - High
**Effort**: 2-3 days
**Risk if Ignored**: Silent failures, difficult debugging, poor user experience

### Problem Statement

The codebase contains multiple empty catch blocks, inconsistent error logging, and no centralized error handling strategy.

### Identified Issues

| Issue | Occurrences | Files |
|-------|-------------|-------|
| Empty catch blocks | 5 | validate.ts |
| console.log instead of error | 12 | Various |
| Missing error context | 15+ | Component validators |
| No error boundaries | All components | - |

### Detailed Recommendations

#### 6.1 Create Centralized Error Handler

```typescript
// src/core/errors/ErrorHandler.ts
export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface ErrorContext {
  component?: string;
  method?: string;
  props?: Record<string, unknown>;
  additionalInfo?: Record<string, unknown>;
}

export interface FormattedError {
  message: string;
  severity: ErrorSeverity;
  code: string;
  context: ErrorContext;
  timestamp: Date;
  stack?: string;
}

class ErrorHandlerService {
  private handlers: ((error: FormattedError) => void)[] = [];

  /**
   * Register error handler (e.g., for analytics, logging service)
   */
  registerHandler(handler: (error: FormattedError) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  /**
   * Log error with context
   */
  log(
    severity: ErrorSeverity,
    message: string,
    code: string,
    context: ErrorContext = {}
  ): void {
    const formattedError: FormattedError = {
      message,
      severity,
      code,
      context,
      timestamp: new Date()
    };

    // Console output based on severity
    switch (severity) {
      case ErrorSeverity.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[${code}]`, message, context);
        }
        break;
      case ErrorSeverity.WARNING:
        console.warn(`[${code}]`, message, context);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(`[${code}]`, message, context);
        break;
      default:
        console.info(`[${code}]`, message, context);
    }

    // Notify registered handlers
    this.handlers.forEach(handler => handler(formattedError));
  }

  /**
   * Capture exception with full stack
   */
  captureException(error: Error, context: ErrorContext = {}): void {
    this.log(
      ErrorSeverity.ERROR,
      error.message,
      'UNHANDLED_EXCEPTION',
      { ...context, stack: error.stack }
    );
  }
}

export const ErrorHandler = new ErrorHandlerService();
```

#### 6.2 Create Error Codes Enum

```typescript
// src/core/errors/ErrorCodes.ts
export const ErrorCodes = {
  // Validation Errors (1xxx)
  VALIDATION_SCENARIO_INVALID: 'E1001',
  VALIDATION_VARIANCE_INVALID: 'E1002',
  VALIDATION_ORDER_INVALID: 'E1003',
  VALIDATION_JSON_PARSE: 'E1004',
  VALIDATION_DATE_FORMAT: 'E1005',

  // Data Errors (2xxx)
  DATA_MISSING_REQUIRED: 'E2001',
  DATA_TYPE_MISMATCH: 'E2002',
  DATA_EMPTY_DATASET: 'E2003',

  // Rendering Errors (3xxx)
  RENDER_SVG_FAILED: 'E3001',
  RENDER_LAYOUT_FAILED: 'E3002',

  // Configuration Errors (4xxx)
  CONFIG_STYLE_NOT_FOUND: 'E4001',
  CONFIG_LOCALE_NOT_FOUND: 'E4002',

  // Security Errors (5xxx)
  SECURITY_SANITIZATION_FAILED: 'E5001',
  SECURITY_INVALID_INPUT: 'E5002'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

#### 6.3 Refactor Empty Catch Blocks

```typescript
// BEFORE (src/utils/validate.ts:104-105)
try {
  JSON.parse(value);
} catch {}  // Silent failure!

// AFTER
import { ErrorHandler, ErrorSeverity } from '../core/errors/ErrorHandler';
import { ErrorCodes } from '../core/errors/ErrorCodes';

try {
  JSON.parse(value);
} catch (error) {
  ErrorHandler.log(
    ErrorSeverity.WARNING,
    `Failed to parse JSON: ${(error as Error).message}`,
    ErrorCodes.VALIDATION_JSON_PARSE,
    { input: value.substring(0, 100) }  // Log truncated input for debugging
  );
  return ['Invalid JSON format'];  // Return meaningful validation error
}
```

#### 6.4 Add Error Boundary Component

```typescript
// src/components/bn-error-boundary/bn-error-boundary.tsx
import { Component, Prop, State, h, Host } from '@stencil/core';
import { ErrorHandler, ErrorSeverity } from '../../core/errors/ErrorHandler';

@Component({
  tag: 'bn-error-boundary',
  styleUrl: 'bn-error-boundary.scss',
  shadow: true
})
export class BnErrorBoundary {
  @Prop() fallback?: string;
  @Prop() showDetails: boolean = false;

  @State() hasError: boolean = false;
  @State() error: Error | null = null;

  componentDidCatch(error: Error, errorInfo: any) {
    this.hasError = true;
    this.error = error;

    ErrorHandler.captureException(error, {
      component: 'bn-error-boundary',
      additionalInfo: errorInfo
    });
  }

  render() {
    if (this.hasError) {
      return (
        <Host class="error-boundary">
          <div class="error-container">
            <h3>Something went wrong</h3>
            <p>{this.fallback || 'Unable to render this component.'}</p>
            {this.showDetails && this.error && (
              <details>
                <summary>Error Details</summary>
                <pre>{this.error.message}</pre>
              </details>
            )}
          </div>
        </Host>
      );
    }

    return <slot />;
  }
}
```

### Success Criteria

- [ ] Zero empty catch blocks
- [ ] All errors logged with context
- [ ] Error codes documented
- [ ] Error boundary available for consumers
- [ ] Consistent error message format

---

## Action 7: Clean Up Debug and Dead Code

**Priority**: P2 - Medium
**Effort**: 1-2 days
**Risk if Ignored**: Larger bundle size, confusion, unprofessional appearance

### Problem Statement

The codebase contains debug statements, unused variables, and commented-out code that should be removed before production use.

### Identified Issues

| Issue Type | Count | Impact |
|------------|-------|--------|
| console.log statements | 12+ | Debug noise in production |
| Commented-out code | 20+ blocks | Confusion, maintenance burden |
| Unused imports | 15+ | Larger bundle size |
| Unused variables | 8+ | Confusion, warnings |

### Detailed Recommendations

#### 7.1 Remove All console.log Statements

```typescript
// Files with console.log to remove:
// - src/components/bn-table/bn-table.tsx:504
// - src/utils/withComponentStyle.ts:14
// - src/components/bn-chart-tree/bn-chart-tree.tsx:various

// Replace with conditional debug logging:
import { ErrorHandler, ErrorSeverity } from '../core/errors/ErrorHandler';

// BEFORE
console.log("columnthereof", newValue)

// AFTER (if logging is needed)
if (process.env.NODE_ENV === 'development') {
  ErrorHandler.log(
    ErrorSeverity.DEBUG,
    'Column thereof updated',
    'DEBUG_TABLE_001',
    { newValue }
  );
}
```

#### 7.2 Add ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-unused-imports': 'error',
    'no-commented-out-code': 'warn'  // Custom rule or plugin
  }
};
```

#### 7.3 Remove Commented-Out Code

```typescript
// BEFORE (found in multiple files)
// private oldMethod() {
//   // Old implementation
//   return something;
// }

// private newMethod() {
//   // TODO: refactor this
//   // const unused = this.oldMethod();
//   return somethingElse;
// }

// AFTER - Clean removal
private newMethod() {
  return somethingElse;
}
```

#### 7.4 Add Pre-commit Hook

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "git add"
    ]
  }
}
```

### Success Criteria

- [ ] Zero console.log in production builds
- [ ] No commented-out code blocks
- [ ] ESLint rules enforced via CI
- [ ] All unused imports removed
- [ ] Bundle size reduced

---

## Action 8: Implement Constants and Configuration

**Priority**: P2 - Medium
**Effort**: 2-3 days
**Risk if Ignored**: Magic numbers, inconsistent behavior, hard to configure

### Problem Statement

The codebase contains magic numbers and hardcoded values that should be extracted to constants for better maintainability and configurability.

### Identified Magic Numbers

| Value | Location | Purpose |
|-------|----------|---------|
| 28 | bn-chart-time.tsx:384 | maxBars default |
| 28 | bn-chart-time.tsx:406 | intervalSpanLimit |
| 0.7 | EdgeRenderer.ts:194 | bendRatio |
| 8 | EdgeRenderer.ts:100 | spacing |
| 400/300 | Various | Default chart dimensions |

### Detailed Recommendations

#### 8.1 Create Chart Constants

```typescript
// src/core/constants/chart.constants.ts

/**
 * Default configuration values for chart components
 */
export const CHART_DEFAULTS = {
  /** Default chart width in pixels */
  WIDTH: 400,
  /** Default chart height in pixels */
  HEIGHT: 300,
  /** Maximum number of bars before auto-switching to line mode */
  MAX_BARS: 28,
  /** Maximum date interval span before requiring aggregation */
  INTERVAL_SPAN_LIMIT: 28,
  /** Minimum readable bar width in pixels */
  MIN_BAR_WIDTH: 10,
  /** Default padding around charts */
  PADDING: {
    TOP: 20,
    RIGHT: 20,
    BOTTOM: 40,
    LEFT: 60
  }
} as const;

/**
 * Tree chart specific constants
 */
export const TREE_DEFAULTS = {
  /** Default node spacing in pixels */
  NODE_SPACING: 50,
  /** Default level spacing in pixels */
  LEVEL_SPACING: 100,
  /** Bezier curve bend ratio for edges */
  EDGE_BEND_RATIO: 0.7,
  /** Multi-parent connection point spacing */
  MULTI_PARENT_SPACING: 8,
  /** Animation duration in milliseconds */
  ANIMATION_DURATION: 300
} as const;

/**
 * Table component constants
 */
export const TABLE_DEFAULTS = {
  /** Default page size for pagination */
  PAGE_SIZE: 50,
  /** Maximum column width in pixels */
  MAX_COLUMN_WIDTH: 400,
  /** Minimum column width in pixels */
  MIN_COLUMN_WIDTH: 50
} as const;
```

#### 8.2 Create Color Constants (IBCS Compliance)

```typescript
// src/core/constants/colors.constants.ts

/**
 * IBCS-compliant color palette
 * @see https://www.ibcs.com/standards/
 */
export const IBCS_COLORS = {
  /** Actual values - solid black */
  ACTUAL: {
    PRIMARY: '#121212',
    SECONDARY: '#333333'
  },
  /** Forecast values - outlined/hatched */
  FORECAST: {
    STROKE: '#121212',
    FILL: '#FFFFFF',
    PATTERN: '10 5 5 5'  // Dash pattern
  },
  /** Previous period - gray */
  PREVIOUS: {
    PRIMARY: '#606060',
    SECONDARY: '#808080'
  },
  /** Positive variance - green */
  VARIANCE_POSITIVE: '#006400',
  /** Negative variance - red */
  VARIANCE_NEGATIVE: '#8B0000',
  /** Neutral - gray */
  NEUTRAL: '#808080'
} as const;

/**
 * Semantic color mappings for scenarios
 */
export const SCENARIO_COLORS: Record<string, typeof IBCS_COLORS[keyof typeof IBCS_COLORS]> = {
  ac: IBCS_COLORS.ACTUAL,
  ac1: IBCS_COLORS.ACTUAL,
  ac2: IBCS_COLORS.ACTUAL,
  fc: IBCS_COLORS.FORECAST,
  pp: IBCS_COLORS.PREVIOUS,
  py: IBCS_COLORS.PREVIOUS,
  bud: IBCS_COLORS.FORECAST
};
```

#### 8.3 Create Error Message Constants

```typescript
// src/core/constants/messages.constants.ts

export const ERROR_MESSAGES = {
  VALIDATION: {
    SCENARIOS_INVALID: (invalid: string[]) =>
      `Invalid scenario values: ${invalid.join(', ')}. ` +
      `Valid options: ac, ac1, ac2, fc, pp, py, bud, bud1, bud2.`,

    VARIANCES_INVALID: (invalid: string[]) =>
      `Invalid variance format: ${invalid.join(', ')}. ` +
      `Expected format: 'scenario1%scenario2' (e.g., 'ac%pp').`,

    JSON_PARSE_FAILED: (input: string) =>
      `Failed to parse JSON. Received: ${input.substring(0, 50)}...`,

    DATE_FORMAT_INVALID: (date: string, expectedFormat: string) =>
      `Invalid date format: '${date}'. Expected: ${expectedFormat}.`
  },
  DATA: {
    DATASET_NOT_FOUND: (name: string) =>
      `Dataset '${name}' not found. Ensure bn-dataset provider is configured.`,

    EMPTY_DATA: 'No data available for rendering.'
  }
} as const;
```

#### 8.4 Usage in Components

```typescript
// BEFORE
@Prop() maxBars: number = 28;  // Magic number

// AFTER
import { CHART_DEFAULTS } from '../../core/constants/chart.constants';

@Prop() maxBars: number = CHART_DEFAULTS.MAX_BARS;
```

### Success Criteria

- [ ] All magic numbers extracted to constants
- [ ] Constants documented with JSDoc
- [ ] IBCS colors centralized
- [ ] Error messages consistent
- [ ] Easy to configure defaults

---

## Action 9: Add Accessibility Support

**Priority**: P2 - Medium
**Effort**: 4-5 days
**Risk if Ignored**: Excludes users with disabilities, potential legal issues

### Problem Statement

The library currently has no accessibility support - no ARIA labels, no keyboard navigation, and no screen reader compatibility.

### Detailed Recommendations

#### 9.1 Add ARIA Labels to Charts

```typescript
// src/components/bn-chart-time/bn-chart-time.tsx
render() {
  return (
    <Host
      role="img"
      aria-label={this.getAccessibleDescription()}
      tabIndex={0}
    >
      <svg
        role="graphics-document"
        aria-labelledby="chart-title chart-desc"
      >
        <title id="chart-title">{this.title || 'Time Chart'}</title>
        <desc id="chart-desc">{this.generateChartDescription()}</desc>
        {/* Chart content */}
      </svg>
    </Host>
  );
}

private getAccessibleDescription(): string {
  const scenarios = this.prepareScenarios().join(', ');
  const dataPoints = this.data?.length || 0;
  return `Time chart showing ${scenarios} with ${dataPoints} data points`;
}

private generateChartDescription(): string {
  // Generate detailed description for screen readers
  const summaryStats = this.calculateSummaryStats();
  return `Chart displays ${summaryStats.scenarios} scenarios. ` +
         `Values range from ${summaryStats.min} to ${summaryStats.max}. ` +
         `Time period: ${summaryStats.startDate} to ${summaryStats.endDate}.`;
}
```

#### 9.2 Add Keyboard Navigation to Tables

```typescript
// src/components/bn-table/bn-table.tsx
@Listen('keydown')
handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      this.focusNextRow();
      break;
    case 'ArrowUp':
      event.preventDefault();
      this.focusPreviousRow();
      break;
    case 'ArrowRight':
      event.preventDefault();
      this.focusNextCell();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      this.focusPreviousCell();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      this.activateCurrentCell();
      break;
    case 'Home':
      event.preventDefault();
      event.ctrlKey ? this.focusFirstRow() : this.focusFirstCell();
      break;
    case 'End':
      event.preventDefault();
      event.ctrlKey ? this.focusLastRow() : this.focusLastCell();
      break;
  }
}
```

#### 9.3 Create Accessible Data Table

```typescript
// src/components/bn-table/rendering/AccessibleTable.tsx
renderAccessibleTable() {
  return (
    <table
      role="grid"
      aria-label={this.tableTitle || 'Data Table'}
      aria-rowcount={this.data.length}
      aria-colcount={this.columns.length}
    >
      <thead>
        <tr role="row">
          {this.columns.map((col, index) => (
            <th
              role="columnheader"
              scope="col"
              aria-colindex={index + 1}
              aria-sort={this.getSortDirection(col)}
              tabIndex={-1}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {this.data.map((row, rowIndex) => (
          <tr
            role="row"
            aria-rowindex={rowIndex + 1}
            tabIndex={rowIndex === this.focusedRow ? 0 : -1}
          >
            {this.columns.map((col, colIndex) => (
              <td
                role="gridcell"
                aria-colindex={colIndex + 1}
                tabIndex={-1}
              >
                {this.renderCellValue(row, col)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### 9.4 Add Focus Indicators

```scss
// src/global.css - Add focus styles
:host {
  // Visible focus indicator for keyboard navigation
  *:focus-visible {
    outline: 2px solid var(--bn-focus-color, #005fcc);
    outline-offset: 2px;
  }

  // High contrast mode support
  @media (prefers-contrast: high) {
    --bn-focus-color: #000000;
    --bn-border-color: #000000;
  }

  // Reduced motion support
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

#### 9.5 Add Accessibility Props

```typescript
// src/core/types/accessibility.interface.ts
export interface AccessibilityProps {
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ID of element that labels this component */
  ariaLabelledBy?: string;
  /** ID of element that describes this component */
  ariaDescribedBy?: string;
  /** Whether component is in loading state */
  ariaLoading?: boolean;
  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;
}
```

### Success Criteria

- [ ] All charts have ARIA labels
- [ ] Tables support keyboard navigation
- [ ] Focus indicators visible
- [ ] Screen reader tested
- [ ] WCAG 2.1 AA compliance (target)

---

## Action 10: Enhance Documentation and Developer Experience

**Priority**: P3 - Low
**Effort**: 3-4 days
**Risk if Ignored**: Poor adoption, support burden, developer frustration

### Problem Statement

While auto-generated documentation exists, it lacks comprehensive usage examples, architectural guidance, and troubleshooting information.

### Detailed Recommendations

#### 10.1 Create Component Usage Guide

```markdown
<!-- doc/guides/getting-started.md -->
# Getting Started with BN-Template-Engine

## Installation

\`\`\`bash
npm install @bino-bi/bn-template-engine
\`\`\`

## Basic Setup

### 1. Import Components

\`\`\`html
<script type="module" src="node_modules/@bino-bi/bn-template-engine/dist/bn-template-engine/bn-template-engine.esm.js"></script>
\`\`\`

### 2. Add Providers

\`\`\`html
<bn-component-style>
  <bn-dataset name="sales" data='[...]'>
    <bn-chart-time
      scenarios="ac,fc"
      dataset="sales"
    ></bn-chart-time>
  </bn-dataset>
</bn-component-style>
\`\`\`

## Component Hierarchy

Components follow a provider pattern:

\`\`\`
bn-component-style (optional - custom themes)
└── bn-internationalization (optional - i18n)
    └── bn-dataset (required for data-bound components)
        └── bn-chart-* / bn-table / bn-map
\`\`\`
```

#### 10.2 Add JSDoc to All Public APIs

```typescript
// src/components/bn-chart-time/bn-chart-time.tsx
/**
 * Time series chart component supporting bar and line visualization modes.
 *
 * @component
 * @example
 * ```html
 * <bn-chart-time
 *   scenarios="ac,fc"
 *   variances="ac%fc"
 *   dataset="sales"
 *   chart-width="600"
 *   chart-height="400"
 * ></bn-chart-time>
 * ```
 *
 * @fires chartRendered - Emitted when chart finishes rendering
 * @fires dataError - Emitted when data validation fails
 */
@Component({...})
export class BnChartTime {
  /**
   * Comma-separated list of scenarios to display.
   *
   * @example "ac,fc,pp"
   * @validValues ac, ac1, ac2, fc, pp, py, bud, bud1, bud2
   */
  @Prop() scenarios: string = '';

  /**
   * Comma-separated list of variance calculations.
   * Format: "scenario1%scenario2" calculates (scenario1 - scenario2) / scenario2
   *
   * @example "ac%fc,ac%pp"
   */
  @Prop() variances: string = '';
}
```

#### 10.3 Create Interactive Storybook Stories

```typescript
// src/stories/BnChartTime.stories.ts
import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Charts/Time Chart',
  tags: ['autodocs'],
  argTypes: {
    scenarios: {
      control: 'text',
      description: 'Comma-separated list of scenarios',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '' }
      }
    },
    chartWidth: {
      control: { type: 'range', min: 200, max: 1000 },
      description: 'Chart width in pixels'
    },
    chartHeight: {
      control: { type: 'range', min: 150, max: 600 },
      description: 'Chart height in pixels'
    }
  }
};

export default meta;
type Story = StoryObj;

export const BasicBarChart: Story = {
  args: {
    scenarios: 'ac,fc',
    chartWidth: 400,
    chartHeight: 300
  },
  render: (args) => `
    <bn-dataset name="demo" data='${JSON.stringify(sampleData)}'>
      <bn-chart-time
        scenarios="${args.scenarios}"
        chart-width="${args.chartWidth}"
        chart-height="${args.chartHeight}"
        dataset="demo"
      ></bn-chart-time>
    </bn-dataset>
  `
};

export const WithVariances: Story = {
  args: {
    scenarios: 'ac,fc,pp',
    variances: 'ac%fc,ac%pp'
  },
  render: (args) => `...`
};

export const LineChartMode: Story = {
  args: {
    scenarios: 'ac',
    maxBars: 10  // Triggers line mode with more data
  },
  render: (args) => `...`
};
```

#### 10.4 Create Troubleshooting Guide

```markdown
<!-- doc/guides/troubleshooting.md -->
# Troubleshooting Guide

## Common Issues

### Chart Not Rendering

**Symptoms**: Empty space where chart should appear

**Possible Causes**:
1. Missing dataset provider
2. Invalid data format
3. Missing scenarios

**Solution**:
\`\`\`html
<!-- Ensure data provider wraps component -->
<bn-dataset name="mydata" data='[{"date":"2024-01","ac":100}]'>
  <bn-chart-time scenarios="ac" dataset="mydata"></bn-chart-time>
</bn-dataset>
\`\`\`

### "Invalid scenario" Warning

**Symptoms**: Console warning about invalid scenarios

**Cause**: Scenario name not in valid list

**Solution**: Use valid scenario names:
- `ac`, `ac1`, `ac2` - Actuals
- `fc` - Forecast
- `pp`, `py` - Previous period/year
- `bud`, `bud1`, `bud2` - Budget

### Styles Not Applied

**Symptoms**: Default styling, custom theme ignored

**Solution**:
\`\`\`html
<bn-component-style theme="myTheme">
  <!-- Components here will use myTheme -->
</bn-component-style>
\`\`\`
```

#### 10.5 Add Architectural Decision Records (ADRs)

```markdown
<!-- doc/adr/001-web-components.md -->
# ADR 001: Use Web Components with Stencil

## Status
Accepted

## Context
We need a component library that works across frameworks (React, Vue, Angular, vanilla).

## Decision
Use Stencil.js to build native Web Components.

## Consequences
- **Positive**: Framework agnostic, native browser support
- **Negative**: Shadow DOM styling constraints, bundle size

## Alternatives Considered
- React-only library (rejected: not framework agnostic)
- Lit (rejected: less tooling support)
```

### Success Criteria

- [ ] All public APIs documented with JSDoc
- [ ] Interactive Storybook for all components
- [ ] Getting started guide complete
- [ ] Troubleshooting guide covers common issues
- [ ] ADRs document key decisions

---

## Implementation Timeline

| Week | Actions | Deliverables |
|------|---------|--------------|
| 1 | Action 1 (Security) | XSS vulnerabilities fixed |
| 1-2 | Action 2 (Testing) | Test infrastructure, 60% coverage |
| 2-3 | Action 3 (Refactor) | Large components split |
| 3 | Action 4 (Duplication) | Shared utilities created |
| 3-4 | Action 5 (Types) | Strict TypeScript enabled |
| 4 | Action 6 (Errors) | Error handling centralized |
| 4 | Action 7 (Cleanup) | Debug code removed |
| 5 | Action 8 (Constants) | Magic numbers eliminated |
| 5-6 | Action 9 (A11y) | Basic accessibility support |
| 6 | Action 10 (Docs) | Documentation enhanced |

---

## Metrics for Success

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | ~11% | >70% |
| TypeScript Errors | Unknown | 0 |
| Security Vulnerabilities | 4+ critical | 0 |
| `any` Type Usage | 47+ | 0 |
| Max Component Lines | 880 | <300 |
| console.log Statements | 12+ | 0 |
| ESLint Warnings | Unknown | 0 |

---

*Action Plan Created: January 2026*
*Library Version: 1.1.0*
*Review Frequency: Monthly progress check*
