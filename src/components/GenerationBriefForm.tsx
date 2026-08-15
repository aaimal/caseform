"use client";

import type { GenerationBrief } from "@/lib/types";

const detailOptions = [
  { value: "smoke", label: "Smoke", hint: "Critical paths, ≤5 steps" },
  { value: "standard", label: "Standard", hint: "Balanced depth" },
  { value: "detailed", label: "Detailed", hint: "Explicit data & expects" },
] as const;

const coverageOptions = [
  { value: "happy", label: "Happy" },
  { value: "negative", label: "Negative" },
  { value: "edge", label: "Edge" },
] as const;

export function GenerationBriefForm({
  value,
  onChange,
}: {
  value: GenerationBrief;
  onChange: (next: GenerationBrief) => void;
}) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--ink)]">
          Detail level
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {detailOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, detailLevel: opt.value })}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                value.detailLevel === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)]"
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">{opt.hint}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--ink)]">
          Coverage
        </legend>
        <div className="flex flex-wrap gap-2">
          {coverageOptions.map((opt) => {
            const on = value.coverageIntent.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = on
                    ? value.coverageIntent.filter((c) => c !== opt.value)
                    : [...value.coverageIntent, opt.value];
                  if (next.length === 0) return;
                  onChange({
                    ...value,
                    coverageIntent: next as GenerationBrief["coverageIntent"],
                  });
                }}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  on
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--ink)]">
            Preconditions
          </span>
          <select
            className="field"
            value={value.preconditionStyle}
            onChange={(e) =>
              onChange({
                ...value,
                preconditionStyle: e.target.value as GenerationBrief["preconditionStyle"],
              })
            }
          >
            <option value="minimal">Minimal</option>
            <option value="explicit">Explicit env / data / role</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--ink)]">
            Primary focus
          </span>
          <select
            className="field"
            value={value.testFocus}
            onChange={(e) =>
              onChange({
                ...value,
                testFocus: e.target.value as GenerationBrief["testFocus"],
              })
            }
          >
            <option value="functional">Functional</option>
            <option value="functional_plus_ui">Functional + UI checks</option>
            <option value="functional_plus_data">Functional + data/state</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-[var(--ink)]">
          Always consider
        </span>
        <textarea
          className="field min-h-20"
          maxLength={500}
          placeholder="e.g. mobile Safari, role=buyer, use test card 4242…"
          value={value.alwaysConsider}
          onChange={(e) =>
            onChange({ ...value, alwaysConsider: e.target.value })
          }
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {value.alwaysConsider.length}/500
        </span>
      </label>
    </div>
  );
}
