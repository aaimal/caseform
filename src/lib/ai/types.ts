export type GenerateInput = {
  prompt: { system: string; user: string };
  model?: string;
  temperature?: number;
  responseSchema: Record<string, unknown>;
};

export type GenerateResult = {
  text: string;
  parsed?: unknown;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export interface AiProvider {
  generate(input: GenerateInput): Promise<GenerateResult>;
}
