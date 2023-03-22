define(["DS/PlatformAPI/PlatformAPI", "ExtHelper/Convert"],
    function(PlatformAPI, Convert) {
        var instance = null;

        function FeaturesManager() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        FeaturesManager.getInstance = function() {
            if (instance === null) {
                instance = new FeaturesManager();
                instance.PlatformAPI = PlatformAPI;
                instance.convert = Convert;
            }
            return instance;
        };

        FeaturesManager.prototype = {
            stopLoading: false,
            selectedPrimitives: [],

            init: function() {},
            drawSearchPoint: function(position, index) {
                var options = {};

                if (typeof position == "object") {
                    if (position.z == undefined) {
                        options.addTerrainHeight = true;
                    }
                }

                this._createTemporaryFolder("Search", "Search");
                this.PlatformAPI.publish('3DEXPERIENCity.Add3DPOI', {
                    widgetID: widget.id,
                    collection: {
                        type: "POINT",
                        coordinates: position
                    },
                    layer: {
                        "id": "searchPoint_" + index,
                        "name": 'Search Point',
                        selectable: false
                    },
                    folder: {
                        "id": "Search",
                        "name": 'Search',
                        "parent_id": 'root'
                    },
                    render: {
                        renderMode: 'occluded',
                        color: "rgb(54,142,196)",
                        shape: "sphere",
                        scale: [5, 5, 5],
                        switchDistance: 750
                    },
                    options: options
                });
            },
            drawSearchAreaPolygon: function(polygonCoordinates, index) {
                if (polygonCoordinates.length < 3) {
                    return;
                }

                this._createTemporaryFolder("Search", "Search");
                this.PlatformAPI.publish('3DEXPERIENCity.AddPolygon', {
                    widgetID: widget.id,
                    collection: {
                        type: "POLYGON",
                        coordinates: polygonCoordinates
                    },
                    layer: {
                        id: "searchPolygon_" + index,
                        name: "Search Polygon",
                        selectable: false
                    },
                    folder: {
                        "id": "Search",
                        "name": 'Search',
                        "parent_id": 'root'
                    },
                    render: {
                        renderMode: 'overlay',
                        color: "rgb(5,180,255)",
                        minWidth: 2,
                        minDist: 100,
                        opacity: 0.3
                    }
                });
            },
            drawSearchBufferedArea: function(polygonCoordinates, index) {
                if (polygonCoordinates.length < 3) {
                    return;
                }

                this._createTemporaryFolder("Search", "Search");
                this.PlatformAPI.publish('3DEXPERIENCity.AddPolygon', {
                    widgetID: widget.id,
                    collection: {
                        type: "POLYGON",
                        coordinates: polygonCoordinates
                    },
                    layer: {
                        id: "searchBufferedArea_" + index,
                        name: "Search Area",
                        selectable: false
                    },
                    folder: {
                        "id": "Search",
                        "name": 'Search',
                        "parent_id": 'root'
                    },
                    render: {
                        renderMode: 'overlay',
                        color: "rgb(5,180,255)",
                        minWidth: 2,
                        minDist: 100,
                        opacity: 0.3,
                        heightOffset: polygonCoordinates[0][2]
                    }
                });
            },
            drawSearchLine: function(lineCoordinates, index) {
                var options = {};
                if (lineCoordinates[0].length < 3) {
                    options.addTerrainHeight = true;
                }

                this._createTemporaryFolder("Search", "Search");
                this.PlatformAPI.publish('3DEXPERIENCity.AddLine', {
                    widgetID: widget.id,
                    collection: {
                        type: "LINESTRING",
                        coordinates: lineCoordinates
                    },
                    layer: {
                        id: "searchLine_" + index,
                        name: "Search Line",
                        selectable: false
                    },
                    folder: {
                        "id": "Search",
                        "name": 'Search',
                        "parent_id": 'root'
                    },
                    render: {
                        renderMode: 'overlay',
                        color: "rgb(5,180,255)",
                        lineWidth: 4,
                        minWidth: 2,
                        minDist: 100
                    },
                    options: options
                });
            },
            removeSearchBufferedArea: function(index) {
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchBufferedArea_' + index);
            },
            removeSearchGeometry: function(index) {
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchPoint_' + index);
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchPolygon_' + index);
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchLine_' + index);
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchBufferedArea_' + index);
            },
            removeCustomSearchGeometries: function() {
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchPoint');
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchPolygon');
                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchLine');
            },
            plotPointResults: function(metas) {
                this.stopLoading = false;

                var collections = [];

                for (var i = 0, length = metas.length; i < length; i++) {
                    if (this.isGeoType(metas[i], "Point") == true) {
						let collection = JSON.parse(JSON.stringify(metas[i]));
                        collection.properties.NAME = this.getFeatureName(metas[i], i);
                        collections.push(metas[i]);
                    }
                }

                if (collections.length == 0) {
                    return;
                }

                this._createTemporaryFolder("searchResults", "Search Results");
                this.PlatformAPI.publish('3DEXPERIENCity.Add3DPOI', {
                    widgetID: widget.id,
                    geojson: {
						"type": "FeatureCollection",						
						"features": collections,
					},
                    layer: {
                        "id": "searchResultPoints",
                        "name": 'Search Results',
                    },
                    folder: {
                        "id": "searchResults",
                        "name": 'Search Results',
                        "parent_id": 'Search'
                    },
                    render: {
                        renderMode: 'dual',
                        color: "rgb(0,250,250)",
                        shape: "sphere",
                        scale: [5, 5, 5],
                        switchDistance: 750,
                        opacity: 1
                    },
                    options: {
                        css: {
                            "id": 'poi3D',
                            "url": 'https://sgp-server2015x.uwglobe.com/widget/assets/css/poi.css?v=2'
                        }
                    }
                });
            },
            plotLineResults: function(metas) {
                this.stopLoading = false;

                var collections = [];

                for (var i = 0, length = metas.length; i < length; i++) {
                    if (this.isGeoType(metas[i], "LineString") == true) {
						let collection = JSON.parse(JSON.stringify(metas[i]));
                        collection.properties.NAME = this.getFeatureName(metas[i], i);
                        collections.push(metas[i]);
                    }
                }

                if (collections.length == 0) {
                    return;
                }

                this._createTemporaryFolder("searchResults", "Search Results");
                this.PlatformAPI.publish('3DEXPERIENCity.AddLine', {
                    geojson: {
						"type": "FeatureCollection",						
						"features": collections,
					},
                    layer: {
                        id: "searchResultLines", 
                        name: "Search Result Lines"
                    },
                    folder: {
                        "id": "searchResults",
                        "name": 'Search Results',
                        "parent_id": 'Search'
                    },
                    render: {
                        renderMode: 'dual',
                        color: "rgb(0,250,250)",
                        minWidth: 2,
                        minDist: 100,
                        maxDist: 100000,
                        lineWidth: 4,
                        blending: "multiply"
                    }
                });
            },
            plotPolygonResults: function(metas) {
                this.stopLoading = false;

                var collections = [];

                for (var i = 0, ilength = metas.length; i < ilength; i++) {
                    if (this.isGeoType(metas[i], "Polygon") == true) {
						let collection = JSON.parse(JSON.stringify(metas[i]));
                        collection.properties.NAME = this.getFeatureName(metas[i], i);
                        collections.push(collection);
                    }
                }

                if (collections.length == 0) {
                    return;
                }

                this._createTemporaryFolder("searchResults", "Search Results");
                this.PlatformAPI.publish('3DEXPERIENCity.AddPolygon', {
                    geojson: {
						"type": "FeatureCollection",						
						"features": collections,
					},
                    layer: {
                        id: "searchResultPolygons", 
                        name: "Search Result Polygons"
                    },
                    folder: {
                        "id": "searchResults",
                        "name": 'Search Results',
                        "parent_id": 'Search'
                    },
                    render: {
                        renderMode: 'dual',
                        color: "rgb(0,250,250)"
                    },
                    options: {
						"addTerrainHeight" : true
					}
                });
            },
            _getFirstLeafArray: function(arr) {
                if (Array.isArray(arr[0][0]) == false) {
                    return arr;
                }
                return this._getFirstLeafArray(arr[0]);
            },
            isGeoType: function(meta, type) {
				if(meta.geometry.type) {
					return meta.geometry.type.toLowerCase().contains(type.toLowerCase());
				}
                return false;
            },
            getFeatureName: function(meta, i) {
                if (meta.NAME) {
                    return meta.NAME.value;
                } else if (meta.Name) {
                    return meta.Name.value;
                } else if (meta.HOUSE_BLK_ && meta.ROAD_NAME) {
                    return meta.HOUSE_BLK_.value + " " + meta.ROAD_NAME.value;
                } else if (meta.BUILDING_N) {
                    return meta.BUILDING_N.value;
                } else if(meta.layername){
                    return meta.layername.value + "_" + i;
                }
				else if(meta.properties){
					return meta.properties.layername + "_" + i;
				}
            },
            yieldingLoop: function(count, chunksize, callback, finished) {
                var i = 0,
                    that = this;
                (function chunk() {
                    if (that.stopLoading == true) {
                        return;
                    }

                    var end = Math.min(i + chunksize, count);
                    for (; i < end; ++i) {
                        callback.call(null, i);
                    }
                    if (i < count) {
                        setTimeout(chunk, 0);
                    } else {
                        finished.call(null);
                    }
                })();
            },
            stopLoadingFeatures: function() {
                this.stopLoading = true;
            },
            getSelectedFeature: function() {
                var promise = $.Deferred();

                var that = this;
                var subscription = this.PlatformAPI.subscribe('3DEXPERIENCity.GetSelectedItemsReturn', function(rs) {
                    subscription.unsubscribe();

                    promise.resolve(rs.data.pop());
                });

                this.PlatformAPI.publish('3DEXPERIENCity.GetSelectedItems');

                return promise;
            },
            getFeatureAttrib: function(featureId, attribName) {
                var promise = $.Deferred();

                var that = this;
                var subscription = this.PlatformAPI.subscribe('3DEXPERIENCity.GetReturn', function(attribValue) {
                    subscription.unsubscribe();

                    promise.resolve(attribValue);
                });

                this.PlatformAPI.publish('3DEXPERIENCity.Get', [featureId, attribName]);

                setTimeout(function() {
                    subscription.unsubscribe();
                    promise.reject('Promise timed out after ' + 2000 + ' ms');
                }, 2000);

                return promise;
            },
            clearSearchFeatures: function() {
                var that = this;
                this._deselectAllFeatures().then(function() {
                    that.PlatformAPI.publish('3DEXPERIENCity.Set', ['searchResultPoints', 'visible', 'false']);
                    that.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'Search');
                    that.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', 'searchResults');
                });
            },
            selectFeature: function(layerId, primitiveId, geotype) {
                var that = this;
                this._deselectAllFeatures().then(function() {
                    if (!layerId) {
                        if (geotype.toUpperCase() === "POLYGON") {
                            layerId = "searchResultPolygons";
                        } else if (geotype.toUpperCase() === "LINESTRING") {
                            layerId = "searchResultLines";
                        } else {
                            layerId = "searchResultPoints";
                        }
                    } else {
                        that.selectedPrimitives.push(primitiveId);
                    }

                    that.PlatformAPI.publish('3DEXPERIENCity.SelectObject', {
                        widget_id: widget.id,
                        layer_id: layerId,
                        primitive_id: primitiveId,
                        folder_id: "searchResults",
                        exclusive: false
                    });
                });
            },
            deselectFeature: function(featureId) {
               
                var selectedPrimitiveIndex = this.selectedPrimitives.indexOf(featureId);
                if (selectedPrimitiveIndex > -1) {
                    this.selectedPrimitives.splice(selectedPrimitiveIndex, 1);
                }

                this.PlatformAPI.publish('3DEXPERIENCity.RemoveContent', featureId);
            },
            _deselectAllFeatures: function() {
                var promise = $.Deferred();

                var that = this;
                var subscription = this.PlatformAPI.subscribe('3DEXPERIENCity.GetSelectedItemsReturn', function(rs) {
                    subscription.unsubscribe();

                    for (var i = 0, length = rs.data.length; i < length; i++) {
                        that.PlatformAPI.publish('3DEXPERIENCity.Set', [rs.data[i].id, 'selected', false]);
                    }

                    setTimeout(function() {
                        promise.resolve();
                    }, 200);
                });

                this.PlatformAPI.publish('3DEXPERIENCity.GetSelectedItems');

                return promise;
            },
            _createTemporaryFolder: function(id, name) {
                var isWidgetInView = function(element) {
                    return element.parentElement.offsetWidth > 0 && element.parentElement.offsetHeight > 0;
                };
                var cityReferentialWidget = Array.from(parent.document.querySelectorAll("[class*='CityReferential']")).find(isWidgetInView);
                var cityDiscoverWidget = Array.from(parent.document.querySelectorAll("[class*='CityDiscover']")).find(isWidgetInView);
                var cityPlay = Array.from(parent.document.querySelectorAll("[class*='City3Dplay']")).find(isWidgetInView);
                var cityWidget = cityReferentialWidget || cityDiscoverWidget || cityPlay;

                if (cityWidget == undefined) {
                    return;
                }

                var xCity = cityWidget.querySelector("iframe").contentWindow.xCity;

                xCity.getTemporaryFolder(id, name);
            }
        };

        return FeaturesManager.getInstance();
    });