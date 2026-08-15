import { readFileSync } from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const promptFileSchema = z.object({
  id: z.string(),
  version: z.string(),
  model: z.string(),
  temperature: z.number().optional(),
  system: z.string(),
  user: z.string(),
});

export type PromptTemplate = z.infer<typeof promptFileSchema>;

export function loadPrompt(id: string, version = "1"): PromptTemplate {
  const file = path.join(process.cwd(), "prompts", `${id}.v${version}.yaml`);
  const raw = readFileSync(file, "utf8");
  return promptFileSchema.parse(parseYaml(raw));
}

export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
