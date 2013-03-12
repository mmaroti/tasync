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

	function getValue (value) {
		while (value instanceof Future) {
			if (value.state === STATE_LISTEN) {
				return value;
			} else if (value.state === STATE_VALUE) {
				value = value.value;
			} else {
				throw value.value;
			}
		}
		return value;
	}

	function setValue (future, value) {
		assert(future instanceof Future && future.state === STATE_LISTEN);

		console.log("tasync setvalue", getPath(future), value);

		var i, listener, listeners = future.value;

		future.state = STATE_VALUE;
		future.value = value;

		for (i = 0; i < listeners.length; ++i) {
			listener = listeners[i];
			listener.setValue(value);
		}
	}

	function addListener (future, target) {
		assert(future instanceof Future && target instanceof Future);

		if (future.state === STATE_LISTEN) {
			future.value.push(target);
		} else if (future.state === STATE_VALUE) {
			setValue(target, future.value);
		} else {
			setError(target, future.value);
		}
	}

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

	function setError (future, error) {
		assert(future.state === STATE_LISTEN);

		if (!(error instanceof Error) || typeof error.trace !== "string") {
			error.trace = getTrace(future, error);
		}

		console.log("tasync seterror", future.getPath(), error.message);

		if (future.state === STATE_LISTEN) {
			var i, listener, listeners = future.value;

			future.state = STATE_ERROR;
			future.value = error;

			for (i = 0; i < listeners.length; ++i) {
				listener = listeners[i];
				listener.setError(error);
			}
		}
	}

	var ROOT = Object.create(Future.prototype);
	ROOT.children = 0;

	var current = ROOT;

	function getPath (future) {
		assert(future instanceof Future);

		var path = [];
		while (future !== ROOT) {
			path.push(future.position);
			future = future.caller;
		}
		return path;
	}

	// ------- delay -------

	function delay (timeout, value) {
		if (timeout < 0) {
			return value;
		}
		var future = new Future();
		setTimeout(setValue, timeout, future, value);
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

	function setArgument_trace_start (future, value) {
		assert(future instanceof FutureInvoke);

		var args = future.args;
		args[future.index] = value;

		do {
			while (args[future.index] instanceof Future) {
				value = args[future.index];
				if (value.state === STATE_VALUE) {
					args[future.index] = value.value;
					continue;
				}
				if (value.state === STATE_LISTEN) {
					addListener(value, setArgument_trace_start, future);
					return;
				} else if (value.state === STATE_ERROR) {
					setError(future, value.value);
					return;
				}
			}
		} while (++future.index < args.length);

		while (future.index < args.length) {
			var arg = args[future.index];
			while (arg instanceof Future) {
				if (arg.value === STATE_LISTEN) {
					addListener(arg, setArgument_trace_start, future);
					return;
				} else if (arg.state === STATE_VALUE) {
					arg = arg.value;
				} else if (arg.state === STATE_ERROR) {
					setError(future, arg.value);
					return;
				} else {
					args[future.index] = arg.value;
				}
			}
		}

		assert(current === ROOT);
		current = future;

		try {
			value = future.func.apply(future.that, args);
		} catch (err) {
			value = new FutureError(future, err);
		}

		current = ROOT;

		if (value instanceof Future) {
			if (value.value === UNRESOLVED) {
				addListener(value, setValue, future);
				return;
			} else {
				value = value.value;
			}
		}

		setValue(future, value);
	}

	function invoke_trace_end (func, args, that) {
		assert(typeof func === "function" && args instanceof Array);

		var index;
		for (index = 0; index < args.length; ++index) {
			var arg = args[index];
			while (arg instanceof Future) {
				if (arg.state === STATE_VALUE) {
					arg = arg.value;
				} else if (arg.state === STATE_LISTEN) {
					args[index] = arg;
					var future = new FutureInvoke(func, that, args, index);
					arg.addListener(setArgument_trace_start, future);
					return future;
				} else {
					throw arg.value;
				}
			}
			args[index] = arg;
		}

		return func.apply(that, args);
	}

	// ------- TASYNC -------

	return {
		Future: Future,
		delay: delay,
		invoke: invoke_trace_end
	};
});
