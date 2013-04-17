/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "../lib/tasync", "fs" ], function (TASYNC, FS) {
	"use strict";

	var startdir = process.argv[2];
	var pattern = process.argv[3];

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

	TASYNC.setTrace(false);
	
	var tasync = (function () {
		var FS_READDIR = TASYNC.adapt(FS.readdir);
		var FS_STAT = TASYNC.adapt(FS.lstat);

		function readDir (dir) {
			var futureList = FS_READDIR(dir);
			return TASYNC.invoke(processDir, [ dir, futureList ]);
		}

		function processDir (dir, list) {
			var i = 0;
			for (i = 0; i < list.length; ++i) {
				var filename = list[i];
				var filepath = dir + "/" + filename;
				var futureStat = FS_STAT(filepath);
				list[i] = TASYNC.invoke(processFile, [ filename, filepath, futureStat ]);
			}
			return TASYNC.invoke(sum, list);
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

		return TASYNC.unadapt(readDir);
	})();

	if (typeof startdir !== "string" || typeof pattern !== "string") {
		console.log("Usage: node testfs.js startdir pattern");
		return;
	}

	var methods = {
		parallel: parallel,
		serial: serial,
		tasync: tasync
	};

	var test = function (name, next) {
		return function () {
			var elapsed = Date.now();
			methods[name](startdir, function (error, result) {
				elapsed = Date.now() - elapsed;
				name = name + new Array(17 - name.length).join(" ");
				console.log(name + (error || result) + "\t" + elapsed + " ms");
				next();
			});
		};
	};

	var next = function () {
	};

	var name;
	for (name in methods) {
		next = test(name, next);
	}

	next();
});
