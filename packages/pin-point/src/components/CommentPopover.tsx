import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const MOBILE_BREAKPOINT = 768;

type ReadProps = {
	mode: "read";
	content: string;
	createdAt: string;
	viewportWidth: number;
	top: number;
	left: number;
	onDelete?: () => Promise<void>;
	onUpdate?: (content: string) => Promise<void>;
	onSubmit?: never;
	onCancel?: never;
};

type CreateProps = {
	mode: "create";
	top: number;
	left: number;
	onSubmit: (content: string) => Promise<void>;
	onCancel: () => void;
	content?: never;
	createdAt?: never;
	viewportWidth?: never;
};

type CommentPopoverProps = ReadProps | CreateProps;

type Placement = { x: "right" | "left"; y: "bottom" | "top" };

const POPOVER_OFFSET = 14;
const VIEWPORT_MARGIN = 8;
const KEYBOARD_HEIGHT_THRESHOLD = 150;

function useScrollIntoViewOnKeyboard(
	ref: React.RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		if (window.innerWidth < MOBILE_BREAKPOINT) return;
		const viewport = window.visualViewport;
		if (!viewport) return;

		const baselineHeight = viewport.height;

		const handleResize = () => {
			if (
				baselineHeight - viewport.height > KEYBOARD_HEIGHT_THRESHOLD &&
				ref.current
			) {
				ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		};

		viewport.addEventListener("resize", handleResize);
		return () => viewport.removeEventListener("resize", handleResize);
	}, [ref]);
}

export function CommentPopover(props: CommentPopoverProps) {
	const { mode, top, left } = props;
	const popoverRef = useRef<HTMLDivElement>(null);
	const [placement, setPlacement] = useState<Placement>({
		x: "right",
		y: "bottom",
	});
	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	);

	useLayoutEffect(() => {
		if (window.innerWidth < MOBILE_BREAKPOINT) return;
		const el = popoverRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const w = rect.width;
		const h = rect.height;

		const pinViewX = left - window.scrollX;
		const pinViewY = top - window.scrollY;

		const fitsRight =
			pinViewX - POPOVER_OFFSET + w + VIEWPORT_MARGIN <= window.innerWidth;
		const fitsLeft = pinViewX + POPOVER_OFFSET - w - VIEWPORT_MARGIN >= 0;
		const fitsBottom =
			pinViewY + POPOVER_OFFSET + h + VIEWPORT_MARGIN <= window.innerHeight;
		const fitsTop = pinViewY - POPOVER_OFFSET - h - VIEWPORT_MARGIN >= 0;

		setPlacement({
			x: fitsRight ? "right" : fitsLeft ? "left" : "right",
			y: fitsBottom ? "bottom" : fitsTop ? "top" : "bottom",
		});
		setSize({ width: w, height: h });
	}, [top, left]);

	useScrollIntoViewOnKeyboard(popoverRef);

	const isMobile =
		typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

	const style: React.CSSProperties = isMobile
		? {}
		: size
			? {
					top: `${
						placement.y === "bottom"
							? top + POPOVER_OFFSET
							: top - POPOVER_OFFSET - size.height
					}px`,
					left: `${
						placement.x === "right"
							? left - POPOVER_OFFSET
							: left + POPOVER_OFFSET - size.width
					}px`,
				}
			: {
					top: `${top + POPOVER_OFFSET}px`,
					left: `${left - POPOVER_OFFSET}px`,
					visibility: "hidden",
				};

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, not interactive
		<div
			ref={popoverRef}
			className="pp-popover"
			data-placement-x={placement.x}
			data-placement-y={placement.y}
			style={style}
			onClick={(e) => e.stopPropagation()}
			role="dialog"
		>
			<div className="pp-popover-arrow" />
			{mode === "read" ? (
				<ReadContent
					content={props.content}
					createdAt={props.createdAt}
					viewportWidth={props.viewportWidth}
					onDelete={props.onDelete}
					onUpdate={props.onUpdate}
				/>
			) : (
				<CreateContent onSubmit={props.onSubmit} onCancel={props.onCancel} />
			)}
		</div>
	);
}

function ReadContent({
	content,
	createdAt,
	viewportWidth,
	onDelete,
	onUpdate,
}: {
	content: string;
	createdAt: string;
	viewportWidth: number;
	onDelete?: () => Promise<void>;
	onUpdate?: (content: string) => Promise<void>;
}) {
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(content);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState(false);
	const [editError, setEditError] = useState(false);

	useEffect(() => setEditContent(content), [content]);

	const date = new Date(createdAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	if (isEditing) {
		return (
			<>
				<textarea
					className="pp-popover-textarea"
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
				/>
				<div className="pp-popover-actions">
					<button
						type="button"
						className="pp-btn pp-btn--cancel"
						onClick={() => {
							setIsEditing(false);
							setEditContent(content);
							setEditError(false);
						}}
					>
						Cancel
					</button>
					<button
						type="button"
						className="pp-btn pp-btn--submit"
						disabled={editContent.trim().length === 0 || saving}
						onClick={async () => {
							setSaving(true);
							setEditError(false);
							try {
								await onUpdate?.(editContent);
								setIsEditing(false);
							} catch {
								setEditError(true);
							} finally {
								setSaving(false);
							}
						}}
					>
						Save
					</button>
				</div>
				{editError && (
					<div className="pp-popover-error">Couldn't save. Try again.</div>
				)}
			</>
		);
	}

	if (isConfirmingDelete) {
		return (
			<div className="pp-delete-confirm">
				<div className="pp-delete-confirm-icon">
					<svg
						aria-hidden="true"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>
				<p className="pp-delete-confirm-text">Delete this comment?</p>
				{deleteError && (
					<div className="pp-popover-error">Couldn't delete. Try again.</div>
				)}
				<div className="pp-delete-confirm-actions">
					<button
						type="button"
						className="pp-btn pp-btn--cancel"
						disabled={deleting}
						onClick={() => {
							setIsConfirmingDelete(false);
							setDeleteError(false);
						}}
					>
						Cancel
					</button>
					<button
						type="button"
						className="pp-btn pp-btn--danger"
						disabled={deleting}
						onClick={async () => {
							setDeleting(true);
							setDeleteError(false);
							try {
								await onDelete?.();
							} catch {
								setDeleteError(true);
							} finally {
								setDeleting(false);
							}
						}}
					>
						{deleting ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="pp-popover-content">{content}</div>
			<div className="pp-popover-footer">
				<div className="pp-popover-meta">
					{date} · {viewportWidth}px viewport
				</div>
				{(onDelete || onUpdate) && (
					<div className="pp-popover-actions-row">
						{onUpdate && (
							<button
								type="button"
								className="pp-action-btn"
								aria-label="Edit"
								onClick={() => setIsEditing(true)}
							>
								<svg
									aria-hidden="true"
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
									<path d="m15 5 4 4" />
								</svg>
							</button>
						)}
						{onDelete && (
							<button
								type="button"
								className="pp-action-btn pp-action-btn--danger"
								aria-label="Delete"
								onClick={() => setIsConfirmingDelete(true)}
							>
								<svg
									aria-hidden="true"
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M3 6h18" />
									<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
									<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
								</svg>
							</button>
						)}
					</div>
				)}
			</div>
		</>
	);
}

function CreateContent({
	onSubmit,
	onCancel,
}: {
	onSubmit: (content: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async () => {
		setError(null);
		setSubmitting(true);
		try {
			await onSubmit(text);
		} catch {
			setError("Couldn't save. Try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<textarea
				className="pp-popover-textarea"
				placeholder="Leave your feedback..."
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<div className="pp-popover-actions">
				<button
					type="button"
					className="pp-btn pp-btn--cancel"
					onClick={onCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					className="pp-btn pp-btn--submit"
					onClick={handleSubmit}
					disabled={text.trim().length === 0 || submitting}
				>
					Submit
				</button>
			</div>
			{error && <div className="pp-popover-error">{error}</div>}
		</>
	);
}
