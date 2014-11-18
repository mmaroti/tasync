# TAsync.js

TAsync is a javascript module to help the development of asynchronous code.
It can be used both with [node.js](http://nodejs.org) or directly in the
browser. TAsync can be characterized as a future/promise library with some
unique features:

* follows stack traces across asynchronous calls
* real and future values can be mixed freely
* execution can be throttled in logical execution time

I use this library to work with a large database backend, where most objects
are cached in memory. In this scenario you do not want to use regular
callbacks, because either you call the callbacks before the methods return
and then you run out of stack space, or you use `nextTick` which kills
the performance. Also, traversing an extremely large tree asynchronously is
hard: if you do it serially (depth first) then it is slow, if you do it
parallel (breadth first) then you run out of memory, so you need a combination
of the two. This (and much more) can be accomplished with the `throttle`
functionality provided by this library.

## Stack trace example

```javascript
var TASYNC = require("tasync");

function divide (x, y) {
	if (y === 0) {
		throw new Error("divide by zero");
	}
	return x / y;
}

function test() {
	var a = TASYNC.delay(100, 1);
	var b = TASYNC.delay(200, 0);
	return TASYNC.call(divide, a, b);
}

TASYNC.trycatch(test, function (error) {
	console.log(error.trace);
});
```

In this example we crate two future values (`a` and `b`) that become
available in 100 and 200 ms, then invoke the `divide` function which
will throw an exception. The future result of the division is
returned from the `test` function. When this value becomes available,
we display the error trace on the console. Running this in node.js
will display the following stack trace where line 15 is pointing to
the return statement and line 7 to the `throw` statement.

```
Error: divide by zero
    at divide (~/tasync/test/teststack.js:7:9)
*** callback ***
    at test (~/tasync/test/teststack.js:15:16)
    at Object.trycatch (~/tasync/lib/tasync.js:435:16)
    at Object.<anonymous> (~/tasync/test/teststack.js:18:8)
    at Module._compile (module.js:441:26)
    at Object..js (module.js:459:10)
    at Module.load (module.js:348:32)
    at Function._load (module.js:308:12)
    at Array.0 (module.js:479:10)
```

## Caching example

```javascript
var fsReadFile = TASYNC.wrap(FS.readFile);
var lastFileName, lastFileData;

function cachedReadFile (fileName) {
	if (fileName === lastFileName) {
		return lastFileData + "\n";
	}

	var futureFileData = fsReadFile(fileName);
	return TASYNC.call(updateCache, fileName, futureFileData);
}

function updateCache (fileName, fileData) {
	lastFileName = fileName;
	lastFileData = fileData;

	return fileData;
}

FS.readFile = TASYNC.unwrap(cachedReadFile);
```

In this example we monkey patch the node.js `FS.readFile` method to cache
the last result and return that (with an extra end line character at the
end) at subsequent calls with the same file name. We first turn a callback
based method `FS.readFile` into a method that returns futures `fsReadFile`.
Notice, that in `cachedReadFile` we either going to return a regular value
or a future value. We can call `fsReadFile` directly, because we are sure
that all parameters are regular values. However, the call to `updateCache`
is done through `TASYNC.call` since it has a parameter that is potentially
a future object. The `TASYNC.call` returns immediately, creating a
new future that will be set when the `updateCache` call is eventually
completed. Finally, we turn our future returning function `cachedReadFile`
into a regular callback based one and monkey patch `FS.readFile`.

## Throttle example

```javascript
var fsReadDir = TASYNC.wrap(FS.readdir);
var fsStat = TASYNC.wrap(FS.lstat);

function readDir (dir) {
	var futureList = fsReadDir(dir);
	return TASYNC.call(processDir, dir, futureList);
}

function processDir (dir, list) {
	for (var i = 0; i < list.length; ++i) {
		var filename = list[i];
		var filepath = dir + "/" + filename;
		var futureStat = fsStat(filepath);
		list[i] = TASYNC.call(processFile, filename, filepath, futureStat);
	}
	return TASYNC.apply(sum, list);
}

function processFile (filename, filepath, stat) {
	if (stat.isDirectory()) {
		return readDir(filepath);
	} else {
		return filename.indexOf(".js", filename.length - 3) !== -1 ? 1 : 0;
	}
}

function sum () {
	var s = 0;
	for (var i = 0; i < arguments.length; ++i) {
		s += arguments[i];
	}
	return s;
}
```

In this example the function `readDir(dir)` will search the given directory
recursively and returns the number of javascript files found. The code is
quite easy to follow (try to write the same with regular callbacks) and
essentially performs a breadth first search. If you run this (or the
equivalent code with callbacks) on a really really large directory, then
you are going to run out of memory since you are creating potentially as
many continuations as the largest breadth of your tree. If you replace
the first line with this

```
var fsReadDir = TASYNC.throttle(TASYNC.wrap(FS.readdir), 5);
```

then you limit the number of concurrently executing `FS.readdir` calls to
five. More importantly, when we select the next `FS.readdir` to be executed
among the blocked ones, you select the directory whose name is the smallest
in lexicographical order. This means, that you are approximating a serial
(depth first) search but still perform up to five parallel calls. All of this
is done by maintaining a tree of the outstanding futures where the
lexicographical order is the logical time order of execution assuming your
code is running sequentially.

Running the serial, parallel, original tasync, and throttled tasync versions
of this program with hot caches we get the following execution times for
the directory `/usr/lib`:

```
serial          996 ms
parallel        244 ms
tasync          348 ms
throttled       320 ms
```

With cold caches (`echo 1 > /proc/sys/vm/drop_caches`), then the
throttled version becomes the fastest:

```
serial          5680 ms
parallel        6533 ms
tasync          6540 ms
throttled       4975 ms
```

# Documentation

Most TAsync functions potentially return future objects. You should never
call methods on these futures, nor should you test for them. Instead,
use `apply` or `call` to invoke further functions when these potential
future objects get resolved. Throwing of exceptions are encouraged and
are properly handled throughout the library.

## delay(timeout, value)

Returns a future value which will be resolved to `value` after `timeout`
milliseconds. If `timeout` is negative, then `value` is returned
immediately.

## apply(func, args, [that])

Calls the `func` function with the `args` array of arguments on the optional
`that` object. If one of the arguments is an unresolved future value, then
this method returns a new future value that will be resolved when all
arguments are resolved and the `func` function is returned. You can chain
futures, that is, `func` can return a future value as well. If any of the
arguments are futures that are rejected, then the returned future will
be rejected with the same error. If all arguments are available (regular
value, or a rejected or resolved future), then `func` will be called
immediately and a regular value is returned or an exception is thrown.

## call(func, arg1, ..., argn)

Same as `apply(func, [arg1,...,argn], null)`.

##  wrap(func)

Takes a node.js style asynchronous function `func` which should be called
with a callback at the last argument, and turns it into a function that returns
futures. In particular, if `func` calls the callback before returning, then
the new function will return a regular object or throw an exception,
otherwise it will return a future object which will be eventually resolved or
rejected.

## unwrap(func)

Takes a function that returns futures, and turns it into a node.js
asynchronous function that takes a callback as the last parameter.

## trycatch(func, handler)

Calls the `func` function with no parameters. If `func` throws an error or
returns a future that is eventually rejected, then `handler(error)` is called.
The result of the method will be the result of `func` if no error occurs,
or the result of `handler(error)` if an error is detected. The `error` object
passed to `handle` is an instance of `Error` and has an extra `error.trace`
field that tracks the function calls across asynchronous calls.

## lift(array)

Takes an array `array` of values and/or futures, and returns a future value
that will be resolved to an array of values when all embedded futures are
resolved. If one of the embedded futures is rejected, then the returned
future will also be rejected.

## throttle(func, limit)

Takes a function `func` that returns futures and turns it into another
function which takes the same set of arguments, but ensues that no more than
`limit` number of instances of `func` are currently running. If this limit
is reached, then further calls of `func` are delayed until one of the
running instances returns. This method chooses that outstanding call to
run next which is earliest in the logical time ordering (i.e. the one
that would be called fist if all asynchronous calls were synchronous).

## join(first, second)

Returns `first`, when both `first` and `second` are resolved. If one of
them are rejected, then that error is returned in the future. Both `first`
and `second` can be regular objects, so this method may return a regular
object, throw an error, or return a future.
