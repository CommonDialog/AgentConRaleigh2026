import { prisma } from "./db.js";
import { createJob, enqueueAndPublish } from "./services/jobs.js";
import { streaming } from "./services/streaming.js";

async function main() {
  await streaming.connect();

  const user = await prisma.user.findFirst({ where: { email: "agent@propvision.local" } });
  if (!user) throw new Error("seed first");

  const project = await prisma.project.create({
    data: { userId: user.id, name: "Pipeline test", type: "STAGING" },
  });

  const created: string[] = [];
  for (let i = 0; i < 3; i++) {
    const job = await createJob({
      userId: user.id,
      projectId: project.id,
      type: "STAGING",
      params: { test: true, idx: i },
    });
    await enqueueAndPublish(job.id);
    created.push(job.id);
    console.log(`enqueued job ${i + 1}/3:`, job.id);
  }

  let done = 0;
  streaming.on("update", (p) => {
    if (created.includes(p.jobId)) {
      console.log(`[${p.jobId.slice(0, 8)}] ${p.status} ${p.progress}% — ${p.step}`);
      if (p.status === "COMPLETE" || p.status === "FAILED") {
        done++;
        if (done === 3) {
          console.log("all jobs complete");
          process.exit(0);
        }
      }
    }
  });

  setTimeout(() => {
    console.error("timeout — jobs did not complete");
    process.exit(1);
  }, 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
