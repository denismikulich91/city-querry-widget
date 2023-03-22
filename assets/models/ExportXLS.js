define(["ExtLibs/js-xlsx/xlsx", "ExtLibs/js-xlsx/jszip"], function(_XLSX, _jszip) {
    var instance = null;

    function ExportXLS() {
        if (instance !== null) {
            throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
        }
    }

    ExportXLS.getInstance = function() {
        if (instance === null) {
            instance = new ExportXLS();
            instance.XLSX = XLSX;
        }
        return instance;
    };

    ExportXLS.prototype = {
        _maxSheetNameLength: 31,
        generateXlsxContent: function(searchResults) {
            var wb = {
                SheetNames: [],
                Sheets: {}
            };

            var splittedResults = this._splitResultsByAttribute(searchResults, "layername");
            var wsKeys = Object.keys(splittedResults);
            for (var i = 0, length = wsKeys.length; i < length; i++) {
                var sheetName = this._getSheetName(wsKeys[i]);
                wb.SheetNames.push(sheetName);
                wb.Sheets[sheetName] = this._generateSearchResultsXlsxSheet(wsKeys[i], splittedResults[wsKeys[i]]);
            }

            var wbout = this.XLSX.write(wb, { bookType: 'xlsx', bookSST: true, type: 'binary' });

            return new Blob([this._s2ab(wbout)], { type: "application/octet-stream" });
        },
        _splitResultsByAttribute: function(searchResults, attrib) {
            var results = [];

            for (var i = 0, length = searchResults.length; i < length; i++) {
				let currSearchResult = searchResults[i].properties;
                var key = currSearchResult[attrib];
                if (results[key] == undefined) {
                    results[key] = [];
                }
                results[key].push(currSearchResult);
            }

            return results;
        },
        _getAllKeys: function(matchedResults) {
            var ommit = ["physicalid", "searchResultId", "url", "layername", "size", "geometrytype", "layerindex"];
            var keys = [];

            for (var i = 0, ilength = matchedResults.length; i < ilength; i++) {
                var rowKeys = Object.keys(matchedResults[i]);
                for (var j = 0, jlength = rowKeys.length; j < jlength; j++) {
                    if (keys.contains(rowKeys[j]) || ommit.contains(rowKeys[j])) {
                        continue;
                    }
                    keys.push(rowKeys[j]);
                }
            }

            return keys;
        },
        _generateXlsxSheetHeader: function(keys) {
            var header = [];

            for (var j = 0; j < keys.length; j++) {
                header.push(keys[j]
                    .replace("field_number_", "")
                    .replace("field_string_", "")
                    .toUpperCase()
                );
            }

            return header;
        },
        _generateSearchResultsXlsxSheet: function(layerName, matchedResults) {
            if (matchedResults.length == 0) {
                return {};
            }

            var data = [["LAYER NAME:", layerName],[]];

            var header = [];
            var originalDataKeys = [];
            var keys = this._getAllKeys(matchedResults);
            data.push(this._generateXlsxSheetHeader(keys));

            for (var i = 0, length = matchedResults.length; i < length; i++) {
                var row = [];
                for (var j = 0; j < keys.length; j++) {
                    matchedResults[i][keys[j]] ? row.push(matchedResults[i][keys[j]]) : row.push("");
                }
                data.push(row);
            }

            return this._sheet_from_array_of_arrays(data);
        },
        _s2ab: function(s) {
            var buf = new ArrayBuffer(s.length);
            var view = new Uint8Array(buf);
            for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
            return buf;
        },
        _sheet_from_array_of_arrays: function(data, opts) {
            var ws = {};
            var range = { s: { c: 10000000, r: 10000000 }, e: { c: 0, r: 0 } };
            for (var R = 0; R != data.length; ++R) {
                for (var C = 0; C != data[R].length; ++C) {
                    if (range.s.r > R) range.s.r = R;
                    if (range.s.c > C) range.s.c = C;
                    if (range.e.r < R) range.e.r = R;
                    if (range.e.c < C) range.e.c = C;
                    var cell = { v: data[R][C] };
                    if (cell.v == null) continue;
                    var cell_ref = this.XLSX.utils.encode_cell({ c: C, r: R });

                    if (typeof cell.v === 'number') cell.t = 'n';
                    else if (typeof cell.v === 'boolean') cell.t = 'b';
                    else if (cell.v instanceof Date) {
                        cell.t = 'n';
                        cell.z = this.XLSX.SSF._table[14];
                        cell.v = this._datenum(cell.v);
                    } else cell.t = 's';

                    ws[cell_ref] = cell;
                }
            }
            if (range.s.c < 10000000) ws['!ref'] = this.XLSX.utils.encode_range(range);
            return ws;
        },
        _datenum: function(v, date1904) {
            if (date1904) v += 1462;
            var epoch = Date.parse(v);
            return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        },
        _getSheetName: function(layerName) {
            if (layerName.length <= this._maxSheetNameLength) {
                return layerName;
            }

            return layerName.substring(0, this._maxSheetNameLength - 11) + "..." + layerName.substring(layerName.length - 8);
        }
    };

    return ExportXLS.getInstance();
});