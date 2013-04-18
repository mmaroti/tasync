# TAsync.js 

TAsync is a javascript module to help the development of asynchronous code.
It can be both used with [node.js](http://nodejs.org) or directly in the
browser.

TAsync can be characterized as a future/promise library with some unique
features:

* stack traces across asynchronous calls
* ordering in logical execution time 

## Quick example

```javascript
function divide (x, y) {
	if (y === 0) {
		throw new Error("divide by zero");
	}
	return x / y;
}

var a = TASYNC.delay(100, 1);
var b = TASYNC.delay(200, 0);
var c = TASYNC.apply(divide, [ a, b ]);

TASYNC.then(c, function (error, value) {
	console.log(error.trace);
});
```

In this example we crate two future values (`a` and `b`) that becomes 
available in 100 and 200 ms, then invoke the divide function which
will throw a divide by zero exception. The result of the division is
stored in `c`. When this value becomes available then we display the
error trace on the console. Running this in node.js you should see
a stack trace similar to this where line 15 would be pointing to the
variable assignment to `c` and line 8 would point to the `throw` 
statement.

```
Error: divide by zero
    at divide (~/tasync/test/teststack.js:8:10)
*** callback ***
    at test (~/tasync/test/teststack.js:15:17)
    at Object.<anonymous> (~/tasync/test/teststack.js:23:1)
    at Module._compile (module.js:441:26)
    at Object..js (module.js:459:10)
    at Module.load (module.js:348:32)
    at Function._load (module.js:308:12)
    at Array.0 (module.js:479:10)
    at EventEmitter._tickCallback (node.js:192:41)
```
