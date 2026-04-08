import type { AnchorData } from "../types";

export function restorePosition(
  anchor: AnchorData
): { top: number; left: number } | null {
  if (!anchor.selector) {
    return null;
  }

  let el: Element | null;
  try {
    el = document.querySelector(anchor.selector);
  } catch {
    return null;
  }

  if (!el) {
    return null;
  }

  const rect = el.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const left = rect.left + scrollX + (rect.width * anchor.xPercent) / 100;
  const top = rect.top + scrollY + (rect.height * anchor.yPercent) / 100;

  return { top, left };
}
