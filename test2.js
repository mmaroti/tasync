/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tasync2" ], function (TASYNC) {
	"use strict";

	function test1 () {
		var a = new TASYNC.Future();
		console.log(a);
		
		var err = new Error("xxx");
		a.setError(err);
		console.log(err.trace);
	}

	test1();
});
