import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom returns all-zero rects; provide a stable non-zero default so
// percentage calculations in resolveAnchor tests produce meaningful values.
Element.prototype.getBoundingClientRect = function () {
  return {
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
  } as DOMRect;
};
