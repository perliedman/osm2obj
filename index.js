var extend = require('extend'),
    osmium = require('osmium'),
    findLocalProj = require('local-proj').find,
    async = require('async'),
    bboxPolygon = require('turf-bbox-polygon'),
    osmFeatureToObj = require('./osm-feature-to-obj'),
    tileSet = require('./tile-set'),
    isClockwise = function(vertices) {
        var area = 0,
            i,
            j;
        for (i = 0; i < vertices.length; i++) {
            j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return area > 0;
    },
    progress = (function() {
        var pad = function(s, l) {
            return s + (new Array(l - s.length).join(' '));
        };

        if (process.stderr.isTTY) {
            return function(status) {
                var spinner = '|/-\\|/-\\';
                var s = process.stderr,
                    highways = status.highways + ' highways,',
                    buildings = status.buildings + ' buildings,',
                    processing = status.remaining + ' to process',
                    msg = spinner[status.spinner++ % spinner.length] +
                        ' ' + pad(highways, 24) +
                        pad(buildings, 24) +
                        processing;
                s.cursorTo(0);
                s.write(msg);
                s.clearLine(1);
            };
        } else {
            process.stderr.write('stderr is not a TTY.\n');
        }
    })();

module.exports = function(osmData, stream, elevationProvider, cb, options) {
    var reader = new osmium.BasicReader(osmData, {way:true}),
        handler = new osmium.Handler(),
        locHandler = new osmium.LocationHandler(),
        header = reader.header(),
        bound = header.bounds[0],
        extent = [bound.left(),bound.bottom(),bound.right(),bound.top()],
        extentPolygon = bboxPolygon(extent),
        projection = options.projection || findLocalProj(extentPolygon),
        cleanUp = function(err, result) {
            clearTimeout(statusUpdateTimer);
            if (process.stderr.isTTY) {
                process.stderr.cursorTo(0);
                process.stderr.clearLine(1);
            }
            cb(err, result);
        },
        status = {
            spinner: 0,
            highways: 0,
            buildings: 0,
            remaining: 0
        },
        statusUpdateTimer = setInterval(function() {
            progress(status);
        }, 250),
        tile,
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
        projection: projection
    }, options);

    workqueue = async.queue(function(geojson, callback) {
        osmFeatureToObj(geojson, stream, tile, function(err, numberVertices) {
            if (err) {
                callback(err);
                return;
            }

            options.vertexStartIndex = numberVertices;
            status.remaining--;
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
            geojson.coordinates.forEach(function(ring) {
                if (isClockwise(ring)) {
                    ring.reverse();
                }
            });
            geojson.coordinates = [geojson.coordinates];
            status.buildings++;
        } else {
            status.highways++;
        }

        var feature = {
                type: 'Feature',
                geometry: geojson,
                properties: way.tags()
            },
            pushWork = function(err) {
                if (err) {
                    status.remaining--;
                    return cleanUp(err);
                }
                workqueue.push(feature);
            };

        status.remaining++;
        if (highway) {
            if (feature.geometry.coordinates.length < 2) {
                return;
            }

            geojson.coordinates.forEach(function(c) {
                c[2] = tile.getElevation([c[1], c[0]]);
            });
        }

        pushWork();
    });

    workqueue.drain = function() {
        cleanUp(undefined, status);
    };

    var loadTile = function(ll, cb) {
        elevationProvider.options.loadTile.call(
            elevationProvider,
            elevationProvider._tileDir,
            {lat: ll[0], lng: ll[1]},
            cb);
    };

    tileSet(loadTile, extent, 1, function(err, t) {
        if (err) {
            return cleanUp(err);
        }

        tile = t;
        reader = new osmium.Reader(osmData);
        var readAll = function() {
            var buffer = reader.read();
            if (buffer) {
                osmium.apply(buffer, locHandler, handler);
                setImmediate(readAll);
            } else {
                handler.end();
                reader.close();
            }
        };

        readAll();
    });
};
