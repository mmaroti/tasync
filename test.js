/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tsync" ], function (TSYNC) {
	"use strict";

	function test1 () {
		var a = new TSYNC.Future();
		var b = TSYNC.napply(function (x, callback) {
			console.log("aaa", arguments);
			setTimeout(callback, 1000, null, 2);
		}, null, [ a ]);

		var c = TSYNC.lift([ a, 3, a, b ]);

		var d = TSYNC.napply(function (x, y, callback) {
			console.log("xxx", arguments);
			return [ x[0], y ];
		}, null, [ c, b ]);

		TSYNC.then(d, function (err, value) {
			//		throw new Error("xxx");
			console.log(err, value);
		});

		TSYNC.setValue(a, 1);
	}

	function test2 () {
		var a = TSYNC.delay(1000, 1);
		var b = TSYNC.delay(500, 0);

		function divide (x, y) {
			if (y === 0) {
				throw new Error("divide by zero");
			}

			return x / y;
		}

		var c = TSYNC.apply(divide, [ 2, b ]);
		var d = TSYNC.apply(divide, [ c, 1 ]);

		TSYNC.then(d, function (err, value) {
			console.log(err && err.stack);
			console.log(value);
		});
	}

	test2();
});
