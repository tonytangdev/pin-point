import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PinMarker } from "./PinMarker";

describe("PinMarker", () => {
  it("renders with the given number", () => {
    render(<PinMarker number={1} top={100} left={200} onClick={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("positions at top/left", () => {
    render(<PinMarker number={1} top={100} left={200} onClick={() => {}} />);
    const pin = screen.getByText("1");
    expect(pin.style.top).toBe("100px");
    expect(pin.style.left).toBe("200px");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<PinMarker number={1} top={100} left={200} onClick={onClick} />);
    fireEvent.click(screen.getByText("1"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
