import type { GenerationBrief, TestCaseBody } from "@/lib/types";

export function formatExemplarsForPrompt(
  cases: TestCaseBody[],
  max = 8,
): string {
  const slice = cases.slice(0, max);
  return slice
    .map((c, i) => {
      const steps = c.steps
        .map((s, n) => `  ${n + 1}. ${s.action} → ${s.expected}`)
        .join("\n");
      return `### Exemplar ${i + 1}: ${c.title}\nPreconditions: ${c.preconditions || "(none)"}\nSteps:\n${steps}`;
    })
    .join("\n\n");
}

export function formatBriefForPrompt(brief: GenerationBrief) {
  return {
    detailLevel: brief.detailLevel,
    coverageIntent: brief.coverageIntent.join(", "),
    preconditionStyle: brief.preconditionStyle,
    testFocus: brief.testFocus,
    alwaysConsider: brief.alwaysConsider || "(none)",
  };
}

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Drop generated cases that are near-duplicates of exemplar titles. */
export function filterDrift<T extends { title: string }>(
  generated: T[],
  exemplars: { title: string }[],
): { kept: T[]; dropped: T[] } {
  const exemplarTitles = new Set(exemplars.map((e) => normalizeTitle(e.title)));
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const g of generated) {
    if (exemplarTitles.has(normalizeTitle(g.title))) {
      dropped.push(g);
    } else {
      kept.push(g);
    }
  }
  return { kept, dropped };
}

export function truncateSpec(text: string, maxChars = 60000) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head - 80;
  return {
    text: `${text.slice(0, head)}\n\n[... truncated middle ...]\n\n${text.slice(-tail)}`,
    truncated: true,
  };
}

export function parseExemplarCsv(csv: string): TestCaseBody[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const titleIdx = header.findIndex((h) => h.includes("title"));
  const preIdx = header.findIndex((h) => h.includes("precondition"));
  const actionIdx = header.findIndex(
    (h) => h.includes("step") || h.includes("action"),
  );
  const expectedIdx = header.findIndex((h) => h.includes("expected"));

  if (titleIdx < 0 || actionIdx < 0 || expectedIdx < 0) {
    throw new Error(
      "CSV needs columns: title, preconditions (optional), step/action, expected",
    );
  }

  const byTitle = new Map<string, TestCaseBody>();

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const title = cols[titleIdx]?.trim();
    if (!title) continue;
    const action = cols[actionIdx]?.trim();
    const expected = cols[expectedIdx]?.trim();
    if (!action || !expected) continue;

    const existing = byTitle.get(title) ?? {
      title,
      preconditions: preIdx >= 0 ? cols[preIdx]?.trim() ?? "" : "",
      steps: [],
    };
    existing.steps.push({ action, expected });
    byTitle.set(title, existing);
  }

  const result = [...byTitle.values()];
  if (result.length === 0) {
    throw new Error("No valid exemplar rows found in CSV");
  }
  return result;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
