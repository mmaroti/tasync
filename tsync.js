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

	// ------- Exception -------

	function Exception (future, error) {
		this.original = error;
		this.message = error.message;
		this.stack = error.stack + "\n" + getTrace(future);

		console.log("tsync future error", getPath(future));
	}

	function getPath (future) {
		var path = [];
		while (future !== ROOT) {
			path.push(future.index);
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
		this.index = ++current.children;
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

		for (i = 0; i < listeners.length; i += 4) {
			try {
				listeners[i](value, listeners[i + 1], listeners[i + 2], listeners[i + 3]);
			} catch (err) {
				console.log("tsync listener error ignored", err);
			}
		}
	}

	function addListener (future, func, arg1, arg2, arg3) {
		assert(future.value === UNRESOLVED);

		future.listeners.push(func, arg1, arg2, arg3);
	}

	// ------- lift -------

	function liftArray (array) {
		var index;
		for (index = 0; index < array.length; ++index) {
			if (array[index] instanceof Future) {
				if (array[index].value === UNRESOLVED) {
					var future = new Future();
					addListener(array[index], setArrayMember, future, array, index);
					return future;
				} else if (array[index].value instanceof Exception) {
					throw array[index].value;
				} else {
					array[index] = array[index].value;
				}
			}
		}
		return array;
	}

	function setArrayMember (value, future, array, index) {
		if (value instanceof Exception) {
			setValue(future, value);
		} else {
			array[index] = value;

			while (++index < array.length) {
				if (array[index] instanceof Future) {
					if (array[index].value === UNRESOLVED) {
						addListener(array[index], setArrayMember, future, array, index);
						return;
					} else if (array[index].value instanceof Exception) {
						setValue(array[index].value);
						return;
					} else {
						array[index] = array[index].value;
					}
				}
			}

			setValue(future, array);
		}
	}

	// ------- then -------

	function then (value, func) {
		assert(typeof func === "function");

		if (value instanceof Future) {
			if (value.value === UNRESOLVED) {
				addListener(value, notify, func);
			} else if (value.value instanceof Exception) {
				func(value.value);
			} else {
				func(null, value.value);
			}
		} else {
			func(null, value);
		}
	}

	function notify (result, func) {
		if (result instanceof Exception) {
			func(result);
		} else {
			func(null, result);
		}
	}

	// ------- TSYNC -------

	return {
		Future: Future,
		getTrace: getTrace,
		setValue: setValue,
		lift: liftArray,
		then: then
	};
});
