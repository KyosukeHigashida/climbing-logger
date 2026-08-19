import { type FormEvent, useState } from "react";
import { EffortInput } from "./EffortInput";
import type { Attempt, AttemptEffort, AttemptResult, Climb, Gym } from "../types/domain";
import { formatClimbLabel } from "../utils/climbs";
import { applyLocalTimeWithinRange, formatReadableDate, toTimeInputValue } from "../utils/time";

type AttemptEditorProps = {
  attempt: Attempt;
  climbs: Climb[];
  gyms?: Gym[];
  sessionStartedAt: string;
  sessionEndedAt: string | null;
  onCancel: () => void;
  onDelete: (attemptId: string) => Promise<void>;
  onSave: (
    attemptId: string,
    update: { result: AttemptResult; timestamp: string; climbId: string; effort?: AttemptEffort | null },
  ) => Promise<void>;
};

export function AttemptEditor({
  attempt,
  climbs,
  gyms = [],
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
  const [effort, setEffort] = useState<AttemptEffort>(attempt.effort ?? 4);
  const [hasEffort, setHasEffort] = useState(attempt.effort !== undefined);
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));
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
        effort: hasEffort ? effort : null,
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
              {formatClimbLabel(climb)}
              {climb.name ? ` ${climb.name}` : ""}
              {climb.gymId && gymById.get(climb.gymId) ? ` / ${gymById.get(climb.gymId)?.name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="effort-editor">
        <div className="section-heading">
          <span className="label">Effort</span>
          <button type="button" className="small-text-action" onClick={() => setHasEffort((current) => !current)}>
            {hasEffort ? "Clear" : "Set"}
          </button>
        </div>
        {hasEffort ? <EffortInput value={effort} onChange={setEffort} /> : <p className="muted">No effort set.</p>}
      </div>
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
