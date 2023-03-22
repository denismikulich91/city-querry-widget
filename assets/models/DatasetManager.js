define(["DS/WAFData/WAFData", "DS/PlatformAPI/PlatformAPI", "ExtHelper/Convert", "ExtModels/DocumentManager"],
    function(waf, PlatformAPI, Convert, DocumentManager) {
        var instance = null;
        var xCity;

        function DatasetManager() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        DatasetManager.getInstance = function() {
            if (instance === null) {
                instance = new DatasetManager();
                instance.waf = waf;
                instance.PlatformAPI = PlatformAPI;
                instance.convert = Convert;
                instance.DocumentManager = DocumentManager;
                instance.init();
            }
            return instance;
        };

        DatasetManager.prototype = {
            availableDatasets: [],
            proxy: "https://sgp-server2015x.uwglobe.com/widget/assets/php/urlProxy.php",

            init: function() {
                this._initXCityReference();
            },
            _initXCityReference: function() {
                if (xCity != undefined) {
                    return;
                }

                var isWidgetInView = function(element) {
                    return element.parentElement.offsetWidth > 0 && element.parentElement.offsetHeight > 0;
                };
                var cityReferentialWidget = Array.from(parent.document.querySelectorAll("[class*='CityReferential']")).find(isWidgetInView);
                var cityDiscoverWidget = Array.from(parent.document.querySelectorAll("[class*='CityDiscover']")).find(isWidgetInView);
                var cityPlay = Array.from(parent.document.querySelectorAll("[class*='City3Dplay']")).find(isWidgetInView);
                var cityWidget = cityReferentialWidget || cityDiscoverWidget || cityPlay;

                if (cityWidget == undefined) {
                    setTimeout(this._initXCityReference.bind(this), 200);
                    return;
                }

                xCity = cityWidget.querySelector("iframe").contentWindow.xCity;
                if (xCity == undefined) {
                    setTimeout(this._initXCityReference.bind(this), 200);
                    return;
                }

                var that = this;
                cityWidget.querySelector("iframe").contentWindow.require(
                    [
                        'DS/xCityAppsInfra/xCity3DContentCreation'
                    ],
                    function(
                        xCity3DContentCreation
                    ) {
                        that.xCity3DContentCreation = xCity3DContentCreation;
                    }
                );

                this.getAllAvailableDatasets();
                setInterval(this.getAllAvailableDatasets.bind(this), 60000);
            },
            getAllAvailableDatasets: function() {
                if (xCity.widgetData == undefined) {
                    setTimeout(this.getAllAvailableDatasets.bind(this), 200);
                    return;
                }

                if (xCity.widgetData.enoviaData == undefined) {
                    setTimeout(this.getAllAvailableDatasets.bind(this), 200);
                    return;
                }

                var promise = $.Deferred();

                // var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                // var tenant = xCity.widgetData.enoviaData.getTenantId();
                // var referential = xCity.widgetData.currentReferential.model.get("title");
                // var url = globeUrl + "/authoring/dataset?tenant=" + tenant + "&referential=" + referential + "&xrequestedwith=xmlhttprequest";

                // var that = this;
                // this.waf.authenticatedRequest(url, {
                //     method: "GET",
                //     onComplete: function(rs) {
                //         // console.log("get datasets success", rs);
                //         rs = JSON.parse(rs);
                //         that.availableDatasets = rs;
                //         promise.resolve(rs);
                //     },
                //     onFailure: function(rs) {
                //         console.log("get datasets failed", rs);
                //     }
                // });

                var referential = xCity.widgetData.currentReferential.model.get("title");
                if (!referential) {
                    setTimeout(this.getAllAvailableDatasets.bind(this), 200);
                    return;
                }

                var that = this;
                xCity.widgetData.datasetCollection.fetchDatasetsByReferential(referential, true, function(rs) {
                    // console.log("fetch dataset collection", rs);
                    that.availableDatasets = rs.toJSON();
                    promise.resolve(that.availableDatasets);
                }, function() {});

                return promise;
            },
            getDatasetIdWithEnoviaDocId: function(enoviaDocId) {
                return; //TODO: Need to update

                var splitted = enoviaDocId.split("/");
                enoviaDocId = splitted.getLast();

                for (var i = 0, ilength = this.availableDatasets.length; i < ilength; i++) {
                    var sources = this.availableDatasets[i].sourceList;
                    for (var j = 0, jlength = sources.length; j < jlength; j++) {
                        if (sources[j].enoviaSourceId == enoviaDocId) {
                            return this.availableDatasets[i].UUID;
                        }
                    }
                }
                return undefined;
            },
            _getDatasetPropertiesWithEnoviaDocId: function(enoviaDocId) {
                return; //TODO: Need to update

                var splitted = enoviaDocId.split("/");
                enoviaDocId = splitted.getLast();

                for (var i = 0, ilength = this.availableDatasets.length; i < ilength; i++) {
                    var sources = this.availableDatasets[i].sourceList;
                    for (var j = 0, jlength = sources.length; j < jlength; j++) {
                        if (sources[j].enoviaSourceId == enoviaDocId) {
                            return this.availableDatasets[i];
                        }
                    }
                }
                return undefined;
            },
            getLoadedDatasetIdWithEnoviaDocId: function(enoviaDocId) {
                var datasetId = this.getDatasetIdWithEnoviaDocId(enoviaDocId);

                if (datasetId) {
                    var loadedDatasets = xCity.getDataModelVisibility();

                    for (var i = 0, length = loadedDatasets.length; i < length; i++) {
                        var dataset = xCity.findItem({ id: loadedDatasets[i].id });
                        var url = dataset.get("url");
                        if (url) {
                            if (typeof url != "string") {
                                continue;
                            }
                            if (url.indexOf(datasetId) > -1) {
                                return dataset.get("id");
                            }
                        }
                    }
                }

                return undefined;
            },
            getDatasetTypeWithEnoviaDocId: function(enoviaDocId) {
                var datasetProperties = this._getDatasetPropertiesWithEnoviaDocId(enoviaDocId);

                return datasetProperties ? datasetProperties.type : undefined;
            },
            plotDatasetResults: function(rs) {
                console.log("Plotting non loaded dataset search results", rs);

                var groupedResults = this._groupDatasetResultsByDatasource(rs);

                var keys = Object.keys(groupedResults);
                for (var i = 0, length = keys.length; i < length; i++) {
                    var datasetProperties = this._getDatasetPropertiesWithEnoviaDocId(groupedResults[keys[i]][0].enovia_physical_id.value);
                    var geojson = this._generateGeoJson(groupedResults[keys[i]]);
                    this.addDatasetFeature(datasetProperties, geojson);
                }
            },
            _groupDatasetResultsByDatasource: function(rs) {
                var grouped = [];

                for (var i = 0, length = rs.length; i < length; i++) {
                    if (grouped[rs[i].enovia_physical_id.value]) {
                        grouped[rs[i].enovia_physical_id.value].push(rs[i]);
                    } else {
                        grouped[rs[i].enovia_physical_id.value] = [rs[i]];
                    }
                }

                return grouped;
            },
            addDatasetFeature: function(datasetProperties, geojson) {
                var getFactoryUrl = this._getDatasetFactoryUrl(datasetProperties.type, datasetProperties.UUID);
                var getContentUrl = this._getDatasetContentUrl(datasetProperties.UUID, geojson);

                var that = this;
                $.when(getFactoryUrl, getContentUrl).done(function(factoryUrl, contentUrl) {
                    console.log("add dataset feature", factoryUrl, contentUrl);

                    var searchResultsFolder = xCity.findItem({ id: "searchResults" });
                    if (searchResultsFolder == undefined) {
                        var searchFolder = xCity.findItem({ id: "Search" });
                        searchResultsFolder = xCity.addFolder({ id: "searchResults", name: "Search Results" }, searchFolder);
                    }

                    that.displayDatasetFeature(datasetProperties, factoryUrl, contentUrl, searchResultsFolder);
                });
            },
            _getDatasetFactoryUrl: function(type, uuid) {
                var promise = $.Deferred();

                var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                var tenant = xCity.widgetData.enoviaData.getTenantId();

                if (type == "GeolocalizedBuilding" ||
                    type == "SpecificBuilding" ||
                    type == "Point" ||
                    type == "Polygon" ||
                    type == "Linestring") {
                    promise.resolve(globeUrl + "/datasupplier/" + uuid + "/resources/?tenant=" + tenant);
                } else {
                    this._getDatasetResources(uuid).then(function(resources) {
                        var resource = "";
                        for (var i = 0, length = resources.length; i < length; i++) {
                            if (resources[i].toLowerCase().indexOf(".json") > -1 || 
                                resources[i].toLowerCase().indexOf(".png") > -1 ||
                                resources[i].toLowerCase().indexOf(".3dxc") > -1) {
                                resource = resources[i];
                                break;
                            }
                        }

                        promise.resolve(globeUrl + "/datasupplier/" + uuid + "/resources/" + resource + "?tenant=" + tenant);
                    });
                }

                return promise;
            },
            _getDatasetResources: function(uuid) {
                var promise = $.Deferred();

                var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                var tenant = xCity.widgetData.enoviaData.getTenantId();
                var url = globeUrl + "/datasupplier/" + uuid + "/resources/index.json?tenant=" + tenant + "&xrequestedwith=xmlhttprequest"

                var that = this;
                this.waf.authenticatedRequest(url, {
                    method: "GET",
                    onComplete: function(rs) {
                        console.log("get dataset resources success", rs);
                        promise.resolve(JSON.decode(rs));
                    },
                    onFailure: function(rs) {
                        console.log("get dataset resources failed", rs);
                        promise.resolve([]);
                    }
                });

                return promise;
            },
            _getDatasetContentUrl: function(uuid, geo, type) {
                var promise = $.Deferred();

                if (geo) {
                    var geojson = JSON.stringify(geo);

                    var formData = new FormData();
                    formData.append("action", "put");
                    formData.append("id", uuid);
                    formData.append("data", geojson);

                    var proxyUrl = "https://sgp-server2015x.uwglobe.com/widget/assets/php/urlProxy.php";
                    this.waf.proxifiedRequest(proxyUrl, {
                        method: "POST",
                        type: 'json',
                        data: formData,
                        onComplete: function(rs) {
                            promise.resolve(proxyUrl + '?action=get&sid=' + rs.sid + '&id=' + id);
                        },
                        onFailure: function(err) {
                            console.log('ERR', err);
                            reject({ widget_id: data.widget_id, data: 'Add3DPOI: Unable to get respond from external service' })
                        }
                    });
                } else {
                    var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                    var tenant = xCity.widgetData.enoviaData.getTenantId();
                    var ext = "geojson";
                    if (type == "Image") {
                        ext = "png";
                    } else if (type == "ImageTerrain") {
                        ext = "bil";
                    } else if (type == "GeometricTerrain" || type == "MergedBuilding") {
                        ext = "3dxc";
                        uuid += "/resources";
                    }

                    promise.resolve(globeUrl + "/datasupplier/" + uuid + "/%l/%x/%y." + ext + "?tenant=" + tenant);
                }

                return promise;
            },
            displayDatasetFeature: function(datasetProperties, factoryUrl, contentUrl, folder) {
                if (datasetProperties.type == "Tree") {
                    var profile = {
                        "profiles": [{
                            "name": xCity.renderingProfile,
                            "Rendering": [{
                                "Ids": [datasetProperties.uuid],
                                "Material": {
                                    "mapUrl": factoryUrl
                                }
                            }]
                        }]
                    };
                    xCity.loadRenderingProfiles(profile);
                }

                var content;
                if (datasetProperties.type == "MapServer") {
                    content = {
                        "levelMin": datasetProperties.startLevel,
                        "levelMax": datasetProperties.endLevel,
                        "levelMaxVisu": 99999,
                        "priority": 5,
                        "cache": 50,
                        "AABBox":
                        {
                            "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                            "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        },
                        "url": contentUrl,
                        "res": 256,
                        "opacity": 1,
                        "yTopToBottom": true,
                        "id": datasetProperties.uuid, //+ "_content",
                        "className": "RasterOverlay"
                    }
                } else if (datasetProperties.type == "GeometricTerrain") {
                    content = {
                        "levelMin": 8,
                        "levelMax": 8,
                        "levelMaxVisu": 99999,
                        "priority": 5,
                        "cache": 100,
                        // "AABBox":
                        // {
                        //     "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                        //     "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        // },
                        "url": contentUrl,
                        "sourceMode": "geometricMode",
                        "border": 2,
                        "res": 1,
                        "yTopToBottom": false,
                        "id": datasetProperties.uuid, //+ "_content",
                        "className": "Terrain"
                    }
                } else if (datasetProperties.type == "MergedBuilding") {
                    content = {
                        "levelMin": datasetProperties.startLevel,
                        "levelMax": datasetProperties.endLevel,
                        "priority": 3,
                        "priorityOffset": 1,
                        "cache": 50,
                        "lodBias": 0,
                        "AABBox":
                        {
                            "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                            "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        },
                        "type": "3DXM",
                        "url": contentUrl,
                        "invertY": false,
                        "alternUrl": "",
                        "alternDict": [],
                        "geolocalized": true,
                        "id": datasetProperties.uuid, //+ "_content",
                        "className": "RdbLink",
                        "Factory":
                        {
                            "className": "Model"
                        }
                    }
                } else if (datasetProperties.type == "ImageTerrain") {
                    content = {
                        "levelMin": datasetProperties.startLevel,
                        "levelMax": datasetProperties.endLevel,
                        "levelMaxVisu": 99999,
                        "priority": 4,
                        "cache": 150,
                        "AABBox":
                        {
                            "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                            "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        },
                        "url": contentUrl,
                        "sourceMode": "raster",
                        "res": 68,
                        "yTopToBottom": true,
                        "id": datasetProperties.uuid, //+ "_content",
                        "className": "Terrain"
                    }
                } else if (datasetProperties.type == "Image") {
                    content = {
                        "levelMin": datasetProperties.startLevel,
                        "levelMax": datasetProperties.endLevel,
                        "levelMaxVisu": 99999,
                        "priority": 2,
                        "cache": 20,
                        "AABBox":
                        {
                            "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                            "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        },
                        "url": contentUrl,
                        "res": 256,
                        "opacity": 1,
                        "yTopToBottom": true,
                        "id": datasetProperties.uuid, //+ "_content",
                        "className": "RasterOverlay"
                    }
                } else {
                    content = {
                        "levelMin": datasetProperties.startLevel,
                        "levelMax": datasetProperties.endLevel,
                        "priority": 5,
                        "priorityOffset": 1,
                        "cache": 50,
                        "lodBias": 0,
                        "AABBox": {
                            "min": [datasetProperties.bbox.xmin, datasetProperties.bbox.ymin],
                            "max": [datasetProperties.bbox.xmax, datasetProperties.bbox.ymax]
                        },
                        "type": "json",
                        "url": contentUrl,
                        "invertY": true,
                        "alternUrl": "",
                        "alternDict": [],
                        "renderID": "",
                        "geolocalized": true,
                        "objectId": datasetProperties.uuid, //+ "_content",
                        "id": UWA.Utils.getUUID(), 
                        "className": "RdbLink",
                        "Factory": this._getFactory(datasetProperties.type, factoryUrl)
                    };
                }

                xCity.add3DContent({
                        // "id": datasetProperties.uuid,
                        "name": datasetProperties.name,
                        "className": "Feature",
                        "visible": true,
                        "parentFolder": folder
                    },
                    content
                );
            },
            _getFactory: function(type, factoryUrl) {
                if (type == "SpecificBuilding") {
                    return {
                        "className": "Model",
                        "path": factoryUrl,
                        "shader": "building"
                    }
                } else if (type == "GenericBuilding") {
                    return {
                        "className": "Building",
                        "defaultTextures": "textures/buildings/white.jpg",
                        "wallTextures": "",
                        "roofTextures": "textures/buildings/roofs/atlasR_512_2.jpg"
                    }
                } else if (type == "GeolocalizedBuilding") {
                    return {
                        "className": "File",
                        "path": factoryUrl,
                        "shader": "building"
                    }
                } else if (type == "Tree") {
                    return {
                        "className": "CrossQuad",
                        "atlasNum": {
                            "x": 4,
                            "y": 4
                        }
                    }
                } else if (type == "POI") {
                    return {
                        "className": "Pointofinterest3d",
                        "shapeType": "billboard",
                        "renderMode": "dual",
                        "opacityFactor": 0.3,
                        "nameAttribute": "NAME",
                        "alwaysDisplayText": false,
                        "scale": 0.25
                    }
                } else if (type == "Point") {
                    return {
                        "className": "Pointofinterest3d",
                        "geometryMode": "mesh",
                        "shapeType": "disc",
                        "shadingMode": "smooth",
                        "nameAttribute": "name",
                        "scaleAttribute": "[0.2,0.2,0.2]",
                        "heightAttribute": 10,
                        "renderAnchor": true,
                        "anchorLineWidth": 1,
                        "nbVertices": 8,
                        "scale": 20,
                        "switchDistance": 500,
                        "renderMode": "overlay",
                        "opacityFactor": 0.66,
                        "color":
                        {
                            "r": 10,
                            "g": 10,
                            "b": 10
                        }
                    }
                } else if (type == "Linestring") {
                    return {
                        "className": "Linestring",
                        "lineWidth": 4,
                        "heightOffset": 1,
                        "renderMode": "overlay",
                        "opacityFactor": 0.6,
                        "switchDistance": 1000,
                        "color": "#0a0a0a"
                    }
                } else if (type == "Polygon") {
                    return {
                        "className": "Polygon",
                        "geometricMode": "filled",
                        "lineWidth": 4,
                        "renderMode": "overlay",
                        "heightOffset": 0.5,
                        "opacity": 0.8,
                        "color": "#404040"
                    }
                } else {
                    return {
                        "className": "Element",
                        "url": factoryUrl
                    }
                }
            },
            _generateGeoJson: function(resultsMetas) {
                var hasName,
                    geojson = {
                        "type": "FeatureCollection",
                        "name": "",
                        "features": []
                    };

                for (var i = 0, ilength = resultsMetas.length; i < ilength; i++) {
                    var metas = resultsMetas[i],
                        geoType;

                    geojson.features.push({
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "",
                            "coordinates": []
                        }
                    });

                    var keys = Object.keys(resultsMetas[i]);
                    for (var j = 0, jlength = keys.length; j < jlength; j++) {
                        var metaValue = resultsMetas[i][keys[j]].value;

                        if (keys[j] === 'title') {
                            if (hasName) continue;
                            else {
                                geojson.name = metaValue;
                                hasName = true;
                            }
                        } else if (keys[j] === 'searchResultId') {
                            geojson.features[i].properties[keys[j]] = resultsMetas[i][keys[j]];
                        } else if (keys[j] === 'url') continue;
                        else if (keys[j] === 'enovia_doc_id') continue;
                        else if (keys[j] === 'enovia_physical_id') continue;
                        else if (keys[j] === 'gdal_default_epsg_code') continue;
                        else if (keys[j] === 'gdal_invalid_geo') continue;
                        else if (keys[j] === 'gdal_geo_type') {
                            geojson.features[i].geometry.type = metaValue;
                            geoType = metaValue;
                        } else if (keys[j] === 'gdal_default_geo') {
                            var coordinates = this._convertWKTToCoordinates(metaValue);
                            geojson.features[i].geometry.coordinates = [coordinates.x, coordinates.y];
                        } else {
                            var key = this._truncateGDALPrefix(keys[j]);
                            geojson.features[i].properties[key] = metaValue;
                        }
                    }
                }

                return geojson;
            },
            _convertWKTToCoordinates: function(wkt) {
                var coordinates;

                if (wkt.indexOf("POINT") > -1) {
                    coordinates = this.convert.convertPoint(wkt);
                } else if (wkt.indexOf("LINESTRING") > -1) {
                    coordinates = this.convert.convertLine(wkt);
                } else if (wkt.indexOf("POLYGON") > -1) {
                    coordinates = this.convert.convertPolygon(wkt);
                }

                return coordinates;
            },
            _truncateGDALPrefix: function(key) {
                if (key.indexOf("gdal_string_") > -1) {
                    key = key.replace("gdal_string_", "");
                } else if (key.indexOf("gdal_integer_") > -1) {
                    key = key.replace("gdal_integer_", "");
                } else if (key.indexOf("gdal_real_") > -1) {
                    key = key.replace("gdal_real_", "");
                }
                return key;
            },
            searchDataset: function(whatFilter, page) {
                var promise = $.Deferred();

                var that = this;
                var availableDatasets = this.availableDatasets;
                // this.getAllAvailableDatasets()
                    // // .then(this._getDatasetsCollabSpace.bind(this))
                    // .then(function(availableDatasets) {
                    var results = [];
                    if (whatFilter.length == 0) {
                        for (var i = 0, length = availableDatasets.length; i < length; i++) {
                            results.push(that._getDatasetSearchResult(availableDatasets[i]));
                        }
                    } else {
                        for (var i = 0, length = availableDatasets.length; i < length; i++) {
                            for (var j = 0; j < whatFilter.length; j++) {
                                var field = whatFilter[j].field;
                                if (field) {
                                    field = field.replace("dataset_", "");
                                    if (whatFilter[j].operator === "equals") {
                                        if (availableDatasets[i][field].toLowerCase() == whatFilter[j].value.toLowerCase().trim()) {
                                            results.push(that._getDatasetSearchResult(availableDatasets[i]));
                                        }
                                    } else if (whatFilter[j].operator === "contains") {
                                        if (availableDatasets[i][field].toLowerCase().contains(whatFilter[j].value.toLowerCase().trim())) {
                                            results.push(that._getDatasetSearchResult(availableDatasets[i]));
                                        }
                                    }
                                } else if (availableDatasets[i].name.toLowerCase().contains(whatFilter[j].value.toLowerCase().trim())) {
                                    results.push(that._getDatasetSearchResult(availableDatasets[i]));
                                }
                            }
                        }
                    }

                    var i, j, resultsPaginated = [],
                        chunk = 100;
                    for (i = 0, j = results.length; i < j; i += chunk) {
                        resultsPaginated.push(results.slice(i, i + chunk));
                    }

                  //  that._getDatasetsCollabSpace(resultsPaginated[page]).then(function(datasets) {
                        promise.resolve({
                            start: page * chunk,
                            nhits: results.length,
                            hits: resultsPaginated[page]
                        });
                  //  });
                // });

                return promise;
            },
            _getDatasetsCollabSpace: function(datasets) {
                var promise = $.Deferred();

                if (datasets == undefined) {
                    promise.resolve([]);
                    return promise;
                }

                var docIds = "";
                for (var i = 0, length = datasets.length; i < length; i++) {
                    docIds += (i > 0 ? "," : "") + datasets[i].dataset_docId.value;
                }

                this.DocumentManager.getDocuments(docIds).then(function(rs) {
                    rsLoop:
                    for (var i = 0, ilength = rs.data.length; i < ilength; i++) {
                        datasetLoop:
                        for (var j = 0, jlength = datasets.length; j < jlength; j++) {
                            if (rs.data[i].id == datasets[j].dataset_docId.value) {
                                datasets[j].collabspace = {value: rs.data[i].dataelements.collabspace, disableAttributeFilter: true};
                                break datasetLoop;
                            }
                        }
                    }

                    promise.resolve(datasets);
                });

                return promise;
            },
            _getDatasetSearchResult: function(dataset) {
                return {
                    dataset_name: {
                        value: dataset.name
                    },
                    dataset_uuid: {
                        value: dataset.uuid
                    },
                    dataset_state: {
                        value: dataset.state
                    },
                    dataset_type: {
                        value: dataset.type
                    },
                    dataset_docId: {
                        value: dataset.enoviaPhysicalId
                    },
                    dataset_startLevel: {
                        value: dataset.startLevel
                    },
                    dataset_endLevel: {
                        value: dataset.endLevel
                    },
                    dataset_pixTileBorder: {
                        value: dataset.pixTileBorder
                    },
                    dataset_referential: {
                        value: dataset.referential
                    },
                    dataset_exposedAttributeList: {
                        value: dataset.exposedAttributeList
                    }
                };
            },
            loadDataset: function(res) {
                for (var i = 0, length = this.availableDatasets.length; i < length; i++) {
                    if (this.availableDatasets[i].uuid == res.dataset_uuid.value) {
                        this.xCity3DContentCreation.createContentFromDataset(this.availableDatasets[i]);
                        break;
                    }
                }
            },
            loadDatasetOld: function(uuid) {
                var datasetProperties;
                for (var i = 0, length = this.availableDatasets.length; i < length; i++) {
                    if (this.availableDatasets[i].uuid == uuid) {
                        datasetProperties = this.availableDatasets[i];
                    }
                }

                if (datasetProperties.type == "SimpleFeature") {
                    var pointsProperties = Object.assign({}, datasetProperties);
                    pointsProperties.name += " (Points)";
                    pointsProperties.type = "Point";
                    this._addDatasetToCityWidget(pointsProperties);

                    var lineProperties = Object.assign({}, datasetProperties);
                    lineProperties.name += " (Lines)";
                    lineProperties.type = "Linestring";
                    this._addDatasetToCityWidget(lineProperties);

                    var polygonProperties = Object.assign({}, datasetProperties);
                    polygonProperties.name += " (Polygons)";
                    polygonProperties.type = "Polygon";
                    this._addDatasetToCityWidget(polygonProperties);
                } else {
                    this._addDatasetToCityWidget(datasetProperties);
                }
            },
            _addDatasetToCityWidget: function(datasetProperties) {
                var that = this;
                if (datasetProperties.type == "RawData") {
                    this._getCTDSContent(datasetProperties.uuid).then(function(ctds) {
                        datasetProperties.bbox = ctds.sourceBbox;
                        datasetProperties.type = ctds.sourceType;
                        datasetProperties.startLevel = ctds.sourceLevel;
                        datasetProperties.endLevel = ctds.sourceLevel;

                        that._addDatasetToCityWidget(datasetProperties);
                    });
                } else {
                    var getFactoryUrl = this._getDatasetFactoryUrl(datasetProperties.type, datasetProperties.uuid);
                    var getContentUrl = this._getDatasetContentUrl(datasetProperties.uuid, undefined, datasetProperties.type);
                    
                    $.when(getFactoryUrl, getContentUrl).done(function(factoryUrl, contentUrl) {
                        console.log("add dataset feature", factoryUrl, contentUrl);
                        that.displayDatasetFeature(datasetProperties, factoryUrl, contentUrl);
                    });
                }
            },
            removeDataset: function(uuid) {
                var promise = $.Deferred();

                var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                var tenant = xCity.widgetData.enoviaData.getTenantId();
                var url = globeUrl + "/authoring/dataset/" + uuid + "?tenant=" + tenant + "&xrequestedwith=xmlhttprequest"

                var that = this;
                this.waf.authenticatedRequest(url, {
                    method: "DELETE",
                    onComplete: function(rs) {
                        console.log("delete dataset success", rs);
                        promise.resolve(JSON.decode(rs));
                    },
                    onFailure: function(rs) {
                        console.log("delete dataset failed", rs);
                        promise.resolve();
                    }
                });

                return promise;
            },
			removeDatasetFromRef: function(uuid, action) {
				let datasetImpl = xCity.findItem({id: uuid}).impl;
				datasetImpl._itemParent.removeChild(datasetImpl);
				if(action === "permanent") {
					this.removeDataset(uuid);
				}
			},
            _getCTDSContent: function(uuid) {
                var promise = $.Deferred();

                var globeUrl = xCity.widgetData.enoviaData.urlGlobe;
                var tenant = xCity.widgetData.enoviaData.getTenantId();
                var url = globeUrl + "/datasupplier/" + uuid + "/resources/tiles.ctds?tenant=" + tenant + "&xrequestedwith=xmlhttprequest"

                var that = this;
                this.waf.authenticatedRequest(url, {
                    method: "GET",
                    onComplete: function(rs) {
                        console.log("get dataset resources success", rs);
                        promise.resolve(JSON.decode(rs));
                    },
                    onFailure: function(rs) {
                        console.log("get dataset resources failed", rs);
                        promise.resolve([]);
                    }
                });

                return promise;
            },
            getDatasourceDocumentIds: function() {
                var promise = $.Deferred();

                var datasourceDocIds = [];
                var datasets = this.availableDatasets;
                    for (var i = 0; i < datasets.length; i++) {
                        if (!datasets[i].sourceList[0]) {
                            continue;
                        }

                        datasourceDocIds.push(datasets[i].sourceList[0].enoviaSourcePhysicalId);
                    }
                    promise.resolve(datasourceDocIds);
                
                return promise;
            }
        };

        return DatasetManager.getInstance();
    });