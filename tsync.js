/**
 * Copyright (c) 2013, Miklos Maroti
 */

define(function () {
	"use strict";

	// ------- assert -------

	function assert (cond) {
		if (!cond) {
			throw new Error("tsync internal error");
		}
	}

	// ------- FutureError -------

	function FutureError (future, error) {
		assert(future instanceof Future && error instanceof Error);

		this.original = error;
		this.message = error.message;
		this.stack = error.stack + "\n" + getTrace(future);

		console.log("tsync future error", getPath(future));
	}

	function getPath (future) {
		var path = [];
		while (future !== ROOT) {
			path.push(future.position);
			future = future.caller;
		}
		return path;
	}

	function getSlice (trace) {
		var end = trace.indexOf("_trace_end");
		if (end >= 0) {
			end = trace.lastIndexOf("\n", end);
			end = trace.lastIndexOf("\n", end - 1) + 1;
		} else {
			end = undefined;
		}

		var start = trace.indexOf("_trace_start");
		start = trace.indexOf("\n", start) + 1;

		return trace.substring(start, end);
	}

	function getTrace (future) {
		var trace = "";
		while (future !== ROOT) {
			trace += "*** tsync ***\n";
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
		console.log("tsync future created", getPath(this));
	}

	var ROOT = Object.create(Future.prototype);
	ROOT.children = 0;

	var current = ROOT;

	function setValue (future, value) {
		assert(future.value === UNRESOLVED);
		console.log("tsync future setvalue", getPath(future), value);

		var i, listeners = future.listeners;

		future.value = value;
		future.listeners = null;

		for (i = 0; i < listeners.length; i += 2) {
			try {
				listeners[i](listeners[i + 1], value);
			} catch (err) {
				console.log("tsync listener error ignored", err.stack);
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
		if (result instanceof FutureError) {
			func(result);
		} else {
			func(null, result);
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

		args = liftArray(args);
		args.push(function (err, value) {
			if (err) {
				err = err instanceof Error ? err : new Error(err);
				value = err instanceof FutureError ? err : new FutureError(future, err);
			}
			setValue(future, value);
		});

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
		var old = current;
		current = future;
		try {
			future.func.apply(future.obj, args);
		} catch (err) {
			var error = err instanceof Error ? err : new Error(err);
			error = error instanceof FutureError ? error : new FutureError(future, error);
			setValue(future, error);
		}
		current = old;
	}

	// ------- TSYNC -------

	return {
		Future: Future,
		getTrace: getTrace,
		setValue: setValue,
		lift: liftArray,
		then: then,
		napply: napply
	};
});
