import type { Attempt, Climb, Gym } from "../types/domain";
import { getAttemptCountsByClimb } from "../utils/attempts";

type ClimbListProps = {
  climbs: Climb[];
  attempts: Attempt[];
  gyms?: Gym[];
  currentClimbId: string | null;
  onSelect: (climbId: string) => void;
  onAdd: () => void;
  onEdit: (climb: Climb) => void;
};

export function ClimbList({ climbs, attempts, gyms = [], currentClimbId, onSelect, onAdd, onEdit }: ClimbListProps) {
  const attemptCounts = getAttemptCountsByClimb(attempts);
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));

  return (
    <section className="section">
      <div className="section-heading">
        <h2>Recent Climbs</h2>
        <button className="icon-action" onClick={onAdd} aria-label="Add climb">
          +
        </button>
      </div>
      {climbs.length === 0 ? (
        <p className="empty">No climbs yet.</p>
      ) : (
        <div className="climb-list">
          {climbs.map((climb) => (
            <div
              className={`climb-row ${climb.id === currentClimbId ? "selected" : ""}`}
              key={climb.id}
            >
              <button className="climb-select" onClick={() => onSelect(climb.id)}>
                <span>
                  <strong>{climb.grade}</strong>
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
    </section>
  );
}
