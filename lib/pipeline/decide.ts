import type { MaterialGroup, ProductRow, Standard } from "@/db/seed-data";
import type { Extraction } from "@/lib/extraction/types";
import { normalise } from "@/lib/domain/normalise";
import { buildLineSpec, type LineSpec } from "@/lib/domain/spec";
import { preLookupHits, r11BothStandards, r11OneStandard, r7Rows, r8Stock } from "@/lib/rules/line-rules";
import { r10NoLines, r12Coverage, r12Revision, r13Unclaimed } from "@/lib/rules/rfq-rules";
import { outcomeOf, worst, type Outcome, type RuleHit } from "@/lib/rules/types";

export type ProductQuery = {
  standard: Standard;
  thread_size: string;
  length_mm: number;
  material_group: MaterialGroup;
  property_class: string;
  finish?: "plain" | "zinc";
};

export type Lookup = (q: ProductQuery) => Promise<ProductRow[]>;

export type DecidedLine = {
  lineNo: number;
  outcome: Outcome;
  hits: RuleHit[];
  sourceText: string;
  evidence: LineSpec["evidence"];
  ungrounded: LineSpec["ungrounded"];
  quantity: number | null;
  product: ProductRow | null;
  shortfall: number | null;
  substitution: { requested: string; supplied: string } | null;
};

export type DecidedRfq = { badge: Outcome; warnings: RuleHit[]; lines: DecidedLine[] };

function describe(q: Omit<ProductQuery, "standard">, standard?: string): string {
  const material = q.material_group === "CARBON" ? q.property_class : `${q.material_group}-${q.property_class}`;
  return [standard, `${q.thread_size}x${q.length_mm}`, material, q.finish].filter(Boolean).join(" ");
}

// Lookup for a line that passed every pre-lookup rule. Exact equality only; a missing standard is
// never sent as a value, it is tried once per supported standard (R11).
async function lookupLine(s: LineSpec, lookup: Lookup): Promise<{ hits: RuleHit[]; product: ProductRow | null }> {
  const base = {
    thread_size: `M${s.diameter}`,
    length_mm: s.lengthMm!,
    material_group: s.group as MaterialGroup,
    property_class: s.propertyClass!,
    ...(s.finish === "plain" || s.finish === "zinc" ? { finish: s.finish } : {}),
  };
  if (s.standard === "ISO 4017" || s.standard === "ISO 4014") {
    const rows = await lookup({ ...base, standard: s.standard });
    const hit = r7Rows(rows, describe(base, s.standard));
    return hit ? { hits: [hit], product: null } : { hits: [], product: rows[0] };
  }
  const [full, partial] = await Promise.all([
    lookup({ ...base, standard: "ISO 4017" }),
    lookup({ ...base, standard: "ISO 4014" }),
  ]);
  if (full.length > 0 && partial.length > 0) return { hits: [r11BothStandards()], product: null };
  const [standard, rows] = full.length > 0 ? (["ISO 4017", full] as const) : (["ISO 4014", partial] as const);
  const hit = r7Rows(rows, describe(base));
  if (hit) return { hits: [hit], product: null };
  return { hits: [r11OneStandard(standard)], product: rows[0] };
}

export async function decideRfq(email: string, extraction: Extraction, lookup: Lookup): Promise<DecidedRfq> {
  const emailNorm = normalise(email);
  const specs = extraction.items.map((item) => buildLineSpec(item, emailNorm));
  const r13 = r13Unclaimed(emailNorm, specs);

  const lines: DecidedLine[] = [];
  for (const [i, s] of specs.entries()) {
    const hits = preLookupHits(s);
    const r13Hit = r13.affected.get(i);
    if (r13Hit) hits.push(r13Hit);
    let product: ProductRow | null = null;
    if (outcomeOf(hits) === "READY") {
      const result = await lookupLine(s, lookup);
      hits.push(...result.hits);
      product = result.product;
    }
    const stock = product && s.quantity !== null ? r8Stock(s.quantity, product) : null;
    if (stock) hits.push(stock);
    const outcome = outcomeOf(hits);
    if (outcome !== "READY") product = null;
    lines.push({
      lineNo: i + 1,
      outcome,
      hits,
      sourceText: s.sourceText,
      evidence: s.evidence,
      ungrounded: s.ungrounded,
      quantity: s.quantity,
      product,
      shortfall: product && s.quantity !== null && s.quantity > product.stock_qty ? s.quantity - product.stock_qty : null,
      substitution: s.requestedStandard && product ? { requested: s.requestedStandard, supplied: product.standard } : null,
    });
  }

  const warnings = [r10NoLines(specs.length), r12Revision(emailNorm, specs), r12Coverage(emailNorm, specs), ...r13.warnings].filter(
    (h): h is RuleHit => h !== null,
  );
  const lineWorst = worst(lines.map((l) => l.outcome));
  const badge = warnings.length > 0 ? worst([lineWorst, "CLARIFICATION"]) : lineWorst;
  return { badge, warnings, lines };
}
