import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareLinkButton } from "./ShareLinkButton";

describe("ShareLinkButton", () => {
	beforeEach(() => {
		Object.assign(navigator, {
			clipboard: { writeText: vi.fn(async () => {}) },
		});
		window.history.replaceState({}, "", "/test-page");
	});

	it("renders Share button", () => {
		render(<ShareLinkButton onCreate={async () => ({ tokenId: "ft_x" })} />);
		expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
	});

	it("click calls onCreate and copies URL with token to clipboard", async () => {
		const onCreate = vi.fn(async () => ({ tokenId: "ft_abc" }));
		render(<ShareLinkButton onCreate={onCreate} />);
		fireEvent.click(screen.getByRole("button", { name: /share/i }));
		await waitFor(() => {
			expect(onCreate).toHaveBeenCalled();
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				expect.stringContaining("pin-token=ft_abc"),
			);
		});
	});

	it("shows copied toast after copy", async () => {
		render(<ShareLinkButton onCreate={async () => ({ tokenId: "ft_x" })} />);
		fireEvent.click(screen.getByRole("button", { name: /share/i }));
		await waitFor(() => {
			expect(screen.getByText(/copied/i)).toBeInTheDocument();
		});
	});
});
