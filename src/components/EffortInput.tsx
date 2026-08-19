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
      <div className="effort-range-wrap">
        <div className="effort-ticks" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <input
          type="range"
          min="1"
          max="7"
          step="1"
          value={value}
          onChange={(event) => onChange(toAttemptEffort(Number(event.target.value)))}
          aria-label="Attempt effort"
        />
      </div>
      <div className="effort-scale-wrap" aria-hidden="true">
        <div className="effort-scale">
          <span className="effort-scale-label" style={{ left: "0%" }}>
            Easy
          </span>
          <span className="effort-scale-label" style={{ left: "33.333%" }}>
            Moderate
          </span>
          <span className="effort-scale-label" style={{ left: "66.667%" }}>
            Hard
          </span>
          <span className="effort-scale-label" style={{ left: "100%" }}>
            Extreme
          </span>
        </div>
      </div>
    </div>
  );
}
