import { useEffect, useState } from "react";
import { formatIntervalDuration } from "../utils/time";

type IntervalTimerProps = {
  since: string;
};

export function IntervalTimer({ since }: IntervalTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return <span>{formatIntervalDuration(now - new Date(since).getTime())}</span>;
}
