import { useState } from "react";

type Props = {
	onCreate: (
		label?: string,
		expiresInHours?: number,
	) => Promise<{ tokenId: string }>;
};

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
			<button type="button" onClick={handleClick} disabled={busy}>
				Share for feedback
			</button>
			{copied && <span className="pp-share-toast">Link copied</span>}
		</div>
	);
}
