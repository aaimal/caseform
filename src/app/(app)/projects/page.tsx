"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const boot = await fetch("/api/bootstrap", { method: "POST" });
      const bootJson = await boot.json();
      if (!boot.ok) {
        setError(bootJson.error || "Workspace setup failed");
        setProjects([]);
        return;
      }

      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("projects")
        .select("id, title, status, updated_at")
        .order("updated_at", { ascending: false });
      if (err) setError(err.message);
      setProjects((data as Project[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not create project");
        return;
      }
      setTitle("");
      router.push(`/projects/${json.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Projects</h1>
          <p className="mt-1 text-[var(--muted)]">
            Each project is one spec → generate → review loop.
          </p>
        </div>
      </div>

      <form
        onSubmit={createProject}
        className="panel mt-8 flex flex-wrap gap-3 p-4"
      >
        <input
          className="field max-w-md flex-1"
          placeholder="New project title — e.g. Checkout v2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={creating}
        />
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? "Creating…" : "Create project"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="font-display text-lg">No projects yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create one, attach exemplars, paste a spec, then generate.
            </p>
          </div>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="panel flex items-center justify-between px-5 py-4 transition hover:-translate-y-0.5"
            >
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="mt-0.5 text-xs capitalize text-[var(--muted)]">
                  {p.status}
                </div>
              </div>
              <span className="text-sm text-[var(--accent)]">Open →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
