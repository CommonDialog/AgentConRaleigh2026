import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { api } from "../lib/api";
import { Empty, Skeleton } from "../components/Empty";

interface ProjectListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  assets: { id: string; thumbnailUrl?: string | null; storageUrl: string }[];
  _count: { jobs: number; assets: number };
}

export function Projects() {
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const u = cursor ? `/api/projects?cursor=${cursor}&limit=20` : "/api/projects?limit=20";
    api<{ items: ProjectListItem[]; nextCursor: string | null }>(u).then((d) => {
      setItems((prev) => (cursor && prev ? [...prev, ...d.items] : d.items));
      setNext(d.nextCursor);
    });
  }, [cursor]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-bold mb-4">Your Projects</h1>
      {items === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-3"><Skeleton className="h-40" /><Skeleton className="h-3 w-3/4 mt-3" /></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <Empty
            icon={<ImageOff size={24} />}
            title="No projects yet"
            description="Create your first project from the Dashboard."
            action={<Link to="/" className="btn-primary">Go to Dashboard</Link>}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="card p-3 hover:shadow-md transition">
                <div className="h-40 rounded bg-slate-100 overflow-hidden grid grid-cols-2 gap-px">
                  {p.assets.slice(0, 4).map((a) => (
                    <img key={a.id} src={a.thumbnailUrl || a.storageUrl} alt="" className="object-cover w-full h-full" loading="lazy" />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-medium truncate">{p.name}</div>
                  <span className="badge bg-slate-100 text-slate-700">{p.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex justify-between">
                  <span>{p.type.replace(/_/g, " ")}</span>
                  <span>{p._count.assets} assets · {p._count.jobs} jobs</span>
                </div>
              </Link>
            ))}
          </div>
          {next && (
            <div className="text-center mt-6">
              <button className="btn-secondary" onClick={() => setCursor(next)}>Load more</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
