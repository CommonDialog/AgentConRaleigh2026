import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Skeleton } from "../components/Empty";

interface Asset { id: string; type: string; storageUrl: string; thumbnailUrl?: string | null; createdAt: string }
interface Job { id: string; type: string; status: string; createdAt: string; result?: unknown; error?: string | null }

interface Project {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  createdAt: string;
  assets: Asset[];
  jobs: Job[];
}

export function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Project>(`/api/projects/${id}`).then(setProject);
  }, [id]);

  if (!project) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500"><Link to="/projects" className="hover:underline">Projects</Link> / {project.type}</div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
        </div>
        <span className="badge bg-slate-100 text-slate-700">{project.status}</span>
      </div>

      <section>
        <h2 className="font-semibold mb-3">Assets ({project.assets.length})</h2>
        {project.assets.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No assets yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {project.assets.map((a) => (
              <a key={a.id} href={a.storageUrl} target="_blank" rel="noopener" className="card p-2 block hover:shadow">
                <div className="aspect-square bg-slate-100 rounded overflow-hidden">
                  <img src={a.thumbnailUrl || a.storageUrl} alt={a.type} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="text-xs text-slate-500 mt-2">{a.type.replace(/_/g, " ")}</div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Job History ({project.jobs.length})</h2>
        {project.jobs.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No jobs yet.</div>
        ) : (
          <div className="card divide-y">
            {project.jobs.map((j) => (
              <div key={j.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{j.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-slate-500">{new Date(j.createdAt).toLocaleString()}</div>
                </div>
                <span className={`badge ${j.status === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : j.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
