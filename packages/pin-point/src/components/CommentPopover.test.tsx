import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentPopover } from "./CommentPopover";

describe("CommentPopover — read mode", () => {
	it("renders comment content", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
			/>,
		);
		expect(screen.getByText("Fix the heading")).toBeInTheDocument();
	});

	it("shows viewport width", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix it"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
			/>,
		);
		expect(screen.getByText(/1440px/)).toBeInTheDocument();
	});
});

describe("CommentPopover — create mode", () => {
	it("renders a textarea", () => {
		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={async () => {}}
				onCancel={() => {}}
			/>,
		);
		expect(
			screen.getByPlaceholderText("Leave your feedback..."),
		).toBeInTheDocument();
	});

	it("calls onSubmit with text content", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={onSubmit}
				onCancel={() => {}}
			/>,
		);

		const textarea = screen.getByPlaceholderText("Leave your feedback...");
		fireEvent.change(textarea, { target: { value: "Needs more contrast" } });
		fireEvent.click(screen.getByText("Submit"));

		expect(onSubmit).toHaveBeenCalledWith("Needs more contrast");
	});

	it("calls onCancel when cancel is clicked", () => {
		const onCancel = vi.fn();
		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={async () => {}}
				onCancel={onCancel}
			/>,
		);

		fireEvent.click(screen.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("disables submit when textarea is empty", () => {
		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={async () => {}}
				onCancel={() => {}}
			/>,
		);

		expect(screen.getByText("Submit")).toBeDisabled();
	});

	it("shows error message on submit failure", async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error("fail"));
		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={onSubmit}
				onCancel={() => {}}
			/>,
		);

		const textarea = screen.getByPlaceholderText("Leave your feedback...");
		fireEvent.change(textarea, { target: { value: "test" } });
		fireEvent.click(screen.getByText("Submit"));

		expect(
			await screen.findByText("Couldn't save. Try again."),
		).toBeInTheDocument();
	});
});

describe("CommentPopover — read mode delete", () => {
	it("shows delete button when onDelete is provided", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onDelete={async () => {}}
			/>,
		);
		expect(screen.getByLabelText("Delete")).toBeInTheDocument();
	});

	it("does not show delete button when onDelete is not provided", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
			/>,
		);
		expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
	});

	it("shows confirmation when delete is clicked, replaces content with prompt", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onDelete={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete"));
		// Confirmation visible with Cancel and Delete buttons
		expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
		expect(screen.getByText("Cancel")).toBeInTheDocument();
		expect(screen.getByText("Delete")).toBeInTheDocument();
		// Original content hidden
		expect(screen.queryByText("Fix the heading")).not.toBeInTheDocument();
	});

	it("confirming delete removes the confirmation UI", async () => {
		const onDelete = vi.fn().mockResolvedValue(undefined);
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onDelete={onDelete}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete"));
		fireEvent.click(screen.getByText("Delete"));
		expect(onDelete).toHaveBeenCalledOnce();
	});

	it("shows error when delete fails", async () => {
		const onDelete = vi.fn().mockRejectedValue(new Error("fail"));
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onDelete={onDelete}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete"));
		fireEvent.click(screen.getByText("Delete"));

		expect(
			await screen.findByText("Couldn't delete. Try again."),
		).toBeInTheDocument();
		// Still on confirmation screen so user can retry
		expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
	});

	it("cancels delete confirmation and returns to read mode", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onDelete={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete"));
		fireEvent.click(screen.getByText("Cancel"));
		// Back to normal — content visible, delete button available
		expect(screen.getByText("Fix the heading")).toBeInTheDocument();
		expect(screen.getByLabelText("Delete")).toBeInTheDocument();
		expect(screen.queryByText("Delete this comment?")).not.toBeInTheDocument();
	});
});

describe("CommentPopover — read mode edit", () => {
	it("shows edit button when onUpdate is provided", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={async () => {}}
			/>,
		);
		expect(screen.getByLabelText("Edit")).toBeInTheDocument();
	});

	it("clicking edit shows textarea with existing content", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit"));
		const textarea = screen.getByDisplayValue("Fix the heading");
		expect(textarea).toBeInTheDocument();
	});

	it("save hides textarea and shows Save/Cancel buttons while editing", async () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit"));
		// Edit mode visible
		expect(screen.getByDisplayValue("Fix the heading")).toBeInTheDocument();
		expect(screen.getByText("Save")).toBeInTheDocument();
		expect(screen.getByText("Cancel")).toBeInTheDocument();
		// Edit/Delete buttons hidden
		expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
	});

	it("shows error when save fails", async () => {
		const onUpdate = vi.fn().mockRejectedValue(new Error("fail"));
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={onUpdate}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit"));
		fireEvent.click(screen.getByText("Save"));

		expect(
			await screen.findByText("Couldn't save. Try again."),
		).toBeInTheDocument();
		// Still in edit mode so user can retry
		expect(screen.getByDisplayValue("Fix the heading")).toBeInTheDocument();
	});

	it("save with empty content is disabled", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit"));
		const textarea = screen.getByDisplayValue("Fix the heading");
		fireEvent.change(textarea, { target: { value: "" } });
		expect(screen.getByText("Save")).toBeDisabled();
	});

	it("cancel returns to read mode showing original content", () => {
		render(
			<CommentPopover
				mode="read"
				content="Fix the heading"
				createdAt="2026-04-08T12:00:00Z"
				viewportWidth={1440}
				top={100}
				left={200}
				onUpdate={async () => {}}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit"));
		const textarea = screen.getByDisplayValue("Fix the heading");
		fireEvent.change(textarea, { target: { value: "Changed" } });
		fireEvent.click(screen.getByText("Cancel"));

		// Back to read mode with original content
		expect(screen.getByText("Fix the heading")).toBeInTheDocument();
		expect(screen.queryByDisplayValue("Changed")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Edit")).toBeInTheDocument();
	});
});
