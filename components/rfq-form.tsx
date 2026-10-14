"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPence } from "@/lib/money";
import type { DecidedLine, DecidedRfq } from "@/lib/pipeline/decide";
import type { Outcome, RuleHit } from "@/lib/rules/types";

type AnalyzeResponse = DecidedRfq & {
  rfqId: string;
  meta: { model: string; usedFallback: boolean; latencyMs: number; inputTokens: number; outputTokens: number };
};

const DEMOS = [
  { label: "Harbour wall (ready)", text: "Hi, please quote 40 x M10x50 A4-80 hex bolts, fully threaded, for a harbour wall repair. Thanks, Dan" },
  { label: "Coastal, vague (clarify)", text: "20 stainless M10 bolts for a coastal install" },
  { label: "Pontoon A2 (no match)", text: "Need 100 off A2-70 M12x60 DIN 933 for a pontoon build, price and lead time pls" },
];

const OUTCOME_LABEL: Record<Outcome, string> = {
  READY: "Ready to quote",
  CLARIFICATION: "Clarification required",
  NO_MATCH: "No compliant match",
};

const OUTCOME_STYLE: Record<Outcome, string> = {
  READY: "bg-green-100 text-green-900 border-green-300",
  CLARIFICATION: "bg-amber-100 text-amber-900 border-amber-300",
  NO_MATCH: "bg-red-100 text-red-900 border-red-300",
};

const CLASS_LABEL: Record<RuleHit["cls"], string> = { NM: "no match", CL: "clarify", NOTE: "note" };

const MAX_CHARS = 4000;

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-sm font-medium ${OUTCOME_STYLE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>;
}

function Hits({ hits }: { hits: RuleHit[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {hits.map((h, i) => (
        <li key={i}>
          <span className="font-mono font-semibold">{h.ruleId}</span>{" "}
          <span className="text-muted-foreground">({CLASS_LABEL[h.cls]}, {h.basis})</span>: {h.reason}
        </li>
      ))}
    </ul>
  );
}

function Line({ line }: { line: DecidedLine }) {
  const p = line.product;
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Line {line.lineNo}</span>
        <OutcomeBadge outcome={line.outcome} />
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Customer wrote: </span>&ldquo;{line.sourceText}&rdquo;
      </p>
      {line.hits.length > 0 ? <Hits hits={line.hits} /> : <p className="text-sm text-muted-foreground">No rule fired.</p>}
      {line.substitution && (
        <p className="rounded border border-blue-300 bg-blue-50 p-2 text-sm text-blue-900">
          Substitution: {line.substitution.requested} requested, {line.substitution.supplied} supplied.
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Evidence from the email</summary>
        <ul className="mt-1 flex flex-col gap-0.5">
          {Object.entries(line.evidence).map(([field, snippet]) => (
            <li key={field}>
              <span className="font-mono">{field}</span>: &ldquo;{snippet}&rdquo;
            </li>
          ))}
          {line.ungrounded.length > 0 && (
            <li className="text-amber-800">Not found in the email, treated as missing: {line.ungrounded.join(", ")}</li>
          )}
        </ul>
      </details>
      {p && line.outcome === "READY" && (
        <div className="rounded border bg-muted/40 p-3 text-sm">
          <p className="font-mono font-semibold">{p.sku}</p>
          <p>
            {p.standard} {p.thread_size}x{p.length_mm} {p.material_group === "CARBON" ? p.property_class : `${p.material_group}-${p.property_class}`} {p.finish}
          </p>
          <p>
            {line.quantity} x {formatPence(p.price_pence)} = {formatPence(p.price_pence * (line.quantity ?? 0))}
          </p>
          <p>
            Stock {p.stock_qty}, lead time {p.lead_time_days} days{line.shortfall ? `, shortfall ${line.shortfall}` : ""}.
          </p>
          <p className="text-muted-foreground">Price and stock as of {p.stock_as_of.slice(0, 10)} (synthetic demo data).</p>
        </div>
      )}
    </li>
  );
}

export function RfqForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyse(email: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: email }),
      });
      const body = await res.json();
      if (!res.ok) setError(body?.error?.message ?? "Something went wrong.");
      else setResult(body as AnalyzeResponse);
    } catch {
      setError("The request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {DEMOS.map((d) => (
          <Button
            key={d.label}
            variant="outline"
            disabled={busy}
            onClick={() => {
              setText(d.text);
              void analyse(d.text);
            }}
          >
            {d.label}
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Customer email
        <textarea
          className="min-h-36 rounded-md border bg-background p-3 font-mono text-sm"
          value={text}
          maxLength={MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the enquiry here. Do not paste personal data."
        />
        <span className="text-xs text-muted-foreground">
          {text.length} / {MAX_CHARS} characters
        </span>
      </label>
      <div>
        <Button disabled={busy || text.trim() === ""} onClick={() => void analyse(text)}>
          {busy ? "Analysing..." : "Analyse"}
        </Button>
      </div>

      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">RFQ outcome:</span>
            <OutcomeBadge outcome={result.badge} />
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3">
              <p className="mb-1 text-sm font-semibold text-amber-900">Checks on the whole email</p>
              <Hits hits={result.warnings} />
            </div>
          )}
          <ol className="flex flex-col gap-3">
            {result.lines.map((l) => (
              <Line key={l.lineNo} line={l} />
            ))}
          </ol>
          <p className="rounded border p-3 text-sm font-medium">Draft: human review required. Nothing is sent to the customer.</p>
          <p className="text-xs text-muted-foreground">
            Extracted by {result.meta.model}
            {result.meta.usedFallback ? " (after one retry)" : ""} in {(result.meta.latencyMs / 1000).toFixed(1)} s. Reference {result.rfqId}.
          </p>
        </div>
      )}
    </section>
  );
}
