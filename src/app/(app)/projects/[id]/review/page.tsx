"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Stepper } from "@/components/Stepper";
import { TestCaseCard } from "@/components/TestCaseCard";
import { createClient } from "@/lib/supabase/client";
import type { Step, TestCaseStatus } from "@/lib/types";

type CaseRow = {
  id: string;
  title: string;
  preconditions: string;
  steps: Step[];
  status: TestCaseStatus;
  version: number;
  comments: { id: string; body: string; consumed: boolean }[];
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeEdited, setIncludeEdited] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("title")
      .eq("id", id)
      .single();
    setTitle(project?.title ?? "");

    const { data: rows } = await supabase
      .from("test_cases")
      .select("id, title, preconditions, steps, status, version")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    const withComments: CaseRow[] = [];
    for (const row of rows ?? []) {
      const { data: comments } = await supabase
        .from("test_case_comments")
        .select("id, body, consumed_in_generation_id")
        .eq("test_case_id", row.id)
        .order("created_at", { ascending: true });
      withComments.push({
        ...(row as Omit<CaseRow, "comments">),
        comments: (comments ?? []).map((c) => ({
          id: c.id,
          body: c.body,
          consumed: Boolean(c.consumed_in_generation_id),
        })),
      });
    }
    setCases(withComments);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCase(
    caseId: string,
    next: { title: string; preconditions: string; steps: Step[] },
  ) {
    const supabase = createClient();
    const current = cases.find((c) => c.id === caseId);
    await supabase.from("test_case_revisions").insert({
      org_id: (await getOrgId())!,
      test_case_id: caseId,
      before: current
        ? {
            title: current.title,
            preconditions: current.preconditions,
            steps: current.steps,
          }
        : null,
      after: next,
      source: "user",
    });
    await supabase
      .from("test_cases")
      .update({
        ...next,
        status: "edited",
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);
    await load();
  }

  async function getOrgId() {
    const res = await fetch("/api/bootstrap", { method: "POST" });
    const json = await res.json();
    return json.orgId as string;
  }

  async function acceptCase(caseId: string) {
    const supabase = createClient();
    await supabase
      .from("test_cases")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", caseId);
    await load();
  }

  async function addComment(caseId: string, body: string) {
    const orgId = await getOrgId();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("test_case_comments").insert({
      org_id: orgId,
      project_id: id,
      test_case_id: caseId,
      body,
      author_id: user?.id,
    });
    await load();
  }

  async function regenerate(caseId: string, feedback?: string) {
    setError(null);
    const res = await fetch("/api/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        testCaseId: caseId,
        feedback: feedback || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Regeneration failed");
    }
    await load();
  }

  const accepted = cases.filter((c) => c.status === "accepted").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">
            <Link href="/projects" className="hover:text-[var(--ink)]">
              Projects
            </Link>{" "}
            /{" "}
            <Link href={`/projects/${id}`} className="hover:text-[var(--ink)]">
              {title || "Project"}
            </Link>{" "}
            / Review
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-tight">Review</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Edit inline, leave feedback, accept the keepers. Export accepted
            cases only by default.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={includeEdited}
              onChange={(e) => setIncludeEdited(e.target.checked)}
            />
            Include edited in export
          </label>
          <a
            className="btn-ghost"
            href={`/api/export/${id}?format=csv${includeEdited ? "&includeEdited=1" : ""}`}
          >
            Export CSV
          </a>
          <a
            className="btn-secondary"
            href={`/api/export/${id}?format=jira${includeEdited ? "&includeEdited=1" : ""}`}
          >
            Jira CSV
          </a>
        </div>
      </div>

      <Stepper step={4} />

      <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
        <span>{cases.length} cases</span>
        <span>·</span>
        <span>{accepted} accepted</span>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {cases.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-lg">No cases yet</p>
          <Link href={`/projects/${id}`} className="mt-3 inline-block text-[var(--accent)]">
            Go generate →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {cases.map((c) => (
            <TestCaseCard
              key={c.id}
              testCase={c}
              onSave={(next) => saveCase(c.id, next)}
              onAccept={() => acceptCase(c.id)}
              onComment={(body) => addComment(c.id, body)}
              onRegenerate={(feedback) => regenerate(c.id, feedback)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
