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
