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

	var STATE_LISTEN = 0;
	var STATE_ERROR = 1;
	var STATE_VALUE = 2;

	var Future = function Future_trace_end () {
		this.state = STATE_LISTEN;
		this.value = [];

		this.caller = current;
		this.position = ++current.children;
		this.children = 0;

		this.trace = new Error();
		console.log("tasync future", this.getPath());
	};

	Future.prototype.addListener = function (target) {
		assert(this.state === STATE_LISTEN);
		assert(target instanceof Future && target.state === STATE_LISTEN);

		this.value.push(target);
	};

	Future.prototype.setValue = function (value) {
		assert(this.state === STATE_LISTEN);
		assert(!(value instanceof Future) || value.state === STATE_LISTEN);

		console.log("tasync setvalue", this.getPath(), value);

		var listeners = this.value;

		this.state = STATE_VALUE;
		this.value = value;

		var i = listeners.length;
		while (--i >= 0) {
			var listener = listeners[i];
			listener.receiveValue(value);
		}
	};

	Future.prototype.setError = function (error) {
		assert(this.state === STATE_LISTEN);

		if (!(error instanceof Error)) {
			error = new Error(error);
		}

		if (typeof error.trace !== "string") {
			var trace = getSlice(error.stack) + "\n";

			var future = this;
			while (future !== ROOT) {
				trace += "*** tasync ***\n";
				trace += getSlice(future.trace.stack);
				future = future.caller;
			}

			error.trace = trace;
		}

		console.log("tasync seterror", this.getPath(), error.message);

		var listeners = this.value;

		this.state = STATE_ERROR;
		this.value = error;

		var i = listeners.length;
		while (--i >= 0) {
			var listener = listeners[i];
			listener.receiveError(error);
		}
	};

	Future.prototype.getPath = function () {
		var future = this, path = [];
		while (future !== ROOT) {
			path.push(future.position);
			future = future.caller;
		}
		return path;
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

	var ROOT = Object.create(Future.prototype);
	ROOT.children = 0;

	var current = ROOT;

	// ------- delay -------

	function delay (timeout, value) {
		if (timeout < 0) {
			return value;
		}
		var future = new Future();
		setTimeout(function () {
			future.setValue(value);
		}, timeout);
		return future;
	}

	// ------- invoke -------

	function FutureInvoke (func, that, args, index) {
		Future.apply(this);

		this.func = func;
		this.that = that;
		this.args = args;
		this.index = index;
	}

	FutureInvoke.prototype = Object.create(Future.prototype);

	FutureInvoke.prototype.receiveValue = function (value) {
		assert(!(value instanceof Future));

		var args = this.args;
		args[this.index] = value;

		while (++this.index < args.length) {
			var arg = args[this.index];
			if (arg instanceof Future) {
				if (arg.value === STATE_VALUE) {
					args[this.index] = arg.value;
				} else if (arg.value === STATE_LISTEN) {
					arg.addListener(this);
					return;
				} else {
					this.setError(arg);
					return;
				}
			}
		}

		assert(current === ROOT);
		current = this;

		try {
			value = this.func.apply(this.that, args);
		} catch (err) {
			current = ROOT;
			this.setError(err);
			return;
		}

		current = ROOT;

		if (value instanceof Future) {
			if (value.state === STATE_LISTEN) {
				this.receiveValue = this.setValue;
				value.addListener(this);
				return;
			} else if (value.state === STATE_VALUE) {
				value = value.value;
			} else {
				assert(value.state === STATE_ERROR);
				value.setError(value.value);
			}
		}

		this.setValue(value);
	};

	var invoke = function invoke_trace_end (func, args, that) {
		assert(typeof func === "function" && args instanceof Array);

		var index;
		for (index = 0; index < args.length; ++index) {
			var arg = args[index];
			if (arg instanceof Future) {
				if (arg.state === STATE_VALUE) {
					args[index] = arg.value;
				} else if (arg.state === STATE_LISTEN) {
					var future = new FutureInvoke(func, that, args, index);
					arg.addListener(future);
					return future;
				} else {
					throw arg.value;
				}
			}
		}

		return func.apply(that, args);
	};

	// ------- TASYNC -------

	return {
		Future: Future,
		delay: delay,
		invoke: invoke
	};
});
