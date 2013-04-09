/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tasync" ], function (TA) {
	"use strict";

	function divide (x, y) {
		if (y === 0) {
			throw new Error("divide by zero");
		}
		return x / y;
	}

	function curry (x, y) {
		y = TA.delay(300, y);
		return TA.invoke(divide, [ x, y ]);
	}

	function test1 () {
		var a = TA.delay(100, 1);
		var b = TA.delay(200, 0);
		var c = TA.invoke(curry, [ a, b ]);

		TA.then(c, function (error, value) {
			console.log(error ? error.trace : null, value);
		});
	}

	test1();
});
