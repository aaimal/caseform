import type { TestCaseBody } from "@/lib/types";

export function casesToCsv(
  cases: Array<TestCaseBody & { status?: string }>,
  opts?: { jira?: boolean },
) {
  if (opts?.jira) {
    const header = ["Summary", "Description", "Preconditions", "Steps"];
    const rows = cases.map((c) => {
      const steps = c.steps
        .map((s, i) => `${i + 1}. ${s.action}\n   Expected: ${s.expected}`)
        .join("\n");
      return [
        c.title,
        c.title,
        c.preconditions,
        steps,
      ].map(escapeCsv);
    });
    return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  const header = [
    "title",
    "preconditions",
    "step_number",
    "action",
    "expected",
    "status",
  ];
  const rows: string[][] = [];
  for (const c of cases) {
    c.steps.forEach((s, i) => {
      rows.push([
        c.title,
        c.preconditions,
        String(i + 1),
        s.action,
        s.expected,
        c.status ?? "",
      ].map(escapeCsv));
    });
  }
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function escapeCsv(value: string) {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
