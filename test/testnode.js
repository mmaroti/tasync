"use strict";

var TASYNC = require("../lib/tasync");

function test () {
	function divide (x, y) {
		if (y === 0) {
			throw new Error("divide by zero");
		}
		return x / y;
	}

	var a = TASYNC.delay(100, 1);
	var b = TASYNC.delay(200, 0);
	var c = TASYNC.invoke(divide, [ a, b ]);

	TASYNC.then(c, function (error, value) {
		console.log(error && (error.trace || error.stack));
		console.log(value);
	});
}

test();
