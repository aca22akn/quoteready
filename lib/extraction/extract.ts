import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_CONFIG, type ExtractionCall } from "./config";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import { EXTRACTION_JSON_SCHEMA, validateExtraction } from "./schema";
import type { Extraction } from "./types";

export type MessagesClient = {
  messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
};

type Usage = { model: string; usedFallback: boolean; latencyMs: number; inputTokens: number; outputTokens: number };

export type ExtractResult =
  | ({ ok: true; extraction: Extraction } & Usage)
  | ({ ok: false; code: "CONFIG_ERROR" | "PROVIDER_ERROR" } & Usage);

type Attempt = { kind: "ok"; extraction: Extraction } | { kind: "recoverable" } | { kind: "config" } | { kind: "fatal" };

// Config and billing failures cannot be fixed by a retry; 429, 5xx, 529, network and timeouts can.
function classify(error: unknown): "recoverable" | "config" | "fatal" {
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return "recoverable";
  if (error instanceof Anthropic.APIConnectionError) return "recoverable"; // includes timeouts
  if (error instanceof Anthropic.APIError) {
    if (typeof error.status === "number" && error.status >= 500) return "recoverable";
    if (typeof error.status === "number" && error.status >= 400) return "config";
  }
  return "fatal";
}

export function params(email: string, call: ExtractionCall): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: call.model,
    max_tokens: call.maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage(email) }],
    output_config: {
      format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
      ...(call.effort ? { effort: call.effort } : {}),
    },
    ...(call.thinking ? { thinking: call.thinking } : {}),
  } as Anthropic.MessageCreateParamsNonStreaming;
}

// stop_reason first, then the single text block (thinking blocks ignored), then strict validation.
export function readResponse(response: Anthropic.Message): Extraction | null {
  if (response.stop_reason !== "end_turn") return null;
  const texts = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  if (texts.length !== 1) return null;
  try {
    return validateExtraction(JSON.parse(texts[0].text));
  } catch {
    return null;
  }
}

export async function extract(
  email: string,
  client: MessagesClient,
  calls: { primary: ExtractionCall; retry: ExtractionCall | null } = EXTRACTION_CONFIG,
): Promise<ExtractResult> {
  const started = Date.now();
  const usage = { inputTokens: 0, outputTokens: 0 };

  async function attempt(call: ExtractionCall): Promise<Attempt> {
    try {
      const response = await client.messages.create(params(email, call));
      usage.inputTokens += response.usage.input_tokens;
      usage.outputTokens += response.usage.output_tokens;
      const extraction = readResponse(response);
      return extraction ? { kind: "ok", extraction } : { kind: "recoverable" };
    } catch (error) {
      return { kind: classify(error) };
    }
  }

  const finish = (model: string, usedFallback: boolean, result: Attempt): ExtractResult => {
    const base = { model, usedFallback, latencyMs: Date.now() - started, ...usage };
    if (result.kind === "ok") return { ok: true, extraction: result.extraction, ...base };
    return { ok: false, code: result.kind === "config" ? "CONFIG_ERROR" : "PROVIDER_ERROR", ...base };
  };

  const first = await attempt(calls.primary);
  if (first.kind !== "recoverable" || calls.retry === null) return finish(calls.primary.model, false, first);
  const second = await attempt(calls.retry); // exactly one retry, never a loop
  return finish(calls.retry.model, true, second);
}
