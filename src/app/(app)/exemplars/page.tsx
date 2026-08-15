"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseExemplarCsv } from "@/lib/exemplars/helpers";

type ExemplarSet = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  count?: number;
};

export default function ExemplarsPage() {
  const [sets, setSets] = useState<ExemplarSet[]>([]);
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    await fetch("/api/bootstrap", { method: "POST" });
    const supabase = createClient();
    const { data: setRows } = await supabase
      .from("exemplar_sets")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });

    const withCounts: ExemplarSet[] = [];
    for (const s of setRows ?? []) {
      const { count } = await supabase
        .from("exemplars")
        .select("*", { count: "exact", head: true })
        .eq("exemplar_set_id", s.id);
      withCounts.push({ ...s, count: count ?? 0 });
    }
    setSets(withCounts);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createFromCsv(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const cases = parseExemplarCsv(csv);
      if (cases.length < 1) throw new Error("Need at least one exemplar");

      const boot = await fetch("/api/bootstrap", { method: "POST" });
      const { orgId } = await boot.json();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: setRow, error: setErr } = await supabase
        .from("exemplar_sets")
        .insert({
          org_id: orgId,
          name: name.trim() || "Manual goldens",
          source_type: "csv",
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (setErr) throw setErr;

      const { error: exErr } = await supabase.from("exemplars").insert(
        cases.map((c, i) => ({
          org_id: orgId,
          exemplar_set_id: setRow.id,
          title: c.title,
          preconditions: c.preconditions,
          steps: c.steps,
          sort_order: i,
        })),
      );
      if (exErr) throw exErr;

      setName("");
      setCsv("");
      setOk(`Imported ${cases.length} exemplar${cases.length === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Exemplar library</h1>
      <p className="mt-1 max-w-2xl text-[var(--muted)]">
        Upload your best manually written test cases. Caseform imitates their
        style when generating new cases from a spec.
      </p>

      <form onSubmit={createFromCsv} className="panel mt-8 space-y-4 p-5">
        <h2 className="font-display text-lg">Import a set</h2>
        <label className="block text-sm">
          <span className="mb-1.5 block">Set name</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Checkout goldens"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block">CSV</span>
          <textarea
            className="field min-h-40 font-mono text-xs"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={`title,preconditions,step,expected\nLogin success,User exists,Open /login,Login form shown\nLogin success,User exists,Enter valid credentials,Dashboard loads`}
          />
        </label>
        <p className="text-xs text-[var(--muted)]">
          Columns: title, preconditions (optional), step/action, expected. Rows
          with the same title become one case with multiple steps. Aim for 3–8
          high-quality cases.
        </p>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {ok ? <p className="text-sm text-[var(--accent)]">{ok}</p> : null}
        <button type="submit" className="btn-primary">
          Import exemplars
        </button>
      </form>

      <div className="mt-10 space-y-3">
        <h2 className="font-display text-xl">Your sets</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : sets.length === 0 ? (
          <div className="panel p-6 text-sm text-[var(--muted)]">
            No exemplar sets yet. Import a few goldens to unlock better
            generation quality.
          </div>
        ) : (
          sets.map((s) => (
            <div key={s.id} className="panel flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {s.count ?? 0} case{(s.count ?? 0) === 1 ? "" : "s"}
                  {s.count !== undefined && s.count < 3
                    ? " · add more for best results"
                    : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
