import { type FormEvent, useEffect, useState } from "react";
import type { Grade, Gym, WallAngle } from "../types/domain";
import { parseOptionalNumericInput } from "../utils/numericInput";

export type ClimbFormValue = {
  grade: string;
  name: string | null;
  gymId: string | null;
  gradeId: string | null;
  wallAnglePresetId: string | null;
  wallAngle: number | null;
};

type ClimbFormProps = {
  initialGrade?: string;
  initialGradeId?: string | null;
  initialGymId?: string | null;
  initialWallAngle?: number;
  initialWallAnglePresetId?: string | null;
  initialName?: string | null;
  currentVenue: Gym | null;
  grades: Grade[];
  wallAngles: WallAngle[];
  onCancel: () => void;
  onSubmit: (value: ClimbFormValue) => Promise<void>;
  submitLabel?: string;
};

export function ClimbForm({
  initialGrade = "",
  initialGradeId = null,
  initialGymId = null,
  initialWallAngle,
  initialWallAnglePresetId = null,
  initialName = "",
  currentVenue,
  grades,
  wallAngles,
  onCancel,
  onSubmit,
  submitLabel = "START CLIMB",
}: ClimbFormProps) {
  const [grade, setGrade] = useState(initialGrade);
  const [gradeId, setGradeId] = useState<string | null>(initialGradeId);
  const [name, setName] = useState(initialName ?? "");
  const [wallAngle, setWallAngle] = useState(initialWallAngle?.toString() ?? "");
  const [wallAnglePresetId, setWallAnglePresetId] = useState<string | null>(initialWallAnglePresetId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formGymId = initialGymId ?? currentVenue?.id ?? null;
  const selectedGrade = gradeId ? grades.find((item) => item.id === gradeId) ?? null : null;
  const selectedWallAngle = wallAnglePresetId ? wallAngles.find((item) => item.id === wallAnglePresetId) ?? null : null;

  useEffect(() => {
    if (initialGrade || initialGradeId !== null) {
      return;
    }
    setGradeId(null);
    setGrade("");
    setWallAnglePresetId(null);
    setWallAngle("");
  }, [currentVenue?.id, initialGradeId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolvedGrade = selectedGrade?.label ?? grade.trim();
    if (!resolvedGrade) {
      setError("Grade is required.");
      return;
    }

    let parsedWallAngle: number | null;
    try {
      parsedWallAngle =
        selectedWallAngle?.angle ?? parseOptionalNumericInput(wallAngle, { label: "Wall angle", min: 0, max: 180 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wall angle is invalid.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        grade: resolvedGrade,
        name,
        gymId: formGymId,
        gradeId,
        wallAnglePresetId,
        wallAngle: parsedWallAngle,
      });
      setGrade("");
      setGradeId(null);
      setName("");
      setWallAngle("");
      setWallAnglePresetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save climb.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="climb-form" onSubmit={handleSubmit}>
      <label>
        Venue
        <div className="readonly-date">{currentVenue?.name ?? "No venue"}</div>
      </label>
      <label>
        Grade
        {grades.length > 0 ? (
          <select
            value={gradeId ?? ""}
            onChange={(event) => {
              const nextGradeId = event.target.value || null;
              const nextGrade = grades.find((item) => item.id === nextGradeId) ?? null;
              setGradeId(nextGradeId);
              setGrade(nextGrade?.label ?? "");
            }}
          >
            <option value="">Select grade</option>
            {grades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : (
          <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade label" />
        )}
      </label>
      <label>
        Name / number
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name / number" />
      </label>
      <label>
        Wall angle
        {wallAngles.length > 0 ? (
          <select
            value={wallAnglePresetId ?? ""}
            onChange={(event) => {
              const nextWallAnglePresetId = event.target.value || null;
              const nextWallAngle = wallAngles.find((item) => item.id === nextWallAnglePresetId) ?? null;
              setWallAnglePresetId(nextWallAnglePresetId);
              setWallAngle(nextWallAngle?.angle.toString() ?? "");
            }}
          >
            <option value="">No angle</option>
            {wallAngles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.angle}°
              </option>
            ))}
          </select>
        ) : (
          <div className="angle-input-row">
            <input
              inputMode="decimal"
              value={wallAngle}
              onChange={(event) => setWallAngle(event.target.value)}
              placeholder="Wall angle"
            />
            <span>°</span>
          </div>
        )}
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
