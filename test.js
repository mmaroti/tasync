/**
 * Copyright (c) 2013, Miklos Maroti
 */

var requirejs = require("requirejs");

requirejs([ "tsync" ], function (TSYNC) {
	"use strict";

	var future = new TSYNC.Future();
	var array = [future, 2, future]; 
	
	TSYNC.then(TSYNC.lift(array), function (err, value) {
		console.log(err, value);
	});
	
	TSYNC.setValue(future, 1);
});
