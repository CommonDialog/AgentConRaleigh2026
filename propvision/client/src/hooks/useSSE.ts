import { useEffect, useState, useRef } from "react";

export interface JobUpdate {
  jobId: string;
  projectId: string;
  userId: string;
  status: "QUEUED" | "PROCESSING" | "STREAMING" | "COMPLETE" | "FAILED" | "CANCELLED";
  progress: number;
  step?: string;
  data?: unknown;
}

export function useJobStream(jobId: string | null) {
  const [update, setUpdate] = useState<JobUpdate | null>(null);
  const [history, setHistory] = useState<JobUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const startedAt = useRef<number>(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    const url = `/api/jobs/${jobId}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    startedAt.current = Date.now();
    setHistory([]);
    setUpdate(null);
    setError(null);

    es.addEventListener("init", () => setConnected(true));
    es.addEventListener("update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as JobUpdate;
        setUpdate(data);
        setHistory((h) => [...h, data]);
        if (data.status === "COMPLETE" || data.status === "FAILED" || data.status === "CANCELLED") {
          es.close();
        }
      } catch (err) {
        console.error(err);
      }
    });
    es.onerror = () => {
      setError("connection_lost");
      es.close();
    };

    const tick = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000)), 500);

    return () => {
      es.close();
      clearInterval(tick);
    };
  }, [jobId]);

  const etaSec = update && update.progress > 0 && update.progress < 100
    ? Math.max(1, Math.round((elapsedSec / update.progress) * (100 - update.progress)))
    : null;

  return { update, history, error, connected, elapsedSec, etaSec };
}
