import type { AnchorData } from "../types";

const DATA_ATTR_PRIORITY = ["data-testid", "data-cy"];

function findAnchorElement(element: Element): { el: Element; selector: string } {
  // 1. Check clicked element for id
  if (element.id) {
    return { el: element, selector: `#${CSS.escape(element.id)}` };
  }

  // 2. Walk up to nearest ancestor with id
  let current = element.parentElement;
  while (current && current !== document.body) {
    if (current.id) {
      return { el: current, selector: `#${CSS.escape(current.id)}` };
    }
    current = current.parentElement;
  }

  // 3. Check element and ancestors for data attributes
  current = element as HTMLElement;
  while (current && current !== document.body) {
    for (const attr of DATA_ATTR_PRIORITY) {
      const value = current.getAttribute(attr);
      if (value) {
        return { el: current, selector: `[${attr}="${CSS.escape(value)}"]` };
      }
    }
    // Check any other data-* attribute
    for (const attr of current.getAttributeNames()) {
      if (attr.startsWith("data-") && !DATA_ATTR_PRIORITY.includes(attr)) {
        const value = current.getAttribute(attr)!;
        return { el: current, selector: `[${attr}="${CSS.escape(value)}"]` };
      }
    }
    current = current.parentElement as HTMLElement;
  }

  // 4. Fallback: structural path (max 3 levels)
  return { el: element, selector: buildStructuralSelector(element) };
}

function buildStructuralSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && current !== document.body && depth < 3) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;

    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }

    current = parent;
    depth++;
  }

  return parts.join(" > ");
}

function computePercentages(
  anchorEl: Element,
  clickX: number,
  clickY: number
): { xPercent: number; yPercent: number } {
  const rect = anchorEl.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;

  const xPercent = ((clickX - rect.left) / width) * 100;
  const yPercent = ((clickY - rect.top) / height) * 100;

  return { xPercent, yPercent };
}

export function resolveAnchor(
  element: Element,
  clickX: number,
  clickY: number
): AnchorData {
  const { el, selector } = findAnchorElement(element);
  const { xPercent, yPercent } = computePercentages(el, clickX, clickY);

  return { selector, xPercent, yPercent };
}
