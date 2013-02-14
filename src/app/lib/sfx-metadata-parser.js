var MusicMetaData = require("musicmetadata");
var config = require("../../config");
var fs = require("fs");
var async = require("async");
var log = require("./log");

var sfxDir = config.sfxDir || "./public/sfx";

/**
 * Loops through an sfx data structure and parses each file for MP3 metadata. If
 * it is found its added to the data for each file.
 */
module.exports = function (sfx,cb) {
    if ( sfx[0].parsed ) {
        cb(null,sfx);
        return;
    }
    var tasks = [];
    sfx.forEach(function (dir) {
        dir.files.forEach(function (file) {
            tasks.push(function (file,dir) {
                return function (cb) {
                    parseFile(file,dir,cb);
                }
            }(file,dir));
        });
    });
    async.series(tasks,function (err) {
        cb(err,sfx);
    });
}

function parseFile (file,dir,cb) {
    dir.parsed = true;
    var filePath = sfxDir+"/"+dir.name+"/"+file.filename;
    var parser = new MusicMetaData(fs.createReadStream(filePath));
    parser.on("metadata",function (res) {
        file.title = res.title;
        file.artist = res.artist.toString();
        file.album = res.album;
    });
    parser.on("TLEN",function (res) {
        file.duration = res;
    });
    parser.on("done",function (err) {
        //if ( err ) log.warn(file.filename+" "+err.toString());
        parser.stream.destroy();
        cb();
    });
}