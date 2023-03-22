define(["DS/PlatformAPI/PlatformAPI", "Ext/ExportXLS", "Ext/ExportKML", "ExtHelper/Convert"],
    function(PlatformAPI, _exportXLS, _exportKML, Convert) {
        var instance = null;

        function DataExport() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        }

        DataExport.getInstance = function() {
            if (instance === null) {
                instance = new DataExport();
                instance.PlatformAPI = PlatformAPI;
                instance.exportXLS = _exportXLS;
                instance.exportKML = _exportKML;
                instance.convert = Convert;
            }
            return instance;
        };

        DataExport.prototype = {
            toXLS: function(searchResults) {
                var content = this.exportXLS.generateXlsxContent(searchResults);
                this._createDownloadableBlobFile(content, "Search Results.xlsx");
            },
            toKML: function(searchResults) {
                var that = this;
                this._convertCoordinates(searchResults).then(function(searchResultsCoordinatesConverted) {
                    var content = that.exportKML.generateKMLContent(searchResultsCoordinatesConverted);
                    var blob = new Blob([content], { type: 'text/plain' });
                    that._createDownloadableBlobFile(blob, "Search Results.kml");
                });
            },
            _convertCoordinates: function(searchResults) {
                var promise = $.Deferred();

                this.PlatformAPI.unsubscribe('3DEXPERIENCity.ConvertCoordinatesReturn');
                this._convertCoordinatesCount = 0;

                var that = this;
                this.PlatformAPI.subscribe('3DEXPERIENCity.ConvertCoordinatesReturn', function(rs) {
                    var index = rs.widget_id.split("_").getLast();
                    if (index.contains("-")) {
                        var indexes = index.split("-");
                        if (searchResults[indexes[0]].latlon == undefined) {
                            searchResults[indexes[0]].latlon = [];
                        }
                        searchResults[indexes[0]].latlon[indexes[1]] = rs.data;
                    } else {
                        searchResults[index].latlon = rs.data;
                    }

                    that._convertCoordinatesCount--;
                   // console.log("Remaining features to convert coordinates", that._convertCoordinatesCount);
                    if (that._convertCoordinatesCount <= 0) {
                        that.PlatformAPI.unsubscribe('3DEXPERIENCity.ConvertCoordinatesReturn');
                        promise.resolve(searchResults);
                    }
                });

                // console.log("Total features to convert coordinates", searchResults.length);
                for (var i = 0, ilength = searchResults.length; i < ilength; i++) {
                    var geometryType = searchResults[i].geometry.type.toUpperCase();
                    //var wkt = searchResults[i].geometry.coordinates;

                    let featureCoordinates = searchResults[i].geometry.coordinates;//this._getFeatureCoordinates(geometryType, wkt);					
                    if (geometryType.contains("POLYGON") || geometryType.contains("MULTIPOLYGON")) {
                        for (var j = 0, jlength = featureCoordinates.length; j < jlength; j++) {
                            this._convertCoordinatesCount++;							
                            this.PlatformAPI.publish('3DEXPERIENCity.ConvertCoordinates', {
                                widget_id: widget.id + "_" + i + "-" + j,
                                coordinates: featureCoordinates[j],
                                project_to: "WGS84"
                            });
                        }
                    } else {
                        this._convertCoordinatesCount++;
						let coordinates = geometryType.contains("POINT") ? {x: featureCoordinates[0], y: featureCoordinates[1]} : featureCoordinates;
                        this.PlatformAPI.publish('3DEXPERIENCity.ConvertCoordinates', {
                            widget_id: widget.id + "_" + i,
                            coordinates: coordinates,
                            project_to: "WGS84"
                        });
                    }
                }

                return promise;
            },
            _getFeatureCoordinates: function(geometryType, wkt) {
                if (geometryType.contains("POINT")) {
                    return this.convert.convertPoint(wkt);
                }

                if (geometryType.contains("LINESTRING")) {
                    return this.convert.convertLine(wkt);
                }

                if (geometryType.contains("POLYGON")) {
                    // return this.convert.convertPolygon(wkt);
                    return this.convert.convertMultiPolygon(wkt)[0];
                }

                if (geometryType.contains("MULTIPOLYGON")) {
                    return this.convert.convertMultiPolygon(wkt);
                }
            },
            _createDownloadableFile: function(csvContent, fileName) {
                var encodedUri = encodeURI(csvContent);
                var link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", fileName);
                link.click();
            },
            _createDownloadableBlobFile: function(blob, fileName) {
                var url = window.URL.createObjectURL(blob);
                var link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.click();
                window.URL.revokeObjectURL(url);
            }
        };

        return DataExport.getInstance();
    });