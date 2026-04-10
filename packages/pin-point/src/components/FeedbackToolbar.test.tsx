import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PinAuth } from "../types";
import { FeedbackToolbar } from "./FeedbackToolbar";

const anonymous: PinAuth = { role: "anonymous" };
const tokenHolder: PinAuth = { role: "tokenHolder", token: "ft_test" };
const admin: PinAuth = { role: "admin", secret: "secret" };

const baseProps = {
	commentCount: 0,
	pinModeActive: false,
	onPinModeToggle: () => {},
	onAdminKeyOpen: () => {},
};

describe("FeedbackToolbar", () => {
	it("anonymous: comment button disabled", () => {
		render(<FeedbackToolbar {...baseProps} auth={anonymous} />);
		const commentBtn = screen.getByRole("button", { name: "Leave feedback" });
		expect(commentBtn).toBeDisabled();
	});

	it("tokenHolder: comment button enabled, no share button", () => {
		render(<FeedbackToolbar {...baseProps} auth={tokenHolder} />);
		const commentBtn = screen.getByRole("button", { name: "Leave feedback" });
		expect(commentBtn).not.toBeDisabled();
		expect(
			screen.queryByRole("button", { name: /Share for feedback/i }),
		).not.toBeInTheDocument();
	});

	it("admin: share button rendered from prop", () => {
		render(
			<FeedbackToolbar
				{...baseProps}
				auth={admin}
				shareButton={<button type="button">Share for feedback</button>}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Share for feedback" }),
		).toBeInTheDocument();
	});

	it("clicking key icon calls onAdminKeyOpen", () => {
		const onAdminKeyOpen = vi.fn();
		render(
			<FeedbackToolbar
				{...baseProps}
				auth={anonymous}
				onAdminKeyOpen={onAdminKeyOpen}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Enter admin key" }));
		expect(onAdminKeyOpen).toHaveBeenCalledOnce();
	});

	it("clicking comment button calls onPinModeToggle", () => {
		const onPinModeToggle = vi.fn();
		render(
			<FeedbackToolbar
				{...baseProps}
				auth={tokenHolder}
				onPinModeToggle={onPinModeToggle}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Leave feedback" }));
		expect(onPinModeToggle).toHaveBeenCalledOnce();
	});

	it("aria-pressed reflects pinModeActive", () => {
		const { rerender } = render(
			<FeedbackToolbar
				{...baseProps}
				auth={tokenHolder}
				pinModeActive={false}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Leave feedback" }),
		).toHaveAttribute("aria-pressed", "false");

		rerender(
			<FeedbackToolbar
				{...baseProps}
				auth={tokenHolder}
				pinModeActive={true}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Leave feedback" }),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("shows comment count", () => {
		render(
			<FeedbackToolbar {...baseProps} auth={tokenHolder} commentCount={3} />,
		);
		expect(screen.getByText("3 comments")).toBeInTheDocument();
	});

	it("shows singular for 1 comment", () => {
		render(
			<FeedbackToolbar {...baseProps} auth={tokenHolder} commentCount={1} />,
		);
		expect(screen.getByText("1 comment")).toBeInTheDocument();
	});

	it("shows error message when provided", () => {
		render(
			<FeedbackToolbar
				{...baseProps}
				auth={tokenHolder}
				error="Couldn't load comments."
			/>,
		);
		expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument();
	});
});
