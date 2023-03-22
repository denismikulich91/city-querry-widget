define(["DS/PlatformAPI/PlatformAPI"], function(PlatformAPI) {
    var instance = null;

    function ViewHelper() {
        if (instance !== null) {
            throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
        }
    }

    ViewHelper.getInstance = function() {
        if (instance === null) {
            instance = new ViewHelper();
            instance.PlatformAPI = PlatformAPI;
        }
        return instance;
    };

    ViewHelper.prototype = {
        zoomToArea: function(results) {
            var bbox = this._getResultsBoundingBox(results);

            if (bbox.max == undefined || bbox.min == undefined) {
                return;
            }

            var centriodX = (bbox.max.x + bbox.min.x) / 2;
            var centriodY = (bbox.max.y + bbox.min.y) / 2;

            var cameraDist = this._getCameraDistance(bbox);
            this.PlatformAPI.publish('3DEXPERIENCity.MoveToTarget', [{
                x: centriodX,
                y: centriodY,
                z: 0
            }, 5, [0, 0, 0], cameraDist]);
        },
        _getResultsBoundingBox: function(results) {
            var bbox = {};

            if (results.length > 0) {
                var x = parseFloat(results[0].x || results[0][0]);
                var y = parseFloat(results[0].y || results[0][1]);
                bbox = this._initBBox(x, y);

                for (var i = 0, length = results.length; i < length; i++) {
                    bbox = this._updateBBox(bbox, results[i]);
                }
            }

            return bbox;
        },
        _initBBox: function(x, y) {
            return {
                min: {
                    x: x,
                    y: y
                },
                max: {
                    x: x,
                    y: y
                }
            };
        },
        _updateBBox: function(bbox, searchResult) {
            var x = parseFloat(searchResult.x || searchResult[0]);
            var y = parseFloat(searchResult.y || searchResult[1]);

            bbox.min.x = x < bbox.min.x ? x : bbox.min.x;
            bbox.min.y = y < bbox.min.y ? y : bbox.min.y;
            bbox.max.x = x > bbox.max.x ? x : bbox.max.x;
            bbox.max.y = y > bbox.max.y ? y : bbox.max.y;

            return bbox;
        },
        _getCameraDistance: function(bbox) {
            if (bbox.max.x == bbox.min.x) {
                return 750;
            }

            var xDist = bbox.max.x - bbox.min.x;
            var yDist = bbox.max.y - bbox.min.y;
            var groundDist = Math.max(xDist, yDist) * 1.1;

            var halfFOV = 20;
            var cameraHeight = (groundDist / 2 ) / Math.tan(halfFOV * Math.PI/180);

            return cameraHeight;
        }
    };

    return ViewHelper.getInstance();
});
