import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home, Sun, Eraser, Pencil, Layers, Crop, ImageOff, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Empty, Skeleton } from "../components/Empty";

const FEATURES = [
  { to: "/staging", icon: Home, title: "Virtual Staging", desc: "Furnish empty rooms in any style.", cta: "Stage a Room" },
  { to: "/environmental", icon: Sun, title: "Environmental Edit", desc: "HDR, sky replace, day-to-dusk.", cta: "Enhance Photos" },
  { to: "/declutter", icon: Eraser, title: "Declutter & Remove", desc: "Auto-detect or paint to remove clutter.", cta: "Clean Up Photos" },
  { to: "/sketch", icon: Pencil, title: "Sketch to Render", desc: "Draw it. Render it photorealistic.", cta: "Start Sketching" },
  { to: "/optimize", icon: Layers, title: "Space Optimization", desc: "Layout, costs, sustainability.", cta: "Analyze Property" },
  { to: "/resize", icon: Crop, title: "Multi-Format Resize", desc: "Social, MLS, print — instantly.", cta: "Resize Images" },
];

interface ProjectListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  assets: { id: string; thumbnailUrl?: string | null; storageUrl: string }[];
}

export function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);

  useEffect(() => {
    api<{ items: ProjectListItem[] }>("/api/projects?limit=5").then((d) => setProjects(d.items)).catch(() => setProjects([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">What do you want to create?</h1>
            <p className="text-sm text-slate-500">Hi {user?.name?.split(" ")[0] ?? ""} — pick a tool to get started.</p>
          </div>
          <Link to="/billing" className="hidden sm:inline-flex badge bg-brand-50 text-brand-700">{user?.creditsBalance} credits</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="card p-5 hover:shadow-md transition group">
              <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1 mb-3">{f.desc}</p>
              <span className="text-sm font-medium text-brand-600 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                {f.cta} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Projects</h2>
          <Link to="/projects" className="text-sm text-brand-600">View all</Link>
        </div>
        {projects === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-3 w-3/4 mt-3" /></div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card">
            <Empty
              icon={<ImageOff size={24} />}
              title="No projects yet"
              description="Pick a tool above to create your first project."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="card p-3 hover:shadow-md transition">
                <div className="h-32 rounded bg-slate-100 overflow-hidden grid grid-cols-2 gap-px">
                  {p.assets.slice(0, 4).map((a) => (
                    <img key={a.id} src={a.thumbnailUrl || a.storageUrl} alt="" className="object-cover w-full h-full" loading="lazy" />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-medium truncate">{p.name}</div>
                  <span className="badge bg-slate-100 text-slate-700">{p.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{new Date(p.createdAt).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
