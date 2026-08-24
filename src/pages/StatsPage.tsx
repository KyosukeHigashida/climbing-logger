import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScaleInput } from "../components/ScaleInput";
import { getAllAttempts, getAllSessions, getAllStrengthSets } from "../db/repository";
import type { EffortRating } from "../types/domain";
import { effortLabels } from "../utils/effort";
import {
  buildActivityStats,
  buildOverlaySegments,
  getBucketCenterX,
  type ActivityStats,
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
  { value: "7d", label: "Week" },
  { value: "30d", label: "Month" },
  { value: "6m", label: "Half year" },
  { value: "1y", label: "Year" },
  { value: "all", label: "ALL" },
];

const effortOperatorOptions: EffortFilterOperator[] = ["=", ">=", "<="];

export function StatsPage() {
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const attempts = useLiveQuery(() => getAllAttempts(), []);
  const strengthSets = useLiveQuery(() => getAllStrengthSets(), []);
  const [activityType, setActivityType] = useState<StatsActivityType>("activity");
  const [period, setPeriod] = useState<StatsPeriod>("30d");
  const [includeAllEfforts, setIncludeAllEfforts] = useState(true);
  const [effortValue, setEffortValue] = useState<EffortRating>(5);
  const [effortOperator, setEffortOperator] = useState<EffortFilterOperator>(">=");
  const [showRpe, setShowRpe] = useState(true);
  const [showPerformance, setShowPerformance] = useState(true);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  const effortFilter: StatsEffortFilter = { value: includeAllEfforts ? "all" : effortValue, operator: effortOperator };
  const stats = useMemo(
    () =>
      sessions && attempts && strengthSets
        ? buildActivityStats(sessions, attempts, strengthSets, { period, activityType, effortFilter })
        : null,
    [activityType, attempts, effortFilter.operator, effortFilter.value, period, sessions, strengthSets],
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

  const selectedBucket = stats.buckets.find((bucket) => bucket.key === selectedBucketKey) ?? null;
  const emptyMessage = getStatsEmptyMessage(activityType, unfilteredStats.hasRecordsInRange, stats.hasRecordsInRange);

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
        <StatsChart
          stats={stats}
          activityType={activityType}
          showRpe={showRpe}
          showPerformance={showPerformance}
          selectedBucketKey={selectedBucket?.key ?? null}
          onSelectBucket={setSelectedBucketKey}
        />
        {selectedBucket && <SelectedBucketDetails bucket={selectedBucket} />}
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

        <div className="stats-effort-filter">
          <div className="section-heading">
            <span className="label">Effort</span>
            <label className="skip-effort-toggle">
              <input type="checkbox" checked={includeAllEfforts} onChange={(event) => setIncludeAllEfforts(event.target.checked)} />
              All
            </label>
          </div>
          <div className={includeAllEfforts ? "stats-effort-slider disabled" : "stats-effort-slider"}>
            <ScaleInput
              min={1}
              max={7}
              value={effortValue}
              valueLabel={includeAllEfforts ? "All efforts" : `${effortLabels[effortValue]} ${effortOperator}`}
              labels={[
                { value: 1, label: "Easy" },
                { value: 3, label: "Moderate" },
                { value: 5, label: "Hard" },
                { value: 7, label: "Extreme" },
              ]}
              ariaLabel="Stats effort filter"
              selectionMode={effortOperator === "=" ? "point" : effortOperator === ">=" ? "right" : "left"}
              onChange={(value) => {
                setEffortValue(value as EffortRating);
                setIncludeAllEfforts(false);
              }}
            />
          </div>
          <div className="stats-operator-control" aria-label="Effort match">
            {effortOperatorOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={effortOperator === option ? "selected" : ""}
                disabled={includeAllEfforts}
                onClick={() => setEffortOperator(option)}
              >
                {option}
              </button>
            ))}
          </div>
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
  selectedBucketKey,
  onSelectBucket,
}: {
  stats: ActivityStats;
  activityType: StatsActivityType;
  showRpe: boolean;
  showPerformance: boolean;
  selectedBucketKey: string | null;
  onSelectBucket: (bucketKey: string) => void;
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
  const overlayLayout = { marginLeft: margin.left, marginTop: margin.top, plotHeight, barSlot };
  const rpeSegments = showRpe ? buildOverlaySegments(stats.buckets, "sessionRpeAverage", 10, overlayLayout) : [];
  const performanceSegments = showPerformance ? buildOverlaySegments(stats.buckets, "performanceAverage", 5, overlayLayout) : [];
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
          const bucketCenter = getBucketCenterX(index, margin.left, barSlot);
          return (
            <g key={bucket.key} onClick={() => onSelectBucket(bucket.key)}>
              <title>{describeBucket(bucket)}</title>
              <rect
                className="stats-bucket-hit-area"
                x={margin.left + index * barSlot}
                y={margin.top}
                width={barSlot}
                height={plotHeight}
                onClick={() => onSelectBucket(bucket.key)}
              />
              {selectedBucketKey === bucket.key && (
                <rect className="stats-bucket-selected" x={margin.left + index * barSlot + 1} y={margin.top} width={Math.max(1, barSlot - 2)} height={plotHeight} />
              )}
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
              <circle className="stats-bucket-tap-target" cx={bucketCenter} cy={baseline} r="8" onClick={() => onSelectBucket(bucket.key)}>
                <title>{describeBucket(bucket)}</title>
              </circle>
            </g>
          );
        })}

        {rpeSegments.map((segment, index) => (
          <polyline key={`rpe-segment-${index}`} className="stats-line-rpe" points={toSvgPoints(segment.points)} />
        ))}
        {performanceSegments.map((segment, index) => (
          <polyline key={`performance-segment-${index}`} className="stats-line-performance" points={toSvgPoints(segment.points)} />
        ))}
        {showRpe &&
          rpeSegments.flatMap((segment) => segment.points).map((marker) => (
            <circle key={`rpe-${marker.key}`} className="stats-marker-rpe" cx={marker.x} cy={marker.y} r="3">
              <title>
                {marker.label}: RPE {marker.value.toFixed(1)}/10
              </title>
            </circle>
          ))}
        {showPerformance &&
          performanceSegments.flatMap((segment) => segment.points).map((marker) => (
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

function toSvgPoints(points: { x: number; y: number }[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function SelectedBucketDetails({ bucket }: { bucket: StatsBucket }) {
  return (
    <div className="stats-bucket-details" aria-live="polite">
      <strong>{bucket.label}</strong>
      <span>{bucket.attemptCount} attempts</span>
      <span>{bucket.strengthSetCount} training sets</span>
      {bucket.sessionRpeAverage !== null && <span>Session RPE {bucket.sessionRpeAverage.toFixed(1)}</span>}
      {bucket.performanceAverage !== null && <span>Performance {bucket.performanceAverage.toFixed(1)}</span>}
    </div>
  );
}

function getStatsEmptyMessage(activityType: StatsActivityType, hasUnfilteredRecords: boolean, hasFilteredRecords: boolean): string | null {
  if (!hasUnfilteredRecords) {
    if (activityType === "climb") {
      return "No climb attempts in this period.";
    }
    if (activityType === "training") {
      return "No training sets in this period.";
    }
    return "No activity in this period.";
  }
  if (hasFilteredRecords) {
    return null;
  }
  if (activityType === "climb") {
    return "No climb attempts match this effort filter.";
  }
  if (activityType === "training") {
    return "No training sets match this effort filter.";
  }
  return "No activity matches this effort filter.";
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
