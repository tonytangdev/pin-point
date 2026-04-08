import { describe, it, expect } from "vitest";
import { resolveAnchor } from "./resolveAnchor";

describe("resolveAnchor", () => {
  it("returns id selector when clicked element has an id", () => {
    const el = document.createElement("div");
    el.id = "hero";
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const clickX = rect.left + rect.width * 0.5;
    const clickY = rect.top + rect.height * 0.5;

    const result = resolveAnchor(el, clickX, clickY);

    expect(result.selector).toBe("#hero");
    expect(result.xPercent).toBeCloseTo(50, 0);
    expect(result.yPercent).toBeCloseTo(50, 0);

    el.remove();
  });

  it("walks up to nearest ancestor with id", () => {
    const parent = document.createElement("div");
    parent.id = "parent";
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);

    const rect = parent.getBoundingClientRect();
    const clickX = rect.left + rect.width * 0.25;
    const clickY = rect.top + rect.height * 0.25;

    const result = resolveAnchor(child, clickX, clickY);

    expect(result.selector).toBe("#parent");
    expect(result.xPercent).toBeCloseTo(25, 0);
    expect(result.yPercent).toBeCloseTo(25, 0);

    parent.remove();
  });

  it("uses data-testid when no id found", () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "cta-section");
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const result = resolveAnchor(el, rect.left, rect.top);

    expect(result.selector).toBe('[data-testid="cta-section"]');

    el.remove();
  });

  it("prefers data-testid over data-cy", () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "primary");
    el.setAttribute("data-cy", "secondary");
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const result = resolveAnchor(el, rect.left, rect.top);

    expect(result.selector).toBe('[data-testid="primary"]');

    el.remove();
  });

  it("falls back to structural path when no id or data attr", () => {
    const container = document.createElement("main");
    const section = document.createElement("section");
    container.appendChild(section);
    document.body.appendChild(container);

    const rect = section.getBoundingClientRect();
    const result = resolveAnchor(section, rect.left, rect.top);

    expect(result.selector).toMatch(/main|section/);

    container.remove();
  });

  it("computes percentages relative to anchor bounding box", () => {
    const el = document.createElement("div");
    el.id = "box";
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const result = resolveAnchor(el, rect.left, rect.top);

    expect(result.selector).toBe("#box");
    expect(typeof result.xPercent).toBe("number");
    expect(typeof result.yPercent).toBe("number");

    el.remove();
  });
});
