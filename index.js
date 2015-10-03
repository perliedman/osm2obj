var extend = require('extend'),
    osmtogeojson = require('osmtogeojson'),
    findLocalProj = require('local-proj').find,
    toObj = require('geojson2obj').toObj,
    extent = require('turf-extent'),
    bboxPolygon = require('turf-bbox-polygon'),
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
        mtllib: 'data/default.mtl',
        ground: true
    }, options);

    if (options.ground) {
        var ground = bboxPolygon(extent(geojson));
        ground.properties.id = 'ground';
        ground.properties['@osm2obj/material'] = 'ground';
        geojson.features.push(ground);
    }
    
    toObj(geojson, stream, {
        featureHeight: function(f) {
            var prop = f.properties,
                height = 0;

            if (prop.building) {
                height = toMeters(prop.height) || (prop.levels ? prop.levels * options.metersPerLevel : options.defaultHeight);
            } else if (prop.highway) {
                height = 0.1;
            }

            return height;
        },
        lineWidth: function(f) {
            switch (f.properties.highway) {
            case 'primary':
            case 'secondary':
            case 'trunk':
            case 'tertiary':
                return 1;
            case 'residential':
                return 0.75;
            default:
                return 0.2;
            }
        },
        featureName: function(f) {
            return f.properties.id;
        },
        featureMaterial: function(f) {
            var prop = f.properties;
            if (prop.building) {
                return 'building';
            } else if (prop.highway) {
                return 'highway';
            }

            return prop['@osm2obj/material'];
        },
        coordToPoint: coordToPoint,
        mtllib: options.mtllib
    });
};

