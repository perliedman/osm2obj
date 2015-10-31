var extend = require('extend'),
    osmium = require('osmium'),
    findLocalProj = require('local-proj').find,
    async = require('async'),
    bboxPolygon = require('turf-bbox-polygon'),
    osmFeatureToObj = require('./osm-feature-to-obj');

module.exports = function(osmData, stream, elevationProvider, cb, options) {
    var reader = new osmium.BasicReader(osmData),
        handler = new osmium.Handler(),
        locHandler = new osmium.LocationHandler(),
        header = reader.header(),
        bound = header.bounds[0],
        extent = [bound.left(),bound.bottom(),bound.right(),bound.top()],
        extentPolygon = bboxPolygon(extent),
        featureCount = 0,
        projection,
        workqueue;

    options = extend({
        metersPerLevel: 3,
        defaultHeight: 8,
        mtllib: 'data/default.mtl',
        ground: true,
        featureName: function(f, cb) {
            process.nextTick(function() {
                cb(undefined, undefined);
            });
        },
        coordToPoint: function(c) {
            return projection.forward(c);
        }
    }, options);

    projection = options.projection || findLocalProj(extentPolygon);
    workqueue = async.queue(function(geojson, callback) {
        osmFeatureToObj(geojson, stream, elevationProvider, function(err, numberVertices) {
            if (err) {
                callback(err);
                return;
            }

            options.vertexStartIndex = numberVertices;
            callback();
        }, options);
    });

    handler.on('way', function(way) {
        var highway = way.tags('highway'),
            building = way.tags('building'),
            geojson;

        if (!highway && !building) {
            return;
        }

        geojson = way.geojson();

        if (building) {
            geojson.type = 'Polygon';
            geojson.coordinates = [geojson.coordinates];
        }

        var feature = {
            type: 'Feature',
            geometry: geojson,
            properties: way.tags()
        };

        workqueue.push(feature);
        featureCount++;
    });

    handler.on('done', function() {
        workqueue.drain = function() {
            cb(undefined, featureCount);
        };
    });

    reader = new osmium.Reader(osmData);
    osmium.apply(reader, locHandler, handler);
    handler.end();
    reader.close();
};

