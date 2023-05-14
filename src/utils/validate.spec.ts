import {
  isBlankInput,
  isValidDate,
  isValidDateFormat,
  isValidDateLink,
  isValidDirection,
  validateMeasureList,
  validateOrderList,
  isValidDataFormat,
  validateScenarioList,
  validateVariancesList,
  isValidBoolean,
  isValidTableType,
  isValidInteger,
  validateThereOfJsonStr,
  isValidi18nMode,
  validateCategoryThereOfJsonStr, validateGpxType
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

  it('returns error array for invalid (ac) scenario string ', () => {
    expect(validateScenarioList('ac')).toEqual(["ac"]);
  });

  it('returns empty array for valid (ac1) scenario string ', () => {
    expect(validateScenarioList('ac1')).toEqual([]);
  });

  it('returns empty array for valid (ac1,fc2,pl3,pp4) scenario string ', () => {
    expect(validateScenarioList('ac1,fc2,pl3,pp4')).toEqual([]);
  });

  it('returns empty array for valid (ac1,fc1,pl1,pp1,dpp1_ac1_pos) scenario string with variances', () => {
    expect(validateScenarioList('ac1,fc1,pl1,pp1,dpp1_ac1_pos')).toEqual([]);
  });

  it('returns empty array for valid (ac2,fc2,pl2,pp2,drpp2_ac2_pos) scenario string with relative variances', () => {
    expect(validateScenarioList('ac2,fc2,pl2,pp2,drpp2_ac2_pos')).toEqual([]);
  });

  it('returns  array for invalid (ac1,fc1,pl1,pp1,42) scenario string with number', () => {
    expect(validateScenarioList('ac1,fc1,pl1,pp1,42')).toEqual(['42']);
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

  it('returns empty array for valid (drpp1_ac1_pos) scenario string with relative variances', () => {
    expect(validateScenarioList('drpp1_ac1_pos')).toEqual([]);
  });

  it('returns empty array for valid (\'drpp1_ac1_pos,drpp1_ac1_neg,drpp1_ac1_neu\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpp1_ac1_pos,drpp1_ac1_neg,drpp1_ac1_neu',)).toEqual([]);
  });

  it('returns empty array for valid (\'dpp1_ac1_pos,dpp1_ac1_neg,dpp1_ac1_neu\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpp1_ac1_pos,drpp1_ac1_neg,drpp1_ac1_neu')).toEqual([]);
  });

  it('returns array for invalid (\'dpp1_ac1_nas\') scenario string with relative variances', () => {
    expect(validateScenarioList('drpp1_ac1_nas')).toEqual(['drpp1_ac1_nas']);
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

  it('returns empty array for valid (ac1,fc1,pl1,pp1) scenario string', () => {
    expect(validateOrderList('ac1,fc1,pl1,pp1')).toEqual([]);
  });

  it('returns  array for invalid (ac1,fc1,pl1,pp1,42) scenario string with number', () => {
    expect(validateOrderList('ac1,fc1,pl1,pp1,42')).toEqual(['42']);
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

  it('returns  empty array for valid (dac1_pp1_pos) scenario string ', () => {
    expect(validateOrderList('dac1_pp1_pos')).toEqual([]);
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


describe('isValidInteger', () => {
  it('returns true for "42"', () => {
    expect(isValidInteger(42)).toEqual(true);
  });

  it('returns true for 42', () => {
    expect(isValidInteger("42")).toEqual(true);
  })

  it('returns true for -42', () => {
    expect(isValidInteger(-42)).toEqual(true);
  })

  it('returns true for 42.42', () => {
    expect(isValidInteger(42.42)).toEqual(false);
  })

  it('returns false for "opt"', () => {
    expect(isValidInteger("opt")).toEqual(false);
  });

  it('returns false for false', () => {
    expect(isValidInteger("false")).toEqual(false);
  });

  it('returns false for ""  ', () => {
    expect(isValidInteger('')).toEqual(false);
  });

});


describe('validateThereOfJsonStr', () => {
  it('returns [] for valid json string', () => {
    let valid = '[' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Immobilien",' +
      '            "subCategory":  ""' +
      '          },' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Alternative Investments",' +
      '            "subCategory":  ""' +
      '          }]';


    expect(validateThereOfJsonStr(valid)).toEqual([]);
  });

  it('returns [] for valid json string', () => {
    let valid = '[{'+
      '"rowGroup":     "0Umsatz",'+
      '"category":     "Applications",'+
      '"subCategory":  "Applications-A"'+
      '}]';

    expect(validateThereOfJsonStr(valid)).toEqual([]);
  });


  it('returns [] for valid json string', () => {
    let valid = '[' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Immobilien",' +
      '            "subCategory":  ""' +
      '          },' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Alternative Investments",' +
      '            "subCategory":  ""' +
      '          }]';


    expect(validateThereOfJsonStr(valid)).toEqual([]);
  });


  it('returns array of 1  of invalid ', () => {
    let invalid = '[' +
      '          {' +
      '            "rowfgroup":     "3Geschäftsfeld AM Illiquide",' +
      '            "category":     "Immobilien",' +
      '            "subCategory":  ""' +
      '          },' +
      '          {' +
      '            "rowGroup":     "3Geschäftsfeld AM Illiquide",' +
      '            "category":     "Alternative Investments",' +
      '            "subCategory":  ""' +
      '          }]';

    let expected = [{
                  rowfgroup:    "3Geschäftsfeld AM Illiquide",
                  category:     "Immobilien",
                  subCategory:  "",
                 }];

    expect(validateThereOfJsonStr(invalid)).toEqual(expected);
  });


  it('returns array of 1  of invalid missing category', () => {
    let invalid = '[' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Immobilien",' +
      '            "subCategory":  ""' +
      '          },' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "subCategory":  ""' +
      '          }]';

    let expected = [{
      rowGroup:    "Geschäftsfeld AM Illiquide",
      subCategory:  "",
    }];

    expect(validateThereOfJsonStr(invalid)).toEqual(expected);
  });


  it('returns true for -42', () => {
    let invalid = '[' +
      '          ' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "category":     "Immobilien",' +
      '            "subCategory":  ""' +

      '          },' +
      '          {' +
      '            "rowGroup":     "Geschäftsfeld AM Illiquide",' +
      '            "subCategory":  ""' +

      '          }';
    expect(validateThereOfJsonStr(invalid)).toEqual(["Invalid JSON structure"]);
  })

});


describe('validateOrderList', () => {
  it('returns [] for ""', () => {
    expect(validateOrderList("")).toEqual([]);
  });

  it('returns [] for ac1', () => {
    expect(validateOrderList("ac1")).toEqual([]);
  })

  it('returns [] for ac1,fc1', () => {
    expect(validateOrderList("ac1,fc1")).toEqual([]);
  })

  it('returns []] for category', () => {
    expect(validateOrderList('category')).toEqual([]);
  })

  it('returns [] for "category,ac1" ', () => {
    expect(validateOrderList("category,ac1")).toEqual([]);
  });

  it('returns [false, false] for "category,false,ac1,false"', () => {
    expect(validateOrderList("category,false,ac1,false")).toEqual(['false','false']);
  });

  it('returns [true] for "true"  ', () => {
    expect(validateOrderList('true')).toEqual(['true']);
  });

});


describe('isValidi18nMode', () => {
  it('returns false for none', () => {
    expect(isValidi18nMode("none")).toEqual(false);
  });

  it('returns true for all', () => {
    expect(isValidi18nMode("all")).toEqual(true);
  })

  it('returns false for ac,fc', () => {
    expect(isValidi18nMode("ac,fc")).toEqual(false);
  })

  it('returns true for meta', () => {
    expect(isValidi18nMode('meta')).toEqual(true);
  })

  it('returns false for "category,ac" ', () => {
    expect(isValidi18nMode("category,ac")).toEqual(false);
  });

  it('returns false for null ', () => {
    expect(isValidi18nMode(null)).toEqual(false);
  });
});

describe('categoryThereOf tests', () => {
  it('valid object', () => {
    expect(validateCategoryThereOfJsonStr("{\"pp1\": [{\"name\": \"test\", \"subGroups\": [\"test\"]}]}")).toEqual([]);
  });

  it('invalid object', () => {
    expect(validateCategoryThereOfJsonStr("all")).toEqual(["Invalid JSON structure"]);
  })

  it('invalid subobject', () => {
    expect(validateCategoryThereOfJsonStr("{\"pp1\": [{\"name\": \"test\", \"subGroups\": []}],\n" +
      "                                           \"ac1\": {\"name\": \"test\", \"subGroups\": [\"test\"]}]}")).toEqual([ "Invalid JSON structure"]);
  })

});

describe('gpxs tests', () => {
  it('valid object', () => {
    expect(validateGpxType("[{\"file\": \"http://localhost:3333/build/assets/gpx/Fahrt_am_Nachmittag.gpx\", \"color\": \"#FC5200\", \"opacity\": 0.75, \"weight\": 3, \"lineCap\": \"round\"}]")).toEqual([]);
  });
});
