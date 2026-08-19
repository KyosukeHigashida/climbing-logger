import type { AttemptEffort } from "../types/domain";
import { effortLabels, toAttemptEffort } from "../utils/effort";

type EffortInputProps = {
  value: AttemptEffort;
  onChange: (value: AttemptEffort) => void;
};

export function EffortInput({ value, onChange }: EffortInputProps) {
  const pointerPosition = `${((value - 1) / 6) * 100}%`;

  return (
    <div className="effort-input">
      <div className="effort-value">{effortLabels[value]}</div>
      <input
        type="range"
        min="1"
        max="7"
        step="1"
        value={value}
        onChange={(event) => onChange(toAttemptEffort(Number(event.target.value)))}
        aria-label="Attempt effort"
      />
      <div className="effort-scale-wrap" aria-hidden="true">
        <span className="effort-pointer" style={{ left: pointerPosition }} />
        <div className="effort-scale">
          <span>Easy</span>
          <span>Moderate</span>
          <span>Hard</span>
          <span>Extreme</span>
        </div>
      </div>
    </div>
  );
}
