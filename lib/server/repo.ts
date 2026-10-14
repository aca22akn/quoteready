import "server-only";
import type { ProductRow } from "@/db/seed-data";
import type { DecidedRfq, ProductQuery } from "@/lib/pipeline/decide";
import { db } from "./supabase";

// Builder-style queries only: customer text is never concatenated into SQL.

export type AttemptUsage = {
  model: string;
  usedFallback: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
};

const PRODUCT_COLUMNS =
  "sku, standard, thread_size, length_mm, material_group, property_class, finish, price_pence, stock_qty, lead_time_days, stock_as_of";

function usageColumns(u: AttemptUsage) {
  return {
    model: u.model,
    used_fallback: u.usedFallback,
    latency_ms: u.latencyMs,
    input_tokens: u.inputTokens,
    output_tokens: u.outputTokens,
  };
}

// Snapshot of product facts at decision time (T22): later price changes never alter a saved line.
export function toQuoteLineRows(rfqId: string, rfq: DecidedRfq) {
  return rfq.lines.map((l) => ({
    rfq_id: rfqId,
    line_no: l.lineNo,
    outcome: l.outcome,
    sku: l.product?.sku ?? null,
    unit_price_pence: l.product?.price_pence ?? null,
    quantity: l.quantity !== null && Number.isInteger(l.quantity) && l.quantity >= 0 ? l.quantity : null,
    stock_snapshot: l.product?.stock_qty ?? null,
    lead_time_days: l.product?.lead_time_days ?? null,
    detail: {
      sourceText: l.sourceText,
      evidence: l.evidence,
      ungrounded: l.ungrounded,
      hits: l.hits,
      substitution: l.substitution,
      shortfall: l.shortfall,
      priceAsOf: l.product?.stock_as_of ?? null,
      stockAsOf: l.product?.stock_as_of ?? null,
    },
  }));
}

export async function insertAttempt(rawText: string): Promise<string> {
  const { data, error } = await db().from("rfqs").insert({ raw_text: rawText, status: "PENDING_ANALYSIS" }).select("id").single();
  if (error || !data) throw new Error("insert attempt failed");
  return data.id as string;
}

export async function finishError(id: string, code: string, usage: AttemptUsage | null): Promise<void> {
  await db()
    .from("rfqs")
    .update({ status: "ERROR", error_code: code, ...(usage ? usageColumns(usage) : {}) })
    .eq("id", id);
}

export async function saveResult(id: string, rfq: DecidedRfq, usage: AttemptUsage): Promise<void> {
  const rows = toQuoteLineRows(id, rfq);
  if (rows.length > 0) {
    const { error } = await db().from("quote_lines").insert(rows);
    if (error) throw new Error("save lines failed");
  }
  const { error } = await db()
    .from("rfqs")
    .update({ status: rfq.badge, warnings: rfq.warnings, ...usageColumns(usage) })
    .eq("id", id);
  if (error) throw new Error("save rfq failed");
}

export async function lookupExact(q: ProductQuery): Promise<ProductRow[]> {
  let query = db()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("standard", q.standard)
    .eq("thread_size", q.thread_size)
    .eq("length_mm", q.length_mm)
    .eq("material_group", q.material_group)
    .eq("property_class", q.property_class);
  if (q.finish) query = query.eq("finish", q.finish);
  const { data, error } = await query;
  if (error) throw new Error("product lookup failed");
  return (data ?? []) as ProductRow[];
}
