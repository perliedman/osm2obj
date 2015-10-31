var toObj = require('geojson2obj').toObj,
    coordReduce = require('turf-meta').coordReduce,
    async = require('async'),
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

module.exports = function(geojson, stream, elevationProvider, cb, options) {
    toObj(geojson, stream, cb, {
        vertexStartIndex: options.vertexStartIndex,
        featureBase: function(f, cb) {
            if (elevationProvider) {
                var flatCoords = coordReduce(f, function(cs, c) {
                        cs.push(c);
                        return cs;
                    }, []);

                async.reduce(flatCoords, Number.MAX_VALUE, function(min, c, cb) {
                    elevationProvider.getElevation([c[1], c[0]], function(err, elevation) {
                        if (err) {
                            cb(err);
                            return;
                        }

                        cb(undefined, Math.min(min, elevation));
                    });
                }, cb);
            } else {
                setImmediate(function() {
                    cb(undefined, 0);
                });
            }

        },
        featureHeight: function(f, cb) {
            var prop = f.properties,
                height = 0;

            if (prop.building) {
                height = toMeters(prop.height) || (prop.levels ? prop.levels * options.metersPerLevel : options.defaultHeight);
            } else if (prop.highway) {
                height = 0.1;
            }

            process.nextTick(function() {
                cb(undefined, height);
            });
        },
        lineWidth: function(f, cb) {
            var width;

            switch (f.properties.highway) {
            case 'primary':
            case 'secondary':
            case 'trunk':
            case 'tertiary':
                width = 1;
                break;
            case 'residential':
                width = 0.75;
                break;
            default:
                width = 0.2;
                break;
            }

            process.nextTick(function() {
                cb(undefined, width);
            });
        },
        featureName: options.featureName,
        featureMaterial: function(f, cb) {
            var prop = f.properties,
                material;
            if (prop.building) {
                material = 'building';
            } else if (prop.highway) {
                material = 'highway';
            } else {
                material = prop['@osm2obj/material'];
            }

            process.nextTick(function() {
                cb(undefined, material);
            });
        },
        coordToPoint: options.coordToPoint
    });
};