import { useEffect, useState } from "react";
import { getDownloadStats, onLimitChange, DAILY_LIMIT } from "./downloadLimit";

/** React hook: subscribe to download-limit stats so components can disable
 *  buttons, show remaining counts, etc.
 *
 *  Usage:
 *    const { remaining, resetsAt, limit } = useDownloadLimit();
 *    if (remaining === 0) <button disabled>...</button>
 */
function getDefaultStats() {
  return {
    count: 0,
    remaining: DAILY_LIMIT,
    resetsAt: null,
    limit: DAILY_LIMIT,
    date: null,
  };
}

export function useDownloadLimit() {
  const [stats, setStats] = useState(getDefaultStats);

  useEffect(() => {
    const refresh = () => setStats(getDownloadStats());
    refresh();
    return onLimitChange(refresh);
  }, []);

  return stats;
}
