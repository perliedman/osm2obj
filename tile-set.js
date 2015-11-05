var async = require('async');

function range(start, end) {
    var a = Array.apply(0, Array(end - start + 1));
    a.forEach(function(e, i) { a[i] = start + i; });
    return a;
}

function flatten(a) {
    return [].concat.apply([], a);
}

module.exports = function(loadTile, extent, pad, cb) {
    var south = Math.floor(extent[1]) - pad,
        north = Math.floor(extent[3]) + 1 + pad,
        west = Math.floor(extent[0]) - pad,
        east = Math.floor(extent[2]) + 1 + pad,
        tiles = new Array(north - south),
        tasks = flatten(range(south, north).map(function(lat, i) {
            tiles[i] = new Array(east - west);
            return range(west, east).map(function(lng, j) {
                return function(cb) {
                    loadTile([lat, lng], function(err, t) {
                        if (err) {
                            return setImmediate(cb(err));
                        }
                        tiles[i][j] = t;
                        setImmediate(cb);
                    });
                };
            });
        }));

    async.parallel(tasks, function(err) {
        if (err) {
            return setImmediate(cb(err));
        }

        setImmediate(function() {
            cb(undefined, {
                getElevation: function(ll) {
                    var tileLat = Math.floor(ll[0]),
                        tileLng = Math.floor(ll[1]),
                        tile = tiles[tileLat - south][tileLng - west];
                    return tile.getElevation(ll);
                }
            });
        });
    });
};
