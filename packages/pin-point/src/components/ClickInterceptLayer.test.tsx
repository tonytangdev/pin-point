import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClickInterceptLayer } from "./ClickInterceptLayer";

describe("ClickInterceptLayer", () => {
	it("renders a full-screen overlay", () => {
		const { container } = render(<ClickInterceptLayer onClick={() => {}} />);
		const layer = container.querySelector(".pp-intercept");
		expect(layer).toBeInTheDocument();
	});

	it("calls onClick with click coordinates", () => {
		const onClick = vi.fn();
		const { container } = render(<ClickInterceptLayer onClick={onClick} />);
		const layer = container.querySelector(".pp-intercept") as HTMLElement;

		fireEvent.click(layer, { clientX: 150, clientY: 250 });

		expect(onClick).toHaveBeenCalledOnce();
		expect(onClick.mock.calls[0][0]).toBe(150);
		expect(onClick.mock.calls[0][1]).toBe(250);
	});

	it("debounces rapid clicks", () => {
		const onClick = vi.fn();
		const { container } = render(<ClickInterceptLayer onClick={onClick} />);
		const layer = container.querySelector(".pp-intercept") as HTMLElement;

		fireEvent.click(layer, { clientX: 100, clientY: 100 });
		fireEvent.click(layer, { clientX: 200, clientY: 200 });

		expect(onClick).toHaveBeenCalledOnce();
	});
});
