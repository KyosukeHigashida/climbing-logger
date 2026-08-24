import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllAttempts, getAllSessions, getAllStrengthSets } from "../db/repository";
import {
  buildActivityStats,
  type ActivityStats,
  type EffortFilterLabel,
  type EffortFilterOperator,
  type StatsActivityType,
  type StatsBucket,
  type StatsEffortFilter,
  type StatsPeriod,
} from "../utils/stats";

const activityOptions: { value: StatsActivityType; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "climb", label: "Climb" },
  { value: "training", label: "Training" },
];

const periodOptions: { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" },
];

const effortOptions: { value: EffortFilterLabel; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
  { value: "extreme", label: "Extreme" },
];

const effortOperatorOptions: EffortFilterOperator[] = ["=", ">=", "<="];

export function StatsPage() {
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const attempts = useLiveQuery(() => getAllAttempts(), []);
  const strengthSets = useLiveQuery(() => getAllStrengthSets(), []);
  const [activityType, setActivityType] = useState<StatsActivityType>("activity");
  const [period, setPeriod] = useState<StatsPeriod>("30d");
  const [effortLabel, setEffortLabel] = useState<EffortFilterLabel>("all");
  const [effortOperator, setEffortOperator] = useState<EffortFilterOperator>(">=");
  const [showRpe, setShowRpe] = useState(true);
  const [showPerformance, setShowPerformance] = useState(true);

  const effortFilter: StatsEffortFilter = { label: effortLabel, operator: effortOperator };
  const stats = useMemo(
    () =>
      sessions && attempts && strengthSets
        ? buildActivityStats(sessions, attempts, strengthSets, { period, activityType, effortFilter })
        : null,
    [activityType, attempts, effortFilter.label, effortFilter.operator, period, sessions, strengthSets],
  );
  const unfilteredStats = useMemo(
    () =>
      sessions && attempts && strengthSets
        ? buildActivityStats(sessions, attempts, strengthSets, {
            period,
            activityType,
            effortFilter: { label: "all", operator: ">=" },
          })
        : null,
    [activityType, attempts, period, sessions, strengthSets],
  );

  if (!sessions || !attempts || !strengthSets || !stats || !unfilteredStats) {
    return <main className="app-shell loading">Loading stats...</main>;
  }

  const emptyMessage = !unfilteredStats.hasRecordsInRange
    ? "No activity in this period."
    : !stats.hasRecordsInRange
      ? "No records match this effort filter."
      : null;

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">Statistics</p>
          <h1>Activity Visualizer</h1>
        </div>
        <Link className="ghost-link" to="/">
          Home
        </Link>
      </header>

      <section className="section stats-chart-section" aria-label="Activity visualizer">
        <StatsChart stats={stats} activityType={activityType} showRpe={showRpe} showPerformance={showPerformance} />
        {emptyMessage && <p className="empty stats-empty">{emptyMessage}</p>}
        <div className="stats-chart-footer">
          <span>{stats.totalAttempts} attempts</span>
          <span>{stats.totalStrengthSets} sets</span>
          <span>{stats.unit} buckets</span>
        </div>
      </section>

      <section className="section stats-controls" aria-label="Stats controls">
        <SegmentedControl
          label="Activity type"
          value={activityType}
          options={activityOptions}
          onChange={(value) => setActivityType(value as StatsActivityType)}
        />
        <SegmentedControl label="Period" value={period} options={periodOptions} onChange={(value) => setPeriod(value as StatsPeriod)} />

        <div className="stats-filter-grid">
          <label>
            Effort
            <select value={effortLabel} onChange={(event) => setEffortLabel(event.target.value as EffortFilterLabel)}>
              {effortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Match
            <select
              value={effortOperator}
              disabled={effortLabel === "all"}
              onChange={(event) => setEffortOperator(event.target.value as EffortFilterOperator)}
            >
              {effortOperatorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="stats-overlay-toggles" aria-label="Overlay toggles">
          <label>
            <input type="checkbox" checked={showRpe} onChange={(event) => setShowRpe(event.target.checked)} />
            Session RPE
          </label>
          <label>
            <input type="checkbox" checked={showPerformance} onChange={(event) => setShowPerformance(event.target.checked)} />
            Performance
          </label>
        </div>
      </section>
    </main>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="stats-control-group">
      <span>{label}</span>
      <div className="stats-segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "selected" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatsChart({
  stats,
  activityType,
  showRpe,
  showPerformance,
}: {
  stats: ActivityStats;
  activityType: StatsActivityType;
  showRpe: boolean;
  showPerformance: boolean;
}) {
  const width = 360;
  const height = 230;
  const margin = { top: 18, right: 18, bottom: 30, left: 28 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(
    1,
    ...stats.buckets.map((bucket) =>
      activityType === "activity" ? bucket.attemptCount + bucket.strengthSetCount : activityType === "climb" ? bucket.attemptCount : bucket.strengthSetCount,
    ),
  );
  const barSlot = plotWidth / Math.max(stats.buckets.length, 1);
  const barWidth = Math.max(2, Math.min(18, barSlot * 0.72));
  const rpePoints = showRpe ? makeOverlayPoints(stats.buckets, "sessionRpeAverage", 10, margin.left, margin.top, plotWidth, plotHeight) : "";
  const performancePoints = showPerformance
    ? makeOverlayPoints(stats.buckets, "performanceAverage", 5, margin.left, margin.top, plotWidth, plotHeight)
    : "";
  const xLabels = getAxisLabelBuckets(stats.buckets);

  return (
    <div className="stats-chart-wrap">
      <svg className="stats-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Activity bar chart">
        <line className="stats-axis" x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} />
        <line className="stats-axis" x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} />
        <text className="stats-axis-label" x={margin.left - 6} y={margin.top + 4} textAnchor="end">
          count
        </text>
        <text className="stats-axis-label" x={width - margin.right} y={margin.top + 4} textAnchor="end">
          RPE / perf
        </text>

        {stats.buckets.map((bucket, index) => {
          const x = margin.left + index * barSlot + (barSlot - barWidth) / 2;
          const attemptHeight = (bucket.attemptCount / maxCount) * plotHeight;
          const setHeight = (bucket.strengthSetCount / maxCount) * plotHeight;
          const baseline = height - margin.bottom;
          const showAttempts = activityType !== "training";
          const showSets = activityType !== "climb";
          return (
            <g key={bucket.key}>
              <title>{describeBucket(bucket)}</title>
              {showAttempts && bucket.attemptCount > 0 && (
                <rect className="stats-bar-climb" x={x} y={baseline - attemptHeight} width={barWidth} height={attemptHeight} />
              )}
              {showSets && bucket.strengthSetCount > 0 && (
                <rect
                  className="stats-bar-training"
                  x={x}
                  y={baseline - (activityType === "activity" ? attemptHeight + setHeight : setHeight)}
                  width={barWidth}
                  height={setHeight}
                />
              )}
            </g>
          );
        })}

        {showRpe && rpePoints && <polyline className="stats-line-rpe" points={rpePoints} />}
        {showPerformance && performancePoints && <polyline className="stats-line-performance" points={performancePoints} />}
        {showRpe &&
          makeOverlayMarkers(stats.buckets, "sessionRpeAverage", 10, margin.left, margin.top, plotWidth, plotHeight).map((marker) => (
            <circle key={`rpe-${marker.key}`} className="stats-marker-rpe" cx={marker.x} cy={marker.y} r="3">
              <title>
                {marker.label}: RPE {marker.value.toFixed(1)}/10
              </title>
            </circle>
          ))}
        {showPerformance &&
          makeOverlayMarkers(stats.buckets, "performanceAverage", 5, margin.left, margin.top, plotWidth, plotHeight).map((marker) => (
            <circle key={`performance-${marker.key}`} className="stats-marker-performance" cx={marker.x} cy={marker.y} r="3">
              <title>
                {marker.label}: Performance {marker.value.toFixed(1)}/5
              </title>
            </circle>
          ))}

        {xLabels.map(({ bucket, index }) => (
          <text key={bucket.key} className="stats-axis-label" x={margin.left + index * barSlot + barSlot / 2} y={height - 10} textAnchor="middle">
            {bucket.label}
          </text>
        ))}
      </svg>
      <div className="stats-legend">
        <span>
          <i className="legend-climb" /> Climb
        </span>
        <span>
          <i className="legend-training" /> Training
        </span>
        {showRpe && (
          <span>
            <i className="legend-rpe" /> RPE
          </span>
        )}
        {showPerformance && (
          <span>
            <i className="legend-performance" /> Performance
          </span>
        )}
      </div>
    </div>
  );
}

function makeOverlayPoints(
  buckets: StatsBucket[],
  key: "sessionRpeAverage" | "performanceAverage",
  maxValue: number,
  marginLeft: number,
  marginTop: number,
  plotWidth: number,
  plotHeight: number,
): string {
  const denominator = Math.max(buckets.length - 1, 1);
  return buckets
    .map((bucket, index) => {
      const value = bucket[key];
      if (value === null) {
        return null;
      }
      const x = marginLeft + (index / denominator) * plotWidth;
      const y = marginTop + plotHeight - (value / maxValue) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((point): point is string => point !== null)
    .join(" ");
}

function makeOverlayMarkers(
  buckets: StatsBucket[],
  key: "sessionRpeAverage" | "performanceAverage",
  maxValue: number,
  marginLeft: number,
  marginTop: number,
  plotWidth: number,
  plotHeight: number,
): { key: string; label: string; value: number; x: number; y: number }[] {
  const denominator = Math.max(buckets.length - 1, 1);
  return buckets.flatMap((bucket, index) => {
    const value = bucket[key];
    if (value === null) {
      return [];
    }
    return [
      {
        key: bucket.key,
        label: bucket.label,
        value,
        x: marginLeft + (index / denominator) * plotWidth,
        y: marginTop + plotHeight - (value / maxValue) * plotHeight,
      },
    ];
  });
}

function getAxisLabelBuckets(buckets: StatsBucket[]): { bucket: StatsBucket; index: number }[] {
  if (buckets.length <= 8) {
    return buckets.map((bucket, index) => ({ bucket, index }));
  }
  const step = Math.ceil(buckets.length / 4);
  return buckets
    .map((bucket, index) => ({ bucket, index }))
    .filter(({ index }) => index === 0 || index === buckets.length - 1 || index % step === 0);
}

function describeBucket(bucket: StatsBucket): string {
  const parts = [`${bucket.label}: ${bucket.attemptCount} attempts, ${bucket.strengthSetCount} sets`];
  if (bucket.sessionRpeAverage !== null) {
    parts.push(`RPE ${bucket.sessionRpeAverage.toFixed(1)}/10`);
  }
  if (bucket.performanceAverage !== null) {
    parts.push(`Performance ${bucket.performanceAverage.toFixed(1)}/5`);
  }
  return parts.join(", ");
}
