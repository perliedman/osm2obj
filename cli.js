#!/usr/bin/node

var osm2obj = require('./'),
    TileSet = require('node-hgt').TileSet,
    proj4 = require('proj4'),
    argv = require('minimist')(process.argv.slice(2)),
    elevationProvider,
    options;

if (argv['elevation-data'] || argv.e) {
    elevationProvider = new TileSet(argv['elevation-data'] || argv.e);
}

options = {
    ground: argv.ground || argv.g || false,
    projection: argv.projection ? proj4(proj4.WGS84, argv.projection) : undefined
};

osm2obj(argv._[0], process.stdout, elevationProvider, function(err, status) {
    if (err) {
        process.stderr.write(err + '\n\n');
        return;
    }

    process.stderr.write('Wrote ' + status.highways + ' highways and ' + status.buildings + ' buildings.\n\n');
}, options);
