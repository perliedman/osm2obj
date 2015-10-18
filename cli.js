#!/usr/bin/node

var osm2obj = require('./'),
    fs = require('fs'),
    TileSet = require('node-hgt').TileSet,
    osmdata = JSON.parse(fs.readFileSync(process.argv[2])),
    elevationProvider = new TileSet(process.argv[3]);

osm2obj(osmdata, process.stdout, elevationProvider, function(err) {
    if (err) {
        process.stderr.write(err + '\n\n');
    }
});
