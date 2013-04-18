"use strict";

var TASYNC = require("../lib/tasync");
var FS = require("fs");

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
	var fsReadDir = TASYNC.adapt(FS.readdir);
	var fsStat = TASYNC.adapt(FS.lstat);

	function readDir (dir) {
		var futureList = fsReadDir(dir);
		return TASYNC.apply(processDir, [ dir, futureList ]);
	}

	function processDir (dir, list) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var futureStat = fsStat(filepath);
			list[i] = TASYNC.apply(processFile, [ filename, filepath, futureStat ]);
		}
		return TASYNC.apply(sum, list);
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

var tasync2 = (function () {
	var fsReadDir = TASYNC.adapt(FS.readdir);
	var fsStat = TASYNC.adapt(FS.lstat);

	function readDir (dir) {
		var futureList = fsReadDir(dir);
		return TASYNC.apply(processDir, [ futureList, dir ]);
	}

	function processDir (list, dir) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var futureStat = fsStat(filepath);
			list[i] = TASYNC.apply(processFile, [ filename, filepath, futureStat ]);
		}
		return TASYNC.apply(sum, list);
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

var throttled = (function () {
	var fsReadDir = TASYNC.throttle(TASYNC.adapt(FS.readdir), 5);
	var fsStat = TASYNC.adapt(FS.lstat);

	function readDir (dir) {
		var futureList = fsReadDir(dir);
		return TASYNC.apply(processDir, [ dir, futureList ]);
	}

	function processDir (dir, list) {
		var i = 0;
		for (i = 0; i < list.length; ++i) {
			var filename = list[i];
			var filepath = dir + "/" + filename;
			var futureStat = fsStat(filepath);
			list[i] = TASYNC.apply(processFile, [ filename, filepath, futureStat ]);
		}
		return TASYNC.apply(sum, list);
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

// ------- main

if (typeof startdir !== "string" || typeof pattern !== "string") {
	console.log("Usage: node testfs.js startdir pattern");
	return;
}

var methods = {
	throttled: throttled,
//	tasync2: tasync2,
	tasync: tasync,
	parallel: parallel
//	serial: serial
};

var test = function (name, next) {
	return function () {
		var elapsed = Date.now();
		methods[name](startdir, function (error, result) {
			elapsed = Date.now() - elapsed;
			name = name + new Array(17 - name.length).join(" ");
			console.log(name + elapsed + " ms\t\t" + (error || result));

			if (error) {
				// console.log(error.stack);
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
