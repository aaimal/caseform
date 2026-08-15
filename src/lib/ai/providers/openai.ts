import OpenAI from "openai";
import type { AiProvider, GenerateInput, GenerateResult } from "../types";

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const model = input.model ?? "gpt-4o-mini";
    const response = await this.client.chat.completions.create({
      model,
      temperature: input.temperature ?? 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          strict: true,
          schema: input.responseSchema,
        },
      },
      messages: [
        { role: "system", content: input.prompt.system },
        { role: "user", content: input.prompt.user },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    return {
      text,
      parsed,
      model,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }
}
