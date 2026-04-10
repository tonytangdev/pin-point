import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackOverlay } from "./FeedbackOverlay";
import type { PinComment } from "./types";

const mockComment: PinComment = {
	id: "1",
	url: "/",
	content: "Fix this heading",
	anchor: { selector: "#test", xPercent: 50, yPercent: 50 },
	viewport: { width: 1440 },
	createdAt: "2026-04-08T12:00:00Z",
};

const enterPinMode = () => {
	fireEvent.click(screen.getByRole("button", { name: "Leave feedback" }));
};

describe("FeedbackOverlay", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/");
		// Make elementFromPoint return a real element so handleClick doesn't bail
		document.elementFromPoint = vi.fn().mockReturnValue(document.body);
		// Deterministic UUID
		vi.spyOn(crypto, "randomUUID").mockReturnValue(
			"test-uuid-0000-0000-0000-000000000000",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
		window.history.replaceState({}, "", "/");
		// @ts-expect-error reset jsdom stub
		delete document.elementFromPoint;
	});

	describe("gating by role", () => {
		it("anonymous: toolbar visible but comment button disabled", () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			expect(screen.getByText("My App")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Leave feedback" }),
			).toBeDisabled();
		});

		it("anonymous: click intercept layer not rendered", () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			expect(document.querySelector(".pp-intercept")).not.toBeInTheDocument();
		});

		it("tokenHolder: clicking comment button enables pin mode (click intercept renders)", async () => {
			window.history.replaceState({}, "", "/?pin-token=ft_test");

			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			expect(document.querySelector(".pp-intercept")).not.toBeInTheDocument();

			enterPinMode();

			await waitFor(() => {
				expect(document.querySelector(".pp-intercept")).toBeInTheDocument();
			});
		});
	});

	describe("interaction (token holder)", () => {
		beforeEach(() => {
			window.history.replaceState({}, "", "/?pin-token=ft_test");
		});

		it("click-to-pin: clicking intercept layer creates pending pin", async () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			enterPinMode();

			const intercept = document.querySelector(".pp-intercept") as HTMLElement;
			fireEvent.click(intercept, { clientX: 100, clientY: 200 });

			await waitFor(() => {
				expect(
					screen.getByPlaceholderText("Leave your feedback..."),
				).toBeInTheDocument();
			});
		});

		it("submit flow: calls onCommentCreate with comment + auth headers", async () => {
			const onCommentCreate = vi.fn(async () => {});

			render(
				<FeedbackOverlay
					onCommentCreate={onCommentCreate}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			enterPinMode();

			const intercept = document.querySelector(".pp-intercept") as HTMLElement;
			fireEvent.click(intercept, { clientX: 100, clientY: 200 });

			await waitFor(() =>
				expect(
					screen.getByPlaceholderText("Leave your feedback..."),
				).toBeInTheDocument(),
			);

			const textarea = screen.getByPlaceholderText("Leave your feedback...");
			fireEvent.change(textarea, { target: { value: "Great work!" } });

			fireEvent.click(screen.getByText("Submit"));

			await waitFor(() => {
				expect(onCommentCreate).toHaveBeenCalledOnce();
				expect(onCommentCreate).toHaveBeenCalledWith(
					expect.objectContaining({ content: "Great work!" }),
					{ "X-Pin-Token": "ft_test" },
				);
				// Popover dismissed after submit
				expect(
					screen.queryByPlaceholderText("Leave your feedback..."),
				).not.toBeInTheDocument();
			});
		});

		it("pin mode exits after successful submit", async () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			enterPinMode();

			expect(document.querySelector(".pp-intercept")).toBeInTheDocument();

			const intercept = document.querySelector(".pp-intercept") as HTMLElement;
			fireEvent.click(intercept, { clientX: 100, clientY: 200 });

			await waitFor(() =>
				expect(
					screen.getByPlaceholderText("Leave your feedback..."),
				).toBeInTheDocument(),
			);

			const textarea = screen.getByPlaceholderText("Leave your feedback...");
			fireEvent.change(textarea, { target: { value: "Great work!" } });
			fireEvent.click(screen.getByText("Submit"));

			await waitFor(() => {
				expect(document.querySelector(".pp-intercept")).not.toBeInTheDocument();
			});
		});

		it("cancel flow: clicking Cancel removes pending pin", async () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			enterPinMode();

			const intercept = document.querySelector(".pp-intercept") as HTMLElement;
			fireEvent.click(intercept, { clientX: 100, clientY: 200 });

			await waitFor(() =>
				expect(
					screen.getByPlaceholderText("Leave your feedback..."),
				).toBeInTheDocument(),
			);

			fireEvent.click(screen.getByText("Cancel"));

			await waitFor(() => {
				expect(
					screen.queryByPlaceholderText("Leave your feedback..."),
				).not.toBeInTheDocument();
			});
		});

		it("pin toggle: clicking existing pin shows read popover, clicking again hides it", async () => {
			const target = document.createElement("div");
			target.id = "test";
			document.body.appendChild(target);

			vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
				top: 100,
				left: 100,
				width: 200,
				height: 50,
				bottom: 150,
				right: 300,
				x: 100,
				y: 100,
				toJSON: () => {},
			} as DOMRect);

			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => [mockComment]}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			let pinMarker!: HTMLElement;
			await waitFor(() => {
				pinMarker = document.querySelector(".pp-pin") as HTMLElement;
				expect(pinMarker).toBeInTheDocument();
			});

			fireEvent.click(pinMarker);

			await waitFor(() => {
				expect(screen.getByText("Fix this heading")).toBeInTheDocument();
			});

			fireEvent.click(pinMarker);

			await waitFor(() => {
				expect(screen.queryByText("Fix this heading")).not.toBeInTheDocument();
			});

			target.remove();
		});

		it("delete flow: clicking delete removes comment from state", async () => {
			const target = document.createElement("div");
			target.id = "test";
			document.body.appendChild(target);

			vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
				top: 100,
				left: 100,
				width: 200,
				height: 50,
				bottom: 150,
				right: 300,
				x: 100,
				y: 100,
				toJSON: () => {},
			} as DOMRect);

			const onCommentDelete = vi.fn(async () => {});
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => [mockComment]}
					onCommentDelete={onCommentDelete}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			let pinMarker!: HTMLElement;
			await waitFor(() => {
				pinMarker = document.querySelector(".pp-pin") as HTMLElement;
				expect(pinMarker).toBeInTheDocument();
			});

			fireEvent.click(pinMarker);
			await waitFor(() => {
				expect(screen.getByText("Fix this heading")).toBeInTheDocument();
			});

			fireEvent.click(screen.getByLabelText("Delete"));
			fireEvent.click(screen.getByText("Delete"));

			await waitFor(() => {
				expect(document.querySelector(".pp-pin")).not.toBeInTheDocument();
				expect(screen.queryByText("Fix this heading")).not.toBeInTheDocument();
			});

			expect(onCommentDelete).toHaveBeenCalledWith("1", {
				"X-Pin-Token": "ft_test",
			});

			target.remove();
		});

		it("update flow: editing updates comment in state", async () => {
			const target = document.createElement("div");
			target.id = "test";
			document.body.appendChild(target);

			vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
				top: 100,
				left: 100,
				width: 200,
				height: 50,
				bottom: 150,
				right: 300,
				x: 100,
				y: 100,
				toJSON: () => {},
			} as DOMRect);

			const updatedComment = { ...mockComment, content: "Updated heading" };
			const onCommentUpdate = vi.fn(async () => updatedComment);
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => [mockComment]}
					onCommentUpdate={onCommentUpdate}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			let pinMarker!: HTMLElement;
			await waitFor(() => {
				pinMarker = document.querySelector(".pp-pin") as HTMLElement;
				expect(pinMarker).toBeInTheDocument();
			});

			fireEvent.click(pinMarker);
			await waitFor(() => {
				expect(screen.getByText("Fix this heading")).toBeInTheDocument();
			});

			fireEvent.click(screen.getByLabelText("Edit"));
			const textarea = screen.getByDisplayValue("Fix this heading");
			fireEvent.change(textarea, { target: { value: "Updated heading" } });
			fireEvent.click(screen.getByText("Save"));

			await waitFor(() => {
				expect(screen.getByText("Updated heading")).toBeInTheDocument();
				expect(
					screen.queryByDisplayValue("Updated heading"),
				).not.toBeInTheDocument();
			});

			expect(onCommentUpdate).toHaveBeenCalledWith("1", "Updated heading", {
				"X-Pin-Token": "ft_test",
			});

			target.remove();
		});
	});

	it("renders children and toolbar regardless of role", () => {
		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => []}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		expect(screen.getByText("My App")).toBeInTheDocument();
		// Toolbar always visible
		expect(
			screen.getByRole("button", { name: "Leave feedback" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Enter admin key" }),
		).toBeInTheDocument();
	});

	it("loads and displays existing comments", async () => {
		const target = document.createElement("div");
		target.id = "test";
		document.body.appendChild(target);

		vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
			top: 100,
			left: 100,
			width: 200,
			height: 50,
			bottom: 150,
			right: 300,
			x: 100,
			y: 100,
			toJSON: () => {},
		} as DOMRect);

		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => [mockComment]}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		await waitFor(() => {
			expect(document.querySelector(".pp-pin")).toBeInTheDocument();
		});

		target.remove();
	});

	it("shows error in toolbar when fetch fails", async () => {
		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => {
					throw new Error("fail");
				}}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		await waitFor(() => {
			expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument();
		});
	});

	describe("admin features", () => {
		beforeEach(() => {
			localStorage.setItem("pin-admin-key", "secret");
		});

		it("admin: share button rendered in toolbar when onShareLinkCreate provided", () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
					onShareLinkCreate={async () => ({ tokenId: "ft_x" })}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			expect(
				screen.getByRole("button", { name: /Share for feedback/i }),
			).toBeInTheDocument();
		});

		it("admin: share button NOT rendered if onShareLinkCreate not provided", () => {
			render(
				<FeedbackOverlay
					onCommentCreate={async () => {}}
					onCommentsFetch={async () => []}
				>
					<div>My App</div>
				</FeedbackOverlay>,
			);

			expect(
				screen.queryByRole("button", { name: /Share for feedback/i }),
			).not.toBeInTheDocument();
		});
	});

	it("clicking key icon opens admin modal", async () => {
		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => []}
				onAdminValidate={async () => true}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Enter admin key" }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
			expect(screen.getByText("Enter admin key")).toBeInTheDocument();
		});
	});
});
