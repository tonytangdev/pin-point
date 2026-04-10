import type React from "react";
import type { PinAuth } from "../types";

type FeedbackToolbarProps = {
	auth: PinAuth;
	commentCount: number;
	pinModeActive: boolean;
	onPinModeToggle: () => void;
	onAdminKeyOpen: () => void;
	shareButton?: React.ReactNode;
	error?: string;
};

export function FeedbackToolbar({
	auth,
	commentCount,
	pinModeActive,
	onPinModeToggle,
	onAdminKeyOpen,
	shareButton,
	error,
}: FeedbackToolbarProps) {
	const commentDisabled = auth.role === "anonymous";
	const commentTitle = commentDisabled
		? "Sign in with a share link to leave feedback"
		: pinModeActive
			? "Exit pin mode"
			: "Leave feedback";

	return (
		<div className="pp-toolbar">
			<div className="pp-toolbar-dot" />
			<button
				type="button"
				className="pp-toolbar-btn"
				onClick={onPinModeToggle}
				disabled={commentDisabled}
				aria-pressed={pinModeActive}
				aria-label="Leave feedback"
				title={commentTitle}
			>
				<span aria-hidden="true">💬</span>
			</button>
			<button
				type="button"
				className="pp-toolbar-btn"
				onClick={onAdminKeyOpen}
				aria-label="Enter admin key"
				title="Enter admin key"
			>
				<span aria-hidden="true">🔑</span>
			</button>
			{shareButton}
			{error ? (
				<span className="pp-toolbar-error">{error}</span>
			) : (
				<span className="pp-toolbar-badge">
					{commentCount} {commentCount === 1 ? "comment" : "comments"}
				</span>
			)}
		</div>
	);
}
