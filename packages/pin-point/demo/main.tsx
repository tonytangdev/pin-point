import { createRoot } from "react-dom/client";
import { FeedbackOverlay } from "../src/index";
import "../src/styles/pin-point.css";

const API = "http://localhost:3000";

function App() {
	return (
		<FeedbackOverlay
			onCommentCreate={async (comment, headers) => {
				const res = await fetch(`${API}/comments`, {
					method: "POST",
					headers: { "Content-Type": "application/json", ...headers },
					body: JSON.stringify(comment),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
			}}
			onCommentsFetch={async (headers) => {
				const res = await fetch(
					`${API}/comments?url=${encodeURIComponent(window.location.pathname)}`,
					{ headers },
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json();
			}}
			onCommentDelete={async (id, headers) => {
				const res = await fetch(`${API}/comments/${id}`, {
					method: "DELETE",
					headers,
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
			}}
			onCommentUpdate={async (id, content, headers) => {
				const res = await fetch(`${API}/comments/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", ...headers },
					body: JSON.stringify({ content }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json();
			}}
			onAdminValidate={async (secret) => {
				const res = await fetch(`${API}/admin/tokens`, {
					headers: { "X-Pin-Admin": secret },
				});
				return res.ok;
			}}
			onShareLinkCreate={async (label, expiresInHours, headers) => {
				const res = await fetch(`${API}/admin/tokens`, {
					method: "POST",
					headers: { "Content-Type": "application/json", ...headers },
					body: JSON.stringify({ label, expiresInHours }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const token = await res.json();
				return { tokenId: token.id };
			}}
		>
			<div
				style={{
					fontFamily: "system-ui, sans-serif",
					maxWidth: 800,
					margin: "0 auto",
					padding: 40,
				}}
			>
				<header id="header" style={{ marginBottom: 40 }}>
					<h1>Pin-Point Demo</h1>
					<p style={{ color: "#666" }}>
						Click the comment icon in the toolbar to leave feedback. Anonymous
						users can view existing comments; to add new ones you need a
						feedback link or the admin key. Click the key icon to enter an admin
						key.
					</p>
				</header>

				<section
					id="hero"
					style={{
						background: "#f0f0ff",
						padding: 32,
						borderRadius: 12,
						marginBottom: 24,
					}}
				>
					<h2>Hero Section</h2>
					<p>
						This is a demo section with an id attribute. Pins here will anchor
						to <code>#hero</code>.
					</p>
					<button
						type="button"
						style={{
							background: "#6C5CE7",
							color: "#fff",
							border: "none",
							padding: "10px 20px",
							borderRadius: 8,
							cursor: "pointer",
							fontSize: 16,
						}}
					>
						Call to Action
					</button>
				</section>

				<section
					data-testid="features"
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr 1fr",
						gap: 16,
						marginBottom: 24,
					}}
				>
					<div
						style={{
							background: "#fff",
							border: "1px solid #eee",
							padding: 20,
							borderRadius: 8,
						}}
					>
						<h3>Feature A</h3>
						<p>Pins on page elements with numbered markers.</p>
					</div>
					<div
						style={{
							background: "#fff",
							border: "1px solid #eee",
							padding: 20,
							borderRadius: 8,
						}}
					>
						<h3>Feature B</h3>
						<p>Click to expand and read comments.</p>
					</div>
					<div
						style={{
							background: "#fff",
							border: "1px solid #eee",
							padding: 20,
							borderRadius: 8,
						}}
					>
						<h3>Feature C</h3>
						<p>DOM-anchored with viewport metadata.</p>
					</div>
				</section>

				<footer
					style={{ borderTop: "1px solid #eee", paddingTop: 20, color: "#999" }}
				>
					<p>Footer content - no id or data attributes here.</p>
				</footer>
			</div>
		</FeedbackOverlay>
	);
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
