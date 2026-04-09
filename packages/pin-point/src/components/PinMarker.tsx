type PinMarkerProps = {
	number: number;
	top: number;
	left: number;
	onClick: () => void;
};

export function PinMarker({ number, top, left, onClick }: PinMarkerProps) {
	return (
		<button
			type="button"
			className="pp-pin"
			style={{ top: `${top}px`, left: `${left}px` }}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
		>
			{number}
		</button>
	);
}
