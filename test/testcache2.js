"use strict";

var TASYNC = require("../lib/tasync");
var FS = require("fs");

(function () {
	var fsReadFile = TASYNC.wrap(FS.readFile);

	var lastFileName, lastFileData;
	function cachedReadFile (fileName) {
		if (fileName === lastFileName) {
			return TASYNC.call(patch, lastFileData);
		}

		lastFileName = fileName;
		lastFileData = fsReadFile(fileName);

		return lastFileData;
	}

	function patch (fileData) {
		return "cached:" + fileData;
	}

	FS.readFile = TASYNC.unwrap(cachedReadFile);
}());

// --- test

FS.readFile("testcache2.js", function (err, data) {
	console.log(err, data.length);
});

FS.readFile("testcache2.js", function (err, data) {
	console.log(err, data.length);
});
