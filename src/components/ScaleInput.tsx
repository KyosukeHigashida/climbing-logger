import type { CSSProperties } from "react";

type ScaleLabel = {
  value: number;
  label: string;
};

type ScaleSelectionMode = "point" | "left" | "right";

type ScaleInputProps = {
  min: number;
  max: number;
  value: number;
  valueLabel: string;
  labels: ScaleLabel[];
  ariaLabel: string;
  onChange: (value: number) => void;
  selectionMode?: ScaleSelectionMode;
};

export function ScaleInput({ min, max, value, valueLabel, labels, ariaLabel, onChange, selectionMode }: ScaleInputProps) {
  const pointCount = max - min + 1;
  const valuePercent = pointToPercent(value, min, max);
  const sliderStyle = {
    "--effort-track-background": getTrackBackground(valuePercent, selectionMode ?? "left"),
  } as CSSProperties;

  return (
    <div className="effort-input" style={sliderStyle}>
      <div className="effort-value">{valueLabel}</div>
      <div className="effort-range-wrap">
        <div className="effort-ticks" aria-hidden="true">
          {Array.from({ length: pointCount }, (_, index) => (
            <span key={index} style={{ left: `${pointToPercent(min + index, min, max)}%` }} />
          ))}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={ariaLabel}
        />
      </div>
      <div className="effort-scale-wrap" aria-hidden="true">
        <div className="effort-scale">
          {labels.map((label) => (
            <span key={`${label.value}-${label.label}`} className="effort-scale-label" style={{ left: `${pointToPercent(label.value, min, max)}%` }}>
              {label.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function pointToPercent(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return ((value - min) / (max - min)) * 100;
}

function getTrackBackground(valuePercent: number, selectionMode: ScaleSelectionMode): string {
  const base = "rgba(244, 247, 241, 0.18)";
  const fill = "rgba(215, 244, 95, 0.86)";
  if (selectionMode === "left") {
    return `linear-gradient(to right, ${fill} 0%, ${fill} ${valuePercent}%, ${base} ${valuePercent}%, ${base} 100%)`;
  }
  if (selectionMode === "right") {
    return `linear-gradient(to right, ${base} 0%, ${base} ${valuePercent}%, ${fill} ${valuePercent}%, ${fill} 100%)`;
  }

  const pointStart = Math.max(0, valuePercent - 1.5);
  const pointEnd = Math.min(100, valuePercent + 1.5);
  return `linear-gradient(to right, ${base} 0%, ${base} ${pointStart}%, ${fill} ${pointStart}%, ${fill} ${pointEnd}%, ${base} ${pointEnd}%, ${base} 100%)`;
}
