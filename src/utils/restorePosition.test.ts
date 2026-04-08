import { describe, it, expect } from "vitest";
import { restorePosition } from "./restorePosition";
import type { AnchorData } from "../types";

describe("restorePosition", () => {
  it("returns position for a valid selector", () => {
    const el = document.createElement("div");
    el.id = "target";
    document.body.appendChild(el);

    const anchor: AnchorData = {
      selector: "#target",
      xPercent: 50,
      yPercent: 50,
    };

    const result = restorePosition(anchor);

    expect(result).not.toBeNull();
    expect(typeof result!.top).toBe("number");
    expect(typeof result!.left).toBe("number");

    el.remove();
  });

  it("returns null when selector doesn't match any element", () => {
    const anchor: AnchorData = {
      selector: "#nonexistent",
      xPercent: 50,
      yPercent: 50,
    };

    const result = restorePosition(anchor);

    expect(result).toBeNull();
  });

  it("returns null for empty selector", () => {
    const anchor: AnchorData = {
      selector: "",
      xPercent: 50,
      yPercent: 50,
    };

    const result = restorePosition(anchor);

    expect(result).toBeNull();
  });
});
