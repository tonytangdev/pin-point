export type PinComment = {
	id: string;
	url: string;
	content: string;
	anchor: {
		selector: string;
		xPercent: number;
		yPercent: number;
	};
	viewport: {
		width: number;
	};
	createdAt: string;
};

export type AnchorData = {
	selector: string;
	xPercent: number;
	yPercent: number;
};

export type PendingPin = {
	x: number;
	y: number;
	anchor: AnchorData;
};

export type AuthHeaders = Record<string, string>;

export type PinAuth =
	| { role: "anonymous" }
	| { role: "tokenHolder"; token: string }
	| { role: "admin"; secret: string };

export type FeedbackOverlayProps = {
	onCommentCreate: (
		comment: PinComment,
		authHeaders: AuthHeaders,
	) => Promise<void>;
	onCommentsFetch: (authHeaders: AuthHeaders) => Promise<PinComment[]>;
	onCommentDelete?: (id: string, authHeaders: AuthHeaders) => Promise<void>;
	onCommentUpdate?: (
		id: string,
		content: string,
		authHeaders: AuthHeaders,
	) => Promise<PinComment>;
	onAdminValidate?: (secret: string) => Promise<boolean>;
	onShareLinkCreate?: (
		label: string | undefined,
		expiresInHours: number | undefined,
		authHeaders: AuthHeaders,
	) => Promise<{ tokenId: string }>;
	children: React.ReactNode;
};
