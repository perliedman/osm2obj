#!/usr/bin/node

var osm2obj = require('./'),
    fs = require('fs'),
    osmdata = JSON.parse(fs.readFileSync(process.argv[2]));

osm2obj(osmdata, process.stdout);
