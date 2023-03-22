define(["DS/TagNavigatorProxy/TagNavigatorProxy", "./PlatformCompassServices", "./DatasetManager","ExtModels/DocumentManager"],
    function(tagNavigatorProxy, platformServices, DatasetManager, DocumentManager) {
        var instance = null;

        function FilterManager() {
            if (instance !== null) {
                throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
            }
        };

        FilterManager.getInstance = function() {
            if (instance === null) {
                instance = new FilterManager();
                instance.tagNavigatorProxy = tagNavigatorProxy;
                instance.platformServices = platformServices;
                instance.DocumentManager = DocumentManager;               
            }
            return instance;
        };

        FilterManager.prototype = {
            set6WTags: function(searchResults, documentProperties, callback) {
                if (this.taggerProxy == undefined) {
                    var options = {
                        widgetId: widget.id,
                        filteringMode: "WithFilteringServices"
                    };
                    this.taggerProxy = this.tagNavigatorProxy.createProxy(options);
                    this.taggerProxy.addEvent('onFilterSubjectsChange', callback, this);
                }

                // this.taggerProxy.unsetTags();
                this.taggerProxy.activate();

                var featuresSubjectDB = this._generateFeaturesSubjectDB(searchResults);
                this.taggerProxy.setSubjectsTags(featuresSubjectDB);

                var documentsSubjectDB = this._generateEnoviaDocumentsSubjectDB(documentProperties);
                this.taggerProxy.addSubjectsTags(documentsSubjectDB);
            },
            _generateFeaturesSubjectDB: function(searchResults) {
                var enoviaDocIds = [],
                    enoviaDocTitles = [],
                    geometryTypes = [];
                for (var i = 0, length = searchResults.length; i < length; i++) {
                    if (!enoviaDocIds.contains(searchResults[i].physicalid.value)) {
                        enoviaDocTitles.push(searchResults[i].layername.value);
                        enoviaDocIds.push(searchResults[i].physicalid.value);
                    }

                    var geoType = this._getGeoType(searchResults[i]);
                    if (!geometryTypes.contains(geoType)) {
                        geometryTypes.push(geoType);
                    }
                }

                var subjectDB = {};
                for (var i = 0, length = enoviaDocTitles.length; i < length; i++) {
                    subjectDB[enoviaDocIds[i]] = [{ 'object': enoviaDocIds[i], 'sixw': "ds6w:what/Datasource", 'dispValue': enoviaDocTitles[i] }];
                }
                for (var i = 0, length = geometryTypes.length; i < length; i++) {
                    if (subjectDB[enoviaDocIds[i]]) {
                        subjectDB[enoviaDocIds[i]].push({ 'object': geometryTypes[i], 'sixw': "ds6w:what/Geometry", 'dispValue': geometryTypes[i] });
                    } else {
                        subjectDB[enoviaDocIds[i]] = [{ 'object': geometryTypes[i], 'sixw': "ds6w:what/Geometry", 'dispValue': geometryTypes[i] }];
                    }
                }

                return subjectDB;
            },
            clearFilters: function() {
                if (this.taggerProxy) {
                    this.taggerProxy.unsetTags();
                    this.taggerProxy.deactivate();
                }
            },
            _getGeoType: function(meta) {
                if (meta.geometrytype) {
                    return meta.geometrytype.value;
                } else if (meta.field_string_geo) {
                    return meta.field_string_geo.value.split("(")[0].trim();
                } else if (meta.geometry) {
                    return meta.geometry.value.split("(")[0].trim();
                }
                return "UNKNOWN";
            },
            _getDate: function(dateString) {
                var date = new Date(dateString);
                return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
            },
            getDocumentProperties: function(documentIds) {
                var promise = $.Deferred();

                // var service = this.platformServices.getService("3DSpace");
                // this.DocumentManager.setService(service);

                // var that = this;
                // this.DocumentManager.getDocuments(documentIds.join(",")).then(function(rs) {
                    // console.log("document properties", rs);

                    // promise.resolve(rs);
                // });
				

                return promise;
            },
            _generateEnoviaDocumentsSubjectDB: function(rs) {
                var subjectDB = {};

                for (var i = 0, ilength = rs.data.length; i < ilength; i++) {
                    var documentProperties = rs.data[i];
                    var dateCreated = this._getDate(documentProperties.dataelements.originated);
                    var dateModified = this._getDate(documentProperties.dataelements.modified);
                    var ownerInfo = documentProperties.relateddata.ownerInfo;

                    for (var j = 0, jlength = ownerInfo.length; j < jlength; j++) {
                        var userName = ownerInfo[j].dataelements.firstname + " " + ownerInfo[j].dataelements.lastname;

                        subjectDB[documentProperties.id] = [
                            { 'object': userName, 'sixw': "ds6w:who/Owner", 'dispValue': userName },
                            { 'object': dateCreated, 'sixw': "ds6w:when/Created", 'type': "date" },
                            { 'object': dateModified, 'sixw': "ds6w:when/Modified", 'type': "date" }
                        ];
                        
                    }
                }

                return subjectDB;
            }
        };

        return FilterManager.getInstance();
    });