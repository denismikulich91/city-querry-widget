define(["DS/WAFData/WAFData", "./PlatformCompassServices"],
    function(waf, platformServices) {
        var instance = null;
        var xCity;
		var referentialUUID;
		var tenant;
        var BY_INDEXED_DATA = 0,
            BY_TAGS = 1,
            BY_INDEXED_AND_TAGS = 2;

        function QueryManager() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        QueryManager.getInstance = function() {
            if (instance === null) {
                instance = new QueryManager();
                instance.waf = waf;
                instance.platformServices = platformServices;
                instance._init();
            }
            return instance;
        };

        QueryManager.prototype = {
            getXCity: function() {
                return xCity;
            },

            _init: function() {
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
            },
			getRefrentialUUID: function() {
				var promise = $.Deferred();
                var that = this;
				let refrentialTitle = xCity.widgetData.currentReferential.get("title");
					let queryUrl = platformServices.getGlobeService(widget.getValue("tenant")) + "/authoring/referential/" +refrentialTitle+ "?tenant=" + platformServices.getTenant();
					let config = {
						method: 'GET',
						type: 'json',
						headers: {
							"Content-Type": "application/json"
						},
						onComplete: function(rs) {
							referentialUUID = rs.uuid;
							console.log("referentialUUID", referentialUUID)	
							promise.resolve();							
						},
						onFailure: function(rs) {
							console.log("Query failed rs", rs);		
							 setTimeout(that.getRefrentialUUID.bind(that), 2000);
						}
					};
					this.waf.authenticatedRequest(queryUrl, config);
				return promise;
			},
            search: function(searchProperties, callback) {
                if (searchProperties.searchType == BY_TAGS) {
                    var that = this;
                    this._getDocumentIdsByTag(searchProperties.tagLiteral, searchProperties.predicates).then(function(documentIds) {
                        searchProperties.filter = {
                            hasFiltersTEMP: true,
                            filteredSubjectList: documentIds,
                            allfilters: []
                        }
                        that.processSearch(searchProperties, callback);
                    });
                } else {
                    this.processSearch(searchProperties, callback);
                }
            },
            processSearch: function(searchProperties, callback) {
                var requests = [];

                var numOfGeometricFilters = searchProperties.getNumberOfGeometricFilters();

                if (numOfGeometricFilters == 0) {
                    var start = searchProperties.page * searchProperties.limit;
                    requests.push(this._processGeneralSearch(searchProperties.whatFilters, searchProperties.filter, start, searchProperties.limit, searchProperties.datasetDatasourceDocIds));
                } else {
                    var noOfResultsPerFilter = this._getIntDividedIntoMultiple(searchProperties.limit, numOfGeometricFilters, 1);
                    for (var i = 0, j = 0; i < searchProperties.geometricFilters.length; i++) {
                        if (searchProperties.geometricFilters[i] == undefined) {
                            continue;
                        }

                        var start = searchProperties.page * noOfResultsPerFilter[j];
                        if (searchProperties.geometricFilters[i].wkt == "") {
                            requests.push(this._processGeneralSearch(searchProperties.whatFilters, searchProperties.filter, start, noOfResultsPerFilter[j], searchProperties.datasetDatasourceDocIds));
                        } else {
                            requests.push(this._processGeobufferSearch(searchProperties.whatFilters, searchProperties.geometricFilters[i].type, searchProperties.geometricFilters[i].coordinates, 
                                searchProperties.filter, searchProperties.geometricFilters[i].buffer, start, noOfResultsPerFilter[j], searchProperties.datasetDatasourceDocIds));
                        }
                        j++;
                    }
                }

                var requestCount = requests.length;
                var hits = [], start = 0, nhits = 0;

                var defer = $.when.apply($, requests);
                defer.done(function() {
                    $.each(arguments, function(index, responseData) {
                        // console.log("RESPONSE", responseData);
                        if (responseData.features) {
							console.log(responseData.hits);
                            hits = hits.concat(responseData.features);
                            start += responseData.offset;
                            nhits += responseData.nhits;                       
                        }

                        requestCount--;
                        if (requestCount == 0) {
                            callback({ hits: hits, start: start, nhits: nhits });
                        }
                    });
                });
            },
            _processGeneralSearch: function(what, filter, start, limit, datasetDatasourceDocIds) {
                var promise = $.Deferred();
                var uql;
				
				let queryUrl = this.platformServices.getGlobeService(widget.getValue("tenant")) + "/datasupplier/search?tenant=" + this.platformServices.getTenant();
			
				let omittUndefined = [];
				for(obj of what) {
					if(obj) {
						omittUndefined.push(obj);
					}
				}
				let filters = this._getFiltersList(omittUndefined);
				let data = {
					"referentialUUID": referentialUUID,
					 "filterList":	filters,
					"datamodel": "geoItemDatasetRepresentation",
					"response": {
						"offset": start,
						"size": limit
					}
				}


                let config = {
                    method: 'POST',
                    type: 'json',
                    data: JSON.stringify(data),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    timeout: 45000,
                    onComplete: promise.resolve,
                    onFailure: function(rs) {
                        console.log("Query failed rs", rs);
                        promise.resolve(rs);
                    }
                };

                this.waf.authenticatedRequest(queryUrl, config);

                return promise;
            },
            _processGeobufferSearch: function(what, geoType, coordinates, filter, buffer, start, limit, datasetDatasourceDocIds) {
                				
                var promise = $.Deferred();
                
				let queryUrl = this.platformServices.getGlobeService(widget.getValue("tenant")) + "/datasupplier/search?tenant=" + this.platformServices.getTenant();
				
                let _coordinates = coordinates.length ? coordinates.map(a => Object.values(a).slice(0, -1)) : Object.values(coordinates).slice(0, -1);
				if(geoType.toLowerCase() === "polygon") {
					_coordinates = [_coordinates];
				}
				let data = {
					"referentialUUID": referentialUUID,
					"filterList":	this._getFiltersList(what),
					"spatialFilterList": [
											[
												{
													"operator": buffer !== undefined ? "distancecontains2D" : "within2D",
													"distance": buffer,
													"geometry": {
														"type": geoType,
														"coordinates": _coordinates
													},
													"precision": 0.01
												}
											]
										],
					"datamodel": "geoItemDatasetRepresentation",
					"response": {
						"offset": start,
						"size": limit
					}
				}

                var config = {
                    method: 'POST',
                    type: 'json',
                    data: JSON.stringify(data),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    timeout: 45000,
                    onComplete: promise.resolve,
                    onFailure: function(rs) {
                        console.log("Query failed rs", rs);
                        promise.resolve(rs);
                    }
                };

                this.waf.authenticatedRequest(queryUrl, config);

                return promise;
            },
			_getFiltersList: function(what, filterList) {
				
				if (what.length > 0) {				
				
					filtersList = what.reduce((accumulator, currentValue, currentIndex, array) => {
						if(array[currentIndex]) {
							if(!array[currentIndex].joinOperator) {
								let filter = {
										"operator": array[currentIndex].operator ? array[currentIndex].operator : "like",
										"attribute": array[currentIndex].field ? array[currentIndex].field : ""
									  }
								if(array[currentIndex].operator == "inrange" || array[currentIndex].operator == "outrange")
								{
									let values = array[currentIndex].value.split(",");
									filter.lowerBound = Number(values[0]);
									filter.upperBound = Number(values[1]);
								}
								else {
									filter.value = isNaN(array[currentIndex].value) ? array[currentIndex].value : Number(array[currentIndex].value);
								}
								if(array[currentIndex - 1] && array[currentIndex - 1].joinOperator && array[currentIndex - 1].joinOperator == "OR") {
									accumulator.push([filter])									
								}
								else{
									accumulator[accumulator.length-1].push(filter);									
								}
								return accumulator;
							}
						}
								return accumulator;						
					}, [[]]);
                }
				return filtersList;
			},
            _getWhatFilter: function(what, filter) {
                if (what.length > 0) {
                    var whatQuery = "";

                    for (var i = 0, length = what.length; i < length; i++) {
                        if (what[i] == undefined) {
                            continue;
                        }

                        if (what[i].joinOperator) {
                            whatQuery += " " + what[i].joinOperator;
                        }

                        if (what[i].field && what[i].operator) {
                            whatQuery += " " + this._getWhatFilterQueryValue(what[i].field, what[i].operator, what[i].value);
                        } else if (what[i].value) {
                            if (what[i].value.contains("\"")) {
                                whatQuery += " " + what[i].value.replace(/\"/g, "");
                            } else {
                                whatQuery += " (spellslike:*" + what[i].value.replace(/ /g, "*") + "* OR " + what[i].value + ")";
                            }
                        }
                    }

                    return "(" + whatQuery.trim() + ")";
                }
                if (filter.filteredSubjectList) {
                    if (filter.filteredSubjectList.length > 0 && $.isEmptyObject(filter.allfilters) == false && what.length == 0) {
                        return "";
                    }
                }

                return "(#all)";
            },
            _getWhatFilterQueryValue: function(field, operator, value) {
                if (isNaN(value)) {
                    return "city_feature_field_string:" + field + ":" + this._getStringQueryValue(operator, value);
                } else {
                    return "city_feature_field_number:" + field + ":" + this._getNumberValue(operator, value);
                }
            },
            _getNumberValue: function(operator, value) {
                if (operator == "=") {
                    return value;
                }
                if (operator == ">=") {
                    return "[" + value + " TO " + Number.MAX_SAFE_INTEGER + "]";
                }
                if (operator == "<=") {
                    return "[" + Number.MIN_SAFE_INTEGER + " TO " + value + "]";
                }

                var val = parseFloat(value).toString();
                lastDigit = parseInt(val[val.length - 1]);
                if (operator == ">") {
                    val = val.substring(0, val.length - 1) + (lastDigit + 1).toString();
                    return "[" + val + " TO " + Number.MAX_SAFE_INTEGER + "]";
                }
                if (operator == "<") {
                    val = val.substring(0, val.length - 1) + (lastDigit - 1).toString();
                    return "[" + Number.MIN_SAFE_INTEGER + " TO " + val + "]";
                }
            },
            _getStringQueryValue: function(operator, value) {
                var reserved = [">", "<", "="];

                for (var i = 0, length = reserved.length; i < length; i++) {
                    value = value.replace(new RegExp(reserved[i], 'g'), "");
                }
                
                if (operator == "=") {
                    return value;
                }
                if (operator == "contains") {
                    return "*" + value + "*";
                }
            },
            _getDocumentFilter: function(what, filter) {
                if (filter.hasFiltersTEMP == true) {
                    if (filter.filteredSubjectList.length > 0) {
                        var docFilters = "";
                        for (var i = 0, length = filter.filteredSubjectList.length; i < length; i++) {
                            docFilters += (i > 0 ? " OR " : "") + "city_feature_physicalid:" + filter.filteredSubjectList[i];
                        }

                        if (what == undefined) {
                            return docFilters;
                        }

                        if (what.length == 0) {
                            return docFilters;
                        }

                        return "(" + docFilters + ") AND ";
                    }
                }

                return "";
            },
            _getGeometryFilter: function(filter) {
                if (filter.hasFiltersTEMP == false) {
                    return "";
                }
                if (filter.allfilters["ds6w:what/Geometry"] == undefined) {
                    return "";
                }

                var geometryFilter = "";
                for (var i = 0, length = filter.allfilters["ds6w:what/Geometry"].length; i < length; i++) {
                    geometryFilter += (i > 0 ? " OR " : "") + "city_feature_geometrytype:" + filter.allfilters["ds6w:what/Geometry"][i].object;
                }

                return "(" + geometryFilter + ")";
            },
            _getDatasetFilter: function(documentIds) {
                return "(city_feature_physicalid:" + documentIds.join(" OR city_feature_physicalid:") + ") ";
            },
            getSuggestions: function(callback) {
                $("#suggestions")[0].show();

                var regions = this._queryEnoviaDocument(this.regionsDocumentId, 5);
                var planningArea = this._queryEnoviaDocument(this.planningAreaDocumentId, 5);
                var subzones = this._queryEnoviaDocument(this.subzonesDocumentId, 10);
                var roads = this._queryEnoviaDocument(this.roadsDocumentId, 10);
                var bap = this._queryEnoviaDocument(this.bapDocumentId, 10);

                $.when(regions, planningArea, subzones, roads, bap).done(function(regionsRs, planningAreaRs, subzonesRs, roadsRs, bapRs) {
                    var rs = { hits: regionsRs.hits.concat(planningAreaRs.hits).concat(subzonesRs.hits).concat(roadsRs.hits).concat(bapRs.hits) };
                    callback(rs);
                });
            },
            _queryEnoviaDocument: function(documentId, limit) {
                var promise = $.Deferred();

                var queryValue = "#and(#uql(\"(spellslike:" + $("#whereInput")[0].value + " OR *" + $("#whereInput")[0].value.replace(/ /g, "*") + "*) AND city_feature_physicalid:" + documentId + "\"))";

                var queryUrl = xCity.widgetData.exaleadProxy.ellQuery(queryValue, limit);// + "&datamodel=city_feature";

                var config = {
                    method: 'GET',
                    type: 'json',
                    onComplete: function(rs) {
                        promise.resolve(rs);
                    },
                    onFailure: function(rs) {
                        promise.resolve({ hits: [] });
                    }
                };

                this.waf.authenticatedRequest(queryUrl, config);

                return promise;
            },
            _getIntDividedIntoMultiple: function(dividend, divisor, multiple) {
                var values = [];
                while (dividend > 0 && divisor > 0) {
                    var a = Math.round(dividend / divisor / multiple) * multiple;
                    dividend -= a;
                    divisor--;
                    values.push(a);
                }

                return values;
            },
            _getSearchResultDocumentId: function(rs, docTitle) {
                for (var i = 0, length = rs.length; i < length; i++) {
                    if (rs[i].dataelements.title == docTitle) {
                        return rs[i].id;
                    }
                }

                return rs[0].id;
            },
            _getDocumentIdsByTag: function(tagLiteral, predicates) {
                var promise = $.Deferred();

                if (predicates == undefined) {
                    predicates = ["ds6w:label", "ds6w:description", "ds6w:identifier", "ds6w:modified", "ds6w:created", "ds6w:type", "ds6w:responsible"];
                } else {
                    predicates = this._getDSPredicates(predicates);
                }

                var that = this;
                this._findDocumentsByTag(this.spaceUrl, this.tenant, tagLiteral, predicates).then(function(rs){
                    var resourceIds = that._getResourceIds(rs.results);
                    return that._getDocumentIds(that.spaceUrl, resourceIds);
                }).then(function(rs) {
                    console.log("Fed Search document ids", rs);
                    promise.resolve(rs);
                });

                return promise;
            },
            _findDocumentsByTag: function(spaceUrl, tenant, tagLiteral, predicates) {
                var promise = $.Deferred();

                var queryUrl = spaceUrl.replace("space", "fedsearch").replace("enovia", "federated/search?xrequestedwith=xmlhttprequest");

                var formData = {
                    "with_indexing_date": true,
                    "with_nls": false,
                    "label": "mcn8-1504688422363",
                    "locale": "en",
                    "select_predicate": predicates,
                    "select_file": [],
                    "query": "*" + tagLiteral + "*",
                    "refine": {},
                    "specific_source_parameter": {
                        "3dspace": {
                            "additional_query": " AND NOT (flattenedtaxonomies:\"types/Person\" OR flattenedtaxonomies:\"types/Security Context\") AND NOT (owner:\"ENOVIA_CLOUD\" OR owner:\"Service Creator\" OR owner:\"Corporate\" OR owner:\"User Agent\" OR owner:\"SLMInstallerAdmin\")"
                        },
                        "drive": {
                            "additional_query": " AND NOT (flattenedtaxonomies:\"types/Person\" OR flattenedtaxonomies:\"types/Security Context\") AND NOT (owner:\"ENOVIA_CLOUD\" OR owner:\"Service Creator\" OR owner:\"Corporate\" OR owner:\"User Agent\" OR owner:\"SLMInstallerAdmin\")"
                        }
                    },
                    "order_by": "desc",
                    "order_field": "ds6w:modified",
                    "source": [],
                    "nresults": 10,
                    "start": "0",
                    "tenant": tenant
                };

                var config = {
                    method: 'POST',
                    data: formData,
                    type: 'json',
                    onComplete: function(rs) {
                        console.log("Fed Search Success", rs);
                        promise.resolve(rs);
                    },
                    onFailure: function(rs) {
                        console.log("Fed Search Failed rs", rs);
                        promise.resolve({results:[]});
                    }
                };

                this.waf.authenticatedRequest(queryUrl, config);

                return promise;
            },
            _getResourceIds: function(results) {
                var ids = [];

                for (var i = 0, ilength = results.length; i < ilength; i++) {
                    for (var j = 0, jlength = results[i].attributes.length; j < jlength; j++) {
                        if (results[i].attributes[j].name == "resourceid") {
                            ids.push(results[i].attributes[j].value);
                            continue;
                        }
                    }
                }

                return ids;
            },
            _getDocumentIds: function(spaceUrl, objectIds) {
                var promise = $.Deferred();

                this.waf.authenticatedRequest(spaceUrl + '/resources/bps/PhyIdToObjId/phyIds', {
                    method: "POST",
                    type: 'json',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({phyIds: objectIds}),
                    onComplete: function(rs) {
                        promise.resolve(rs.ObjIds);
                    },
                    onFailure: function(rs) {
                        promise.resolve([]);
                    }
                });

                return promise;
            },
            _getDSPredicates: function(predicates) {
                var dsDefinedPredicates = ["who", "when", "what", "where", "why", "how"];
                var dsPredicates = [];

                for (var i = 0, length = predicates.length; i < length; i++) {
                    predicate = predicates[i].toLowerCase();

                    if (dsDefinedPredicates.indexOf(predicate)) {
                        dsPredicates.push("ds6w:" + predicate)
                    }
                }
                
                return dsPredicates;
            }
        };

        return QueryManager.getInstance();
    });