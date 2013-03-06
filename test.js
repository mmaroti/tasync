/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tasync" ], function (TASYNC) {
	"use strict";

	function test1 () {
		var a = new TASYNC.Future();
		var b = TASYNC.napply(function (x, callback) {
			console.log("aaa", arguments);
			setTimeout(callback, 1000, null, 2);
		}, null, [ a ]);

		var c = TASYNC.lift([ a, 3, a, b ]);

		var d = TASYNC.napply(function (x, y, callback) {
			console.log("xxx", arguments);
			return [ x[0], y ];
		}, null, [ c, b ]);

		TASYNC.then(d, function (err, value) {
			//		throw new Error("xxx");
			console.log(err, value);
		});

		TASYNC.setValue(a, 1);
	}

	function test2 () {
		var a = TASYNC.delay(1000, 1);
		var b = TASYNC.delay(500, 0);

		function divide (x, y) {
			if (y === 0) {
				throw new Error("divide by zero");
			}

			return x / y;
		}

		var c = TASYNC.apply(divide, [ 2, b ]);
		var d = TASYNC.apply(divide, [ c, 1 ]);

		TASYNC.then(d, function (err, value) {
			console.log(err && err.stack);
			console.log(value);
		});
	}

	test2();
});
