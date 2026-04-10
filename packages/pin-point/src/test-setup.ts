import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 22+ ships a stub `globalThis.localStorage` (a web-storage accessor
// that no-ops without `--localstorage-file`). When vitest's jsdom environment
// mirrors `globalThis` onto `window`, that broken stub shadows jsdom's real
// Storage. Re-bind to the jsdom instance via the `jsdom` global that vitest
// attaches to expose the working Storage implementation.
const jsdomInstance = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (jsdomInstance?.window?.localStorage) {
	Object.defineProperty(globalThis, "localStorage", {
		value: jsdomInstance.window.localStorage,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(globalThis, "sessionStorage", {
		value: jsdomInstance.window.sessionStorage,
		configurable: true,
		writable: true,
	});
}

afterEach(cleanup);

// jsdom returns all-zero rects; provide a stable non-zero default so
// percentage calculations in resolveAnchor tests produce meaningful values.
Element.prototype.getBoundingClientRect = () =>
	({
		left: 0,
		top: 0,
		right: 200,
		bottom: 100,
		width: 200,
		height: 100,
		x: 0,
		y: 0,
		toJSON() {
			return this;
		},
	}) as DOMRect;
