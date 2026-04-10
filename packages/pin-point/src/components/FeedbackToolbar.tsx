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

const CommentIcon = () => (
	<svg
		aria-hidden="true"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
	</svg>
);

const KeyIcon = () => (
	<svg
		aria-hidden="true"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="m21 2-9.6 9.6" />
		<circle cx="7.5" cy="15.5" r="5.5" />
		<path d="m15.5 7.5 3 3" />
	</svg>
);

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
	const showAdminKey = auth.role !== "tokenHolder";

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
				<CommentIcon />
			</button>
			{showAdminKey && (
				<button
					type="button"
					className="pp-toolbar-btn"
					onClick={onAdminKeyOpen}
					aria-label="Enter admin key"
					title="Enter admin key"
				>
					<KeyIcon />
				</button>
			)}
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
