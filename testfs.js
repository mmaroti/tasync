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

				list.forEach(function (filename) {
					var filepath = dir + "/" + filename;
					FS.stat(filepath, function (err, stat) {
						if (err) {
							console.log(err);
						} else if (stat.isDirectory()) {
							parallel(filepath, finish);
							return;
						} else if (filename.indexOf(pattern) >= 0) {
							count++;
						}
						finish();
					});
				});
			}
		});
	}

	var FS_READDIR = TA.adapt(FS.readdir);
	var FS_STAT = TA.adapt(FS.stat);

	function tasync_1 (dir) {
		var list = FS_READDIR(dir);
		return TA.invoke(tasync_2, [ dir, list ]);
	}

	function tasync_2 (dir, list) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var stat = FS_STAT(filepath);
			list[i] = TA.invoke(tasync_3, [ filename, filepath, stat ]);
		}
		return TA.invoke(tasync_4, list);
	}

	function tasync_3 (filename, filepath, stat) {
		if (stat.isDirectory()) {
			return TA.invoke(tasync_1, [ filepath ]);
		} else if (filename.indexOf(pattern) >= 0) {
			++count;
		}
	}

	function tasync_4 () {
//		throw new Error();
	}

	if (typeof startdir === "string" && startdir.length >= 1 && typeof pattern === "string" && pattern.length >= 1) {
		if (method === "parallel") {
			method = parallel;
		} else if (method === "tasync") {
			method = TA.unadapt(tasync_1);
		}
	}

	if (typeof method === "function") {
		console.time("elapsed time");
		method(startdir, function (err) {
			if(err) {
				console.log(err.trace);
			}
			console.log("found " + count + " files");
			console.timeEnd("elapsed time");
		});
	} else {
		console.log("Usage: node testfs.js [parallel,tasync] startdir pattern");
	}
});
