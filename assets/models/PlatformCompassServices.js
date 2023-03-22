define('Ext/PlatformCompassServices', ["DS/i3DXCompassServices/i3DXCompassServices"], function(i3DXCompassServices) {
    var instance = null;

    function PlatformCompassServices() {
        if (instance !== null) {
            throw new Error("Cannot instantiate more than one MySingleton, use MySingleton.getInstance()");
        }
    }

    PlatformCompassServices.getInstance = function() {
        if (instance === null) {
            instance = new PlatformCompassServices();
            instance.i3DXCompassServices = i3DXCompassServices;           
            instance._init();
        }
        return instance;
    };

    PlatformCompassServices.prototype = {
        platformServices: undefined,
        securityContext: undefined,
        _init: function() {
            var that = this;
            this.i3DXCompassServices.getPlatformServices({
                onComplete: function(rs) {
                    console.info('getPlatformServices', rs);
                    that.platformServices = rs;
                    that._initTenantPreferences(rs);
                    // that._initSecurityContext();
                }
            });
        },
        _initTenantPreferences: function(platformServices) {
            var preference = {
                name: "tenant",
                type: "list",
                label: "Platform",
                options: [],
                defaultValue: 0
            };

            for (var i = 0, length = platformServices.length; i < length; i++) {
                preference.options.push({ value: i, label: platformServices[i].displayName });
                if (platformServices[i].platformId == widget.getValue("x3dPlatformId")) {
                    preference.defaultValue = i;
                }
            }
            widget.addPreference(preference);
        },
        getService: function(service, tenant) {
            if (this.platformServices) {
                var tenant = tenant || widget.getValue("tenant");
                return this.platformServices[tenant][service];
            }
        },
        getGlobeService: function(tenant) {
            if (this.platformServices) {
                var tenant = tenant || widget.getValue("tenant");
                return this.platformServices[tenant]["3DSpace"].replace('space', 'globe').replace('enovia', 'globe');
            }
        },
        getTenant: function() {
            if (this.platformServices) {
                return this.platformServices[widget.getValue("tenant")].platformId;
            }
        }
    };

    return PlatformCompassServices.getInstance();
});