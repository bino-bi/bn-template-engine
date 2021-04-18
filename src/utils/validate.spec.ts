import {
  isBlankInput, isValidDate, isValidDateFormat, isValidDateLink,
  isValidDirection, validateMeasureList,
  validateOrderList, isValidDataFormat,
  validateScenarioList,
  validateVariancesList, isValidBoolean, isValidTableType
} from './validate';

describe('validateScenarioList', () => {
  it('returns empty array for undefined scenario string', () => {
    expect(validateScenarioList(undefined)).toEqual([]);
  });

  it('returns empty array for null scenario string', () => {
    expect(validateScenarioList(null)).toEqual([]);
  });

  it('returns empty array for \'\' scenario string', () => {
    expect(validateScenarioList('')).toEqual([]);
  });

  it('returns empty array for valid (ac) scenario string ', () => {
    expect(validateScenarioList('ac')).toEqual([]);
  });

  it('returns empty array for valid (ac,fc,pl,py) scenario string ', () => {
    expect(validateScenarioList('ac,fc,pl,py')).toEqual([]);
  });

  it('returns empty array for valid (ac,fc,pl,py,dpy_ac_pos) scenario string with variances', () => {
    expect(validateScenarioList('ac,fc,pl,py,dpy_ac_pos')).toEqual([]);
  });

  it('returns empty array for valid (ac,fc,pl,py,drpy_ac_pos) scenario string with relative variances', () => {
    expect(validateScenarioList('ac,fc,pl,py,drpy_ac_pos')).toEqual([]);
  });

  it('returns  array for invalid (ac,fc,pl,py,42) scenario string with number', () => {
    expect(validateScenarioList('ac,fc,pl,py,42')).toEqual(['42']);
  });

  it('returns  array for invalid (42) scenario string ', () => {
    expect(validateScenarioList('42')).toEqual(['42']);
  });
});


describe('isBlankString', () => {
  it('returns false for undefined  string', () => {
    expect(isBlankInput(undefined)).toEqual(true);
  });

  it('returns false for undefined  string', () => {
    expect(isBlankInput(null)).toEqual(true);
  });

  it('returns false for number 42', () => {
    expect(isBlankInput(42)).toEqual(false);
  });

  it('returns false for number 0', () => {
    expect(isBlankInput(0)).toEqual(false);
  });


  it('returns false for string', () => {
    expect(isBlankInput('42')).toEqual(false);
  });

  it('returns false for empty string', () => {
    expect(isBlankInput('')).toEqual(true);
  });
});


describe('validateVariancesList', () => {
  it('returns empty list for undefined', () => {
    expect(validateVariancesList(undefined)).toEqual([]);
  });

  it('returns empty list for null', () => {
    expect(validateVariancesList(null)).toEqual([]);
  });

  it('returns empty list for null', () => {
    expect(validateVariancesList(null)).toEqual([]);
  });

  it('returns empty array for valid (drpy_ac_pos) scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_ac_pos')).toEqual([]);
  });

  it('returns empty array for valid (\'drpy_ac_pos,drpy_ac_neg,drpy_ac_neu\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_ac_pos,drpy_ac_neg,drpy_ac_neu',)).toEqual([]);
  });

  it('returns empty array for valid (\'dpy_ac_pos,dpy_ac_neg,dpy_ac_neu\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_ac_pos,drpy_ac_neg,drpy_ac_neu')).toEqual([]);
  });

  it('returns array for invalid (\'dpy_ac_nas\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_ac_nas')).toEqual(['drpy_ac_nas']);
  });

  it('returns array for invalid (\'dpy_ac_nas\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_ac_nas')).toEqual(['drpy_ac_nas']);
  });

  it('returns array for invalid (\'dpy_ac_nas\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpy_gc_neu')).toEqual(['drpy_gc_neu']);
  });
});

describe('isValidOrderList', () => {
  it('returns empty list for undefined', () => {
    expect(validateOrderList(undefined)).toEqual([]);
  });

  it('returns empty list for null', () => {
    expect(validateOrderList(null)).toEqual([]);
  });

  it('returns empty array for valid (ac,fc,pl,py) scenario string', () => {
    expect(validateOrderList('ac,fc,pl,py')).toEqual([]);
  });

  it('returns  array for invalid (ac,fc,pl,py,42) scenario string with number', () => {
    expect(validateOrderList('ac,fc,pl,py,42')).toEqual(['42']);
  });

  it('returns  array for invalid (42) scenario string ', () => {
    expect(validateOrderList('42')).toEqual(['42']);
  });

  it('returns  array for invalid (0) scenario string ', () => {
    expect(validateOrderList('0')).toEqual(['0']);
  });

  it('returns  empty array for valid (category) scenario string ', () => {
    expect(validateOrderList('category')).toEqual([]);
  });

  it('returns  empty array for valid (dac_py_pos) scenario string ', () => {
    expect(validateOrderList('dac_py_pos')).toEqual([]);
  });

});

describe('isValidDirection', () => {
  it('returns false for undefined', () => {
    expect(isValidDirection(null)).toEqual(false);
  });

  it('returnsfalse for undefined', () => {
    expect(isValidDirection(undefined)).toEqual(false);
  });

  it('returns true for \'asc\'', () => {
    expect(isValidDirection("asc")).toEqual(true);
  });

  it('returns true for \'desc\'', () => {
    expect(isValidDirection("desc")).toEqual(true);
  });

  it('returns false for \'notValid\'', () => {
    expect(isValidDirection('notValid')).toEqual(false);
  });
});


describe('validateMeasureList', () => {
  it('returns error for undefined', () => {
    expect(validateMeasureList(null)).toEqual([]);
  });

  it('returns error for undefined', () => {
    expect(validateMeasureList(undefined)).toEqual([]);
  });

  it('returns error for undefined', () => {
    expect(validateMeasureList('')).toEqual([]);
  });

  it('returns error for \'asc\'', () => {
    expect(validateMeasureList("asc")).toEqual(["Invalid JSON structure"]);
  });

  it('returns [] for valid measure string', () => {
    expect(validateMeasureList("[{\"name\": \"Bruttoumsatz\", \"unit\": \"mEUR\"}]")).toEqual([]);
  });

  it('returns list of invalid element for partial valid string', () => {
    expect(validateMeasureList('[{"name": "Bruttoumsatz", "unit": "mEUR"},{"name2": "Bruttoumsatz", "unit": "mEUR"}]')).toEqual([{
      "name2": "Bruttoumsatz",
      "unit": "mEUR"
    }]);
  });
});


describe('isValidDate', () => {
  it('returns false for undefined', () => {
    expect(isValidDate(null)).toEqual(false);
  });

  it('returns false for empty', () => {
    expect(isValidDate('')).toEqual(false);
  });

  it('returns true for number', () => {
    expect(isValidDate(42)).toEqual(true);
  });

  it('returns true for number as string', () => {
    expect(isValidDate('42')).toEqual(true);
  });

  it('returns false for 13th month', () => {
    expect(isValidDate('2020-13-12')).toEqual(false);
  });

  it('returns true for valid date', () => {
    expect(isValidDate('1984-10-1')).toEqual(true);
  });
});


describe('isValidDateLink', () => {
  it('returns false for undefined', () => {
    expect(isValidDateLink(null)).toEqual(false);
  });

  it('returns false for empty', () => {
    expect(isValidDateLink('')).toEqual(false);
  });

  it('returns true for ytd', () => {
    expect(isValidDateLink('ytd')).toEqual(true);
  });

  it('returns false for interval', () => {
    expect(isValidDateLink('interval')).toEqual(true);
  });

  it('returns false for number as string', () => {
    expect(isValidDateLink('42')).toEqual(false);
  });

  it('returns true for auto', () => {
    expect(isValidDateLink('auto')).toEqual(true);
  });
});


describe('isValidDateFormat', () => {
  it('returns false for undefined', () => {
    expect(isValidDateFormat(null)).toEqual(false);
  });

  it('returns false for empty', () => {
    expect(isValidDateFormat('')).toEqual(false);
  });

  it('returns true for day', () => {
    expect(isValidDateFormat('day')).toEqual(true);
  });

  it('returns false for quarter', () => {
    expect(isValidDateFormat('quarter')).toEqual(true);
  });

  it('returns false for number as string', () => {
    expect(isValidDateFormat('42')).toEqual(false);
  });

  it('returns true for auto', () => {
    expect(isValidDateFormat('auto')).toEqual(true);
  });
});


describe('isValidDataFormat', () => {
  it('returns true for percent', () => {
    expect(isValidDataFormat("percent")).toEqual(true);
  });

  it('returns true for decimal', () => {
    expect(isValidDataFormat("decimal")).toEqual(true);
  });

  it('returns false for ""  ', () => {
    expect(isValidDataFormat('')).toEqual(false);
  });

  it('returns false for "42" ', () => {
    expect(isValidDataFormat("42")).toEqual(false);
  });
});


describe('isValidBoolean', () => {
  it('returns true for "true"', () => {
    expect(isValidBoolean("true")).toEqual(true);
  });

  it('returns true for "false"', () => {
    expect(isValidBoolean("false")).toEqual(true);
  })

  it('returns true for true', () => {
    expect(isValidBoolean("true")).toEqual(true);
  });

  it('returns true for false', () => {
    expect(isValidBoolean("false")).toEqual(true);
  });


  it('returns false for ""  ', () => {
    expect(isValidBoolean('')).toEqual(false);
  });

  it('returns false for "42" ', () => {
    expect(isValidBoolean("42")).toEqual(false);
  });
});


describe('isValidTableType', () => {
  it('returns true for "list"', () => {
    expect(isValidTableType("list")).toEqual(true);
  });

  it('returns true for "sum"', () => {
    expect(isValidTableType("sum")).toEqual(true);
  })

  it('returns true for "opt"', () => {
    expect(isValidTableType("opt")).toEqual(true);
  });

  it('returns false for false', () => {
    expect(isValidTableType("false")).toEqual(false);
  });

  it('returns false for ""  ', () => {
    expect(isValidTableType('')).toEqual(false);
  });

  it('returns false for "42" ', () => {
    expect(isValidTableType("42")).toEqual(false);
  });
});
