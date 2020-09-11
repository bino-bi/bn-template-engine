import { r as registerInstance, h } from './index-6253379c.js';
import './_commonjsHelpers-9eb5a9ce.js';
import { T as TableType, O as OrderDirection, I as I18nMode } from './model-06841a6d.js';
import { a as alasql_min } from './alasql.min-a77c7b4c.js';

/**
 * Ruleset defines styles and formats used for IBCS-Charts
 * Implements IBVS 1.2
 */
class IBCSRuleSet {
    constructor() {
        this._scenarioMap = new Map();
        this._fallBackScenario = { name: 'Series', group: 'Series', colorIndex: 10, sortIndex: 120 };
        /*private readonly _dateFormatter: DateFormatDescriber = {
          day: {
            short: "dd",
            first: "dd. MMM",
            long: "DD.MM.YYYY"
          },
          week: {
            short: "WW",
            first: "WW'YY",
            long: "WW YYYY"
          },
          month: {
            short: "MMM",
            first: "MMM'YY",
            long: "MMM YYYY",
          },
          quarter: {
            short: "Q[Q]",
            first: "Q[Q]'YY",
            long: "Q[Q] YYYY",
          },
          year: {
            short: "YY",
            first: "YYYY",
            long: "YYYY",
          },
          fallback: "dd.mm.YYYY"
          };
        */
        this._dateFormat = {
            year: "YYYY",
            quarter: "Q[Q] YYYY",
            month: "MMM YYYY",
            locale: "[KW]WW YYYY",
            day: "DD.MM.YYYY"
        };
        this._dateLinkFormat = {
            avg: "Ø[DATE]",
            interval: "[DATE]..[DATE]",
            start: ".[DATE]",
            end: "[DATE].",
            ytd: "_[DATE]",
            ytg: "[DATE]_",
            cum: "[DATE]_[DATE]",
            mat: "~[DATE]",
            none: "[DATE]"
        };
        // defines scenario sortIndex an colour
        this._scenarioMap.set('AC', { name: 'AC', group: 'AC', colorIndex: 10, sortIndex: 120 });
        this._scenarioMap.set('AC2', { name: 'AC2', group: 'AC', colorIndex: 10, sortIndex: 110 }); //11
        this._scenarioMap.set('AC3', { name: 'AC3', group: 'AC', colorIndex: 10, sortIndex: 100 }); //12
        this._scenarioMap.set('PP', { name: 'PP', group: 'PP', colorIndex: 20, sortIndex: 90 });
        this._scenarioMap.set('PP2', { name: 'PP2', group: 'PP', colorIndex: 20, sortIndex: 80 }); //20
        this._scenarioMap.set('PP3', { name: 'PP3', group: 'PP', colorIndex: 20, sortIndex: 70 }); //21
        this._scenarioMap.set('PY', { name: 'PY', group: 'PP', colorIndex: 20, sortIndex: 90 });
        this._scenarioMap.set('PY2', { name: 'PY2', group: 'PP', colorIndex: 20, sortIndex: 80 }); //20
        this._scenarioMap.set('PY3', { name: 'PY3', group: 'PP', colorIndex: 20, sortIndex: 70 }); //21
        this._scenarioMap.set('dPP+', { name: 'dPP', group: 'PP', colorIndex: 90, sortIndex: 120 });
        this._scenarioMap.set('dPY+', { name: 'dPY', group: 'PP', colorIndex: 90, sortIndex: 120 });
        this._scenarioMap.set('dPL+', { name: 'dPY', group: 'PL', colorIndex: 90, sortIndex: 120 });
        this._scenarioMap.set('dFC+', { name: 'dFC', group: 'FC', colorIndex: 90, sortIndex: 120 });
        this._scenarioMap.set('dPP-', { name: 'dPP', group: 'PP', colorIndex: 92, sortIndex: 120 });
        this._scenarioMap.set('dPY-', { name: 'dPY', group: 'PP', colorIndex: 92, sortIndex: 120 });
        this._scenarioMap.set('dPL-', { name: 'dPY', group: 'PL', colorIndex: 92, sortIndex: 120 });
        this._scenarioMap.set('dFC-', { name: 'dFC', group: 'FC', colorIndex: 92, sortIndex: 120 });
        this._scenarioMap.set('FC', { name: 'FC', group: 'FC', colorIndex: 30, sortIndex: 30 });
        this._scenarioMap.set('FC2', { name: 'FC2', group: 'FC', colorIndex: 30, sortIndex: 20 }); //31
        this._scenarioMap.set('FC3', { name: 'FC3', group: 'FC', colorIndex: 30, sortIndex: 10 }); //32
        this._scenarioMap.set('PL', { name: 'PL;', group: 'PL', colorIndex: 50, sortIndex: 60 });
        this._scenarioMap.set('PL2', { name: 'PL2', group: 'PL', colorIndex: 50, sortIndex: 50 }); //51
        this._scenarioMap.set('PL3', { name: 'PL3', group: 'PL', colorIndex: 50, sortIndex: 40 }); //52
        this._scenarioMap.set('BU', { name: 'BU;', group: 'PL', colorIndex: 50, sortIndex: 60 });
        this._scenarioMap.set('BU2', { name: 'BU2', group: 'PL', colorIndex: 50, sortIndex: 50 }); //51
        this._scenarioMap.set('BU3', { name: 'BU3', group: 'PL', colorIndex: 50, sortIndex: 40 }); //52
    }
    getScenario(scenarioName) {
        if (this._scenarioMap.has(scenarioName)) {
            return this._scenarioMap.get(scenarioName);
        }
        else {
            return this._fallBackScenario;
        }
    }
    getScenarioGroup(scenarioName) {
        if (this._scenarioMap.has(scenarioName)) {
            return this._scenarioMap.get(scenarioName).name;
        }
        else {
            return this._fallBackScenario.name;
        }
    }
    getScenarioColorIndex(scenarioName) {
        if (this._scenarioMap.has(scenarioName)) {
            return this._scenarioMap.get(scenarioName).colorIndex;
        }
        else {
            return this._fallBackScenario.colorIndex;
        }
    }
    getScenarioSorIndex(scenarioName) {
        if (this._scenarioMap.has(scenarioName)) {
            return this._scenarioMap.get(scenarioName).sortIndex;
        }
        else {
            return this._fallBackScenario.sortIndex;
        }
    }
}

// export interface Scenario {
//      name: string;
//      group: string;
//      colorIndex: number;
//      sortIndex: number;
//    }
var GroupSelection;
(function (GroupSelection) {
    GroupSelection[GroupSelection["ALL"] = -1] = "ALL";
})(GroupSelection || (GroupSelection = {}));
var FactoryState;
(function (FactoryState) {
    FactoryState[FactoryState["UP_TO_DATE"] = 0] = "UP_TO_DATE";
    FactoryState[FactoryState["DIRTY"] = 1] = "DIRTY";
})(FactoryState || (FactoryState = {}));
class QueryGroups {
    constructor(dataQueryMap, config, _columnNameMap) {
        // prepares category names usesd for query depending on config
        // grpips RAW is a array of Gorups while groups are
        // creatges a local class copy of dataQueryMap
        this._dataQueryMap = dataQueryMap;
        this.groups = [this._dataQueryMap.category];
        if (TableType.OPT == config.type) {
            this.groups.unshift(_columnNameMap.operation);
        }
        if (config.grouped) {
            this.groups.push(this._dataQueryMap.rowgroup);
        }
    }
    toString() {
        return this.groups.map(s => `${s}`).toString() || null;
    }
    noCategory() {
        return this.groups.filter((element) => element != this._dataQueryMap.category);
    }
    toArray() {
        return this.groups;
    }
}
class TableDataSetFactory {
    /**
     * Initialises all Variables for the DataSet, created by the factory
     * @param ruleSet
     */
    constructor(ruleSet) {
        // INFO:
        // class variables starting with _ represent default values of the factory
        //
        // NameMap to map the RawDataSet Row columns to the internal used names
        this._columnNameMap = {
            operation: 'operation',
            rowgroup: 'rowgroup',
            rowgroupindex: 'rowgroupindex',
            currentrow: 'currentrow',
            category: 'category',
            categoryindex: 'categoryindex',
            subcategory: 'subcategory',
            subcategoryindex: 'subcategoryindex',
            columngroup: 'columngroup',
            columnindex: 'columnindex',
            columnsubgroup: 'columnsubgroup',
            columnsubgroupindex: 'columnsubgroupindex',
            ac: 'ac',
            ac2: 'ac2',
            ac3: 'ac3',
            py: 'py',
            py2: 'py2',
            py3: 'py3',
            fc: 'fc',
            fc2: 'fc2',
            fc3: 'fc3',
            pl: 'pl',
            pl2: 'pl2',
            pl3: 'pl3',
        };
        // Map used for default Values in DataQuery used in queryData
        this._dataQueryMap = {
            category: 'category',
            categoryindex: 'categporyindex',
            rowgroup: 'rowgroup',
            rowgroupindex: 'rowgroupindex',
            orderdirection: 'asc',
        };
        // Default configuration as a fallback if config is not filled correctly
        this._config = {
            title: '',
            scenarios: ["ac"],
            grouped: false,
            thereof: [],
            order: {
                columnshierachy: ['category'],
                direction: OrderDirection.ASC
            },
            type: TableType.LIST,
            limit: 0,
            i18n: I18nMode.NONE,
        };
        this.ruleSet = ruleSet || new IBCSRuleSet();
        this.dataSet = {
            type: null,
            version: null,
            name: null,
            author: null,
            descripton: null,
            executedby: null,
            timestamp: null,
            query: null,
            header: [],
            details: []
        };
        this.config = Object.assign({}, this._config);
        this.i18n = new Map();
        this.preparedDataSet = [];
        this.state = FactoryState.DIRTY;
    }
    /**
     * Init load of  Metadata for the to be generated
     * DataSet.
     * Values like executed by, timestamp and query are updated
     * during the generation processes
     *
     * @param meta
     */
    setMetaData(meta) {
        this.state = FactoryState.DIRTY; //mark dataSet for update
        this.dataSet.type = meta.type;
        this.dataSet.version = meta.version;
        this.dataSet.name = meta.name;
        this.dataSet.author = meta.author;
        this.dataSet.descripton = meta.descripton;
        this.dataSet.executedby = meta.executedby;
        this.dataSet.timestamp = meta.timestamp;
        this.dataSet.query = meta.query;
    }
    /**
     * Init load of translation dictionary map
     * map is used to translate lables in the table
     *
     * example:
     * ```
     *   let i18n: Map<string, string> = new Map();
     *   [{key: 'ac',value: 'AC'}].forEach(function(entry){
     *         i18n.set(entry.key, entry.value);
     *   })
     * ```
     * @param i18n
     */
    setI18n(i18n) {
        this.state = FactoryState.DIRTY; //mark dataSet for update
        this.i18n = i18n || new Map();
    }
    /**
     * Init load raw datasets the loaded dataset is
     * the base on which the filters defined in the config
     * are apllied on internaly it is called prepared DataSet
     *
     * @param data
     * @param customColumnNameMap Custon ColumnNameMap can be used if data uses non standard columnames
     */
    setData(data, customColumnNameMap) {
        this.state = FactoryState.DIRTY; //mark dataSet for update
        this.preparedDataSet.length = 0; // cleans formerly loaded and prepared  dataset
        let self = this;
        let columnNameMap = customColumnNameMap || Object.assign({}, this._columnNameMap);
        data.forEach(function (set) {
            set.data.forEach(function (row) {
                self.preparedDataSet.push({
                    operation: row[columnNameMap.operation] || null,
                    rowgroup: row[columnNameMap.rowgroup] || null,
                    rowgroupindex: row[columnNameMap.currentrow] || null,
                    category: row[columnNameMap.category] || null,
                    categoryindex: row[columnNameMap.categoryindex] || null,
                    subcategory: row[columnNameMap.subcategory] || null,
                    subcategoryindex: row[columnNameMap.subcategoryindex] || null,
                    columngroup: row[columnNameMap.columngroup] || set.setname,
                    columnIndex: row[columnNameMap.columnindex] || null,
                    columnSubGroup: row[columnNameMap.columnsubgroup] || null,
                    columnSubGroupIndex: row[columnNameMap.columnsubgroupindex] || null,
                    ac: row[columnNameMap.ac] || null,
                    ac2: row[columnNameMap.ac2] || null,
                    ac3: row[columnNameMap.ac3] || null,
                    py: row[columnNameMap.py] || null,
                    py2: row[columnNameMap.py2] || null,
                    py3: row[columnNameMap.py3] || null,
                    fc: row[columnNameMap.fc] || null,
                    fc2: row[columnNameMap.fc2] || null,
                    fc3: row[columnNameMap.fc3] || null,
                    pl: row[columnNameMap.pl] || null,
                    pl2: row[columnNameMap.pl2] || null,
                    pl3: row[columnNameMap.pl3] || null,
                });
            });
        });
    }
    /**
     * loads and varifies configuration which describes
     * the filte for the to be generated dataset
     *
     * missing but necessary attributes are replaced by default values
     *
     * @param config
     */
    setConfig(config) {
        this.state = FactoryState.DIRTY; //mark dataSet for update
        this.config = config || Object.assign({}, this._config);
        // checks all transmitted values, if they are invalid,
        // warning is raised and the values were deltet, which result into a default setting (see next loop)
        // for (let key in config){
        console.log("TODO: Implement Adapterpattern");
        //}
        // validates if config is default config and if config is filled correctly
        // missing values are replaced with default values.
        for (let key in this._config) {
            if (this.config[key] == null) {
                if (typeof this._config[key] != 'object') {
                    // because of a needed deepcopy for arrays and collections
                    // objects and non objects have to treated differently
                    this.config[key] = this._config[key];
                }
                else {
                    // Deep[ Copy if object]
                    if (Array.isArray(this._config[key])) {
                        this.config[key] = [...this._config[key]];
                    }
                    else {
                        this.config[key] = Object.assign({}, this._config[key]);
                    }
                }
            }
        }
        // sorting scenario order based on Ruleset
        let self = this;
        this.config.scenarios.sort((n1, n2) => {
            return self.ruleSet.getScenarioSorIndex(n1) - self.ruleSet.getScenarioSorIndex(n2);
        });
    }
    /**
     * Generates and Returns the DataSet based,
     * data and conifig.
     * if data or config have not been changed since last run
     * the dataSet will not be regenerated.
     */
    generateDataSet() {
        // console.log('generateDataSet', this.state);
        if (FactoryState.DIRTY == this.state) {
            this.createHeader();
            this.createData();
            this.state = FactoryState.UP_TO_DATE;
        }
        return this.dataSet;
    }
    /**
     * Creates Tableheader based on the configured scenarios (in config)
     * the created header is stored in the dataset json
     * the lables are translated based on the used i18n map
     * based on the structure of the scenarios 'spacer'coulumns are added, to
     * visualise grouping.
     * finally a seperator header row is created for the header underlining
     */
    createHeader() {
        this.normalizedHeader = this.nomalizeHeader();
        let headerRow = { index: 0, groupindex: 0, type: "standard", elements: [] };
        let seperatorRow = { index: 1, groupindex: 0, type: "group", elements: [] };
        let i = 0;
        for (var scenario of this.normalizedHeader) {
            headerRow.elements.push({
                key: scenario,
                index: i,
                colSpan: 1,
                origin: { "value": this.translateScenarioLabel(scenario), "cssStyle": "headerlabel", "colSpan": 1 }
            });
            seperatorRow.elements.push({
                key: scenario,
                index: i,
                colSpan: 1,
                origin: { "value": null, "cssStyle": scenario, "colSpan": 1 }
            });
            i += 1;
        }
        this.dataSet.header.push(headerRow);
        this.dataSet.header.push(seperatorRow);
    }
    /**
     * combines the default columnnames (operation and category) with the
     * configured scenarios.
     * depending of table type operation column is used (OPT) or not (SUM | LIST)
     * in addition the headers are sorted based on the ruleset and duplicates are removed
     */
    nomalizeHeader() {
        // TODO Sort groups
        let header = TableType.OPT == this.config.type ? ['operation', 'category'] : ['category'];
        this.ruleSet.getScenarioSorIndex;
        // NOTE: scenarios are allready sorted in setConfig
        return [...header, ...this.config.scenarios];
    }
    /**
     * Getter for DataSets MetaData
     */
    getMetaData() {
        return [this.dataSet.type,
            this.dataSet.version,
            this.dataSet.name,
            this.dataSet.author,
            this.dataSet.descripton,
            this.dataSet.executedby,
            this.dataSet.timestamp.toDateString(),
            this.dataSet.query
        ];
    }
    /**
     * Crates a detail row depending on the radDataRow Type
     * it switches between header, sum and standard,
     *
     * @param type      valid values GROUPHEADER, SUM   other values are interpreted as standard
     * @param rowIndex
     * @param groupIndex
     * @param maxIndex  total number of rows
     */
    createDetailRow(type, rowIndex, groupIndex, maxIndex) {
        let newRow;
        if ('GROUPHEAD' === type) {
            // TODO reiehenfolge ist nun entscheided da grouphead und sum beide scenario null sind
            newRow = { index: rowIndex, groupindex: groupIndex, type: "HEADER", cssStyle: "groupheader", elements: [] };
        }
        else if ('SUM' === type || 'GROUP_SUM' === type) { //TODO SUM als total naem erstellen
            newRow = { index: maxIndex + 2, groupindex: groupIndex, type: 'SUM', cssStyle: 'sum', elements: [] };
        }
        else if ('DRILLELEMENT' === type) {
            newRow = { index: maxIndex + 2, groupindex: groupIndex, type: 'DRILLELEMENT', cssStyle: 'ofit', elements: [] };
        }
        else {
            newRow = { index: rowIndex, groupindex: groupIndex, type: "STANDARD", elements: [] };
        }
        return newRow;
    }
    /**
     * Creates detail element
     * categoryies are translated if element is a sum or header name
     *
     * @param scenario
     * @param iElementIndex
     * @param value   string | number
     * @param type    valid values (sum, header or standard)
     * @param groupname
     * @param subcategory
     */
    createDetailElement(scenario, iElementIndex, value, type, groupname, subcategory) {
        return {
            key: scenario,
            index: iElementIndex,
            colSpan: 1,
            origin: {
                "value": this.translateSumCellLabel(value, groupname, type, scenario, subcategory),
                "cssStyle": this.translateScenarioCSS(scenario, value >= 0 ? "pos" : "neg"),
                "colSpan": 1 // NOTE: JHE:currently ony 1 column span supported. will be changed after coulmn gouping is implemented
            }
        };
    }
    /**
     * Translates Cell-Value (value) if possible,
     * Numbers are not translated, just category names,
     * if it is a SUM ROW  rowgroup is used
     * if it is a variance in OPT mode the absolute value is used
     *
     * @param value
     * @param rowgroup
     * @param type
     * @param scenario
     * @param subcategory
     */
    translateSumCellLabel(value, rowgroup, type, scenario, subcategory) {
        // Drilldown Elements des get another categorty name
        if ('DRILLELEMENT' == type && Number.isNaN(Number(value)) && 'operation' != scenario) {
            value = subcategory;
        }
        if (('GROUP_SUM' == type || 'SUM' == type) && Number.isNaN(Number(value)) && 'operation' != scenario) {
            value = rowgroup;
        }
        let translate = false;
        let retValue;
        // Rules if Item should be translated or not
        if (I18nMode.ALL == this.config.i18n && Number.isNaN(Number(value))) {
            translate = true;
        }
        else if (I18nMode.META == this.config.i18n && Number.isNaN(Number(value))) {
            translate = true;
        }
        else if (I18nMode.NONE == this.config.i18n) {
            translate = false;
        }
        else {
            translate = false;
        }
        if (translate == true) {
            // translates value
            if (value == null) {
                // Colums in Headerrow must not be autofilled with row
                if ('GROUPHEAD' !== type && 'DRILLELEMENT' !== type) {
                    value = rowgroup;
                }
            }
            retValue = this.i18n.get(value);
            if (retValue == null) {
                retValue = value;
            }
            if ('DRILLELEMENT' == type) {
                if (retValue) {
                    retValue = `${this.i18n.get('thereof')}  ${retValue}`;
                }
            }
        }
        else {
            if (TableType.OPT == this.config.type && !Number.isNaN(Number(value)) && 'SUM' != type) {
                // regexMatch is scenario a variance
                if (this.parseVarianceScenario(scenario).length > 0) {
                    retValue = Number(value);
                }
                else {
                    retValue = Math.abs(Number(value));
                }
            }
            else {
                // category or symbol
                retValue = value;
            }
        }
        return retValue;
    }
    /**
     * Test string if it is a variance
     * e.g.  dpl_ac_pos
     *
     * returns a array of 3 values [base, delta, direction]
     * @param scenario
     */
    parseVarianceScenario(scenario) {
        let scenarioTestRegex = /d(pl\d?|ac\d?|fc\d?|py\d?|bu\d?|pp\d?)(_(pl\d?|ac\d?|fc\d?|py\d?|bu\d?|pp\d?))?(_pos|_neg)?/;
        // regexMatch is scenario a variance
        if (scenarioTestRegex.test(scenario)) {
            let tokens = scenarioTestRegex.exec(scenario);
            return [String(tokens[1]), String(tokens[3]), String(tokens[4])];
        }
        return [];
    }
    /**
     * converts technical scenario string into readable ibcs label
     *
     * @param scenario
     */
    translateScenarioSQL(scenario) {
        let scenarios = this.parseVarianceScenario(scenario);
        if (scenarios.length > 0) {
            if (scenarios[0] != null && scenarios[1] != null) {
                return `SUM(${scenarios[0]} - ${scenarios[1]}) as ${scenario}`;
            }
            else {
                return '';
            }
        }
        else {
            return `SUM(${scenario}) as ${scenario}`;
        }
    }
    /**
     * converts Scenario Labels from technical to readable
     *
     * @param scenario
     */
    translateScenarioLabel(scenario) {
        let scenarios = this.parseVarianceScenario(scenario);
        if (scenarios.length > 0) {
            if (scenarios[0] != null && scenarios[1] != null) {
                if ('ac' == scenarios[1]) {
                    return `${this.i18n.get('ibcssymbol_delta_ac').replace('{%}', this.i18n.get(scenarios[0]))}`;
                }
                else {
                    let scenariolabel = `${this.i18n.get(scenarios[0])} - ${this.i18n.get(scenarios[1])}`;
                    return `${this.i18n.get('ibcssymbol_delta_generic').replace('{%}', scenariolabel)}`;
                }
            }
            else {
                return '';
            }
        }
        else {
            return `${this.i18n.get(scenario)}`;
        }
    }
    /**
     * converts Scenario to CSS class
     *
     * @param scenario
     * @param prefix
     */
    translateScenarioCSS(scenario, prefix) {
        let scenarios = this.parseVarianceScenario(scenario);
        if (scenarios.length > 0) {
            if (scenarios[0] != null && scenario[1] != null) {
                return scenarios[2] != 'undefined' ? prefix + scenarios[2] : scenarios[1];
            }
            else {
                return '';
            }
        }
        else {
            return scenario;
        }
    }
    /**
     * Creates table data colelction,
     * eachh row consists of data columns and 'spacer' columns which are needed to seperate
     * the columns correctyl (IBCS style)
     */
    createData() {
        let iGroupindex = -1; // index used in detailRow JSON to count the current group
        let queryData = this.queryData(); // collection of all query results
        for (var groupData of queryData) {
            // groupData is a collection of dataRows, each group base on a query and represents a 'row' group
            iGroupindex += 1;
            let iRowIndex = -1;
            this.createElementRow(groupData, iGroupindex, iRowIndex);
        }
    }
    /**
     * Helper funciton to generate a new Table Row,
     * it calls itsself recursive if a drilldown is set by the config file.
     * a drilldown is detected if there is a colection of rows in .drill
     *
     * @param groupData
     * @param iGroupindex
     * @param iRowIndex
     */
    createElementRow(groupData, iGroupindex, iRowIndex) {
        for (var rawDataRow of groupData) {
            iRowIndex += 1;
            // create next table row
            let detailsRow = this.createDetailRow(rawDataRow['type'], iRowIndex, iGroupindex, groupData.length);
            // TODO -- fix sorting
            let iElementIndex = -1;
            for (var scenario of this.normalizedHeader) {
                iElementIndex += 1;
                detailsRow.elements.push(this.createDetailElement(scenario, iElementIndex, rawDataRow[scenario], rawDataRow['type'], rawDataRow['groupname'], rawDataRow['subcategory']));
            }
            this.dataSet.details.push(detailsRow);
            // generate drilldown row of the parent detailrow
            if (rawDataRow.drill != null && Array.isArray(rawDataRow.drill)) {
                this.createElementRow(rawDataRow.drill, iGroupindex, iRowIndex);
            }
        }
    }
    /**
     * generates Tuple
     *  [0] orderby string example:   category asc
     *  [1] inverted order example:   category desc
     * @param orderComponent
     */
    createOrderString(orderComponent) {
        let base = '';
        let inverted = '';
        base = `${orderComponent.columnshierachy.toString()} ${orderComponent.direction}`;
        inverted = `${orderComponent.columnshierachy.toString()} ${OrderDirection.ASC == orderComponent.direction ? OrderDirection.DESC : OrderDirection.ASC}`;
        return [base, inverted];
    }
    /**
     * prepares and queries Data based on the config.
     */
    queryData() {
        // QueryBuilder ggf eigene klasse :)
        // default SELECTION
        let querys = [];
        //let orderdirection = this.config.order.direction;
        //let invertedorderdirection = orderdirection == 'asc'? 'desc' : 'asc';
        let scenarios = this.config.scenarios.map(s => this.translateScenarioSQL(s)).toString();
        let groups = new QueryGroups(this._dataQueryMap, this.config, this._columnNameMap);
        let groupsAggrigated = this.config.grouped ? [this._dataQueryMap.rowgroup] : [];
        //let {order, orderInvertend} = this.createOrderString(this.config.order, false);
        let order = this.createOrderString(this.config.order);
        // let : string = this.createOrderString(this.config.order, true);
        let res = []; // result set
        // meta defines groups and the number detail rows in each group
        // Bsp:  0: Object { totalrowcnt: 7, rowgroup: "Umsatz" }
        let meta = alasql_min(`SELECT COUNT(DISTINCT ${this._dataQueryMap.category}) as totalrowcnt ${groupsAggrigated.length > 0 ? ',' + groupsAggrigated : ''} FROM ? ${groupsAggrigated.length > 0 ? 'GROUP BY ' + groupsAggrigated : ''}`, [this.preparedDataSet]);
        // Creates DataSelection for LIST
        meta.forEach(rowGroupEntry => {
            // the following variables are 'helper sections' which are used to constuct dynamicly the sql statement depending of the given config
            // is grouping active?
            let queryWhereSection = (rowGroupEntry.rowgroup && rowGroupEntry.rowgroup.length > 0) ? `WHERE ${this._dataQueryMap.rowgroup} = '${rowGroupEntry.rowgroup}'` : ``;
            // is limit active?
            let queryLimitSection = (this.config.limit) ? `LIMIT ${this.config.limit}` : ``;
            let queryInvertedLimitSection = (this.config.limit) ? `LIMIT ${rowGroupEntry.totalrowcnt - this.config.limit > 0 ? rowGroupEntry.totalrowcnt - this.config.limit : 0}` : ``;
            let queryRESTGroupBySection = groups.noCategory().length > 0 ? `GROUP BY ${groups.noCategory().toString()}` : ``;
            // Generates GroupHeader Row
            if (true == this.config.grouped) {
                var groupTitle = this.config.showGroupTitle ? `,'${rowGroupEntry.rowgroup}' as category` : '';
                querys.push(`SELECT ROWNUM() AS rownr, ${querys.length} as groupindex, 'GROUPHEAD' as type, '${rowGroupEntry.rowgroup}' as groupname ${groupTitle} FROM ? GROUP BY '1'`);
            }
            // Generates DataRows
            querys.push(`SELECT ROWNUM() AS rownr, ${querys.length} as groupindex, 'ENTRY' as type, '${rowGroupEntry.rowgroup || "NO_GROUP"}' as groupname, ${groups}, ${scenarios} FROM ? ${queryWhereSection}GROUP BY ${groups} ORDER BY ${order[0]} ${queryLimitSection}`);
            // Generates REST Row; sumsup the Bottom (total number of rows - limit)
            if (rowGroupEntry.totalrowcnt - this.config.limit > 0 && this.config.limit != 0) {
                querys.push(`SELECT ROWNUM() AS rownr, ${querys.length} as groupindex, 'ENTRY' as type, '${rowGroupEntry.rowgroup || "NO_GROUP"}' as groupname, ${groups.noCategory().length > 0 ? groups.noCategory().toString() + ',' : ''} 'REST' as category, ${scenarios} FROM ? ${queryWhereSection} ${queryRESTGroupBySection} ORDER BY ${order[1]} ${queryInvertedLimitSection}`);
            }
            // Generates SUM Row; sumsup all rows of group
            if (true == this.config.grouped && (TableType.SUM == this.config.type || TableType.OPT == this.config.type)) {
                querys.push(`SELECT ${querys.length} as groupindex,'=' as operation, '${rowGroupEntry.rowgroup}' as groupname,  ROWNUM() AS rownr, 'GROUP_SUM' as type, ${scenarios} FROM ? WHERE rowgroup = '${rowGroupEntry.rowgroup}'  ORDER BY ${order[0]} `);
            }
        });
        if (TableType.SUM == this.config.type || TableType.OPT == this.config.type) {
            querys.push(`SELECT ${querys.length} as groupindex, '${this.config.title}' as groupname, '=' as operation, 'SUM' as type, ${scenarios}  FROM ?  `);
        }
        // executes main queries
        let self = this; // helper
        querys.forEach(function (query) {
            res.push(alasql_min(query, [self.preparedDataSet]));
        });
        // adds drill rows if setup in config
        // if there of is set drilldown row is displayed with absolute numbers,
        // if part of is also not null a relative percenatage based of the selected basis is displayed
        if (this.config.thereof != undefined && this.config.thereof.length > 0) {
            let drillquerys = [];
            let resDrill = []; // set of drill (subquery result injected into resultset)
            // let rollgroups = ['category']; // frage wo kommt das her ?
            // create drill queryies based on config
            let fromstring = '1 <> 1'; // helper for strin concat  1<>1 OR ... OR ...
            this.config.thereof.forEach(element => {
                fromstring += `OR (category = '${element.category}'`;
                if (!(null == element.rowgroup || 0 == element.rowgroup.length || !element.rowgroup.trim())) {
                    // if not empty
                    fromstring += `and rowgroup = '${element.rowgroup}'`;
                }
                if (!(null == element.subcategory || 0 == element.subcategory.length || !element.subcategory.trim())) {
                    // if not empty
                    fromstring += `and subcategory = '${element.subcategory}'`;
                }
                fromstring += `)`;
            });
            // invertet Sort directon because the later used insertion which results into expected order direction
            drillquerys.push(`SELECT ROWNUM() AS rownr,  'DRILLELEMENT' as type, category, subcategory, rowgroup  as groupname , ${scenarios} FROM ? WHERE ${fromstring} GROUP BY rowgroup, category, subcategory  ORDER BY ${order[1]}`);
            drillquerys.forEach(function (query) {
                resDrill.push(...alasql_min(query, [self.preparedDataSet]));
            });
            // finds ParentElement of Drill Element and injects into result array
            if (this.config.grouped === true) {
                resDrill.forEach(function (drillItem) {
                    res.forEach(function (resSegment) {
                        let index = resSegment.findIndex(e => e.category === drillItem.category && e.groupname === drillItem.groupname);
                        if (index >= 0) {
                            resSegment.splice(index + 1, 0, drillItem);
                        }
                    });
                });
            }
            else {
                // if no grouped mode selected matching only searching for category not for groupname
                resDrill.forEach(function (drillItem) {
                    res.forEach(function (resSegment) {
                        let index = resSegment.findIndex(e => e.category === drillItem.category);
                        if (index >= 0) {
                            resSegment.splice(index + 1, 0, drillItem);
                        }
                    });
                });
            }
        }
        return res;
    }
}

const ibcsTableCss = "table{background-color:white;color:black;font-family:sans-serif;border-spacing:0.3rem 0}thead{border-style:none}td{border-top:0.1rem dotted #ddd;padding-left:0.5rem;white-space:nowrap}tr:first-child td{border-top:none;padding-top:0.5rem}td.ac,td.py,td.pl,td.fc,td.share,td.variance,td.pos_pos,td.pos_neg,td.neg_pos,td.neg_neg{text-align:right}th{border-bottom:0.1rem solid black;text-align:right;font-weight:normal;vertical-align:center}th.ofit,td.ofit,tr.ofit{font-size:0.6rem;font-style:italic}td.ofit{font-size:0.6rem;font-style:italic}th.ofit td,tr.ofit td{border-top:0.0rem solid black}th.ofit share,tr.share td{border-top:0.0rem solid black}th.share,tr.share,td.share{font-size:0.6rem;font-style:italic}th.filler{border-bottom:.0rem solid black;text-align:right}td.filler{border-top:0.0rem none !important;border-bottom:0.0rem none;text-align:right}th.group{text-align:center;border-spacing:1rem 0}th.headerlabel{border-bottom:0.0rem none black;padding-bottom:0rem}td.variance:after{content:'%'}th.relative{border-color:green}td.pos_pos{color:green}td.neg_pos{color:red}td.pos_neg{color:red}td.neg_neg{color:green}th.ac{padding-top:0rem;border-bottom:0.3rem solid black}th.py{padding-top:0rem;border-bottom:0.3rem solid grey}th.pl{padding-top:0rem;border-bottom:0.3rem double black}th.fc{padding-top:0rem;border-bottom:0.3rem solid black;border-image-slice:12 12 12 12;border-image-width:0px 0px 0.3rem 0px;border-image-outset:0px 0px 0px 0px;border-image-repeat:repeat repeat;border-image-source:url(\"https://mdn.mozillademos.org/files/6015/border-image-5.png\")}td.colsum{font-weight:bold}th.colsum{padding-top:0rem;font-weight:bold}tr.sum td{border-top:0.1rem solid black;font-weight:bold;padding-bottom:0.5rem}tr.groupheader td{border-top:0.0rem dotted #ddd;padding-top:0.5rem;font-weight:bold;font-style:italic}tr.begingroup td{border-top:0.0rem dotted #ddd;padding-top:0.5rem}th.begin-group{padding-left:10px}th.end-group{padding-left:10px}td{-webkit-column-width:2.5rem;-moz-column-width:2.5rem;column-width:2.5rem}";

const IbcsTable = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    // @Prop()
    // meta?: ComponentMetaData;
    renderRow(row) {
        let result = [];
        for (let cell of row.elements) {
            result.push(cell.origin);
            if (cell.ofit) {
                result.push(cell.ofit);
            }
            if (cell.share) {
                result.push(cell.share);
            }
        }
        return result;
    }
    newLineWrapper(cellValue) {
        let result = [];
        if (cellValue == null) {
            cellValue = '';
        }
        for (let line of cellValue.toString().split('<br/>')) {
            result.push(line);
        }
        return result;
    }
    render() {
        //this.useTmpData();
        //this.useTestData();
        this.useComponentProperties();
        return (h("table", null, h("thead", null, this.redefinedData.header.map((row) => h("tr", { class: row.cssStyle }, this.renderRow(row).map((cell) => h("th", { colSpan: cell.colSpan, class: cell.cssStyle }, this.newLineWrapper(cell.value).map((line, i, arr) => h("span", null, i == (arr.length - 1) ? h("span", null, line) : h("span", null, line, h("br", null))))))))), h("tbody", null, this.redefinedData.details.map((row) => h("tr", { class: row.cssStyle }, this.renderRow(row).map((cell) => h("td", { colSpan: cell.colSpan, class: cell.cssStyle }, cell.value)))))));
    }
    useComponentProperties() {
        let data = this.data;
        let config = {
            title: this.tableTitle,
            scenarios: this.scenarios,
            grouped: this.grouped,
            showGroupTitle: this.showGroupTitle,
            thereof: this.thereof,
            order: this.order,
            type: this.type,
            limit: this.limit,
            i18n: this.i18nMode,
        };
        let i18n = this.i18n;
        let meta = {
            type: "table",
            version: "1.0",
            name: name,
            author: "Jens Herrmann<jens@bino.bi>",
            descripton: "Beispiel DatenSet fuer eine Tabelle",
            executedby: "Sven Herrmann<sven@bino.bi>",
            timestamp: new Date('2019-09-17T08:52:44Z'),
            query: "select * from test where 1"
        };
        // Initialisiert Factory und setzt die MetaDaten
        let tableDataSetFactory = new TableDataSetFactory(new IBCSRuleSet());
        tableDataSetFactory.setMetaData(meta);
        tableDataSetFactory.setI18n(i18n);
        tableDataSetFactory.setData(data);
        tableDataSetFactory.setConfig(config);
        this.redefinedData = tableDataSetFactory.generateDataSet();
    }
    useTestData() {
        //this.data = JSON.parse('{"type":"table","version":"1.0","name":"umsatz","author":"Jens Herrmann<jens@bino.bi>","descripton":"Beispiel DatenSet fuer eine Tabelle","executedby":"Sven Herrmann<sven@bino.bi>","timestamp":"2019-09-17T08:52:44.000Z","query":"select * from test where 1","header":[{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"value":"categories","cssStyle":"headerlabel","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":"AC","cssStyle":"headerlabel","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":"PL","cssStyle":"headerlabel","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":"FC","cssStyle":"headerlabel","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"value":"dPL_AC","cssStyle":"headerlabel","colSpan":1}}]}],"details":[{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":14,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":0,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":8,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":11,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":1,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":6,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":8,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":0,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":1,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":5,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":1,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":4,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":15,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":9,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":13,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":6,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":2,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":5,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":9,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":3,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":4,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":0,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":11,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":5,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":10,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":4,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":9,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]},{"index":0,"type":"standard","elements":[{"key":"categories","index":0,"colSpan":1,"origin":{"cssStyle":"categories","colSpan":1}},{"key":"AC","index":1,"colSpan":1,"origin":{"value":11,"cssStyle":"AC","colSpan":1}},{"key":"PL","index":2,"colSpan":1,"origin":{"value":10,"cssStyle":"PL","colSpan":1}},{"key":"FC","index":3,"colSpan":1,"origin":{"value":1,"cssStyle":"FC","colSpan":1}},{"key":"dPL_AC","index":4,"colSpan":1,"origin":{"cssStyle":"dPL_AC","colSpan":1}}]}]}');
        // Test Data fuer tableDataSetFactory
        let data = [{
                "setname": "de",
                "data": [{
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "matrices",
                        subcategory: "matrices",
                        ac: 1,
                        py: 7,
                        fc: 7,
                        pl: 4
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "Applications",
                        subcategory: "Applications-A",
                        ac: 1,
                        py: 7,
                        fc: 15,
                        pl: 5
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "Applications",
                        subcategory: "Applications-B",
                        ac: 5,
                        py: 7,
                        fc: 10,
                        pl: 5
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "mission-critical",
                        subcategory: "mission-critical",
                        ac: 1,
                        py: 7,
                        fc: 14,
                        pl: 11
                    },
                    { operation: '+', rowgroup: "Umsatz", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 2, pl: 15 },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "turquoise",
                        subcategory: "turquoise",
                        ac: 1,
                        py: 7,
                        fc: 8,
                        pl: 6
                    },
                    { operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3 },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Buckinghamshire",
                        subcategory: "Buckinghamshire",
                        ac: -1,
                        py: -7,
                        fc: -12,
                        pl: 0
                    },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Credit Card Account",
                        subcategory: "Credit Card Account",
                        ac: -1,
                        py: -7,
                        fc: -12,
                        pl: -12
                    },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Gorgeous Fresh Mouse",
                        subcategory: "Gorgeous Fresh Mouse",
                        ac: -1,
                        py: -7,
                        fc: -10,
                        pl: -11
                    },
                    { operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 6, pl: 13 }]
            },
            {
                "setname": "uk",
                "data": [{
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "matrices",
                        subcategory: "matrices",
                        ac: 1,
                        py: 7,
                        fc: 7,
                        pl: 4
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "Applications",
                        subcategory: "Applications",
                        ac: 1,
                        py: 7,
                        fc: 15,
                        pl: 5
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "mission-critical",
                        subcategory: "mission-critical",
                        ac: 1,
                        py: 7,
                        fc: 14,
                        pl: 11
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "application",
                        subcategory: "pplication",
                        ac: 1,
                        py: 7,
                        fc: 2,
                        pl: 15
                    },
                    {
                        operation: '+',
                        rowgroup: "Umsatz",
                        category: "turquoise",
                        subcategory: "turquoise",
                        ac: 1,
                        py: 7,
                        fc: 8,
                        pl: 6
                    },
                    { operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3 },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Buckinghamshire",
                        subcategory: "Buckinghamshire",
                        ac: -1,
                        py: -7,
                        fc: -12,
                        pl: 0
                    },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Credit Card Account",
                        subcategory: "Credit Card Account",
                        ac: -1,
                        py: -7,
                        fc: -12,
                        pl: -12
                    },
                    {
                        operation: '-',
                        rowgroup: "Kosten",
                        category: "Gorgeous Fresh Mouse",
                        subcategory: "Gorgeous Fresh Mouse",
                        ac: -1,
                        py: -7,
                        fc: -10,
                        pl: -11
                    },
                    { operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: -1, py: -7, fc: -6, pl: -13 }]
            }
        ];
        // Test Config durch GUI einstellbar von user
        let config = {
            title: 'title1',
            scenarios: this.scenarios,
            grouped: true,
            showGroupTitle: true,
            thereof: [
                {
                    rowgroup: 'Umsatz',
                    category: "Applications",
                    subcategory: 'Applications-A',
                    partof: "category"
                },
                {
                    rowgroup: 'Umsatz',
                    category: "Applications",
                    subcategory: 'Applications-B',
                    partof: "rowgroup"
                },
                {
                    rowgroup: 'Kosten',
                    category: "lime",
                    subcategory: null,
                    partof: "total"
                }
            ],
            order: {
                columnshierachy: ['fc'],
                direction: OrderDirection.ASC,
            },
            type: TableType.LIST,
            limit: null,
        };
        // Test Ueberstetzungs tabelle bei internationalisierung
        let i18n = new Map();
        [{ key: 'title1', value: 'Beispiel Daten' },
            { key: 'ac', value: 'AC' },
            { key: 'py', value: 'PY' },
            { key: 'fc', value: 'FC' },
            { key: 'pl', value: 'PL' },
            { key: 'category', value: ' ' },
            { key: 'operation', value: ' ' },
            { key: 'thereof', value: 'davon' },
            { key: 'ibcssymbol_delta_ac', value: 'Δ{%}' },
            { key: 'ibcssymbol_delta_generic', value: 'Δ({%})' }].forEach(function (entry) {
            i18n.set(entry.key, entry.value);
        });
        let meta = {
            type: "table",
            version: "1.0",
            name: name,
            author: "Jens Herrmann<jens@bino.bi>",
            descripton: "Beispiel DatenSet fuer eine Tabelle",
            executedby: "Sven Herrmann<sven@bino.bi>",
            timestamp: new Date('2019-09-17T08:52:44Z'),
            query: "select * from test where 1"
        };
        // Initialisiert Factory und setzt die MetaDaten
        let tableDataSetFactory = new TableDataSetFactory(new IBCSRuleSet());
        tableDataSetFactory.setMetaData(meta);
        tableDataSetFactory.setI18n(i18n);
        tableDataSetFactory.setData(data);
        tableDataSetFactory.setConfig(config);
        this.redefinedData = tableDataSetFactory.generateDataSet();
    }
};
IbcsTable.style = ibcsTableCss;

export { IbcsTable as ibcs_table };
