/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tsync" ], function (TSYNC) {
	"use strict";

	var future = new TSYNC.Future();
	var array = TSYNC.lift([future, 2, future]);
	console.log(array instanceof TSYNC.Future);
	
	TSYNC.then(array, function (err, value) {
		console.log(err, value);
	});
	
	TSYNC.setValue(future, 1);
});
