import {DataAnalyzer} from './dataAnalyzer';
import {SiPrefix} from "./model/SiPrefix";

describe('Data Analyzer Test', () => {
  it('returns default if empty data object', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data: any[] = [];
    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1 if data is  < 1000', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 100},
      {category: "test2", ac1: 100, ac2: 100, ac3: 999},
      {category: "test3", ac1: 100, ac2: 100, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1000 if data is  >= 1000', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 1000, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it('returns 1000 if data is  < 1.000.000', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 99999, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it('returns 1000 if data is  < 1.000.000', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: -10000000, ac2: 99999, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "M",
      value: 1000000,
    });
  });

  it('returns 1000000 if data is  >= 1.000.000', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 9999999, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "M",
      value: 1000000,
    });
  });

  it('returns 0.001 if data is  >= 0.001', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'LEAST')).toEqual({
      prefix: "m",
      value: 0.001,
    });
  });

  it('returns 0.001 if data is  >= 0.001, ignoring mode case', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'least')).toEqual({
      prefix: "m",
      value: 0.001,
    });
  });

  it('returns 0.000001 if mode is μ', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'my')).toEqual(new SiPrefix( "my", 0.000001));
  });

  it('returns 0.000001 if mode is μ', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'my')).toEqual({
      prefix: "my",
      value: 0.000001,
    });
  });

  it('returns 1 if mode is _', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, '_')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1000 if mode is null (Greatest is default)', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, null)).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it('returns 1 if scenarios is null', () => {
    let scenarios: any = [];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });


  it('returns 1 if scenarios is empty', () => {
    let scenarios: string[] = [];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1 if scenarios are not in data', () => {
    let scenarios = ['ac4', 'ac5', 'ac6'];

    let data = [
      {category: "test", ac1: 100, ac2: 100, ac3: 1000},
      {category: "test2", ac1: 100, ac2: 0.001, ac3: 100},
      {category: "test3", ac1: 1000, ac2: 1000, ac3: 100},
    ]

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1 if data is  null', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data: any[] = [];

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it('returns 1 if data is empty', () => {
    let scenarios = ['ac1', 'ac2', 'ac3'];

    let data: any[] = [];

    expect(DataAnalyzer.calculateMeasureScale(data, scenarios, 'GREATEST')).toEqual({
      prefix: "",
      value: 1,
    });
  });

});
