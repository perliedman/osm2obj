#!/usr/bin/node

var osm2obj = require('./'),
    fs = require('fs'),
    TileSet = require('node-hgt').TileSet,
    proj4 = require('proj4'),
    argv = require('minimist')(process.argv.slice(2)),
    osmdata = JSON.parse(fs.readFileSync(argv._[0])),
    elevationProvider,
    options;

if (argv['elevation-data'] || argv.e) {
    elevationProvider = new TileSet(argv['elevation-data'] || argv.e);
}

options = {
    ground: argv.ground || argv.g || false,
    projection: argv.projection ? proj4(proj4.WGS84, argv.projection) : undefined
};

osm2obj(osmdata, process.stdout, elevationProvider, function(err) {
    if (err) {
        process.stderr.write(err + '\n\n');
    }
}, options);
