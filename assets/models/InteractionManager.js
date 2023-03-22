define([], function() {
    var instance = null;
    var xCity;

    function InteractionManager() {
        if (instance !== null) {
            throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
        }
    };

    InteractionManager.getInstance = function() {
        if (instance === null) {
            instance = new InteractionManager();
            instance._init();
        }
        return instance;
    };

    InteractionManager.prototype = {
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
        getViewBoundingBox: function() {
            var frustumHeight = 2 * xCity.distanceToTarget * Math.tan(40 * 0.5 * (Math.PI / 180));
            var frustumWidth = xCity._urbanImpl.getViewpoint().camera.aspect * frustumHeight;

            var halfWidth = frustumWidth / 2;
            var halfHeight = frustumHeight / 2;

            return {
                xmin: xCity.pointOfView.target.x - halfWidth, 
                xmax: xCity.pointOfView.target.x + halfWidth, 
                ymin: xCity.pointOfView.target.y - halfHeight,
                ymax: xCity.pointOfView.target.y + halfHeight
            }
        },
        getSelectedFeatureAttribute: function(attribute) {
            return xCity.selectedItems[0].get(attribute);
        }
    };

    return InteractionManager.getInstance();
});