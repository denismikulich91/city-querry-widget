define([
        "ExtHelper/Convert",
        "DS/PlatformAPI/PlatformAPI",
        "DS/i3DXCompassServices/i3DXCompassServices",
        "Ext/SearchProperties",
        "Ext/GeoPolygonBuffer",
        "Ext/FeaturesManager",
        "Ext/QueryManager",
        "Ext/FilterManager",
        "Ext/DatasetManager",
        "Ext/InteractionManager",
        "Ext/DataExport",
        "helpers/ViewHelper",
        "ExtLibs/simplify"
    ],
    function(
        Convert,
        PlatformAPI,
        compass,
        SearchProperties,
        GeoPolygonBuffer,
        featuresManager,
        queryManager,
        filterManager,
        datasetManager,
        interactionManager,
        dataExport,
        ViewHelper,
        simplify
    ) {
        var instance = null;

        function Search() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        Search.getInstance = function() {
            if (instance === null) {
                instance = new Search();

                instance.convert = Convert;
                instance.PlatformAPI = PlatformAPI;
                instance.i3DXCompassServices = compass;
                instance.searchProperties = SearchProperties;
                instance.geoPolygonBuffer = new GeoPolygonBuffer();
                instance.featuresManager = featuresManager;
                instance.queryManager = queryManager;
                instance.filterManager = filterManager;
                instance.datasetManager = datasetManager;
                instance.interactionManager = interactionManager;
                instance.dataExport = dataExport;
                instance.ViewHelper = ViewHelper;
                instance.simplify = simplify;
            }

            return instance;
        };

        Search.prototype = {
            enableSetPoint: function(callback) {
                // this.featuresManager.removeCustomSearchGeometries();

                var that = this;
                this.worldClickSubscription = this.PlatformAPI.subscribe('3DEXPERIENCity.OnWorldClick', function(position) {
                    if (that._duplicateEventReturn() == true) {
                        return;
                    }

                    that.disableSetPoint();

                    var radius = parseInt($("#searchRadiusInput")[0].value);
                    var index = that.searchProperties.addGeometricFilter("POINT", that.convert.convertPointToWKT(position), position, radius);
                    var label = position.x.toFixed(5) + ", " + position.y.toFixed(5);
                    callback(label, index);

                    that.featuresManager.drawSearchPoint(position, index);

                    var areaCoordinates = that._getCircleCoordinates(radius, 100, position);
                    that.featuresManager.drawSearchBufferedArea(areaCoordinates, index);
                });
            },
            disableSetPoint: function() {
                this._unsubscribeOnWorldClick();
            },
            _unsubscribeOnWorldClick() {
                if (this.worldClickSubscription) {
                    this.worldClickSubscription.unsubscribe();
                    this.worldClickSubscription = undefined;
                };
            },
            enableDrawLine: function() {
                this.coordinates = [];
                var index = this.searchProperties.getNextFilterGeometryIndex();
                
                var that = this;
                this.worldClickSubscription = this.PlatformAPI.subscribe('3DEXPERIENCity.OnWorldClick', function(position) {
                    if (that._duplicateEventReturn() == true) {
                        return;
                    }

                    console.log("Line - add coordinates", position);
                    that.coordinates.push(position);

                    that.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchLine_' + index);

                    var lineCoordinates = [];
                    for (var i = 0, length = that.coordinates.length; i < length; i++) {
                        var c = that.coordinates[i];
                        lineCoordinates.push([c.x, c.y, c.z]);
                    }
                    that.featuresManager.drawSearchLine(lineCoordinates, index);
                });
            },
            disableDrawLine: function(callback) {
                this._unsubscribeOnWorldClick();

                if (this.coordinates.length == 0) {
                    return;
                }

                var radius = parseInt($("#searchRadiusInput")[0].value);
                var index = this.searchProperties.addGeometricFilter("LINESTRING", this.convert.convertLineToWKT(this.coordinates), this.coordinates, radius);

                this._drawSearchLineBuffer(this.coordinates, index);

                callback("Search Line", index);
            },
            enableDrawPolygon: function() {
                this.coordinates = [];
                var index = this.searchProperties.getNextFilterGeometryIndex();

                var that = this;
                this.worldClickSubscription = this.PlatformAPI.subscribe('3DEXPERIENCity.OnWorldClick', function(position) {
                    if (that._duplicateEventReturn() == true) {
                        return;
                    }

                    that.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchPolygon_' + index);

                    console.log("Polygon - add coordinates", position);
                    that.coordinates.push(position);

                    var polygonCoordinates = [];
                    for (var i = 0, length = that.coordinates.length; i < length; i++) {
                        var c = that.coordinates[i];
                        polygonCoordinates.push([c.x, c.y, c.z]);
                    }
                    that.featuresManager.drawSearchAreaPolygon(polygonCoordinates, index);
                });
            },
            disableDrawPolygon: function(callback) {
                this._unsubscribeOnWorldClick();

                if (this.coordinates.length == 0) {
                    return;
                } else {
                    this.coordinates.push(this.coordinates[0]);
                }
                var radius = parseInt($("#searchRadiusInput")[0].value);
                var index = this.searchProperties.addGeometricFilter("POLYGON", this.convert.convertPolygonToWKT(this.coordinates), this.coordinates, radius);

                this._drawSearchPolygonBuffer(this.coordinates, index);

                callback("Search Area", index);
            },
            _duplicateEventReturn: function() {
                if (this.lastTriggerTime) {
                    var duration = Date.now() - this.lastTriggerTime;
                    if (duration < 300) {
                        return true;
                    }
                }
                this.lastTriggerTime = Date.now();
                return false;
            },
            _drawSearchLineBuffer: function(coordinates, index) {
                var lineCoordinates = [];
                for (var i = 0, length = coordinates.length; i < length; i++) {
                    var c = coordinates[i];
                    lineCoordinates.push([(c.x || c[0]), (c.y || c[1]), (c.z || c[2])]);
                }

                var radius = parseInt($("#searchRadiusInput")[0].value);
                var linePolygonCoordinates = lineCoordinates.clone();
                for (var i = lineCoordinates.length - 2; i > 0; i--) {
                    linePolygonCoordinates.push(lineCoordinates[i]);
                }
                var bufferedLineCoordinates = this.geoPolygonBuffer.getExpandedCoordinates(linePolygonCoordinates, radius);
                this.featuresManager.drawSearchBufferedArea(bufferedLineCoordinates, index);
            },
            _drawSearchPolygonBuffer: function(coordinates, index) {
                this.featuresManager.removeSearchBufferedArea(index);

                var polygonCoordinates = [];
                for (var i = 0, length = coordinates.length; i < length; i++) {
                    var c = coordinates[i];
                    polygonCoordinates.push([(c.x || c[0]), (c.y || c[1]), (c.z || c[2])]);
                }

                var radius = parseInt($("#searchRadiusInput")[0].value);
                var bufferedPolygonCoordinates = this.geoPolygonBuffer.getExpandedCoordinates(polygonCoordinates, radius, 0.01);
                this.featuresManager.drawSearchBufferedArea(bufferedPolygonCoordinates, index);
            },
            search: function(isDatasetSearch, callbacks) {
                var that = this;
                if (isDatasetSearch) {
                    this.datasetManager.searchDataset(this.searchProperties.whatFilters, this.searchProperties.page).then(function(rs) {
                        callbacks.completedCallback(rs.start, rs.nhits, rs.hits);
                    });
                } else {
                    this.featuresManager.stopLoadingFeatures();
                    this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchResults');

                    this.datasetManager.getDatasourceDocumentIds().then(function(datasourceDocIds) {
                        that.searchProperties.datasetDatasourceDocIds = datasourceDocIds;
                        that.queryManager.processSearch(that.searchProperties, that._processSearchResults.bind(that, callbacks));
                    });
                }
				
				// this.PlatformAPI.subscribe('3DEXPERIENCity.ConvertCoordinatesReturn', function(rs) {
					// that.PlatformAPI.unsubscribe('3DEXPERIENCity.ConvertCoordinatesReturn');
					// console.log('ConvertCoordinatesReturn',rs);
				// });
				// this.PlatformAPI.publish('3DEXPERIENCity.ConvertCoordinates', {
                            // widget_id: widget.id + "_" + 0,
                            // coordinates: that.searchProperties.geometricFilters[0].coordinates,
                            // project_to: "WGS84"
                // });
            },
            _processSearchResults:function(callbacks, rs) {
                var results = [];
                var documentIds = [];
                for (var i = 0, length = rs.hits.length; i < length; i++) {
					let feature = rs.hits[i];

                    if (feature.geometry == undefined) {
                        continue;
                    }

                    feature.searchResultId = "searchResult_" + i + "_" + feature.geometry.type;
                    results.push(feature);
                    documentIds.push(feature.properties.datasetuuid);
                }

                var that = this;				
				
               // this.filterManager.getDocumentProperties(documentIds).then(function(documentProperties) {
                    results = that._updateResultsLayername(results, this.datasetManager.availableDatasets);

                    callbacks.completedCallback(rs.start, rs.nhits, results);

                  //  var groupedFeatures = that._groupSearchResults(results);
                    that.featuresManager.plotPointResults(results);
                    that.featuresManager.plotLineResults(results);
                    that.featuresManager.plotPolygonResults(results);
                  //  that.datasetManager.plotDatasetResults(groupedFeatures.n_onLoadedDatasetFeatures);

                  //  that.filterManager.set6WTags(results, documentProperties, that._processSearchFilterChange.bind(that, callbacks));
                //});
            },
            _updateResultsLayername(results, documentProperties) {
				
                for (var i = 0, ilength = results.length; i < ilength; i++) {
                    for (var j = 0, jlength = documentProperties.length; j < jlength; j++) {
                        if (documentProperties[j].uuid == results[i].properties.datasetuuid) {
                            results[i].properties.layername = documentProperties[j].name;
                        }
                    }
                }

                return results;
            },
            _groupSearchResults: function(rs) {
                var loadedDatasetFeatures = [],
                    n_onLoadedDatasetFeatures = [],
                    nonDatasetFeatures = [];

                for (var i = 0, length = rs.length; i < length; i++) {
                    if (this.datasetManager.getDatasetIdWithEnoviaDocId(rs[i].physicalid.value)) {
                        n_onLoadedDatasetFeatures.push(rs[i]);
                    } else if (this.datasetManager.getLoadedDatasetIdWithEnoviaDocId(rs[i].physicalid.value)) {
                        loadedDatasetFeatures.push(rs[i]);
                    } else {
                        nonDatasetFeatures.push(rs[i]);
                    }
                }

                return {
                    loadedDatasetFeatures: loadedDatasetFeatures,
                    n_onLoadedDatasetFeatures: n_onLoadedDatasetFeatures,
                    nonDatasetFeatures: nonDatasetFeatures
                }
            },
            clear: function() {
                window.stop();
                this.searchProperties.clear();
                this.featuresManager.stopLoadingFeatures();
                this.filterManager.clearFilters();
                this.featuresManager.clearSearchFeatures();
            },
            getSuggestions: function() {
                var promise = $.Deferred();

                var that = this;
                this.queryManager.getSuggestions(function(rs) {
                    var results = [];
                    var documentIds = [];

                    for (var i = 0, length = rs.hits.length; i < length; i++) {
                        var metas = that.convert.convertMetaToObject(rs.hits[i].metas);
                        results.push(metas);
                        documentIds.push(metas.physicalid.value);
                    }

                    that.filterManager.getDocumentProperties(documentIds).then(function(documentProperties) {
                        results = that._updateResultsLayername(results, documentProperties.data);
                        promise.resolve(results);
                    });
                });

                return promise;
            },
            setWhereWithSuggest: function(selectedSuggestion, radius, completedCallback) {
                var selectedGeometryType = selectedSuggestion.geometrytype.value.toUpperCase();

                if (selectedGeometryType.contains("POINT")) {
                    var coordinate = this.convert.convertPoint(selectedSuggestion.geometry.value);
                    var index = this.searchProperties.addGeometricFilter(selectedSuggestion.geometrytype.value, selectedSuggestion.geometry.value, coordinate, radius);
                    this.featuresManager.drawSearchPoint(coordinate, index);

                    var areaCoordinates = this._getCircleCoordinates(radius, 100, coordinate);
                    this.featuresManager.drawSearchBufferedArea(areaCoordinates, index);

                    var name = selectedSuggestion["HOUSE_BLK_"] ?
                        (selectedSuggestion["HOUSE_BLK_"].value + " " + selectedSuggestion["ROAD_NAME"].value) :
                        selectedSuggestion["BUILDING_N"].value;

                    completedCallback(name, index);

                } else if (selectedGeometryType.contains("POLYGON")) {
                    var polygonCoordinatesObj = this.convert.convertPolygon(selectedSuggestion.geometry.value);
                    var polygonCoordinates = [];
                    for (var j = 0, length = polygonCoordinatesObj.length; j < length; j++) {
                        polygonCoordinates.push([polygonCoordinatesObj[j].x, polygonCoordinatesObj[j].y, polygonCoordinatesObj[j].z]);
                    }

                    var wkt = this.convert.convertPolygonToWKT(this.geoPolygonBuffer.getExpandedCoordinatesScaled(polygonCoordinates, 1, 3));
                    var index = this.searchProperties.addGeometricFilter(selectedSuggestion.geometrytype.value, wkt, polygonCoordinatesObj, radius);

                    this.featuresManager.drawSearchAreaPolygon(polygonCoordinates, index);
                    this._drawSearchPolygonBuffer(polygonCoordinates, index);

                    completedCallback(this.getFeatureName(selectedSuggestion), index);

                } else if (selectedGeometryType.contains("LINESTRING")) {
                    var index = this._addLineStringGeometricFilter(selectedSuggestion);
                    // $("#whereInput")[0].tagTpl = { "label": metadata["gdal_string_ROAD_NAME"].value };
                    completedCallback(this.getFeatureName(selectedSuggestion), index);
                }
            },
            _addLineStringGeometricFilter: function(metadata) {
                var lineCoordinates = this.convert.convertLine(metadata.geometry.value);
                var linePolygonCoordinates = lineCoordinates.clone();
                for (var i = lineCoordinates.length - 2; i > 0; i--) {
                    linePolygonCoordinates.push(lineCoordinates[i]);
                }

                var radius = parseInt($("#searchRadiusInput")[0].value);
                var index = this.searchProperties.addGeometricFilter(metadata.geometrytype.value, this.convert.convertLineToWKT(lineCoordinates), linePolygonCoordinates, radius);

                this.featuresManager.drawSearchLine(lineCoordinates, index);

                var bufferedLineCoordinates = this.geoPolygonBuffer.getExpandedCoordinates(linePolygonCoordinates, radius);
                this.featuresManager.drawSearchBufferedArea(bufferedLineCoordinates, index);

                return index;
            },
            _getCircleCoordinates: function(radius, steps, center) {
                var coordinates = [];

                for (var i = 0; i < steps; i++) {
                    var x = center.x + radius * Math.cos(2 * Math.PI * i / steps),
                        y = center.y + radius * Math.sin(2 * Math.PI * i / steps);

                    coordinates.push([
                        x,
                        y,
                        center.z
                    ]);
                }

                return coordinates;
            },
            updateSearchRadiusPolygon: function(radius, selectedTagIndex) {
                this.searchProperties.updateGeometricFilter("buffer", radius, selectedTagIndex);

                var type = this.searchProperties.geometricFilterGet("type", selectedTagIndex);
                var coordinates = this.searchProperties.geometricFilterGet("coordinates", selectedTagIndex);

                if (type.toUpperCase().contains("POINT")) {
                    this.featuresManager.removeSearchBufferedArea(selectedTagIndex);

                    var areaCoordinates = this._getCircleCoordinates(radius, 100, coordinates);
                    this.featuresManager.drawSearchBufferedArea(areaCoordinates, selectedTagIndex);

                } else if (type.toUpperCase().contains("LINESTRING")) {
                    this.featuresManager.removeSearchBufferedArea(selectedTagIndex);
                    this._drawSearchLineBuffer(coordinates, selectedTagIndex);

                } else if (type.toUpperCase().contains("POLYGON")) {
                    this._drawSearchPolygonBuffer(coordinates, selectedTagIndex);
                }
            },
            getGeoTypeIcon: function(type, enoviaDocId) {
                if (enoviaDocId) {
                    var datasetType = this.datasetManager.getDatasetTypeWithEnoviaDocId(enoviaDocId);
                    if (datasetType == "GeolocalizedBuilding") {
                        return "citysearch:building";
                    } else if (datasetType == "UrbanFurniture") {
                        return "citysearch:furniture";
                    } else if (datasetType == "Tree") {
                        return "citysearch:tree";
                    }
                }

                if (type) {
                    if (type.contains("LineString2D")) {
                        return "icons:timeline";
                    }
                    if (type.contains("Polygon2D")) {
                        return "device:signal-cellular-null";
                    }
                }
                
                return "maps:place";
            },
            getFeatureName: function(item) {
                if (item == undefined) {
                    return "";
                }

                if (item.NAME && item.ROAD_NAME == undefined) {
                    return item.NAME;
                } else if (item.HOUSE_BLK_ && item.ROAD_NAME) {
                    return item.HOUSE_BLK_ + " " + item.ROAD_NAME;
                } else if (item.BUILDING_N) {
                    return item.BUILDING_N;
                } else if (item.ROAD_NAME) {
                    return item.ROAD_NAME;
                } else if (item.SUBZONE_N) {
                    return item.SUBZONE_N;
                } else if (item.PLN_AREA_N) {
                    return item.PLN_AREA_N;
                } else if (item.REGION_N) {
                    return item.REGION_N;
                } else if (item.SPSC_NM) {
                    return item.SPSC_NM;
                } else {
                    var keys = Object.keys(item);
                    for (var i = 0, length = keys.length; i < length; i++) {
                        if (keys[i].toLowerCase().contains("name")) {
                            return item[keys[i]];
                        }
                    }
                    return "";
                }
            },
            addSelectedFeatureToWhere: function(completedCallback) {
                var that = this;
                this.featuresManager.getSelectedFeature().then(function(data) {
                    // console.log(data);

                    if (data.className == "Folder") {
                        that.featuresManager.getFeatureAttrib(data.id, "children").then(function(children) {
                            for (var i = 0, length = children.length; i < length; i++) {
                                var feat = Object.assign({}, children[i].impl.Geometry);
                                feat.id = children[i].impl.id;
                                feat.name = children[i].impl.name;
                                that._processAddSelectedFeatureToWhere(feat, completedCallback);
                            }
                        });
                    } else {
                        that._processAddSelectedFeatureToWhere(data, completedCallback);
                    }
                });
            },
            _processAddSelectedFeatureToWhere: function(data, completedCallback) {
                var that = this;
                if (data.className == "Polygon") {
                    if (data.geojson) {
                        that._addGeoJsonPolygonToWhere(completedCallback, data.name, data.geojson);
                    } else {
                        that.featuresManager.getFeatureAttrib(data.id, "geojson").then(that._addGeoJsonPolygonToWhere.bind(that, completedCallback, data.name));
                    }
                } else if (data.className == "Line") {
                    that.featuresManager.getFeatureAttrib(data.id, "geojson").then(function(geojson) {
                        var featProperties = that._setGeoJsonFeatureAsWhere(geojson);
                        that._drawSearchLineBuffer(featProperties.coordinates, featProperties.index);

                        completedCallback(data.name, featProperties.index);
                    });
                } else if (data.className == "LayerVectorPrimitive") {
                    that._addLayerVectorPrimitveToWhere(data, completedCallback);
                } else if (data.className == "RdbLink") {
                    that._addRdbLinkFeatureToWhere(data, completedCallback);
                } else if (data.className == "Annotation") {
                    that._addAttributePointToWhere(data, data.name, completedCallback);
                }
            },
            _addGeoJsonPolygonToWhere: function(completedCallback, name, geojson) {
                var featProperties = this._setGeoJsonFeatureAsWhere(geojson);

                completedCallback(name, featProperties.index);

                this._drawSearchPolygonBuffer(featProperties.coordinates[0], featProperties.index);
            },
            _addLayerVectorPrimitveToWhere: function(data, completedCallback) {
                if (data.userData.gdal_geo_type) {
                    var featureProperties = this._setLayerVectorPrimitveAsWhere(data.userData);

                    completedCallback(data.name, featureProperties.index);

                    if (data.userData.gdal_geo_type == "POLYGON") {
                        this._drawSearchPolygonBuffer(featureProperties.coordinates, featureProperties.index);
                    } else if (data.userData.gdal_geo_type == "LINESTRING") {
                        this._drawSearchLineBuffer(featureProperties.coordinates, featureProperties.index);
                    } else if (data.userData.gdal_geo_type == "POINT") {
                        var radius = parseInt($("#searchRadiusInput")[0].value);
                        var areaCoordinates = this._getCircleCoordinates(radius, 100, data.position);
                        this.featuresManager.drawSearchBufferedArea(areaCoordinates, featureProperties.index);
                    }
                } else {
                    var that = this;
                    this.featuresManager.getFeatureAttrib(data.id, "geojson").then(function(geojson) {
                        if (geojson) {
                            that._addGeoJsonFeatureToWhere(geojson, data, completedCallback);
                        } else {
                            that._addAttributePointToWhere(data, data.name, completedCallback);
                        }
                    }, function(rs) {
                        var geojson = that.interactionManager.getSelectedFeatureAttribute("geojson");
                        if (geojson) {
                            that._addGeoJsonFeatureToWhere(geojson, data, completedCallback);
                        } else {
                            that._addAttributePointToWhere(data, that._getPOIName(data), completedCallback);
                        }
                    });
                }
            },
            _addGeoJsonFeatureToWhere: function(geojson, data, completedCallback) {
                var featProperties;
                var geometryType = geojson.features[0].geometry.type.toLowerCase();
                if (geometryType == "polygon") {
                    featProperties = this._setGeoJsonFeatureAsWhere(geojson);
                    this._drawSearchPolygonBuffer(featProperties.coordinates, featProperties.index);
                } else if (geometryType == "line" || geometryType == "linestring") {
                    featProperties = this._setGeoJsonFeatureAsWhere(geojson);
                    this._drawSearchLineBuffer(featProperties.coordinates, featProperties.index);
                }

                completedCallback(data.name, featProperties.index);
            },
            _addRdbLinkFeatureToWhere: function(data, completedCallback) {
                var that = this;
                this.featuresManager.getFeatureAttrib(data.id, "url").then(function(url) {
                    if (url.contains("data:application/json;base64")) {
                        var geojson = JSON.parse(atob(url.replace("data:application/json;base64,", "")));
                        var featProperties = that._setGeoJsonFeatureAsWhere(geojson);

                        completedCallback(data.name, featureProperties.index);
                    } else {
                        that._addRdbLinkFeatureFromExaleadToWhere(data, url, completedCallback);
                    }
                });
            },
            _addRdbLinkFeatureFromExaleadToWhere: function(data, url, completedCallback) {
                var that = this;
                var bbox = that.interactionManager.getViewBoundingBox();
                url = unescape(url).replace(/%xmin/g, bbox.xmin).replace(/%xmax/g, bbox.xmax).replace(/%ymin/g, bbox.ymin).replace(/%ymax/g, bbox.ymax);
                var split = url.split("eq=");

                var result = {};
                url.split("&").forEach(function(part) {
                    var item = part.split("=");
                    result[item[0]] = decodeURIComponent(item[1]);
                });
                result["eq"] = encodeURIComponent(result["eq"]);

                var keys = Object.keys(result);
                for (var i = 0, length = keys.length; i < length; i++) {
                    if (keys[i].contains("http")) {
                        url = keys[i] + "=" + result[keys[i]];
                    } else {
                        url += "&" + keys[i] + "=" + result[keys[i]];
                    }
                }

                var config = {
                    method: 'GET',
                    type: 'json',
                    timeout: 45000,
                    onComplete: function(rs) {
                        console.log("long query", rs);
                        for (var i = 0, length = rs.hits.length; i < length; i++) {
                            var metas = that.convert.convertMetaToObject(rs.hits[i].metas);
                            var index = that._addLineStringGeometricFilter(metas);

                            // $("#whereInput")[0].tagTpl = { "label": metas["title"].value };

                            completedCallback(data.name, index);
                        }

                    },
                    onFailure: function(rs) {
                        console.log("Failed to get rdblink features", rs);
                    }
                };

                that.queryManager.waf.authenticatedRequest(url, config);
            },
            _addAttributePointToWhere: function(data, name, completedCallback) {
                var radius = parseInt($("#searchRadiusInput")[0].value);
                var index = this.searchProperties.addGeometricFilter("POINT", this.convert.convertPointToWKT(data.position), data.position, radius);

                var areaCoordinates = this._getCircleCoordinates(radius, 100, data.position);
                this.featuresManager.drawSearchBufferedArea(areaCoordinates, index);

                completedCallback(name, index);
            },
            _getPOIName: function(data) {
                if (data.userData) {
                    return data.userData.NAME || data.userData.Name;
                }
                return data.name;
            },
            _setGeoJsonFeatureAsWhere: function(geojson) {
                // console.log(geojson);
                var radius = parseInt($("#searchRadiusInput")[0].value);
                var type = geojson.features[0].geometry.type.toUpperCase();
                var coordinates = type == "POLYGON" ? geojson.features[0].geometry.coordinates[0] : geojson.features[0].geometry.coordinates;
                var wkt = type == "POLYGON" ?
                    this.convert.convertPolygonToWKT(this.geoPolygonBuffer.getExpandedCoordinatesScaled(coordinates, 1, 3)) :
                    this.convert.convertLineToWKT(this._simplifyLinestring(coordinates));

                var index = this.searchProperties.addGeometricFilter(type, wkt, coordinates, radius);

                return { coordinates: coordinates, index: index };
            },
            _setLayerVectorPrimitveAsWhere: function(userData) {
                var radius = parseInt($("#searchRadiusInput")[0].value);
                var type = userData.gdal_geo_type;
                var wkt = userData.gdal_default_geo;
                var coordinates;

                if (userData.gdal_geo_type == "POINT") {
                    coordinates = this.convert.convertPoint(userData.gdal_default_geo);
                } else if (userData.gdal_geo_type == "LINE" || userData.gdal_geo_type == "LINESTRING") {
                    coordinates = this.convert.convertLine(userData.gdal_default_geo);
                    wkt = this.convert.convertLineToWKT(this._simplifyLinestring(coordinates));
                } else if (userData.gdal_geo_type == "POLYGON") {
                    coordinates = this.convert.convertPolygon(userData.gdal_default_geo);
                    wkt = this.convert.convertPolygonToWKT(this.geoPolygonBuffer.getExpandedCoordinatesScaled(coordinates, 1, 3))
                }

                var index = this.searchProperties.addGeometricFilter(type, wkt, coordinates, radius);

                return { coordinates: coordinates, index: index }
            },
            _setFactoryLineAsWhere: function(geojson) {
                var coordinates = [];

                var keys = Object.keys(geojson);
                for (var i = 0, length = keys.length; i < length; i++) {
                    coordinates = coordinates.concat(geojson[keys[i]].features[0].geometry.coordinates);
                }

                var radius = parseInt($("#searchRadiusInput")[0].value);
                var index = this.searchProperties.addGeometricFilter("LINESTRING", this.convert.convertLineToWKT(coordinates), coordinates, radius);

                return { coordinates: coordinates, index: index }
            },
            _simplifyLinestring: function(coordinates) {
                if (coordinates.length <= 30) {
                    return coordinates;
                }

                var simplified = [];
                var factor = 1;

                do {
                    simplified = this.simplify(coordinates, factor, false);
                    factor += 1;
                } while (simplified.length > 30);

                return simplified;
            },
            _processSearchFilterChange: function(callbacks, filter) {
                clearTimeout(this.searchFilterTimer);
                this.searchFilterTimer = setTimeout(this._updateSearchFilter.bind(this, callbacks, filter), 1500);
            },
            _updateSearchFilter: function(callbacks, filter) {
                // console.log("Update search filter", filter);

                if (JSON.stringify(this.searchProperties.filter) == JSON.stringify(filter)) {
                    return;
                }

                callbacks.updatingCallback();
                
                this.searchProperties.filter = filter;
                this.searchProperties.page = 0;
                this.searchProperties.skip = true;
                this.search(false, callbacks);
            },
            export: function(exportType, completedCallback) {
                var searchProperties = Object.assign(
                    Object.create(
                        Object.getPrototypeOf(this.searchProperties)
                    ),
                    this.searchProperties
                );
                searchProperties.limit = 10000;
                searchProperties.page = 0;

                var that = this;
                this.queryManager.processSearch(searchProperties, function(rs) {
                    var results = [];

					for (var i = 0, length = rs.hits.length; i < length; i++) {
                        let feature = rs.hits[i];                 
						
						if(!feature.geometry) {
							continue
						}
						feature.searchResultId = "searchResult_" + i + "_" + feature.geometry.type;
						results.push(feature);
                    }
					
					let updatedResult = that._updateResultsLayername(results, that.datasetManager.availableDatasets);

                    if (exportType == "kml") {
                        that.dataExport.toKML(updatedResult);
                    }
                    if (exportType == "xls") {
                        that.dataExport.toXLS(updatedResult);
                    }

                    completedCallback();
                });
            },
            highlightFeatureOnMap: function(item) {
               // var primitiveId = item.searchResultId;
				
                // var layerId = this.datasetManager.getLoadedDatasetIdWithEnoviaDocId(item.physicalid.value);
                // if (layerId) {
                    // primitiveId = item.field_string_STRID.value;
                // } 
				
				let layerId = item.properties.layerid;
				let primitiveId = item.properties.STRID;
                this.featuresManager.selectFeature(layerId, primitiveId, item.geometry.type);
            },
            deselectFeature: function(featureId) {
                this.featuresManager.deselectFeature(featureId);
            },
            zoomToViewAllWhereFeatures: function() {
                this.ViewHelper.zoomToArea(this.searchProperties.getGeometricFiltersCoordinates());
            },
            zoomToFeature: function(item) {
                var coordinates = [];

                if (item.geometry.type.contains( "POINT")) {
                    coordinates = [this.convert.convertPoint(item.geometry.coordinates)];
                } else if (item.geometry.type.contains( "LINESTRING")) {
                    coordinates = this.convert.convertLine(item.geometry.coordinates);
                } else if (item.geometry.type.contains( "POLYGON")) {
                    coordinates = this.convert.convertPolygon(item.geometry.coordinates);
                }

                this.ViewHelper.zoomToArea(coordinates);
            }
        };

        return Search.getInstance();
    });