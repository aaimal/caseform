import type { AiProvider, GenerateInput, GenerateResult } from "../types";
import { sanitizeText } from "@/lib/exemplars/helpers";

export class OpenAiProvider implements AiProvider {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const model = input.model ?? "gpt-4o-mini";
    const system = sanitizeText(input.prompt.system);
    const user = sanitizeText(input.prompt.user);

    // Use raw fetch with ASCII-only headers. The OpenAI SDK/undici path can throw
    // ByteString errors when prompts contain U+2028 (common in PDF paste).
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenAI HTTP ${response.status}`);
    }

    const text = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    return {
      text,
      parsed,
      model: payload.model ?? model,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      },
    };
  }
}
