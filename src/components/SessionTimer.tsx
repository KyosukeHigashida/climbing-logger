import { useEffect, useState } from "react";
import { formatClockDuration } from "../utils/time";

type SessionTimerProps = {
  startedAt: string;
  endedAt?: string | null;
};

export function SessionTimer({ startedAt, endedAt = null }: SessionTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [endedAt]);

  const end = endedAt ? new Date(endedAt).getTime() : now;
  return <span>{formatClockDuration(end - new Date(startedAt).getTime())}</span>;
}
