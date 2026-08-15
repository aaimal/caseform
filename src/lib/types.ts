import { z } from "zod";

export const stepSchema = z.object({
  action: z.string().min(1),
  expected: z.string().min(1),
});

export const testCaseBodySchema = z.object({
  title: z.string().min(1),
  preconditions: z.string().default(""),
  steps: z.array(stepSchema).min(1),
});

export const generatedSuiteSchema = z.object({
  testCases: z.array(testCaseBodySchema).min(1),
});

export const requirementsSchema = z.object({
  requirements: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    }),
  ),
});

export const generationBriefSchema = z.object({
  detailLevel: z.enum(["smoke", "standard", "detailed"]).default("standard"),
  coverageIntent: z
    .array(z.enum(["happy", "negative", "edge"]))
    .default(["happy", "negative", "edge"]),
  preconditionStyle: z.enum(["minimal", "explicit"]).default("explicit"),
  testFocus: z
    .enum(["functional", "functional_plus_ui", "functional_plus_data"])
    .default("functional"),
  alwaysConsider: z.string().max(500).default(""),
});

export type Step = z.infer<typeof stepSchema>;
export type TestCaseBody = z.infer<typeof testCaseBodySchema>;
export type GenerationBrief = z.infer<typeof generationBriefSchema>;
export type ProjectStatus = "draft" | "generated" | "reviewed";
export type TestCaseStatus = "generated" | "edited" | "accepted";

export const DEFAULT_BRIEF: GenerationBrief = {
  detailLevel: "standard",
  coverageIntent: ["happy", "negative", "edge"],
  preconditionStyle: "explicit",
  testFocus: "functional",
  alwaysConsider: "",
};
