import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "./useAuth";

describe("useAuth", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/");
	});

	it("returns anonymous when no token in URL and no admin in storage", () => {
		const { result } = renderHook(() => useAuth());
		expect(result.current.auth.role).toBe("anonymous");
	});

	it("returns tokenHolder when ?pin-token=ft_xxx in URL", () => {
		window.history.replaceState({}, "", "/?pin-token=ft_test");
		const { result } = renderHook(() => useAuth());
		expect(result.current.auth.role).toBe("tokenHolder");
		if (result.current.auth.role === "tokenHolder") {
			expect(result.current.auth.token).toBe("ft_test");
		}
	});

	it("returns admin when localStorage has pin-admin-key", () => {
		localStorage.setItem("pin-admin-key", "secret");
		const { result } = renderHook(() => useAuth());
		expect(result.current.auth.role).toBe("admin");
	});

	it("URL token takes precedence over admin localStorage", () => {
		localStorage.setItem("pin-admin-key", "secret");
		window.history.replaceState({}, "", "/?pin-token=ft_test");
		const { result } = renderHook(() => useAuth());
		expect(result.current.auth.role).toBe("tokenHolder");
	});

	it("setAdminKey persists and updates auth", () => {
		const { result } = renderHook(() => useAuth());
		act(() => result.current.setAdminKey("new-secret"));
		expect(result.current.auth.role).toBe("admin");
		expect(localStorage.getItem("pin-admin-key")).toBe("new-secret");
	});

	it("clearAdminKey removes from storage and reverts", () => {
		localStorage.setItem("pin-admin-key", "secret");
		const { result } = renderHook(() => useAuth());
		act(() => result.current.clearAdminKey());
		expect(result.current.auth.role).toBe("anonymous");
		expect(localStorage.getItem("pin-admin-key")).toBeNull();
	});

	it("authHeaders returns correct headers for tokenHolder", () => {
		window.history.replaceState({}, "", "/?pin-token=ft_test");
		const { result } = renderHook(() => useAuth());
		expect(result.current.authHeaders).toEqual({ "X-Pin-Token": "ft_test" });
	});

	it("authHeaders returns admin header for admin", () => {
		localStorage.setItem("pin-admin-key", "secret");
		const { result } = renderHook(() => useAuth());
		expect(result.current.authHeaders).toEqual({ "X-Pin-Admin": "secret" });
	});

	it("authHeaders returns empty for anonymous", () => {
		const { result } = renderHook(() => useAuth());
		expect(result.current.authHeaders).toEqual({});
	});
});
