/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tasync", "fs" ], function (TA, FS) {
	"use strict";

	var method = process.argv[2];
	var startdir = process.argv[3];
	var pattern = process.argv[4];
	var count = 0;

	function parallel (dir, done) {
		FS.readdir(dir, function (err, list) {
			if (err) {
				console.log(err);
				done();
			} else if (list.length === 0) {
				done();
			} else {
				var pending = list.length;
				var finish = function () {
					if (--pending === 0) {
						done();
					}
				};

				list.forEach(function (file) {
					var filepath = dir + "/" + file;
					FS.stat(filepath, function (err, stat) {
						if (err) {
							console.log(err);
						} else if (stat.isDirectory()) {
							parallel(filepath, finish);
							return;
						} else if (file.indexOf(pattern) >= 0) {
							count++;
						}
						finish();
					});
				});
			}
		});
	}

	if (typeof startdir === "string" && startdir.length >= 1 && typeof pattern === "string" && pattern.length >= 1) {
		if (method === "parallel") {
			method = parallel;
		}
	}

	if (typeof method === "function") {
		console.time("elapsed time");
		method(startdir, function () {
			console.log("found " + count + " files");
			console.timeEnd("elapsed time");
		});
	} else {
		console.log("Usage: node testfs.js [parallel] startdir pattern");
	}
});
