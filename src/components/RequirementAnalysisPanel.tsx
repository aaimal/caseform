"use client";

import type { RequirementAnalysis } from "@/lib/types";

type AnalysisView = Pick<
  RequirementAnalysis,
  | "ambiguities"
  | "scenarios"
  | "acceptanceCriteriaGaps"
  | "riskPriorities"
>;

const riskClass: Record<string, string> = {
  high: "bg-red-500/15 text-red-800",
  medium: "bg-amber-500/15 text-amber-800",
  low: "bg-teal-500/15 text-teal-800",
};

export function RequirementAnalysisPanel({
  analysis,
}: {
  analysis: AnalysisView | null | undefined;
}) {
  if (!analysis) return null;

  const {
    ambiguities = [],
    scenarios = [],
    acceptanceCriteriaGaps = [],
    riskPriorities = [],
  } = analysis;

  const riskByScenario = new Map(
    riskPriorities.map((r) => [r.scenarioId, r]),
  );

  return (
    <section className="panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-xl tracking-tight">
          Requirement analysis
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ambiguity, scenarios, acceptance-criteria gaps, and risk priorities
          derived from the specification before test cases were generated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Ambiguities" value={ambiguities.length} />
        <Stat label="Scenarios" value={scenarios.length} />
        <Stat label="AC gaps" value={acceptanceCriteriaGaps.length} />
        <Stat
          label="High risk"
          value={riskPriorities.filter((r) => r.riskLevel === "high").length}
        />
      </div>

      <AnalysisBlock
        title="Ambiguity detection"
        empty="No ambiguities flagged."
        count={ambiguities.length}
      >
        {ambiguities.map((a) => (
          <li key={a.id} className="rounded-lg bg-[var(--bg-soft)] p-3 text-sm">
            <div className="font-medium text-[var(--ink)]">{a.issue}</div>
            <p className="mt-1 text-[var(--muted)]">
              <span className="font-mono text-xs">Excerpt:</span> {a.excerpt}
            </p>
            <p className="mt-1 text-[var(--accent)]">{a.suggestion}</p>
          </li>
        ))}
      </AnalysisBlock>

      <AnalysisBlock
        title="Scenario extraction"
        empty="No scenarios extracted."
        count={scenarios.length}
      >
        {scenarios.map((s) => {
          const risk = riskByScenario.get(s.id);
          return (
            <li key={s.id} className="rounded-lg bg-[var(--bg-soft)] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.title}</span>
                <span className="rounded-full bg-[var(--ink)]/10 px-2 py-0.5 text-xs capitalize">
                  {s.type}
                </span>
                {risk ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${riskClass[risk.riskLevel]}`}
                  >
                    {risk.riskLevel} risk
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[var(--muted)]">{s.summary}</p>
              {risk ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Risk: {risk.rationale}
                </p>
              ) : null}
            </li>
          );
        })}
      </AnalysisBlock>

      <AnalysisBlock
        title="Acceptance criteria gaps"
        empty="No acceptance-criteria gaps flagged."
        count={acceptanceCriteriaGaps.length}
      >
        {acceptanceCriteriaGaps.map((g) => (
          <li key={g.id} className="rounded-lg bg-[var(--bg-soft)] p-3 text-sm">
            <div className="font-medium">{g.requirement}</div>
            <p className="mt-1 text-[var(--muted)]">{g.gap}</p>
            <p className="mt-1 text-[var(--accent)]">
              Suggested: {g.suggestedCriteria}
            </p>
          </li>
        ))}
      </AnalysisBlock>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <div className="font-display text-2xl tracking-tight">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function AnalysisBlock({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-[var(--ink)]">{title}</h3>
      {count === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </div>
  );
}
