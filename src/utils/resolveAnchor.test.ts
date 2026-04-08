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

    // Must contain ">" separators and recognizable tag names
    expect(result.selector).toMatch(/>/);
    expect(result.selector).toMatch(/\bmain\b/);
    expect(result.selector).toMatch(/\bsection\b/);

    container.remove();
  });

  it("computes percentages relative to anchor bounding box", () => {
    const el = document.createElement("div");
    el.id = "box";
    document.body.appendChild(el);

    // mock rect: left=0, top=0, width=200, height=100
    // click at (100, 50) => xPercent=50, yPercent=50
    const result = resolveAnchor(el, 100, 50);

    expect(result.selector).toBe("#box");
    expect(result.xPercent).toBeCloseTo(50, 1);
    expect(result.yPercent).toBeCloseTo(50, 1);

    el.remove();
  });

  it("uses data-cy selector when element has only data-cy", () => {
    const el = document.createElement("div");
    el.setAttribute("data-cy", "submit-btn");
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const result = resolveAnchor(el, rect.left, rect.top);

    expect(result.selector).toBe('[data-cy="submit-btn"]');

    el.remove();
  });

  it("uses arbitrary data-* selector when element has only a custom data attr", () => {
    const el = document.createElement("div");
    el.setAttribute("data-foo", "bar");
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    const result = resolveAnchor(el, rect.left, rect.top);

    expect(result.selector).toBe('[data-foo="bar"]');

    el.remove();
  });
});
