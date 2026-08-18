import { type FormEvent, useState } from "react";
import type { Attempt, AttemptResult, Climb } from "../types/domain";
import { applyLocalTimeWithinRange, formatReadableDate, toTimeInputValue } from "../utils/time";

type AttemptEditorProps = {
  attempt: Attempt;
  climbs: Climb[];
  sessionStartedAt: string;
  sessionEndedAt: string | null;
  onCancel: () => void;
  onDelete: (attemptId: string) => Promise<void>;
  onSave: (attemptId: string, update: { result: AttemptResult; timestamp: string; climbId: string }) => Promise<void>;
};

export function AttemptEditor({
  attempt,
  climbs,
  sessionStartedAt,
  sessionEndedAt,
  onCancel,
  onDelete,
  onSave,
}: AttemptEditorProps) {
  const [result, setResult] = useState<AttemptResult>(attempt.result);
  const initialTime = toTimeInputValue(attempt.timestamp);
  const [time, setTime] = useState(initialTime);
  const [climbId, setClimbId] = useState(attempt.climbId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await onSave(attempt.id, {
        result,
        timestamp:
          time === initialTime
            ? attempt.timestamp
            : applyLocalTimeWithinRange(attempt.timestamp, time, sessionStartedAt, sessionEndedAt),
        climbId,
      });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update attempt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setError(null);

    try {
      await onDelete(attempt.id);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete attempt.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="attempt-editor" onSubmit={handleSubmit}>
      <div className="segmented-control">
        <button
          type="button"
          className={result === "fail" ? "active" : ""}
          onClick={() => setResult("fail")}
        >
          FAIL
        </button>
        <button
          type="button"
          className={result === "send" ? "active" : ""}
          onClick={() => setResult("send")}
        >
          SEND
        </button>
      </div>
      <label>
        Date
        <div className="readonly-date">{formatReadableDate(attempt.timestamp)}</div>
      </label>
      <label>
        Time
        <input
          className="timestamp-input"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </label>
      <label>
        Climb
        <select value={climbId} onChange={(event) => setClimbId(event.target.value)}>
          {climbs.map((climb) => (
            <option key={climb.id} value={climb.id}>
              {climb.grade}
              {climb.name ? ` ${climb.name}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions attempt-editor-actions">
        <button type="button" className="danger" disabled={isSaving} onClick={handleDelete}>
          Delete
        </button>
        <button type="button" className="secondary" disabled={isSaving} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving}>
          Save
        </button>
      </div>
    </form>
  );
}
