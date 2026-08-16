"use client";

import { useEffect, useState } from "react";
import type { Step, TestCaseStatus } from "@/lib/types";

type CaseView = {
  id: string;
  title: string;
  preconditions: string;
  steps: Step[];
  status: TestCaseStatus;
  version: number;
  comments?: { id: string; body: string; consumed: boolean }[];
};

export function TestCaseCard({
  testCase,
  onSave,
  onAccept,
  onComment,
  onRegenerate,
}: {
  testCase: CaseView;
  onSave: (next: {
    title: string;
    preconditions: string;
    steps: Step[];
  }) => Promise<void>;
  onAccept: () => Promise<void>;
  onComment: (body: string) => Promise<void>;
  onRegenerate: (feedback?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(testCase.title);
  const [preconditions, setPreconditions] = useState(testCase.preconditions);
  const [steps, setSteps] = useState(testCase.steps);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(testCase.title);
    setPreconditions(testCase.preconditions);
    setSteps(testCase.steps);
  }, [
    testCase.id,
    testCase.version,
    testCase.title,
    testCase.preconditions,
    testCase.steps,
  ]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setLocalError(null);
    try {
      await fn();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent font-display text-lg text-[var(--ink)] outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <StatusPill status={testCase.status} />
            <span>v{testCase.version}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() =>
              run("save", () => onSave({ title, preconditions, steps }))
            }
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!!busy || testCase.status === "accepted"}
            onClick={() => run("accept", onAccept)}
          >
            {busy === "accept" ? "…" : "Accept"}
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Preconditions</span>
          <textarea
            className="field min-h-16"
            value={preconditions}
            onChange={(e) => setPreconditions(e.target.value)}
          />
        </label>

        <div>
          <div className="mb-2 text-sm text-[var(--muted)]">Steps</div>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li
                key={i}
                className="grid gap-2 rounded-lg bg-[var(--bg-soft)] p-3 sm:grid-cols-[auto_1fr]"
              >
                <span className="font-mono text-xs text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="space-y-2">
                  <input
                    className="field"
                    value={s.action}
                    placeholder="Action"
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = { ...s, action: e.target.value };
                      setSteps(next);
                    }}
                  />
                  <input
                    className="field"
                    value={s.expected}
                    placeholder="Expected result"
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = { ...s, expected: e.target.value };
                      setSteps(next);
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="mt-3 text-sm text-[var(--accent)]"
            onClick={() =>
              setSteps([...steps, { action: "", expected: "" }])
            }
          >
            + Add step
          </button>
        </div>

        <div className="rounded-xl border border-dashed border-[var(--line)] p-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--ink)]">
              Feedback for AI
            </span>
            <span className="mb-2 block text-xs text-[var(--muted)]">
              Type what should change, then regenerate — feedback is sent
              automatically.
            </span>
            <textarea
              className="field min-h-16"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Expected result should say the document is closed or minimized"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={!comment.trim() || !!busy}
              onClick={() =>
                run("comment", async () => {
                  await onComment(comment.trim());
                  setComment("");
                })
              }
            >
              {busy === "comment" ? "…" : "Save comment only"}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!!busy}
              onClick={() =>
                run("regen", async () => {
                  const pending = comment.trim();
                  if (
                    !pending &&
                    !(testCase.comments ?? []).some((c) => !c.consumed)
                  ) {
                    throw new Error(
                      "Add feedback in the box above before regenerating",
                    );
                  }
                  await onRegenerate(pending || undefined);
                  setComment("");
                })
              }
            >
              {busy === "regen" ? "Regenerating…" : "Regenerate this case"}
            </button>
          </div>
          {localError ? (
            <p className="mt-2 text-sm text-[var(--danger)]">{localError}</p>
          ) : null}
          {testCase.comments && testCase.comments.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
              {testCase.comments.map((c) => (
                <li key={c.id}>
                  {c.consumed ? "✓ " : "• "}
                  {c.body}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: TestCaseStatus }) {
  const map = {
    generated: "bg-sky-500/15 text-sky-800",
    edited: "bg-amber-500/15 text-amber-800",
    accepted: "bg-teal-500/15 text-teal-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 capitalize ${map[status]}`}>
      {status}
    </span>
  );
}
