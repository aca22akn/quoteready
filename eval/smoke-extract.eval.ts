import { it } from "vitest";
import { EXTRACTION_CONFIG } from "@/lib/extraction/config";
import { params, readResponse } from "@/lib/extraction/extract";
import { anthropicClient } from "@/lib/server/anthropic";

// Keyed smoke check: the exact primary and retry request shapes, called directly so a wrong parameter
// name shows the API's error message. Prints metadata only: no key, no headers, no environment values.
const E01 = "Hi, please quote 40 x M10x50 A4-80 hex bolts, fully threaded, for a harbour wall repair. Thanks, Dan";

it("smoke: primary twice (compile, cached) and retry config once", async () => {
  const client = anthropicClient();
  const runs = [
    ["primary #1 (grammar compile)", EXTRACTION_CONFIG.primary],
    ["primary #2 (cached grammar)", EXTRACTION_CONFIG.primary],
    ["retry config (sonnet between_tools)", EXTRACTION_CONFIG.retry],
  ] as const;
  for (const [label, call] of runs) {
    const started = Date.now();
    try {
      const r = await client.messages.create(params(E01, call));
      const extraction = readResponse(r);
      console.log(
        `[smoke] ${label}: model=${r.model} latency_ms=${Date.now() - started} stop_reason=${r.stop_reason} ` +
          `blocks=${r.content.map((b) => b.type).join(",")} in=${r.usage.input_tokens} out=${r.usage.output_tokens} ` +
          `valid=${extraction !== null} item0=${JSON.stringify(extraction?.items[0] ?? null)}`,
      );
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.log(
        `[smoke] ${label}: ERROR ${e instanceof Error ? e.constructor.name : "unknown"} status=${err.status ?? "n/a"} ` +
          `latency_ms=${Date.now() - started} message=${String(err.message ?? "").slice(0, 300)}`,
      );
    }
  }
}, 120_000);
