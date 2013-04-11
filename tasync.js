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
	var STATE_REJECTED = 1;
	var STATE_RESOLVED = 2;

	var Future = function () {
		this.state = STATE_LISTEN;
		this.value = [];
	};

	Future.prototype.register = function (target) {
		assert(this.state === STATE_LISTEN);
		assert(typeof target === "object" && target != null);

		this.value.push(target);
	};

	Future.prototype.resolve = function (value) {
		assert(this.state === STATE_LISTEN && !(value instanceof Future));

		var listeners = this.value;

		this.state = STATE_RESOLVED;
		this.value = value;

		var i;
		for (i = 0; i < listeners.length; ++i) {
			listeners[i].onResolved(value);
		}
	};

	Future.prototype.reject = function (error) {
		assert(this.state === STATE_LISTEN && error instanceof Error);

		var listeners = this.value;

		this.state = STATE_REJECTED;
		this.value = error;

		var i;
		for (i = 0; i < listeners.length; ++i) {
			listeners[i].onRejected(error);
		}
	};

	// ------- Delay -------

	function delay (timeout, value) {
		if (timeout < 0) {
			return value;
		}

		var future = new Future();
		setTimeout(function () {
			future.resolve(value);
		}, timeout);
		return future;
	}

	// ------- FutureArray -------

	var FutureArray = function (array, index) {
		Future.call(this);

		this.array = array;
		this.index = index;
	};

	FutureArray.prototype = Object.create(Future.prototype);

	FutureArray.prototype.onResolved = function (value) {
		assert(this.state === STATE_LISTEN);

		var array = this.array;
		array[this.index] = value;

		while (++this.index < array.length) {
			value = array[this.index];
			if (value instanceof Future) {
				if (value.state === STATE_RESOLVED) {
					array[this.index] = value.value;
				} else if (value.state === STATE_LISTEN) {
					value.register(this);
					return;
				} else {
					assert(value.state === STATE_REJECTED);
					this.reject(value.value);
					return;
				}
			}
		}

		this.array = null;
		this.resolve(array);
	};

	FutureArray.prototype.onRejected = function (error) {
		this.array = null;
		this.reject(error);
	};

	var array = function (array) {
		assert(array instanceof Array);

		var index;
		for (index = 0; index < array.length; ++index) {
			var value = array[index];
			if (value instanceof Future) {
				if (value.state === STATE_RESOLVED) {
					array[index] = value.value;
				} else if (value.state === STATE_LISTEN) {
					var future = new FutureArray(array, index);
					value.register(future);
					return future;
				} else {
					assert(value.state === STATE_REJECTED);
					throw value.value;
				}
			}
		}

		return array;
	};

	// ------- FutureInvoke -------

	var ROOT = {
		subframes: 0
	};

	var FRAME = ROOT;

	function FutureInvoke (func, that, args, index) {
		Future.call(this);

		this.caller = FRAME;
		this.position = ++FRAME.subframes;
		this.subframes = 0;
		this.trace = new Error();

		this.func = func;
		this.that = that;
		this.args = args;
		this.index = index;
	}

	FutureInvoke.prototype = Object.create(Future.prototype);

	FutureInvoke.prototype.getPath = function () {
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
			end = trace.lastIndexOf("\n", end) + 1;
		} else {
			if (trace.charAt(trace.length - 1) !== "\n") {
				trace += "\n";
			}
			end = undefined;
		}

		var start = trace.indexOf("_trace_end");
		start = trace.indexOf("\n", start) + 1;

		return trace.substring(start, end);
	}

	FutureInvoke.prototype.onRejected = function (error) {
		this.args = null;
		this.reject(error);
	};

	FutureInvoke.prototype.onResolved = function invoke_on_resolved_trace_start (value) {
		assert(this.state === STATE_LISTEN);

		var args = this.args;
		args[this.index] = value;

		while (++this.index < args.length) {
			value = args[this.index];
			if (value instanceof Future) {
				if (value.state === STATE_RESOLVED) {
					args[this.index] = value.value;
				} else if (value.state === STATE_LISTEN) {
					value.register(this);
					return;
				} else {
					assert(value.state === STATE_REJECTED);
					this.reject(value.value);
					return;
				}
			}
		}

		assert(FRAME === ROOT);
		FRAME = this;

		this.args = null;
		try {
			value = this.func.apply(this.that, args);
		} catch (error) {
			FRAME = ROOT;

			value = error instanceof Error ? error : new Error(error);

			value.trace = getSlice(value.stack);
			var future = this;
			do {
				value.trace += "*** callback ***\n";
				value.trace += getSlice(future.trace.stack);
				future = future.caller;
			} while (future !== ROOT);

			this.reject(value);
			return;
		}

		FRAME = ROOT;

		if (value instanceof Future) {
			assert(value.state === STATE_LISTEN);

			this.onResolved = this.resolve;
			value.register(this);
		} else {
			this.resolve(value);
		}
	};

	var invoke = function invoke_trace_end (func, args, that) {
		assert(typeof func === "function" && args instanceof Array);

		var index;
		for (index = 0; index < args.length; ++index) {
			var value = args[index];
			if (value instanceof Future) {
				if (value.state === STATE_RESOLVED) {
					args[index] = value.value;
				} else if (value.state === STATE_LISTEN) {
					var future = new FutureInvoke(func, that, args, index);
					value.register(future);
					return future;
				} else {
					assert(value.state === STATE_REJECTED);
					throw value.value;
				}
			}
		}

		return func.apply(that, args);
	};

	// ------- Then -------

	function FutureThen (func, that, value) {
		FutureInvoke.call(this, func, that, [ null, value ], 1);
	}

	FutureThen.prototype = Object.create(FutureInvoke.prototype);

	FutureThen.prototype.onRejected = function (error) {
		this.args[0] = error;
		this.onResolved(null);
	};

	function then (value, func, that) {
		assert(typeof func === "function");

		if (value instanceof Future) {
			if (value.state === STATE_LISTEN) {
				var future = new FutureThen(func, that, value);
				value.register(future);
				return future;
			} else if (value.state instanceof STATE_RESOLVED) {
				return func(null, value.value);
			} else {
				assert(value.state === STATE_REJECTED);
				return func(value.value);
			}
		} else {
			return func(null, value);
		}
	}

	// ------- Adapt -------

	function adapt (func) {
		assert(typeof func === "function");

		if (typeof func.tasync_adapted === "undefined") {
			func.tasync_adapted = function () {
				var args = arguments;
				var future = new Future();

				args[args.length++] = function (error, value) {
					if (error) {
						future.reject(error instanceof Error ? error : new Error(error));
					} else {
						future.resolve(value);
					}
				};

				func.apply(this, args);

				if (future.state === STATE_LISTEN) {
					return future;
				} else if (future.state === STATE_RESOLVED) {
					return future.value;
				} else {
					assert(future.state === STATE_REJECTED);
					throw future.value;
				}
			};

			func.tasync_adapted.tasync_unadapted = func;
		}

		return func.tasync_adapted;
	}

	// ------- Unadapt -------

	function FutureUnadapt (callback) {
		this.callback = callback;
	}

	FutureUnadapt.prototype.onRejected = function (error) {
		this.callback(error);
	};

	FutureUnadapt.prototype.onResolved = function (value) {
		this.callback(null, value);
	};

	function unadapt (func) {
		assert(typeof func === "function");

		if (typeof func.tasync_unadapted === "undefined") {
			func.tasync_unadapted = function () {
				var args = arguments;

				var callback = args[--args.length];
				assert(typeof callback === "function");

				var value;
				try {
					value = func.apply(this, args);
				} catch (error) {
					callback(error);
					return;
				}

				if (value instanceof Future) {
					assert(value.state === STATE_LISTEN);

					var listener = new FutureUnadapt(callback);
					value.register(listener);
				} else {
					callback(null, value);
				}
			};

			func.tasync_unadapted.tasync_adapted = func;
		}

		return func.tasync_unadapted;
	}

	// ------- TASYNC -------

	return {
		delay: delay,
		array: array,
		invoke: invoke,
		then: then,
		adapt: adapt,
		unadapt: unadapt
	};
});
