import type { AiProvider } from "./types";
import { OpenAiProvider } from "./providers/openai";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const provider = process.env.AI_PROVIDER ?? "openai";
  if (provider === "openai") {
    cached = new OpenAiProvider();
    return cached;
  }
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}
