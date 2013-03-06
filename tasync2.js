/**
 * Copyright (c) 2013, Miklos Maroti
 */

define(function () {
	"use strict";

	// ------- assert -------

	function assert (cond) {
		if (!cond) {
			throw new Error("tasync internal error");
		}
	}

	// ------- Future -------

	var STATE_NULL = 0;
	var STATE_LISTEN = 1;
	var STATE_VALUE = 2;
	var STATE_ERROR = 3;

	var Future = function Future_trace_end () {
		this.state = STATE_NULL;
		this.value = null;

		this.caller = current;
		this.position = ++current.children;
		this.children = 0;

		this.trace = new Error();
		console.log("tasync future", this.getPath());
	};

	Future.prototype.setValue = function (value) {
		assert(this.state === STATE_NULL || this.state === STATE_LISTEN);

		console.log("tasync setvalue", this.getPath(), value);

		if (value instanceof Future) {
			value.addListener(this);
		} else if (this.state === STATE_NULL) {
			this.state = STATE_VALUE;
			this.value = value;
		} else if (this.state === STATE_LISTEN) {
			var i, listeners = this.value;

			this.state = STATE_VALUE;
			this.value = value;

			for (i = 0; i < listeners.length; ++i) {
				listeners[i].setValue(value);
			}
		}
	};

	Future.prototype.addListener = function (target) {
		if (this.state === STATE_NULL) {
			this.state = STATE_LISTEN;
			this.value = [ target ];
		} else if (this.state === STATE_LISTEN) {
			this.value.push(target);
		} else if (this.state === STATE_VALUE) {
			target.setValue(this.value);
		} else {
			assert(this.value instanceof Error);
			target.setError(this.value);
		}
	};

	function getSlice (trace) {
		assert(typeof trace === "string");

		var end = trace.indexOf("_trace_start");
		if (end >= 0) {
			end = trace.lastIndexOf("\n", end);
		} else {
			end = undefined;
		}

		var start = trace.indexOf("_trace_end");
		start = trace.indexOf("\n", start) + 1;

		return trace.substring(start, end);
	}

	function getTrace (future, error) {
		assert(future instanceof Future);

		if (!(error instanceof Error)) {
			error = new Error(error);
		}

		var trace = getSlice(error.stack) + "\n";
		while (future !== ROOT) {
			trace += "*** tasync ***\n";
			trace += getSlice(future.trace.stack);
			future = future.caller;
		}

		return trace;
	}

	Future.prototype.setError = function (error) {
		assert(this.state === STATE_NULL || this.state === STATE_LISTEN);

		if (!(error instanceof Error) || typeof error.trace !== "string") {
			error.trace = getTrace(this, error);
		}

		console.log("tasync seterror", this.getPath(), error.message);

		if (this.state === STATE_NULL) {
			this.state = STATE_ERROR;
			this.value = error;
		} else if (this.state === STATE_LISTEN) {
			var i, listeners = this.value;

			this.state = STATE_ERROR;
			this.value = error;

			for (i = 0; i < listeners.length; ++i) {
				listeners[i].setError(error);
			}
		}
	};

	var ROOT = Object.create(Future.prototype);
	ROOT.children = 0;

	var current = ROOT;

	Future.prototype.getPath = function () {
		var future = this, path = [];
		while (future !== ROOT) {
			path.push(future.position);
			future = future.caller;
		}
		return path;
	};

	// ------- TASYNC -------

	return {
		Future: Future
	};
});
