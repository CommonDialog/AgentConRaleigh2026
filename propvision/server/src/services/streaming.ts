import { Client } from "pg";
import { EventEmitter } from "events";
import { env } from "../env.js";

export interface JobUpdatePayload {
  jobId: string;
  projectId: string;
  userId: string;
  status: "QUEUED" | "PROCESSING" | "STREAMING" | "COMPLETE" | "FAILED" | "CANCELLED";
  progress: number;
  step?: string;
  data?: unknown;
}

class StreamingService extends EventEmitter {
  private client: Client | null = null;
  private connected = false;
  private connecting: Promise<void> | null = null;

  async connect() {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      this.client = new Client({ connectionString: env.DATABASE_URL });
      await this.client.connect();
      await this.client.query("LISTEN job_updates");
      this.client.on("notification", (msg) => {
        if (msg.channel !== "job_updates" || !msg.payload) return;
        try {
          const payload = JSON.parse(msg.payload) as JobUpdatePayload;
          this.emit("update", payload);
          this.emit(`update:${payload.jobId}`, payload);
        } catch (err) {
          console.error("[streaming] failed to parse payload", err);
        }
      });
      this.client.on("error", (err) => {
        console.error("[streaming] pg client error", err);
        this.connected = false;
      });
      this.connected = true;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async notify(payload: JobUpdatePayload) {
    if (!this.client || !this.connected) await this.connect();
    if (!this.client) return;
    await this.client.query("SELECT pg_notify('job_updates', $1)", [JSON.stringify(payload)]);
  }

  onJob(jobId: string, handler: (payload: JobUpdatePayload) => void) {
    this.on(`update:${jobId}`, handler);
    return () => this.off(`update:${jobId}`, handler);
  }
}

export const streaming = new StreamingService();
