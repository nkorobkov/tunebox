import { useState, useEffect } from 'preact/hooks';
import { pb } from '../lib/pb';
import { useAuth } from '../lib/auth';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCalendar(logs, days = 365) {
  const counts = new Map();
  for (const log of logs) {
    const d = log.practiced_at ? new Date(log.practiced_at) : null;
    if (!d || isNaN(d)) continue;
    const key = isoDay(d);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);

  // Compute level thresholds from non-zero days so a few outliers don't wash out the scale.
  const values = [...counts.values()].sort((a, b) => a - b);
  const quantile = (q) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * q))] : 0;
  const t1 = Math.max(1, quantile(0.25));
  const t2 = Math.max(t1 + 1, quantile(0.5));
  const t3 = Math.max(t2 + 1, quantile(0.75));

  const levelFor = (count) => {
    if (count <= 0) return 0;
    if (count <= t1) return 1;
    if (count <= t2) return 2;
    if (count <= t3) return 3;
    return 4;
  };

  const data = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const day = new Date(t);
    const key = isoDay(day);
    const count = counts.get(key) || 0;
    data.push({ date: key, count, level: levelFor(count) });
  }
  return data;
}

export function usePracticeStats() {
  const { user } = useAuth();
  const userId = user?.id;
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const since = new Date(Date.now() - 365 * DAY_MS).toISOString();
    (async () => {
      try {
        const all = [];
        let page = 1;
        const perPage = 500;
        while (true) {
          const res = await pb.collection('practice_log').getList(page, perPage, {
            filter: `user = "${userId}" && practiced_at >= "${since}"`,
            fields: 'id,practiced_at',
            sort: '-practiced_at',
          });
          all.push(...res.items);
          if (res.items.length < perPage) break;
          page++;
          if (page > 20) break;
        }
        if (!cancelled) setLogs(all);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const calendar = logs ? buildCalendar(logs) : [];
  const totalSessions = logs ? logs.length : 0;

  return { calendar, totalSessions, loading, error };
}
