import { it } from "vitest";
import { EVAL_PROFILES } from "@/lib/extraction/config";
import { extract } from "@/lib/extraction/extract";
import { decideRfq } from "@/lib/pipeline/decide";
import { anthropicClient } from "@/lib/server/anthropic";
import { evalProfile } from "@/lib/server/env";
import { lookupExact } from "@/lib/server/repo";
import { CASES } from "./cases";

// Real model + real catalogue lookup, primary config only (no retry), no rfq rows written.
// Prints results and metadata only: no key, no headers, no environment values.
it("eval: 12 labelled cases", async () => {
  const profile = evalProfile();
  const call = EVAL_PROFILES[profile];
  const client = anthropicClient();
  let passed = 0;
  let falseReady = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  for (const c of CASES) {
    const result = await extract(c.text, client, { primary: call, retry: null });
    tokensIn += result.inputTokens;
    tokensOut += result.outputTokens;
    if (!result.ok) {
      console.log(`[eval] ${c.id} FAIL extraction ${result.code} latency_ms=${result.latencyMs}`);
      continue;
    }
    const rfq = await decideRfq(c.text, result.extraction, lookupExact);
    const outcomes = rfq.lines.map((l) => l.outcome);
    const ruleIds = new Set([...rfq.warnings, ...rfq.lines.flatMap((l) => l.hits)].map((h) => h.ruleId));
    const missingRules = c.rules.filter((r) => !ruleIds.has(r));
    const ok = rfq.badge === c.badge && JSON.stringify(outcomes) === JSON.stringify(c.lines) && missingRules.length === 0;
    const fr =
      (c.badge !== "READY" && rfq.badge === "READY") ||
      c.lines.some((expected, i) => expected !== "READY" && outcomes[i] === "READY");
    if (ok) passed += 1;
    if (fr) falseReady += 1;
    console.log(
      `[eval] ${c.id}${c.hard ? " (HARD)" : ""} ${ok ? "PASS" : "FAIL"} badge=${rfq.badge} (want ${c.badge}) ` +
        `lines=${outcomes.join("/")} (want ${c.lines.join("/")}) rules=${[...ruleIds].join(",")}` +
        `${missingRules.length ? ` missing=${missingRules.join(",")}` : ""}${fr ? " FALSE-READY" : ""} latency_ms=${result.latencyMs}`,
    );
    if (!ok) {
      for (const l of rfq.lines) {
        console.log(
          `[eval]   line ${l.lineNo} source="${l.sourceText}" evidence=${JSON.stringify(l.evidence)} ` +
            `ungrounded=${l.ungrounded.join(",") || "-"} hits=${l.hits.map((h) => `${h.ruleId}:${h.reason}`).join(" | ")}`,
        );
      }
      for (const w of rfq.warnings) console.log(`[eval]   warning ${w.ruleId}: ${w.reason}`);
    }
  }

  const costUsd = (tokensIn * 0.1 + tokensOut * 0.5) / 1_000_000;
  console.log(
    `[eval] SUMMARY profile=${profile} model=${call.model} passed=${passed}/${CASES.length} false_ready=${falseReady} ` +
      `tokens_in=${tokensIn} tokens_out=${tokensOut} est_cost_usd=${costUsd.toFixed(5)} (Haiku 5.5 list price $0.10/$0.50 per MTok)`,
  );
}, 600_000);
