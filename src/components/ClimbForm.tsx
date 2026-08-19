import { type FormEvent, useEffect, useState } from "react";
import type { Grade, Gym } from "../types/domain";

export type ClimbFormValue = {
  grade: string;
  name: string | null;
  gymId: string | null;
  gradeId: string | null;
  wallAngle: number | null;
};

type ClimbFormProps = {
  initialGrade?: string;
  initialGradeId?: string | null;
  initialGymId?: string | null;
  initialWallAngle?: number;
  initialName?: string | null;
  currentVenue: Gym | null;
  grades: Grade[];
  onCancel: () => void;
  onSubmit: (value: ClimbFormValue) => Promise<void>;
  submitLabel?: string;
};

export function ClimbForm({
  initialGrade = "",
  initialGradeId = null,
  initialGymId = null,
  initialWallAngle,
  initialName = "",
  currentVenue,
  grades,
  onCancel,
  onSubmit,
  submitLabel = "START CLIMB",
}: ClimbFormProps) {
  const [grade, setGrade] = useState(initialGrade);
  const [gradeId, setGradeId] = useState<string | null>(initialGradeId);
  const [name, setName] = useState(initialName ?? "");
  const [wallAngle, setWallAngle] = useState(initialWallAngle?.toString() ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formGymId = initialGymId ?? currentVenue?.id ?? null;
  const selectedGrade = gradeId ? grades.find((item) => item.id === gradeId) ?? null : null;

  useEffect(() => {
    if (initialGrade || initialGradeId !== null) {
      return;
    }
    setGradeId(null);
    setGrade("");
  }, [currentVenue?.id, initialGradeId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolvedGrade = selectedGrade?.label ?? grade.trim();
    const trimmedWallAngle = wallAngle.trim();
    const parsedWallAngle = trimmedWallAngle ? Number(trimmedWallAngle) : null;
    if (!resolvedGrade) {
      setError("Grade is required.");
      return;
    }
    if (parsedWallAngle !== null && !Number.isFinite(parsedWallAngle)) {
      setError("Wall angle must be a number.");
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
        wallAngle: parsedWallAngle,
      });
      setGrade("");
      setGradeId(null);
      setName("");
      setWallAngle("");
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
          <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="2Q" />
        )}
      </label>
      <label>
        Name / number
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Yellow #12" />
      </label>
      <label>
        Wall angle
        <div className="angle-input-row">
          <input
            inputMode="decimal"
            value={wallAngle}
            onChange={(event) => setWallAngle(event.target.value)}
            placeholder="120"
          />
          <span>°</span>
        </div>
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
