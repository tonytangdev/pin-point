import { useRef, useCallback } from "react";

type ClickInterceptLayerProps = {
  onClick: (clientX: number, clientY: number) => void;
};

export function ClickInterceptLayer({ onClick }: ClickInterceptLayerProps) {
  const lastClickTime = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        return;
      }
      lastClickTime.current = now;
      onClick(e.clientX, e.clientY);
    },
    [onClick]
  );

  return <div className="pp-intercept" onClick={handleClick} />;
}
