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

	// ------- FutureError -------

	function FutureError (future, error) {
		assert(future instanceof Future);

		error = error instanceof Error ? error : new Error(error);

		this.original = error;
		this.message = error.message;
		this.stack = getSlice(error.stack) + "\n" + getTrace(future);

		console.log("tasync future error", getPath(future));
	}

	FutureError.prototype = Object.create(Error.prototype);

	function getPath (future) {
		var path = [];
		while (future !== ROOT) {
			path.push(future.position);
			future = future.caller;
		}
		return path;
	}

	function getSlice (trace) {
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

	function getTrace (future) {
		var trace = "";
		while (future !== ROOT) {
			trace += "*** tasync ***\n";
			trace += getSlice(future.trace.stack);
			future = future.caller;
		}
		return trace;
	}

	// ------- Future -------

	var UNRESOLVED = {};
	Object.seal(UNRESOLVED);

	function Future () {
		this.value = UNRESOLVED;
		this.listeners = [];

		this.caller = current;
		this.position = ++current.children;
		this.children = 0;

		this.trace = new Error();
		console.log("tasync future created", getPath(this));
	}

	var ROOT = Object.create(Future.prototype);
	ROOT.children = 0;

	var current = ROOT;

	function setValue (future, value) {
		assert(future.value === UNRESOLVED);
		console.log("tasync future setvalue", getPath(future), value instanceof Error ? "Error: " + value.message : value);

		var i, listeners = future.listeners;

		future.value = value;
		future.listeners = null;

		for (i = 0; i < listeners.length; i += 2) {
			try {
				listeners[i](listeners[i + 1], value);
			} catch (err) {
				console.log("tasync listener error ignored", err.stack);
			}
		}
	}

	function addListener (future, func, arg) {
		assert(future.value === UNRESOLVED);

		future.listeners.push(func, arg);
	}

	// ------- lift -------

	function FutureArray (array, index) {
		Future.apply(this);

		this.array = array;
		this.index = index;
	}

	FutureArray.prototype = Object.create(Future.prototype);

	function liftArray (array) {
		var index;
		for (index = 0; index < array.length; ++index) {
			if (array[index] instanceof Future) {
				if (array[index].value === UNRESOLVED) {
					var future = new FutureArray(array, index);
					addListener(array[index], setArrayMember, future);
					return future;
				} else if (array[index].value instanceof FutureError) {
					throw array[index].value;
				} else {
					array[index] = array[index].value;
				}
			}
		}
		return array;
	}

	function setArrayMember (future, value) {
		assert(future instanceof FutureArray);

		if (value instanceof FutureError) {
			setValue(future, value);
		} else {
			future.array[future.index] = value;

			while (++future.index < future.array.length) {
				if (future.array[future.index] instanceof Future) {
					if (future.array[future.index].value === UNRESOLVED) {
						addListener(future.array[future.index], setArrayMember, future);
						return;
					} else if (future.array[future.index].value instanceof FutureError) {
						setValue(future.array[future.index].value);
						return;
					} else {
						future.array[future.index] = future.array[future.index].value;
					}
				}
			}

			setValue(future, future.array);
		}
	}

	// ------- then -------

	function then (value, func) {
		assert(typeof func === "function");

		if (value instanceof Future) {
			if (value.value === UNRESOLVED) {
				addListener(value, notify, func);
			} else if (value.value instanceof FutureError) {
				func(value.value);
			} else {
				func(null, value.value);
			}
		} else {
			func(null, value);
		}
	}

	function notify (func, result) {
		try {
			if (result instanceof FutureError) {
				func(result);
			} else {
				func(null, result);
			}
		} catch (err) {
			console.log("tasync uncaught exception", err instanceof Error ? err.stack : err);
		}
	}

	// ------- napply -------

	function FutureCall (func, obj) {
		Future.apply(this);

		this.func = func;
		this.obj = obj;
	}

	FutureCall.prototype = Object.create(Future.prototype);

	function napply (func, obj, args) {
		assert(typeof func === "function");

		var future;

		args.push(function (err, value) {
			if (err) {
				value = new FutureError(future, err);
			}
			setValue(future, value);
		});
		args = liftArray(args);

		if (args instanceof Future) {
			future = new FutureCall(func, obj);
			addListener(args, makeCall, future);
			return future;
		} else {
			future = new Future();

			current = future;
			try {
				func.apply(obj, args);
			} finally {
				current = future.caller;
			}

			if (future.value === UNRESOLVED) {
				return future;
			} else if (future.value instanceof FutureError) {
				throw future.value;
			} else {
				return future.value;
			}
		}
	}

	function makeCall (future, args) {
		var value, old = current;
		current = future;
		try {
			future.func.apply(future.obj, args);
		} catch (err) {
			setValue(future, new FutureError(future, err));
		}
		current = old;
	}

	// ------- delay -------

	function delay (timeout, value) {
		var future = new Future();
		setTimeout(function () {
			setValue(future, value);
		}, timeout);
		return future;
	}

	// ------- apply -------

	function FutureApply (func, that, args, index) {
		Future.apply(this);

		this.func = func;
		this.that = that;
		this.args = args;
		this.index = index;
	}

	FutureApply.prototype = Object.create(Future.prototype);

	function setArgument_trace_start (future, value) {
		assert(future instanceof FutureApply);

		if (value instanceof FutureError) {
			setValue(future, value);
		} else {
			var args = future.args;
			args[future.index] = value;

			while (++future.index < args.length) {
				if (args[future.index] instanceof Future) {
					if (args[future.index].value === UNRESOLVED) {
						addListener(args[future.index], setArgument_trace_start, future);
						return;
					} else if (args[future.index].value instanceof FutureError) {
						setValue(args[future.index].value);
						return;
					} else {
						args[future.index] = args[future.index].value;
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
	}

	function invoke_trace_end (func, args, that) {
		assert(typeof func === "function" && args instanceof Array);

		var index;
		for (index = 0; index < args.length; ++index) {
			if (args[index] instanceof Future) {
				if (args[index].value === UNRESOLVED) {
					var future = new FutureApply(func, that, args, index);
					addListener(args[index], setArgument_trace_start, future);
					return future;
				} else if (args[index].value instanceof FutureError) {
					throw args[index].value;
				} else {
					args[index] = args[index].value;
				}
			}
		}

		return func.apply(that, args);
	}

	// ------- TASYNC -------

	return {
		Future: Future,
		getTrace: getTrace,
		setValue: setValue,
		lift: liftArray,
		then: then,
		napply: napply,
		delay: delay,
		invoke: invoke_trace_end
	};
});