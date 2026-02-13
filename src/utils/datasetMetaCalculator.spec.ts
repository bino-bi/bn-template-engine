import { calculateDatasetMeta } from './datasetMetaCalculator';

describe('calculateDatasetMeta', () => {

  it('handles empty array', () => {
    const meta = calculateDatasetMeta([]);
    expect(meta.rowCount).toBe(0);
    expect(meta.availableScenarios).toEqual([]);
    expect(meta.rowGroup.hasData).toBe(false);
    expect(meta.category.hasData).toBe(false);
    expect(meta.subCategory.hasData).toBe(false);
    expect(meta.dateRange.hasData).toBe(false);
    expect(meta.suggestedLevel).toBe('category');
  });

  it('handles null/undefined input', () => {
    const meta = calculateDatasetMeta(null as any);
    expect(meta.rowCount).toBe(0);
    expect(meta.availableScenarios).toEqual([]);
  });

  it('detects single scenario', () => {
    const data = [
      { ac1: 100, category: 'Sales' },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.availableScenarios).toEqual(['ac1']);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.hasData).toBe(true);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.min).toBe(100);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.max).toBe(100);
  });

  it('detects multiple scenarios', () => {
    const data = [
      { ac1: 100, pp1: 90, fc1: 110 },
      { ac1: 200, pp1: 180 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.availableScenarios).toEqual(['ac1', 'pp1', 'fc1']);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.min).toBe(100);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.max).toBe(200);
    expect(meta.scenarios.find(s => s.key === 'pp1')!.min).toBe(90);
    expect(meta.scenarios.find(s => s.key === 'pp1')!.max).toBe(180);
    expect(meta.scenarios.find(s => s.key === 'fc1')!.min).toBe(110);
    expect(meta.scenarios.find(s => s.key === 'fc1')!.max).toBe(110);
  });

  it('treats zero as valid data', () => {
    const data = [
      { ac1: 0, category: 'Sales' },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.availableScenarios).toEqual(['ac1']);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.hasData).toBe(true);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.min).toBe(0);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.max).toBe(0);
  });

  it('ignores null/undefined/NaN scenario values', () => {
    const data = [
      { ac1: null, ac2: undefined, ac3: NaN, ac4: Infinity },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.hasData).toBe(false);
    expect(meta.scenarios.find(s => s.key === 'ac2')!.hasData).toBe(false);
    expect(meta.scenarios.find(s => s.key === 'ac3')!.hasData).toBe(false);
    expect(meta.scenarios.find(s => s.key === 'ac4')!.hasData).toBe(false);
  });

  it('detects dimension values', () => {
    const data = [
      { rowGroup: 'Revenue', category: 'Product A', subCategory: 'Sub 1', columnGroup: 'Q1', columnSubGroup: 'Jan' },
      { rowGroup: 'Revenue', category: 'Product B', subCategory: 'Sub 2', columnGroup: 'Q1', columnSubGroup: 'Feb' },
      { rowGroup: 'Cost', category: 'Product A', columnGroup: 'Q2' },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.rowGroup.distinctValues).toEqual(['Revenue', 'Cost']);
    expect(meta.rowGroup.count).toBe(2);
    expect(meta.category.distinctValues).toEqual(['Product A', 'Product B']);
    expect(meta.category.count).toBe(2);
    expect(meta.subCategory.distinctValues).toEqual(['Sub 1', 'Sub 2']);
    expect(meta.subCategory.count).toBe(2);
    expect(meta.columnGroup.distinctValues).toEqual(['Q1', 'Q2']);
    expect(meta.columnSubGroup.distinctValues).toEqual(['Jan', 'Feb']);
  });

  it('ignores empty string and null dimension values', () => {
    const data = [
      { category: '', rowGroup: null, subCategory: undefined },
      { category: 'Sales' },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.category.distinctValues).toEqual(['Sales']);
    expect(meta.rowGroup.hasData).toBe(false);
    expect(meta.subCategory.hasData).toBe(false);
  });

  it('detects date ranges', () => {
    const data = [
      { date: '2024-01-01', ac1: 100 },
      { date: '2024-06-15', ac1: 200 },
      { date: '2024-03-01', ac1: 150 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.dateRange.hasData).toBe(true);
    expect(meta.dateRange.min).toBe('2024-01-01');
    expect(meta.dateRange.max).toBe('2024-06-15');
    expect(meta.dateRange.distinctCount).toBe(3);
  });

  it('suggests subCategory level when subCategory has data', () => {
    const data = [
      { rowGroup: 'Revenue', category: 'Sales', subCategory: 'Online', ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedLevel).toBe('subCategory');
  });

  it('suggests category level when only category has data', () => {
    const data = [
      { rowGroup: 'Revenue', category: 'Sales', ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedLevel).toBe('category');
  });

  it('suggests rowGroup level when only rowGroup has data', () => {
    const data = [
      { rowGroup: 'Revenue', ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedLevel).toBe('rowGroup');
  });

  it('defaults suggestedLevel to category when no dimensions present', () => {
    const data = [
      { ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedLevel).toBe('category');
  });

  it('sets suggestedDateInterval to auto when dates exist', () => {
    const data = [
      { date: '2024-01-01', ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedDateInterval).toBe('auto');
  });

  it('sets suggestedDateInterval to null when no dates', () => {
    const data = [
      { ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedDateInterval).toBeNull();
  });

  it('suggestedOrder matches suggestedLevel', () => {
    const data = [
      { rowGroup: 'Revenue', category: 'Sales', subCategory: 'Online', ac1: 100 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.suggestedOrder).toBe(meta.suggestedLevel);
  });

  it('sets calculatedAt to a recent timestamp', () => {
    const before = Date.now();
    const meta = calculateDatasetMeta([{ ac1: 1 }]);
    const after = Date.now();
    expect(meta.calculatedAt).toBeGreaterThanOrEqual(before);
    expect(meta.calculatedAt).toBeLessThanOrEqual(after);
  });

  it('skips null rows in data array', () => {
    const data = [null, { ac1: 100, category: 'Sales' }, undefined, { ac1: 200 }] as any[];
    const meta = calculateDatasetMeta(data);
    expect(meta.rowCount).toBe(4);
    expect(meta.availableScenarios).toEqual(['ac1']);
    expect(meta.category.distinctValues).toEqual(['Sales']);
  });

  it('handles negative values correctly', () => {
    const data = [
      { ac1: -50 },
      { ac1: -10 },
      { ac1: 30 },
    ];
    const meta = calculateDatasetMeta(data);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.min).toBe(-50);
    expect(meta.scenarios.find(s => s.key === 'ac1')!.max).toBe(30);
  });
});
