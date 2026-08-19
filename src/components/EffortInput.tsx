import type { AttemptEffort } from "../types/domain";
import { effortLabels, toAttemptEffort } from "../utils/effort";

type EffortInputProps = {
  value: AttemptEffort;
  onChange: (value: AttemptEffort) => void;
};

export function EffortInput({ value, onChange }: EffortInputProps) {
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
      <div className="effort-scale" aria-hidden="true">
        <span>Easy</span>
        <span>Moderate</span>
        <span>Hard</span>
        <span>Extreme</span>
      </div>
    </div>
  );
}
