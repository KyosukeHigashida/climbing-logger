import { useState } from "react";
import type { Attempt, Climb, Gym, StrengthSet } from "../types/domain";
import { sortAttemptsByTimestampDesc } from "../utils/attempts";
import { formatClimbLabel } from "../utils/climbs";
import { effortLabels } from "../utils/effort";
import { formatIntervalDuration, formatTime } from "../utils/time";
import { buildSessionTimeline } from "../utils/timeline";

type AttemptTimelineProps = {
  attempts: Attempt[];
  strengthSets?: StrengthSet[];
  climbs: Climb[];
  gyms?: Gym[];
  onEdit?: (attempt: Attempt) => void;
  onEditStrength?: (strengthSet: StrengthSet) => void;
};

export function AttemptTimeline({ attempts, strengthSets = [], climbs, gyms = [], onEdit, onEditStrength }: AttemptTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));
  const sortedAttempts = sortAttemptsByTimestampDesc(attempts);
  const timelineItems = [...buildSessionTimeline(attempts, strengthSets)].reverse();
  const actionCount = sortedAttempts.length + strengthSets.filter((set) => set.endedAt !== null).length;

  return (
    <section className="section timeline-section" aria-label="Timeline">
      <button
        type="button"
        className="timeline-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          Timeline <small>· {actionCount}</small>
        </span>
        <span className="timeline-chevron" aria-hidden="true">
          {isExpanded ? "⌃" : "⌄"}
        </span>
      </button>

      {isExpanded && (
        <div className="timeline-scroll">
          {timelineItems.length === 0 ? (
            <p className="empty">Attempts will appear here.</p>
          ) : (
            <ol className="timeline">
              {timelineItems.map((item) => {
                if (item.type === "rest") {
                  return (
                    <li key={item.id} className="timeline-item rest-block">
                      <div className="timeline-time">{formatTime(item.startedAt)}</div>
                      <div className="timeline-rest-card">REST {formatIntervalDuration(item.durationMs)}</div>
                    </li>
                  );
                }

                if (item.type === "strength") {
                  const set = item.set;
                  const strengthMeta = formatStrengthTimelineMeta(set);
                  return (
                    <li key={set.id} className="timeline-item">
                      <div className="timeline-time">{formatTime(item.endedAt)}</div>
                      <div>
                        <div className="timeline-title">{set.name}</div>
                        <div className="timeline-rest">Action {formatIntervalDuration(item.actionDurationMs)}</div>
                        <div className="timeline-rest">
                          {formatTime(item.startedAt)}-{formatTime(item.endedAt)}
                        </div>
                        {strengthMeta && <div className="timeline-effort">{strengthMeta}</div>}
                        {set.effort !== null && set.effort !== undefined && (
                          <div className="timeline-effort">Effort: {effortLabels[set.effort]}</div>
                        )}
                        {set.note && <div className="timeline-note">{set.note}</div>}
                        {onEditStrength && (
                          <button className="edit-attempt-button" onClick={() => onEditStrength(set)}>
                            Edit set
                          </button>
                        )}
                      </div>
                    </li>
                  );
                }

                const attempt = item.attempt;
                const climb = climbById.get(attempt.climbId);

                return (
                  <li key={attempt.id} className="timeline-item">
                    <div className="timeline-time">{item.endedAt ? formatTime(item.endedAt) : "--"}</div>
                    <div>
                      <div className="timeline-title">
                        <span className="timeline-title-main">
                          {climb ? (
                            <>
                              {formatClimbLabel(climb)}
                              {climb.name ? ` ${climb.name}` : ""}
                              {climb.gymId && gymById.get(climb.gymId) ? (
                                <small className="climb-venue">{gymById.get(climb.gymId)?.name}</small>
                              ) : null}
                            </>
                          ) : (
                            "Unknown climb"
                          )}
                        </span>
                        <span className={`result-pill ${attempt.result ?? "pending"}`}>
                          {(attempt.result ?? "pending").toUpperCase()}
                        </span>
                      </div>
                      <div className="timeline-rest">
                        Action {item.actionDurationMs === null ? "--" : formatIntervalDuration(item.actionDurationMs)}
                      </div>
                      <div className="timeline-rest">
                        {item.startedAt ? `${formatTime(item.startedAt)}-` : "-- -"}
                        {item.endedAt ? formatTime(item.endedAt) : "--"}
                      </div>
                      {attempt.effort !== undefined && (
                        <div className="timeline-effort">Effort: {effortLabels[attempt.effort]}</div>
                      )}
                      {attempt.note && <div className="timeline-note">{attempt.note}</div>}
                      {onEdit && (
                        <button className="edit-attempt-button" onClick={() => onEdit(attempt)}>
                          Edit attempt
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function formatStrengthTimelineMeta(set: StrengthSet): string {
  const parts: string[] = [];
  if (set.weight !== null && set.weight !== undefined && set.reps !== null && set.reps !== undefined) {
    parts.push(`${set.weight} kg`, `${set.reps} reps`);
  } else if (set.weight !== null && set.weight !== undefined) {
    parts.push(`${set.weight} kg`);
  } else if (set.reps !== null && set.reps !== undefined) {
    parts.push(`${set.reps} reps`);
  }
  if (set.workDurationSeconds !== null && set.workDurationSeconds !== undefined) {
    parts.push(`${set.workDurationSeconds} sec`);
  }
  return parts.join(", ");
}
