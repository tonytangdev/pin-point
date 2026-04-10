import { useCallback, useEffect, useState } from "react";
import type { AuthHeaders, PinAuth } from "../types";

const ADMIN_KEY_STORAGE = "pin-admin-key";
const TOKEN_QUERY_PARAM = "pin-token";

const resolveAuth = (): PinAuth => {
	if (typeof window === "undefined") return { role: "anonymous" };

	const params = new URLSearchParams(window.location.search);
	const token = params.get(TOKEN_QUERY_PARAM);
	if (token) return { role: "tokenHolder", token };

	const adminKey = localStorage.getItem(ADMIN_KEY_STORAGE);
	if (adminKey) return { role: "admin", secret: adminKey };

	return { role: "anonymous" };
};

const computeHeaders = (auth: PinAuth): AuthHeaders => {
	switch (auth.role) {
		case "tokenHolder":
			return { "X-Pin-Token": auth.token };
		case "admin":
			return { "X-Pin-Admin": auth.secret };
		case "anonymous":
			return {};
	}
};

export const useAuth = () => {
	const [auth, setAuth] = useState<PinAuth>(resolveAuth);

	useEffect(() => {
		const onPopState = () => setAuth(resolveAuth());
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const setAdminKey = useCallback((secret: string) => {
		localStorage.setItem(ADMIN_KEY_STORAGE, secret);
		setAuth(resolveAuth());
	}, []);

	const clearAdminKey = useCallback(() => {
		localStorage.removeItem(ADMIN_KEY_STORAGE);
		setAuth(resolveAuth());
	}, []);

	return {
		auth,
		authHeaders: computeHeaders(auth),
		setAdminKey,
		clearAdminKey,
	};
};
