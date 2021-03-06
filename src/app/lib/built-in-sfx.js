var dive = require("dive");
var config = require("../../config");
var fs = require("fs");

var sfxDir = config.sfxDir || "./public/sfx";
var cacheTime = 1000*60*5;
var sfx;
var lastAccess;

/**
 * Async walks the sfx dir and builds a data structure. Data structure is
 * rebuilt at most once every cacheTime (currently 5mins). Format:
 *
 * [
 *     {
 *         name: "dir",
 *         files: [
 *             filename: "example.mp3",
 *             path: "/sfx/dir/example.mp3",
 *             duration: 0,
 *             title: "",
 *             artist: "",
 *             album: ""
 *          ]
 *     }
 * ]
 */

var sortPropertyAlphabetical = function(property){
    return function(a,b) {
        if( a[property] < b[property] ){
            return -1;
        }
        if( a[property] > b[property] ){
            return 1;
        }
        return 0;
    };
};

module.exports = function (cb) {
    if ( sfx && lastAccess && (Date.now()<(lastAccess+cacheTime)) ) {
        cb(null,sfx);
    } else {
        sfx = [];
        lastAccess = Date.now();
        dive(sfxDir,{directories:true},function (err,path) {
            var pathParts = path.split("/");
            var name = pathParts.pop();
            if ( fs.lstatSync(path).isDirectory() ) {
                var dir = {
                    name: name,
                    files: []
                };
                sfx.push(dir);
                // This will sort the Albums, needed on live server
                sfx.sort(sortPropertyAlphabetical('name'));
            } else {
                var dirName = pathParts.pop();
                sfx.forEach(function (dir) {
                    if ( dir.name === dirName ) {
                        dir.files.push({
                            name: name.split(".").shift(),
                            filename: name,
                            path: "/sfx/"+dirName+"/"+name,
                            duration: 0,
                            title: "",
                            artist: "",
                            album: ""
                        });
                        // This will sort the Tracks, needed on live server
                        dir.files.sort(sortPropertyAlphabetical('name'));
                    }
                });
            }
        },function () {
            cb(null,sfx);
        });
    }
};
