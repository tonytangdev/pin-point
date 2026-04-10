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

				<section
					id="about"
					style={{
						padding: "32px 0",
						marginBottom: 24,
						borderTop: "1px solid #eee",
					}}
				>
					<h2>About</h2>
					<p style={{ color: "#444", lineHeight: 1.7 }}>
						Pin-Point lets your team drop visual feedback directly on the
						interface. No screenshots, no Loom recordings, no “see attached
						mockup, third row, second column”. Just click, type, and the comment
						lands exactly where it belongs — anchored to a real DOM element with
						viewport context preserved.
					</p>
					<p style={{ color: "#444", lineHeight: 1.7 }}>
						The overlay is framework-agnostic on the consumer side: any React
						app can mount it, hand it a few callbacks, and the rest takes care
						of itself. Comments persist server-side, share links scope access to
						specific reviewers, and the admin key unlocks moderation.
					</p>
				</section>

				<section
					id="pricing"
					style={{
						background: "#fafaff",
						padding: 32,
						borderRadius: 12,
						marginBottom: 24,
					}}
				>
					<h2 style={{ marginTop: 0 }}>Pricing</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 16,
							marginTop: 20,
						}}
					>
						{[
							{ name: "Hobby", price: "Free", note: "Up to 50 comments" },
							{ name: "Team", price: "$19/mo", note: "Unlimited comments" },
							{
								name: "Business",
								price: "$79/mo",
								note: "SSO + audit logs",
							},
						].map((tier) => (
							<div
								key={tier.name}
								style={{
									background: "#fff",
									border: "1px solid #eee",
									padding: 20,
									borderRadius: 8,
								}}
							>
								<h3 style={{ marginTop: 0 }}>{tier.name}</h3>
								<p style={{ fontSize: 24, fontWeight: 700, margin: "8px 0" }}>
									{tier.price}
								</p>
								<p style={{ color: "#666", margin: 0 }}>{tier.note}</p>
							</div>
						))}
					</div>
				</section>

				<section
					id="testimonials"
					style={{ padding: "32px 0", marginBottom: 24 }}
				>
					<h2>What people say</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: 16,
							marginTop: 16,
						}}
					>
						{[
							{
								quote:
									"We replaced three Slack channels and a Notion doc with Pin-Point. The PM finally stops messaging me at 2am.",
								author: "Front-end Lead, fintech startup",
							},
							{
								quote:
									"Designers leave pins, devs read them, bugs get filed. Friction went to basically zero.",
								author: "Engineering Manager, B2B SaaS",
							},
							{
								quote:
									"It’s the first feedback tool I’ve actually used for more than a week. The anchoring just works.",
								author: "Indie hacker",
							},
							{
								quote:
									"Onboarding took 30 seconds — drop a script, drop a callback, ship.",
								author: "Tech lead, agency",
							},
						].map((t) => (
							<blockquote
								key={t.author}
								style={{
									background: "#fff",
									border: "1px solid #eee",
									borderLeft: "3px solid #6c5ce7",
									padding: 16,
									borderRadius: 6,
									margin: 0,
								}}
							>
								<p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>
									“{t.quote}”
								</p>
								<footer style={{ color: "#888", fontSize: 13 }}>
									— {t.author}
								</footer>
							</blockquote>
						))}
					</div>
				</section>

				<section
					id="gallery"
					style={{
						background: "#f0f0ff",
						padding: 32,
						borderRadius: 12,
						marginBottom: 24,
					}}
				>
					<h2 style={{ marginTop: 0 }}>Gallery</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
							gap: 12,
							marginTop: 16,
						}}
					>
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static demo content
								key={i}
								style={{
									aspectRatio: "1 / 1",
									background: `linear-gradient(135deg, hsl(${
										240 + i * 12
									}, 70%, 75%) 0%, hsl(${260 + i * 10}, 65%, 60%) 100%)`,
									borderRadius: 8,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#fff",
									fontWeight: 600,
									fontSize: 18,
								}}
							>
								{i + 1}
							</div>
						))}
					</div>
				</section>

				<section id="faq" style={{ padding: "32px 0", marginBottom: 24 }}>
					<h2>FAQ</h2>
					{[
						{
							q: "Does Pin-Point work with my framework?",
							a: "If your app renders React 18 or later, yes. The overlay only needs a parent component and a handful of async callbacks.",
						},
						{
							q: "Where are comments stored?",
							a: "Wherever your `onCommentCreate` / `onCommentsFetch` callbacks store them. The reference server uses Postgres.",
						},
						{
							q: "How do anonymous users see comments without leaving any?",
							a: "Anonymous role is read-only by default. To leave feedback, a reviewer needs a share link with a token, or the admin key.",
						},
						{
							q: "What happens if a pinned element is removed from the DOM?",
							a: "The pin falls back to viewport coordinates so it stays roughly in place; you can prune stale comments from the admin tools.",
						},
						{
							q: "Is there a self-hosted option?",
							a: "Yes — the server in this monorepo is the self-hosted reference. Bring your own Postgres and you’re done.",
						},
					].map((item) => (
						<details
							key={item.q}
							style={{
								background: "#fff",
								border: "1px solid #eee",
								borderRadius: 8,
								padding: "12px 16px",
								marginBottom: 8,
							}}
						>
							<summary style={{ cursor: "pointer", fontWeight: 600 }}>
								{item.q}
							</summary>
							<p style={{ color: "#555", marginBottom: 0, marginTop: 8 }}>
								{item.a}
							</p>
						</details>
					))}
				</section>

				<section
					id="cta"
					style={{
						background: "#1a1a2e",
						color: "#fff",
						padding: 40,
						borderRadius: 12,
						marginBottom: 24,
						textAlign: "center",
					}}
				>
					<h2 style={{ marginTop: 0 }}>Ready to drop your first pin?</h2>
					<p style={{ color: "#bbb", marginBottom: 20 }}>
						Open the toolbar, click the comment icon, then click anywhere on
						this page.
					</p>
					<button
						type="button"
						style={{
							background: "#6C5CE7",
							color: "#fff",
							border: "none",
							padding: "12px 28px",
							borderRadius: 999,
							cursor: "pointer",
							fontSize: 15,
							fontWeight: 600,
						}}
					>
						Get Started
					</button>
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
