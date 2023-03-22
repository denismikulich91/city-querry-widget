define(['ExtLibs/JsClipper/clipper'
], function() {
    var GeoPolygonBuffer = UWA.Class.extend({
        joinType: 0, // square:0, round:1, miter:2
        miterLimit: 2,
        autoFix: true,
        init: function() {
            this.clipper = new ClipperLib.Clipper();
        },
        getExpandedCoordinates: function(coordinates, bufferSize, cleanFactor=0.1) {
            var coordinatesObjectFormat = [];
            for (var i = 0, length = coordinates.length; i < length; i++) {
                coordinatesObjectFormat.push({ X: coordinates[i][0], Y: coordinates[i][1] });
            }

            var ss = this.deserializeClipperPolygon(JSON.stringify([coordinatesObjectFormat]));

            this.clipper.Clear();
            var offsetResult = ClipperLib.Clean(ss, cleanFactor * 100);

            offsetResult = this.clipper.OffsetPolygons(offsetResult, bufferSize, this.joinType, this.miterLimit, this.autoFix);

            return this.convertClipperPolygonToLineCoordinates(offsetResult, this.getLowestElevation(coordinates));
        },
        getExpandedCoordinatesScaled: function(coordinates, bufferSize, cleanFactor=0.1) {
            if (coordinates.length <= 30) {
                return coordinates;
            }

            var scale = 100000000;

            var coordinatesObjectFormat = [];
            for (var i = 0, length = coordinates.length; i < length; i++) {
                coordinatesObjectFormat.push({ X: coordinates[i][0] * scale, Y: coordinates[i][1] * scale});
            }

            var ss = this.deserializeClipperPolygon(JSON.stringify([coordinatesObjectFormat]));
            var offsetResult = [[]];

            do {
                this.clipper.Clear();
                offsetResult = ClipperLib.Clean(ss, cleanFactor * scale);
                offsetResult = this.clipper.SimplifyPolygons(offsetResult, 1);
                offsetResult = this.clipper.OffsetPolygons(offsetResult, bufferSize, this.joinType, this.miterLimit, this.autoFix);
                cleanFactor += 10;
            } while (offsetResult[0].length > 30);

            return this.convertClipperPolygonToLineCoordinatesScaled(offsetResult, scale, this.getLowestElevation(coordinates));
        },
        convertClipperPolygonToLineCoordinates: function(clipperResult, elevation=0) {
            var coordinates = [];

            for (var i = 0, ilength = clipperResult.length; i < ilength; i++) {
                var segment = clipperResult[i];
                for (var j = 0, jlength = segment.length; j < jlength; j++) {
                    coordinates.push([segment[j].X, segment[j].Y, elevation]);
                }
            }
            coordinates.push([clipperResult[0][0].X, clipperResult[0][0].Y, elevation]); //close off line

            return coordinates;
        },
        convertClipperPolygonToLineCoordinatesScaled: function(clipperResult, scale, elevation=0) {
            var coordinates = [];

            for (var i = 0, ilength = clipperResult.length; i < ilength; i++) {
                var segment = clipperResult[i];
                for (var j = 0, jlength = segment.length; j < jlength; j++) {
                    coordinates.push([Math.round(segment[j].X)/scale, Math.round(segment[j].Y)/scale, elevation]);
                }
            }
            coordinates.push([Math.round(clipperResult[0][0].X)/scale, Math.round(clipperResult[0][0].Y)/scale, elevation]); //close off line

            return coordinates;
        },
        deserializeClipperPolygon: function(polygonString) {
            var rawPolygons = JSON.parse(polygonString),
                polygons = [
                    []
                ],
                point;
            for (var i = 0, ilength = rawPolygons.length; i < ilength; i++) {
                polygons[i] = [];
                for (var j = 0, jlength = rawPolygons[i].length; j < jlength; j++) {
                    if (isNaN(Number(rawPolygons[i][j].X)) || isNaN(Number(rawPolygons[i][j].Y))) {
                        return [
                            []
                        ];
                    }
                    point = new ClipperLib.IntPoint(Number(rawPolygons[i][j].X), Number(rawPolygons[i][j].Y));
                    //                point = new ClipperLib.IntPoint(Math.round(Number(rawPolygons[i][j].X)), Math.round(Number(rawPolygons[i][j].Y)));

                    polygons[i].push(point);
                }
            }
            return polygons;
        },
        getAverageElevation: function(coordinates) {
            var total = 0;
            for (var i = 0, length = coordinates.length; i < length; i++) {
                total += (coordinates[i].z || coordinates[i][2]);
            }
            return total / coordinates.length;
        },
        getLowestElevation: function(coordinates) {
            var lowest = (coordinates[0].z || coordinates[0][2]);
            for (var i = 0, length = coordinates.length; i < length; i++) {
                var z = (coordinates[i].z || coordinates[i][2]);
                if (z < lowest) {
                    lowest = z;
                }
            }
            return lowest;
        }
    });

    return GeoPolygonBuffer;
});
