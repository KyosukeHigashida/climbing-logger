type ScaleLabel = {
  value: number;
  label: string;
};

type ScaleInputProps = {
  min: number;
  max: number;
  value: number;
  valueLabel: string;
  labels: ScaleLabel[];
  ariaLabel: string;
  onChange: (value: number) => void;
};

export function ScaleInput({ min, max, value, valueLabel, labels, ariaLabel, onChange }: ScaleInputProps) {
  const pointCount = max - min + 1;

  return (
    <div className="effort-input">
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
