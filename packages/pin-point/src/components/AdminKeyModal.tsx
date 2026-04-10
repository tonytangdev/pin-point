import { useState } from "react";

type Props = {
	onValidate: (secret: string) => Promise<boolean>;
	onSuccess: (secret: string) => void;
	onClose: () => void;
};

export function AdminKeyModal({ onValidate, onSuccess, onClose }: Props) {
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const handleSubmit = async () => {
		setBusy(true);
		setError(null);
		try {
			const ok = await onValidate(value);
			if (ok) {
				onSuccess(value);
			} else {
				setError("Invalid admin key");
			}
		} catch {
			setError("Could not reach server");
		} finally {
			setBusy(false);
		}
	};

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click dismissal, Cancel button and Escape are primary dismissal paths
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a visual scrim, inner dialog has role
		<div className="pp-modal-backdrop" onClick={onClose}>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, not an interactive element */}
			<div
				className="pp-modal"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<h3>Enter admin key</h3>
				<input
					type="password"
					placeholder="Admin key"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					disabled={busy}
				/>
				{error && <div className="pp-modal-error">{error}</div>}
				<div className="pp-modal-actions">
					<button type="button" onClick={onClose} disabled={busy}>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={busy || !value}
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
