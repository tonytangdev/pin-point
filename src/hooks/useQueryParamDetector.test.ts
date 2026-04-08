import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQueryParamDetector } from "./useQueryParamDetector";

describe("useQueryParamDetector", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("returns false when query param is absent", () => {
    const { result } = renderHook(() => useQueryParamDetector("feedback"));
    expect(result.current).toBe(false);
  });

  it("returns true when query param is present", () => {
    window.history.replaceState({}, "", "/?feedback=true");
    const { result } = renderHook(() => useQueryParamDetector("feedback"));
    expect(result.current).toBe(true);
  });

  it("uses custom param name", () => {
    window.history.replaceState({}, "", "/?review=true");
    const { result } = renderHook(() => useQueryParamDetector("review"));
    expect(result.current).toBe(true);
  });

  it("returns false when param has no value", () => {
    window.history.replaceState({}, "", "/?feedback");
    const { result } = renderHook(() => useQueryParamDetector("feedback"));
    expect(result.current).toBe(false);
  });
});
