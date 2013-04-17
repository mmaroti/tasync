/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "../lib/tasync", "fs" ], function (TA, FS) {
	"use strict";

	var method = process.argv[2];
	var startdir = process.argv[3];
	var pattern = process.argv[4];

	var parallel = function (dir, done) {
		FS.readdir(dir, function (err, list) {
			if (err) {
				done(err);
			} else if (list.length === 0) {
				done(null, 0);
			} else {
				var sum = 0, pending = list.length;

				var finish = function (err, count) {
					if (err && pending > 0) {
						pending = 0;
						done(err);
					} else {
						sum += count;
						if (--pending === 0) {
							done(null, sum);
						}
					}
				};

				list.forEach(function (filename) {
					var filepath = dir + "/" + filename;
					FS.lstat(filepath, function (err, stat) {
						if (err) {
							finish(err);
						} else if (stat.isDirectory()) {
							parallel(filepath, finish);
						} else if (filename.indexOf(pattern) >= 0) {
							finish(null, 1);
						} else {
							finish(null, 0);
						}
					});
				});
			}
		});
	};

	var serial = function (dir, done) {
		FS.readdir(dir, function (err, list) {
			if (err) {
				done(err);
			} else {
				var sum = 0, index = -1;

				var next = function (err, count) {
					if (err) {
						done(err);
					} else {
						sum += count;
						if (++index >= list.length) {
							done(null, sum);
						} else {
							var filename = list[index];
							var filepath = dir + "/" + filename;
							FS.lstat(filepath, function (err, stat) {
								if (err) {
									done(err);
								} else if (stat.isDirectory()) {
									serial(filepath, next);
								} else if (filename.indexOf(pattern) >= 0) {
									next(null, 1);
								} else {
									next(null, 0);
								}
							});
						}
					}
				};

				next(null, 0);
			}
		});
	};

	var tasync = (function () {
		var FS_READDIR = TA.adapt(FS.readdir);
		var FS_STAT = TA.adapt(FS.lstat);

		function readDir (dir) {
			var futureList = FS_READDIR(dir);
			return TA.invoke(processDir, [ dir, futureList ]);
		}

		function processDir (dir, list) {
			var i = 0;
			for (i = 0; i < list.length; ++i) {
				var filename = list[i];
				var filepath = dir + "/" + filename;
				var futureStat = FS_STAT(filepath);
				list[i] = TA.invoke(processFile, [ filename, filepath, futureStat ]);
			}
			return TA.invoke(sum, list);
		}

		function processFile (filename, filepath, stat) {
			if (stat.isDirectory()) {
				return readDir(filepath);
			} else if (filename.indexOf(pattern) >= 0) {
				return 1;
			} else {
				return 0;
			}
		}

		function sum () {
			var i, s = 0;
			for (i = 0; i < arguments.length; ++i) {
				s += arguments[i];
			}
			return s;
		}

		return TA.unadapt(readDir);
	})();

	if (typeof startdir === "string" && startdir.length >= 1 && typeof pattern === "string" && pattern.length >= 1) {
		if (method === "parallel") {
			method = parallel;
		} else if (method === "serial") {
			method = serial;
		} else if (method === "tasync") {
			method = tasync;
		}
	}

	if (typeof method === "function") {
		console.time("elapsed time");
		method(startdir, function (err, count) {
			if (err) {
				console.log(err);
			}
			console.log("found " + count + " files");
			console.timeEnd("elapsed time");
		});
	} else {
		console.log("Usage: node testfs.js [parallel,serial,tasync] startdir pattern");
	}
});
