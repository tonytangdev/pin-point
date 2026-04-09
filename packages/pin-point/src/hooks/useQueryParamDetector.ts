import { useCallback, useEffect, useState } from "react";

export function useQueryParamDetector(paramName: string): boolean {
	const getIsActive = useCallback(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get(paramName) === "true";
	}, [paramName]);

	const [isActive, setIsActive] = useState(getIsActive);

	useEffect(() => {
		const handleChange = () => setIsActive(getIsActive());

		window.addEventListener("popstate", handleChange);

		const originalPush = history.pushState.bind(history);
		const originalReplace = history.replaceState.bind(history);

		history.pushState = (...args) => {
			originalPush(...args);
			handleChange();
		};

		history.replaceState = (...args) => {
			originalReplace(...args);
			handleChange();
		};

		return () => {
			window.removeEventListener("popstate", handleChange);
			history.pushState = originalPush;
			history.replaceState = originalReplace;
		};
	}, [getIsActive]);

	return isActive;
}
