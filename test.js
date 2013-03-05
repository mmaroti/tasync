/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tsync" ], function (TSYNC) {
	"use strict";

	var a = new TSYNC.Future();
	var b = TSYNC.napply(function (x, callback) {
		console.log("aaa", arguments);
		setTimeout(callback, 1000, null, 2);
	}, null, [ a ]);

	var c = TSYNC.lift([ a, 3, a, b ]);

	var d = TSYNC.napply(function (x, y, callback) {
		console.log("xxx", arguments);
		return [x[0], y];
	}, null, [ c, b ]);

	TSYNC.then(d, function (err, value) {
		//		throw new Error("xxx");
		console.log(err, value);
	});

	TSYNC.setValue(a, 1);
});
