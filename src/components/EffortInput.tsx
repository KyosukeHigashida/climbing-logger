import type { AttemptEffort } from "../types/domain";
import { effortLabels, toAttemptEffort } from "../utils/effort";
import { ScaleInput } from "./ScaleInput";

type EffortInputProps = {
  value: AttemptEffort;
  onChange: (value: AttemptEffort) => void;
};

export function EffortInput({ value, onChange }: EffortInputProps) {
  return (
    <ScaleInput
      min={1}
      max={7}
      value={value}
      valueLabel={effortLabels[value]}
      labels={[
        { value: 1, label: "Easy" },
        { value: 3, label: "Moderate" },
        { value: 5, label: "Hard" },
        { value: 7, label: "Extreme" },
      ]}
      ariaLabel="Attempt effort"
      onChange={(nextValue) => onChange(toAttemptEffort(nextValue))}
    />
  );
}
