# TAsync.js 

TAsync is a javascript module to help the development of asynchronous code.
It can be both used with [node.js](http://nodejs.org) or directly in the
browser. TAsync can be characterized as a future/promise library with some 
unique features:

* follows stack traces across asynchronous calls
* real and future values can be mixed freely
* execution can be throttled in logical execution time

## Stack trace example

```javascript
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
available in 100 and 200 ms, then invoke the divide function which
will throw an exception. The future result of the division is
return from the `test` function. When this value becomes available 
then we display the error trace on the console. Running this in node.js
 ill display a stack trace where line 15 would be pointing to the return 
statement and line 7 would point to the `throw` statement.

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
var fsReadFile = TASYNC.adapt(FS.readFile);
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

FS.readFile = TASYNC.unadapt(cachedReadFile);
```

In this example we monkey patch the node.js `FS.readFile` method to cache
the last result and return that (with an extra end line character at the
end) at subsequent calls with the same file name. we first turn a callback
based method `FS.readFile` into a method that returns futures `fsReadFile`.
Notice, that in `cachedReadFile` we either going to return a regular value
or a future value. We can call `fsReadFile` directly, because we are sure
that all parameters are regular values. However, the call to `updateCache`
is done through `TASYNC.apply` since it has a parameter that is potentially
a future object. The `TASYNC.apply` call returns immediatelly, creating a
new future that will be set when the `updateCache` call is eventually
completed. Finally, we turn our future returning function `cachedReadFile`
into a regular callback based one and monkey patch `FS.readFile`. 
