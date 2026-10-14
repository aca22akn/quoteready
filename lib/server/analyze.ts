import type { ExtractResult } from "@/lib/extraction/extract";
import { decideRfq, type DecidedRfq, type Lookup } from "@/lib/pipeline/decide";
import { ConfigError } from "./env";
import type { AttemptUsage } from "./repo";

export const MAX_INPUT_CHARS = 4000;
export const MAX_LINES = 10;

export type AnalyzeDeps = {
  insertAttempt: (rawText: string) => Promise<string>;
  finishError: (id: string, code: string, usage: AttemptUsage | null) => Promise<void>;
  saveResult: (id: string, rfq: DecidedRfq, usage: AttemptUsage) => Promise<void>;
  lookup: Lookup;
  extract: (email: string) => Promise<ExtractResult>;
};

const MESSAGES: Record<string, string> = {
  BAD_REQUEST: "Send JSON with a text field.",
  EMPTY_INPUT: "Paste an email to analyse.",
  TOO_LONG: `The email is longer than ${MAX_INPUT_CHARS} characters. Shorten it and try again.`,
  DB_UNAVAILABLE: "The database could not be reached. Try again shortly.",
  CONFIG_ERROR: "The service is not configured correctly. No analysis was run.",
  PROVIDER_ERROR: "The extraction service failed twice. No quote was drafted.",
  TOO_MANY_LINES: `More than ${MAX_LINES} lines were found. Split the request into smaller emails.`,
  INTERNAL: "Something went wrong. No quote was drafted.",
};

const STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  EMPTY_INPUT: 400,
  TOO_LONG: 400,
  DB_UNAVAILABLE: 503,
  CONFIG_ERROR: 500,
  PROVIDER_ERROR: 502,
  TOO_MANY_LINES: 422,
  INTERNAL: 500,
};

// Errors never carry key text, stack traces or request headers.
function fail(code: string, rfqId?: string): Response {
  return Response.json({ error: { code, message: MESSAGES[code] }, ...(rfqId ? { rfqId } : {}) }, { status: STATUS[code] });
}

export async function handleAnalyze(request: Request, deps: AnalyzeDeps): Promise<Response> {
  let text: unknown;
  try {
    text = ((await request.json()) as { text?: unknown })?.text;
  } catch {
    return fail("BAD_REQUEST");
  }
  if (typeof text !== "string") return fail("BAD_REQUEST");
  if (text.trim() === "") return fail("EMPTY_INPUT");
  if (text.length > MAX_INPUT_CHARS) return fail("TOO_LONG");

  // The attempt row exists before the model call, so failed calls are counted.
  let id: string;
  try {
    id = await deps.insertAttempt(text);
  } catch (error) {
    return fail(error instanceof ConfigError ? "CONFIG_ERROR" : "DB_UNAVAILABLE");
  }

  let usage: AttemptUsage | null = null;
  try {
    let result: ExtractResult;
    try {
      result = await deps.extract(text);
    } catch (error) {
      const code = error instanceof ConfigError ? "CONFIG_ERROR" : "PROVIDER_ERROR";
      await deps.finishError(id, code, null);
      return fail(code, id);
    }
    usage = { model: result.model, usedFallback: result.usedFallback, latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    if (!result.ok) {
      await deps.finishError(id, result.code, usage);
      return fail(result.code, id);
    }
    if (result.extraction.items.length > MAX_LINES) {
      await deps.finishError(id, "TOO_MANY_LINES", usage);
      return fail("TOO_MANY_LINES", id);
    }
    const rfq = await decideRfq(text, result.extraction, deps.lookup);
    await deps.saveResult(id, rfq, usage);
    return Response.json({ rfqId: id, ...rfq, meta: usage });
  } catch {
    await deps.finishError(id, "INTERNAL", usage).catch(() => undefined);
    return fail("INTERNAL", id);
  }
}
