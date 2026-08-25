import { type FormEvent, useState } from "react";
import { EffortInput } from "./EffortInput";
import type { EffortRating, StrengthSet } from "../types/domain";
import { getOptionalNumericInputError, parseOptionalNumericInput } from "../utils/numericInput";
import { formatReadableDate, fromDateTimeLocalValue, toDateTimeLocalValue } from "../utils/time";

type StrengthSetEditorProps = {
  strengthSet: StrengthSet;
  sessionStartedAt: string;
  sessionEndedAt: string | null;
  onCancel: () => void;
  onDelete: (strengthSetId: string) => Promise<void>;
  onSave: (
    strengthSetId: string,
    update: {
      name: string;
      startedAt: string;
      endedAt: string;
      weight: number | null;
      reps: number | null;
      workDurationSeconds: number | null;
      effort?: EffortRating | null;
      memo?: string | null;
    },
  ) => Promise<unknown>;
};

export function StrengthSetEditor({
  strengthSet,
  sessionStartedAt,
  sessionEndedAt,
  onCancel,
  onDelete,
  onSave,
}: StrengthSetEditorProps) {
  const [name, setName] = useState(strengthSet.name);
  const [startedAt, setStartedAt] = useState(toDateTimeLocalValue(strengthSet.startedAt));
  const [endedAt, setEndedAt] = useState(strengthSet.endedAt ? toDateTimeLocalValue(strengthSet.endedAt) : "");
  const [weight, setWeight] = useState(strengthSet.weight === null || strengthSet.weight === undefined ? "" : String(strengthSet.weight));
  const [reps, setReps] = useState(strengthSet.reps === null || strengthSet.reps === undefined ? "" : String(strengthSet.reps));
  const [workDurationSeconds, setWorkDurationSeconds] = useState(
    strengthSet.workDurationSeconds === null || strengthSet.workDurationSeconds === undefined
      ? ""
      : String(strengthSet.workDurationSeconds),
  );
  const [effort, setEffort] = useState<EffortRating>(strengthSet.effort ?? 4);
  const [hasEffort, setHasEffort] = useState(strengthSet.effort !== null && strengthSet.effort !== undefined);
  const [memo, setMemo] = useState(strengthSet.memo ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = getStrengthSetEditorError({ name, endedAt, weight, reps, workDurationSeconds });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(strengthSet.id, {
        name,
        startedAt: fromDateTimeLocalValue(startedAt),
        endedAt: fromDateTimeLocalValue(endedAt),
        weight: parseOptionalNumericInput(weight, { label: "Weight", min: 0 }),
        reps: parseOptionalNumericInput(reps, { label: "Reps", integer: true, min: 0 }),
        workDurationSeconds: parseOptionalNumericInput(workDurationSeconds, { label: "Work duration", min: 0 }),
        effort: hasEffort ? effort : null,
        memo,
      });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update strength sets.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setError(null);

    try {
      await onDelete(strengthSet.id);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete strength sets.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="attempt-editor" onSubmit={handleSubmit}>
      <label>
        Date
        <div className="readonly-date">{formatReadableDate(strengthSet.endedAt ?? strengthSet.createdAt)}</div>
      </label>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Start
        <input
          className="timestamp-input"
          type="datetime-local"
          min={toDateTimeLocalValue(sessionStartedAt)}
          max={sessionEndedAt ? toDateTimeLocalValue(sessionEndedAt) : undefined}
          value={startedAt}
          onChange={(event) => setStartedAt(event.target.value)}
        />
      </label>
      <label>
        End
        <input
          className="timestamp-input"
          type="datetime-local"
          min={toDateTimeLocalValue(sessionStartedAt)}
          max={sessionEndedAt ? toDateTimeLocalValue(sessionEndedAt) : undefined}
          value={endedAt}
          onChange={(event) => setEndedAt(event.target.value)}
        />
      </label>
      <div className="training-grid">
        <label className="select-chip training-input-chip">
          <span className="metric-label">Weight kg</span>
          <input inputMode="decimal" value={weight} placeholder="Weight" onChange={(event) => setWeight(event.target.value)} />
        </label>
        <label className="select-chip training-input-chip">
          <span className="metric-label">Reps</span>
          <input inputMode="numeric" value={reps} placeholder="Reps" onChange={(event) => setReps(event.target.value)} />
        </label>
        <label className="select-chip training-input-chip">
          <span className="metric-label">Work sec</span>
          <input
            inputMode="decimal"
            value={workDurationSeconds}
            placeholder="Seconds"
            onChange={(event) => setWorkDurationSeconds(event.target.value)}
          />
        </label>
      </div>
      <div className="effort-editor">
        <div className="section-heading">
          <span className="label">Effort</span>
          <button type="button" className="small-text-action" onClick={() => setHasEffort((current) => !current)}>
            {hasEffort ? "Clear" : "Set"}
          </button>
        </div>
        {hasEffort ? <EffortInput value={effort} onChange={setEffort} /> : <p className="muted">No effort set.</p>}
        <label className="attempt-note-field">
          Memo
          <textarea value={memo} placeholder="Training memo" onChange={(event) => setMemo(event.target.value)} />
        </label>
      </div>
      {(error || validationError) && <p className="error">{error ?? validationError}</p>}
      <div className="form-actions attempt-editor-actions">
        <button type="button" className="danger" disabled={isSaving} onClick={handleDelete}>
          Delete
        </button>
        <button type="button" className="secondary" disabled={isSaving} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving || Boolean(validationError)}>
          Save
        </button>
      </div>
    </form>
  );
}

function getStrengthSetEditorError({
  name,
  endedAt,
  weight,
  reps,
  workDurationSeconds,
}: {
  name: string;
  endedAt: string;
  weight: string;
  reps: string;
  workDurationSeconds: string;
}): string | null {
  if (!name.trim()) {
    return "Strength sets name is required.";
  }
  if (!endedAt) {
    return "Strength sets end time is required.";
  }
  return (
    getOptionalNumericInputError(weight, { label: "Weight", min: 0 }) ??
    getOptionalNumericInputError(reps, { label: "Reps", integer: true, min: 0 }) ??
    getOptionalNumericInputError(workDurationSeconds, { label: "Work duration", min: 0 })
  );
}
