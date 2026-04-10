import { useState } from "react";

type Props = {
	onCreate: (
		label?: string,
		expiresInHours?: number,
	) => Promise<{ tokenId: string }>;
};

const ShareIcon = () => (
	<svg
		aria-hidden="true"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
		<polyline points="16 6 12 2 8 6" />
		<line x1="12" y1="2" x2="12" y2="15" />
	</svg>
);

const CheckIcon = () => (
	<svg
		aria-hidden="true"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="20 6 9 17 4 12" />
	</svg>
);

export function ShareLinkButton({ onCreate }: Props) {
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleClick = async () => {
		setBusy(true);
		try {
			const { tokenId } = await onCreate();
			const url = new URL(window.location.href);
			url.searchParams.set("pin-token", tokenId);
			await navigator.clipboard.writeText(url.toString());
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="pp-share-wrapper">
			<button
				type="button"
				className="pp-share-btn"
				onClick={handleClick}
				disabled={busy}
				data-state={copied ? "copied" : busy ? "busy" : "idle"}
			>
				{copied ? <CheckIcon /> : <ShareIcon />}
				<span>{copied ? "Link copied" : "Share for feedback"}</span>
			</button>
		</div>
	);
}
