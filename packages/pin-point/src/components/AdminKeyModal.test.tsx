import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminKeyModal } from "./AdminKeyModal";

describe("AdminKeyModal", () => {
	const baseProps = {
		onValidate: async () => true,
		onSuccess: () => {},
		onClose: () => {},
	};

	it("renders input and Save button", () => {
		render(<AdminKeyModal {...baseProps} />);
		expect(screen.getByPlaceholderText(/admin key/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
	});

	it("calls onValidate then onSuccess with valid key", async () => {
		const onValidate = vi.fn(async () => true);
		const onSuccess = vi.fn();
		render(
			<AdminKeyModal
				{...baseProps}
				onValidate={onValidate}
				onSuccess={onSuccess}
			/>,
		);
		fireEvent.change(screen.getByPlaceholderText(/admin key/i), {
			target: { value: "test-secret" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save/i }));
		await waitFor(() => {
			expect(onValidate).toHaveBeenCalledWith("test-secret");
			expect(onSuccess).toHaveBeenCalledWith("test-secret");
		});
	});

	it("shows error and does NOT call onSuccess when validation fails", async () => {
		const onSuccess = vi.fn();
		render(
			<AdminKeyModal
				{...baseProps}
				onValidate={async () => false}
				onSuccess={onSuccess}
			/>,
		);
		fireEvent.change(screen.getByPlaceholderText(/admin key/i), {
			target: { value: "wrong" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save/i }));
		await waitFor(() => {
			expect(screen.getByText(/invalid/i)).toBeInTheDocument();
			expect(onSuccess).not.toHaveBeenCalled();
		});
	});

	it("Cancel calls onClose", () => {
		const onClose = vi.fn();
		render(<AdminKeyModal {...baseProps} onClose={onClose} />);
		fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalled();
	});

	it("Save button disabled when input empty", () => {
		render(<AdminKeyModal {...baseProps} />);
		expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
	});
});
