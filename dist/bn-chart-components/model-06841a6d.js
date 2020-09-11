var I18nMode;
(function (I18nMode) {
    I18nMode["ALL"] = "ALL";
    I18nMode["NONE"] = "NONE";
    I18nMode["META"] = "META";
})(I18nMode || (I18nMode = {}));
var TableType;
(function (TableType) {
    TableType["LIST"] = "LIST";
    TableType["SUM"] = "SUM";
    TableType["OPT"] = "OPT";
})(TableType || (TableType = {}));
var OrderDirection;
(function (OrderDirection) {
    OrderDirection["ASC"] = "asc";
    OrderDirection["DESC"] = "desc";
})(OrderDirection || (OrderDirection = {}));

export { I18nMode as I, OrderDirection as O, TableType as T };
