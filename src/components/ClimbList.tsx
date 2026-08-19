import { useState } from "react";
import type { Attempt, Climb, Gym } from "../types/domain";
import { getAttemptCountsByClimb } from "../utils/attempts";
import { formatClimbLabel } from "../utils/climbs";

type ClimbListProps = {
  climbs: Climb[];
  attempts: Attempt[];
  gyms?: Gym[];
  currentClimbId: string | null;
  onSelect: (climbId: string) => void;
  onEdit: (climb: Climb) => void;
};

export function ClimbList({ climbs, attempts, gyms = [], currentClimbId, onSelect, onEdit }: ClimbListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const attemptCounts = getAttemptCountsByClimb(attempts);
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));

  return (
    <section className="section climb-section" aria-label="Recent climbs">
      <button
        type="button"
        className="timeline-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          Recent Climbs <small>· {climbs.length}</small>
        </span>
        <span className="timeline-chevron" aria-hidden="true">
          {isExpanded ? "⌃" : "⌄"}
        </span>
      </button>

      {isExpanded && (
        <div className="climb-scroll">
          {climbs.length === 0 ? (
            <p className="empty">No climbs yet.</p>
          ) : (
            <div className="climb-list">
              {climbs.map((climb) => (
                <div className={`climb-row ${climb.id === currentClimbId ? "selected" : ""}`} key={climb.id}>
                  <button className="climb-select" onClick={() => onSelect(climb.id)}>
                    <span>
                      <strong>{formatClimbLabel(climb)}</strong>
                      {climb.name ? ` ${climb.name}` : ""}
                      {climb.gymId && gymById.get(climb.gymId) ? (
                        <small className="climb-venue">{gymById.get(climb.gymId)?.name}</small>
                      ) : null}
                    </span>
                    <span className="muted">{attemptCounts.get(climb.id) ?? 0} attempts</span>
                  </button>
                  <button className="edit-action" onClick={() => onEdit(climb)}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
