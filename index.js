var extend = require('extend'),
    osmtogeojson = require('osmtogeojson'),
    findLocalProj = require('local-proj').find,
    toObj = require('geojson2obj').toObj,
    toMeters = (function() {
        var matchers = [
            {pattern: new RegExp('^([0-9\\.]+)\\s*m{0,1}$'), converter: function(groups) {
                return parseFloat(groups[1]);
            }},
            {pattern: new RegExp('^([0-9\\.]+)\'\\s*([0-9\\.]+)"$'), factor: function(groups) {
                return parseFloat(groups[1]) * 0.3048 + parseFloat(groups[2])*0.0254;
            }},
        ];
        return function(v) {
            if (v == null) {
                return undefined;
            }

            for (var i = 0; i < matchers.length; i++) {
                var match = v.match(matchers[i].pattern);
                if (match) {
                    return matchers[i].converter(match);
                }
            }

            return undefined;
        };
    })();

module.exports = function(osmData, stream, options) {
    var geojson = osmtogeojson(osmData, {
            flatProperties: true
        }),
        projection = findLocalProj(geojson),
        coordToPoint = function(c) {
            return projection.forward(c);
        };

    options = extend({
        metersPerLevel: 3,
        defaultHeight: 8,
    }, options);
    
    toObj(geojson, stream, {
        featureHeight: function(f) {
            var prop = f.properties,
                height = toMeters(prop.height) || (prop.levels ? prop.levels * options.metersPerLevel : options.defaultHeight),
                minHeight = toMeters(prop.minHeight) || (prop.minLevel ? prop.minLevel * options.metersPerLevel : 0);

            return height;
        },
        featureName: function(f) {
            return f.properties.id;
        },
        featureMaterial: function() {
            return 'building';
        },
        coordToPoint: coordToPoint
    });
};

