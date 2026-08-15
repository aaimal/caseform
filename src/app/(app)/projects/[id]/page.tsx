"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GenerationBriefForm } from "@/components/GenerationBriefForm";
import { Stepper } from "@/components/Stepper";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_BRIEF, type GenerationBrief } from "@/lib/types";

type ExemplarSet = { id: string; name: string; count: number };

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState("");
  const [specId, setSpecId] = useState<string | null>(null);
  const [brief, setBrief] = useState<GenerationBrief>(DEFAULT_BRIEF);
  const [sets, setSets] = useState<ExemplarSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [caseCount, setCaseCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const step = useMemo(() => {
    if (caseCount > 0) return 4;
    if (spec.trim() && selectedSetId) return 3;
    if (selectedSetId) return 2;
    return 1;
  }, [caseCount, spec, selectedSetId]);

  const load = useCallback(async () => {
    const boot = await fetch("/api/bootstrap", { method: "POST" });
    const bootJson = await boot.json();
    setOrgId(bootJson.orgId);

    const supabase = createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("title, generation_brief")
      .eq("id", id)
      .single();
    if (project) {
      setTitle(project.title);
      if (project.generation_brief) {
        setBrief({ ...DEFAULT_BRIEF, ...project.generation_brief });
      }
    }

    const { data: specs } = await supabase
      .from("specifications")
      .select("id, raw_text")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (specs?.[0]) {
      setSpec(specs[0].raw_text);
      setSpecId(specs[0].id);
    }

    const { data: links } = await supabase
      .from("project_exemplar_sets")
      .select("exemplar_set_id")
      .eq("project_id", id);
    if (links?.[0]) setSelectedSetId(links[0].exemplar_set_id);

    const { data: setRows } = await supabase
      .from("exemplar_sets")
      .select("id, name");
    const withCounts: ExemplarSet[] = [];
    for (const s of setRows ?? []) {
      const { count } = await supabase
        .from("exemplars")
        .select("*", { count: "exact", head: true })
        .eq("exemplar_set_id", s.id);
      withCounts.push({ id: s.id, name: s.name, count: count ?? 0 });
    }
    setSets(withCounts);

    const { count } = await supabase
      .from("test_cases")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id);
    setCaseCount(count ?? 0);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSpecAndBrief() {
    setError(null);
    setMessage(null);
    if (!orgId) throw new Error("Workspace not ready");
    const supabase = createClient();

    await supabase
      .from("projects")
      .update({
        generation_brief: brief,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (specId) {
      await supabase
        .from("specifications")
        .update({ raw_text: spec })
        .eq("id", specId);
    } else if (spec.trim()) {
      const { data } = await supabase
        .from("specifications")
        .insert({
          org_id: orgId,
          project_id: id,
          source_type: "paste",
          raw_text: spec,
        })
        .select("id")
        .single();
      setSpecId(data?.id ?? null);
    }

    await supabase.from("project_exemplar_sets").delete().eq("project_id", id);
    if (selectedSetId) {
      await supabase.from("project_exemplar_sets").insert({
        project_id: id,
        exemplar_set_id: selectedSetId,
      });
    }
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!selectedSetId) throw new Error("Select an exemplar set");
      if (!spec.trim()) throw new Error("Paste a specification");
      const selected = sets.find((s) => s.id === selectedSetId);
      if (!selected || selected.count < 1) {
        throw new Error("Exemplar set needs at least one case");
      }
      await saveSpecAndBrief();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setMessage(
        `Generated ${json.count} cases` +
          (json.droppedDrift
            ? ` (${json.droppedDrift} near-duplicate titles dropped)`
            : ""),
      );
      router.push(`/projects/${id}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">
            <Link href="/projects" className="hover:text-[var(--ink)]">
              Projects
            </Link>{" "}
            / {title || "Workspace"}
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-tight">
            {title || "Project"}
          </h1>
        </div>
        {caseCount > 0 ? (
          <Link href={`/projects/${id}/review`} className="btn-secondary">
            Open review ({caseCount})
          </Link>
        ) : null}
      </div>

      <Stepper step={step} />

      <section className="panel space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg">1 · Exemplars</h2>
          <Link href="/exemplars" className="text-sm text-[var(--accent)]">
            Manage library
          </Link>
        </div>
        {sets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Import goldens in the Exemplars library first.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSetId(s.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selectedSetId === s.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {s.count} case{s.count === 1 ? "" : "s"}
                  {s.count < 3 ? " · recommend 3+" : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-lg">2 · Specification</h2>
        <textarea
          className="field min-h-48 font-mono text-sm"
          placeholder="Paste requirements / PRD text here…"
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
        />
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-lg">3 · Generation brief</h2>
        <p className="text-sm text-[var(--muted)]">
          Detail and emphasis knobs. Exemplars still teach writing style.
        </p>
        <GenerationBriefForm value={brief} onChange={setBrief} />
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              saveSpecAndBrief()
                .then(() => setMessage("Saved"))
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Save failed"),
                )
            }
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={onGenerate}
          >
            {busy ? "Generating…" : "Generate test cases"}
          </button>
        </div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
      </section>
    </div>
  );
}
