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
	return TASYNC.call(divide, a, b);
}

TASYNC.trycatch(test, function (error) {
	console.log(error.trace || error.stack);
});
