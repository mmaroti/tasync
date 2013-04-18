"use strict";

var TASYNC = require("../lib/tasync");
var FS = require("fs");

(function () {
	var fsReadFile = TASYNC.adapt(FS.readFile);
	var lastFileName, lastFileData;

	function cachedReadFile (fileName) {
		if (fileName === lastFileName) {
			return lastFileData + "\n";
		}

		var futureFileData = fsReadFile(fileName);
		return TASYNC.apply(updateCache, [ fileName, futureFileData ]);
	}

	function updateCache (fileName, fileData) {
		lastFileName = fileName;
		lastFileData = fileData;

		return fileData;
	}

	FS.readFile = TASYNC.unadapt(cachedReadFile);
}());

// --- test

FS.readFile("testcache.js", function (err, data) {
	console.log(data.length);
	FS.readFile("testcache.js", function (err, data) {
		console.log(data.length);
	});
});
