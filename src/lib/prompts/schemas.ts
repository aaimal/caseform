/** JSON Schemas for OpenAI Structured Outputs (strict mode). */

export const requirementsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
        },
        required: ["id", "text"],
      },
    },
  },
  required: ["requirements"],
} as const;

export const requirementAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
        },
        required: ["id", "text"],
      },
    },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          excerpt: { type: "string" },
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["id", "excerpt", "issue", "suggestion"],
      },
    },
    scenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          type: { type: "string", enum: ["happy", "alternative", "exception"] },
          summary: { type: "string" },
          requirementIds: { type: "array", items: { type: "string" } },
        },
        required: ["id", "title", "type", "summary", "requirementIds"],
      },
    },
    acceptanceCriteriaGaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          requirementId: { type: "string" },
          requirement: { type: "string" },
          gap: { type: "string" },
          suggestedCriteria: { type: "string" },
        },
        required: [
          "id",
          "requirementId",
          "requirement",
          "gap",
          "suggestedCriteria",
        ],
      },
    },
    riskPriorities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scenarioId: { type: "string" },
          riskLevel: { type: "string", enum: ["high", "medium", "low"] },
          rationale: { type: "string" },
        },
        required: ["scenarioId", "riskLevel", "rationale"],
      },
    },
  },
  required: [
    "requirements",
    "ambiguities",
    "scenarios",
    "acceptanceCriteriaGaps",
    "riskPriorities",
  ],
} as const;

export const suiteJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    testCases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          preconditions: { type: "string" },
          requirementId: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                action: { type: "string" },
                expected: { type: "string" },
              },
              required: ["action", "expected"],
            },
          },
        },
        required: ["title", "preconditions", "requirementId", "steps"],
      },
    },
  },
  required: ["testCases"],
} as const;

export const singleCaseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    preconditions: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          expected: { type: "string" },
        },
        required: ["action", "expected"],
      },
    },
  },
  required: ["title", "preconditions", "steps"],
} as const;
