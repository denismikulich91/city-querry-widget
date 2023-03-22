define([],
    function() {
        var instance = null;

        function AttributeFilter() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        AttributeFilter.getInstance = function() {
            if (instance === null) {
                instance = new AttributeFilter();
            }
            return instance;
        };

        AttributeFilter.prototype = {
            getNewAttributeFilter: function(e) {
                var operators = this._getAttributeFilterOperators(e.currentTarget.dataValue);
                return {
                    attribute: e.currentTarget.dataName,
                    operators: operators,
                    selectedFilterOperator: operators[0],
                    key: e.currentTarget.dataKey,
                    value: isNaN(e.currentTarget.dataValue) ? e.currentTarget.dataValue : parseFloat(e.currentTarget.dataValue),
                    precision: this._getDecimalPrecision(e.currentTarget.dataValue)
                };
            },
            getModifyAttributeFilter: function(e) {
                return {
                        index: e.index,
                        attribute: e.field,
                        selectedJoinOperator: e.joinOperator,
                        operators: e.operator ? this._getAttributeFilterOperators(e.value) : undefined,
                        selectedFilterOperator: e.operator,
                        key: e.field,
                        value: isNaN(e.value) ? e.value : parseFloat(e.value),
                        precision: this._getDecimalPrecision(e.value)
                    };
            },
            _getAttributeFilterOperators: function(value) {
                if (value == undefined) {
                    return [];
                }

                if (isNaN(value) && value.indexOf(",") === -1 || this.searchDataset) {
                    return ["equals", "contains"];
                }

                return ["equals", "greater", "lesser", "inrange", "outrange"];
            },
            _populateAttributeFilterAutocompleteValues: function(field, displayedResults) {
                var values = []
                for (var i = displayedResults.length - 1; i >= 0; i--) {
                    var resultField = displayedResults[i].properties ? displayedResults[i].properties[field] : displayedResults[i][field].value;
                    if (resultField == undefined) {
                        continue;
                    }
                    if (values.contains(resultField)) {
                        continue;
                    }

                    if (isNaN(resultField)) {
                        values.push(resultField);
                    } else {
                        values.push(parseFloat(resultField));
                    }
                }

                return values;
            },
            _getDecimalPrecision(dataValue) {
                if (isNaN(dataValue)) {
                    return;
                }

                var dataValueSplit = dataValue.toString().split(".");
                if (dataValueSplit[1]) {
                    return dataValueSplit[1].length;
                }
            },
            isAttributeJoinOperator: function(value) {
                var operators = ["OR", "AND", "(", ")"];
                return operators.contains(value);
            }
        };

        return AttributeFilter.getInstance();
    });