define([], function() {
    var instance = null;

    function ExportKML() {
        if (instance !== null) {
            throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
        }
    }

    ExportKML.getInstance = function() {
        if (instance === null) {
            instance = new ExportKML();
        }
        return instance;
    };

    ExportKML.prototype = {
        generateKMLContent: function(searchResults) {
            var content = "<?xml version=\"1.0\" encoding=\"utf-8\" ?><kml xmlns=\"http://www.opengis.net/kml/2.2\">\n";
            content += "<Document id=\"root_doc\">\n";

            var schemasContent = "";
            var foldersContent = "";

            var splittedResults = this._splitResultsByAttribute(searchResults, "layername");
            var layerTitles = Object.keys(splittedResults);
            for (var i = 0, length = layerTitles.length; i < length; i++) {
                schemasContent += this._generateSchema(layerTitles[i], splittedResults[layerTitles[i]][0].properties);
                foldersContent += this._generateFolder(layerTitles[i], splittedResults[layerTitles[i]]);
            }

            content += schemasContent;
            content += foldersContent;
            content += "</Document></kml>";

            return content;
        },
        _splitResultsByAttribute: function(searchResults, attrib) {
            var results = [];

            for (var i = 0, length = searchResults.length; i < length; i++) {
				let currSearchResult = searchResults[i].properties;
                var key = currSearchResult[attrib];
                if (results[key] == undefined) {
                    results[key] = [];
                }
                results[key].push(searchResults[i]);
            }

            return results;
        },
        _getAllKeys: function(matchedResults) {
            var ommit = ["physicalid", "searchResultId", "url", "layername", "size", "geometrytype", "latlon", "layerindex"];

            var keys = [];

            // for (var i = 0, ilength = matchedResults.length; i < ilength; i++) {
                var rowKeys = Object.keys(matchedResults);
                for (var j = 0, jlength = rowKeys.length; j < jlength; j++) {
                    if (keys.contains(rowKeys[j]) || ommit.contains(rowKeys[j])) {
                        continue;
                    }
                    keys.push(rowKeys[j]);
                }
            // }

            return keys;
        },
        _generateSchema: function(title, results) {
            var content = "<Schema name=\"" + title + "\" id=\"" + title + "\">\n";

            keys = this._getAllKeys(results);
            for (var j = 0; j < keys.length; j++) {
                content += "<SimpleField name=\"" + this._getKeyName(keys[j]) + 
                    "\" type=\"" + this._getKeyType(keys[j]) + "\"></SimpleField>\n";
            }

            content += "</Schema>\n";

            return content;
        },
        _getKeyName: function(key) {
            return key.replace("field_number_", "")
                    .replace("field_string_", "")
                    .toUpperCase();
        },
        _getKeyType: function(key) {
            if (key.contains("field_number_")) {
                return "float";
            } else {
                return "string";
            }
        },
        _generateFolder: function(title, results) {
            var content = "<Folder><name>" + title + "</name>";

            for (var i = 0, length = results.length; i < length; i++) {
                content += this._generatePlacemark(title, results[i]);
            }

            content += "</Folder>\n";
            return content;
        },
        _generatePlacemark: function(title, result) {
            var content = "<Placemark>\n";

            content += this._generateExtendedData(title, result.properties);

            var geometryType = result["geometry"].type.toUpperCase();
            if (geometryType.contains("POINT")) {
                content += result["latlon"] ? this._generatePointGeometry(result["latlon"]) : "";
            } else if (geometryType.contains("LINESTRING")) {
                content += result["latlon"] ? this._generateLinestringGeometry(result["latlon"]) : "";
            } else if (geometryType.contains("POLYGON")) {
                content += result["latlon"] ? this._generateMultiPolygonGeometry(result["latlon"]): "";
            } else if (geometryType.contains("MULTIPOLYGON")) {
                content += result["latlon"] ? this._generateMultiPolygonGeometry(result["latlon"]): "";
            }
            
            content += "</Placemark>\n";

            return content;
        },
        _generateExtendedData: function(title, result) {
            var content = "<ExtendedData><SchemaData schemaUrl=\"#" + title + "\">\n";

            var keys = this._getAllKeys(result);
            for (var i = 0; i < keys.length; i++) {
                content += "<SimpleData name=\"" + this._getKeyName(keys[i]) + "\">" + this._sanitizeValue(result[keys[i]]) + "</SimpleData>\n";
            }
            
            content += "</SchemaData></ExtendedData>\n";

            return content;
        },
        _sanitizeValue: function(value) {
            value = this._replaceAll(value, "&", "&amp;");
            value = this._replaceAll(value, "<", "&lt;");
            value = this._replaceAll(value, ">", "&lt;");

            return value;
        },
        _replaceAll: function(target, search, replacement) {
            return target.toString().replace(new RegExp(search, 'g'), replacement);
        },
        _generatePointGeometry: function(coordinates) {
            var content = "<Point><coordinates>" + coordinates.x + "," + coordinates.y + "</coordinates></Point>";
            return content;
        },
        _generateLinestringGeometry: function(coordinates) {
            var content = "<LineString><altitudeMode>clampToGround</altitudeMode><coordinates>";

            for (var i = 0; i < coordinates.length; i++) {
                content += coordinates[i].x + "," + coordinates[i].y + "," + coordinates[i].z + " ";
            }

            content += "</coordinates></LineString>";
            return content;
        },
        _generatePolygonGeometry: function(coordinates) {
            var content = "<Polygon><altitudeMode>clampToGround</altitudeMode>";

            content += this._generateBoundary(coordinates, false);

            content += "</Polygon>";
            return content;
        },
        _generateBoundary: function(coordinates, isInnerBoundary) {
            var content = isInnerBoundary ? "<innerBoundaryIs>" : "<outerBoundaryIs>"; 
            content += "<LinearRing><altitudeMode>clampToGround</altitudeMode><coordinates>";

            for (var i = 0; i < coordinates.length; i++) {
                content += coordinates[i].x + "," + coordinates[i].y + "," + coordinates[i].z + " ";
            }

            content += "</coordinates></LinearRing>";
            content += isInnerBoundary ? "</innerBoundaryIs>" : "</outerBoundaryIs>"; 
            return content;
        },
        _generateMultiPolygonGeometry: function(coordinates) {
            var content = "<Polygon><altitudeMode>clampToGround</altitudeMode>";

            content += this._generateBoundary(coordinates[0], false);
            for (var i = 1; i < coordinates.length; i++) {
                content += this._generateBoundary(coordinates[i], true);
            }

            content += "</Polygon>";
            return content;
        }
    };

    return ExportKML.getInstance();
});