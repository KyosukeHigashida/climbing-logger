import { useEffect, useState } from "react";
import { formatRestDuration } from "../utils/time";

type RestTimerProps = {
  lastAttemptAt: string | null;
};

export function RestTimer({ lastAttemptAt }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!lastAttemptAt) {
    return <span className="muted">-</span>;
  }

  return <span>{formatRestDuration(now - new Date(lastAttemptAt).getTime())}</span>;
}
