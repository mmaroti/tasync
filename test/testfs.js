"use strict";

var TASYNC = require("../lib/tasync");
var FS = require("fs");
var ext = ".js";

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
					} else {
						finish(null, filename.indexOf(ext, filename.length - ext.length) !== -1 ? 1 : 0);
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
							} else {
								next(null, filename.indexOf(ext, filename.length - ext.length) !== -1 ? 1 : 0);
							}
						});
					}
				}
			};

			next(null, 0);
		}
	});
};

// disable stack tracing 
TASYNC.setTrace(false);

var tasync = (function () {
	var fsReadDir = TASYNC.wrap(FS.readdir);
	var fsStat = TASYNC.wrap(FS.lstat);

	function readDir (dir) {
		var futureList = fsReadDir(dir);
		return TASYNC.call(processDir, dir, futureList);
	}

	function processDir (dir, list) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var futureStat = fsStat(filepath);
			list[i] = TASYNC.call(processFile, filename, filepath, futureStat);
		}
		return TASYNC.apply(sum, list);
	}

	function processFile (filename, filepath, stat) {
		if (stat.isDirectory()) {
			return readDir(filepath);
		} else {
			return filename.indexOf(ext, filename.length - ext.length) !== -1 ? 1 : 0;
		}
	}

	function sum () {
		var i, s = 0;
		for (i = 0; i < arguments.length; ++i) {
			s += arguments[i];
		}
		return s;
	}

	return TASYNC.unwrap(readDir);
})();

var throttled = (function () {
	var fsReadDir = TASYNC.throttle(TASYNC.wrap(FS.readdir), 5);
	var fsStat = TASYNC.wrap(FS.lstat);

	function readDir (dir) {
		var futureList = fsReadDir(dir);
		return TASYNC.call(processDir, dir, futureList);
	}

	function processDir (dir, list) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var futureStat = fsStat(filepath);
			list[i] = TASYNC.call(processFile, filename, filepath, futureStat);
		}
		return TASYNC.apply(sum, list);
	}

	function processFile (filename, filepath, stat) {
		if (stat.isDirectory()) {
			return readDir(filepath);
		} else {
			return filename.indexOf(ext, filename.length - ext.length) !== -1 ? 1 : 0;
		}
	}

	function sum () {
		var i, s = 0;
		for (i = 0; i < arguments.length; ++i) {
			s += arguments[i];
		}
		return s;
	}

	return TASYNC.unwrap(readDir);
})();

// ------- main

var startdir = process.argv[2];
if (typeof startdir !== "string") {
	console.log("Usage: node testfs.js startdir");
	return;
}

var methods = {
	throttled: throttled,
	tasync: tasync,
	parallel: parallel,
	serial: serial
};

var test = function (name, next) {
	return function () {
		var elapsed = Date.now();
		methods[name](startdir, function (error, result) {
			elapsed = Date.now() - elapsed;
			name = name + new Array(17 - name.length).join(" ");
			console.log(name + elapsed + " ms\t\t" + (error || result));

			if (error) {
				console.log(error.trace || error.stack);
			}
			next();
		});
	};
};

var next = function () {
	console.log("done");
};

var name;
for (name in methods) {
	next = test(name, next);
}

console.log("start");
next();
