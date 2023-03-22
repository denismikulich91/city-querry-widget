define([],
    function() {
        var instance = null;

        function SearchProperties() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        SearchProperties.getInstance = function() {
            if (instance === null) {
                instance = new SearchProperties();
            }
            return instance;
        };

        SearchProperties.prototype = {
            whatFilters: [],
            page: 0,
            geometricFilters: [], // [{type:"", wkt:"", coordinates:[]},....]
            filter: { hasFiltersTEMP: false },
            datasetDatasourceDocIds: [],
            limit: 100,

            addWhatFilter: function(value, joinOperator, field, operator) {
                console.log("Adding what filter", value, joinOperator, field, operator);
                this.whatFilters.push({
                    joinOperator: joinOperator,
                    field: field,
                    operator: operator,
                    value: value
                });

                return this.whatFilters.length - 1;
            },
            removeWhatFilter: function(index) {
                if (index == this.whatFilters.length - 1) {
                    this.whatFilters.pop();
                } else {
                    this.whatFilters[index] = undefined;
                }

                console.log("What filters", this.whatFilters);                
            },
            updateWhatFilter: function(index, value, joinOperator, field, operator) {
                console.log("Old what filter", this.whatFilters[index]);
                this.whatFilters[index].joinOperator = joinOperator;
                this.whatFilters[index].field = field;
                this.whatFilters[index].operator = operator;
                this.whatFilters[index].value = value;
                console.log("New what filter", this.whatFilters[index]);
            },
            getNextWhatFilterIndex: function() {
                return this.whatFilters.length;
            },
            addGeometricFilter: function(type, wkt, coordinates, buffer) {
                this.geometricFilters.push({type: type, wkt: wkt, coordinates: coordinates, buffer: buffer});

                return this.geometricFilters.length - 1;
            },
            removeGeometricFilter: function(index) {
                if (index == this.geometricFilters.length - 1) {
                    this.geometricFilters.pop();
                } else {
                    this.geometricFilters[index] = undefined;
                }
            },
            removeAllGeometricFilters: function() {
                this.geometricFilters = [];
            },
            getNextFilterGeometryIndex: function() {
                return this.geometricFilters.length;
            },
            updateGeometricFilter: function(key, value, index) {
                if (this.geometricFilters[index] == undefined) {
                    return;
                }
                if (this.geometricFilters[index][key] == undefined) {
                    return;
                }
                this.geometricFilters[index][key] = value;
            },
            geometricFilterGet: function(key, index) {
                return this.geometricFilters[index][key];
            },
            getNumberOfGeometricFilters: function() {
                var count = 0;

                for (var i = 0, length = this.geometricFilters.length; i < length; i++) {
                    if (this.geometricFilters[i]) {
                        count++;
                    }
                }

                return count;
            },
            getGeometricFiltersCoordinates: function() {
                var coordinates = [];

                for (var i = 0, length = this.geometricFilters.length; i < length; i++) {
                    coordinates = coordinates.concat(this.geometricFilters[i].coordinates);
                }

                return coordinates;
            },
            clear: function() {
                this.whatFilters = [];
                this.geometricFilters = [];
                this.page = 0;
                this.filter = { hasFiltersTEMP: false };
                this.datasetDatasourceDocIds = [];
            },
            setDatasetDatasourceDocIds: function(documentIds) {
                datasetDatasourceDocIds = documentIds;
            }
        };

        return SearchProperties.getInstance();
    });