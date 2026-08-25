import { useState } from "react";
import type { Attempt, Climb, Gym, StrengthSet } from "../types/domain";
import { getAttemptCountsByClimb } from "../utils/attempts";
import { formatClimbLabel } from "../utils/climbs";
import { buildRecentActivity, type RecentActivityFilter } from "../utils/recentActivity";

type ClimbListProps = {
  climbs: Climb[];
  attempts: Attempt[];
  strengthSets?: StrengthSet[];
  gyms?: Gym[];
  currentClimbId: string | null;
  currentStrengthSetId?: string | null;
  onSelect: (climbId: string) => void;
  onSelectStrength?: (strengthSet: StrengthSet) => void;
};

export function ClimbList({
  climbs,
  attempts,
  strengthSets = [],
  gyms = [],
  currentClimbId,
  currentStrengthSetId = null,
  onSelect,
  onSelectStrength,
}: ClimbListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<RecentActivityFilter>("activity");
  const attemptCounts = getAttemptCountsByClimb(attempts);
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));
  const activityItems = buildRecentActivity(climbs, attempts, strengthSets, filter);

  return (
    <section className="section climb-section" aria-label="Recent activity">
      <button
        type="button"
        className="timeline-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          Recent Activity <small>· {activityItems.length}</small>
        </span>
        <span className="timeline-chevron" aria-hidden="true">
          {isExpanded ? "⌃" : "⌄"}
        </span>
      </button>

      {isExpanded && (
        <div className="climb-scroll">
          <div className="activity-filter" role="tablist" aria-label="Recent activity filter">
            {(["activity", "climbs", "training"] as const).map((nextFilter) => (
              <button
                key={nextFilter}
                type="button"
                className={filter === nextFilter ? "selected" : ""}
                onClick={() => setFilter(nextFilter)}
              >
                {nextFilter === "activity" ? "Activity" : nextFilter === "climbs" ? "Climbs" : "Training"}
              </button>
            ))}
          </div>
          {activityItems.length === 0 ? (
            <p className="empty">Activity will appear here.</p>
          ) : (
            <div className="climb-list">
              {activityItems.map((item) => {
                if (item.type === "training") {
                  const completedSetCount = item.sets.filter((set) => set.endedAt !== null).length;
                  const isSelectedTraining = item.sets.some((set) => set.id === currentStrengthSetId);
                  return (
                    <div className={`climb-row training-row ${isSelectedTraining ? "selected" : ""}`} key={item.set.id}>
                      <button className="climb-select" onClick={() => onSelectStrength?.(item.set)}>
                        <span>
                          <strong>{item.name}</strong>
                          <small className="climb-venue">{formatStrengthSetMeta(item.set)}</small>
                        </span>
                        <span className="muted">{completedSetCount} sets</span>
                      </button>
                    </div>
                  );
                }

                const climb = item.climb;
                return (
                  <div className={`climb-row ${climb.id === currentClimbId ? "selected" : ""}`} key={climb.id}>
                    <button className="climb-select" onClick={() => onSelect(climb.id)}>
                      <span>
                        <strong>{formatClimbLabel(climb)}</strong>
                        {climb.name ? ` ${climb.name}` : ""}
                        {climb.gymId && gymById.get(climb.gymId) ? (
                          <small className="climb-venue">{gymById.get(climb.gymId)?.name}</small>
                        ) : null}
                      </span>
                      <span className="muted">
                        {attemptCounts.get(climb.id) ?? 0} attempts
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function formatStrengthSetMeta(set: StrengthSet): string {
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
  return parts.join(", ") || "Strength sets";
}
