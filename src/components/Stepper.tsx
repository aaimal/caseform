export function Stepper({
  step,
  labels = ["Exemplars", "Spec", "Generate", "Review"],
}: {
  step: number;
  labels?: string[];
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? (
              <span className="mx-1 h-px w-6 bg-[var(--line)]" aria-hidden />
            ) : null}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                current
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : done
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${
                  current || done
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
