/**
 * Copyright (c) 2013, Miklos Maroti
 */

define(function () {
	"use strict";

	// ------- assert -------

	function assert (cond) {
		if (!cond) {
			console.log("TSYNC ERROR: this should not happen");
			console.log(new Error().stack);
		}
	}

	// ------- Error -------

	function FutureError (future, error) {
		assert(future instanceof Future);
		assert(error instanceof Error);

		this.original = error;
		this.message = error.message;
		this.stack = error.stack + "\n" + future.getStack();

		console.log("future error", future.getPath());
	}

	// ------- Future -------

	var UNRESOLVED = Object.create(FutureError.prototype);
	Object.seal(UNRESOLVED);

	var START = {
		next: START,
		prev: START
	};

	function Future (parent) {
		this.value = UNRESOLVED;
		this.listeners = null;

		this.parent = parent;
		this.prev = prev;
		this.next = prev.next;

		this.stack = new Error();
		console.log("future created", this.getPath());
	}

	Future.prorotype.setError = function (error) {
		assert(error instanceof FutureError);
		assert(this.value instanceof FutureError);

		if (this.value === UNRESOLVED) {
			this.value = error;
			if (this !== ROOT) {
				this.parent.setError(error);
			}
		}
	};

	Future.prototype.getPath = function () {
		var future = this, path = [];
		while (future !== ROOT) {
			path.push(future.index);
			future = future.parent;
		}
		return path;
	};

	function getSlice (stack) {
		var end = stack.indexOf("_stack_end");
		if (end >= 0) {
			end = stack.lastIndexOf("\n", end);
			end = stack.lastIndexOf("\n", end - 1) + 1;
		} else {
			end = undefined;
		}

		var start = stack.indexOf("_stack_start");
		start = stack.indexOf("\n", start) + 1;

		return stack.substring(start, end);
	}

	Future.prototype.getStack = function () {
		var future = this, stack = "";
		while (future !== ROOT) {
			stack += "*** tsync future ***\n";
			stack += getSlice(future.stack.stack);
			future = future.parent;
		}
		return stack;
	};
});
