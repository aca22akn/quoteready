import type { ProductRow } from "@/db/seed-data";
import { COARSE_PITCH } from "@/lib/domain/designation";
import { CARBON_CLASSES, type LineSpec } from "@/lib/domain/spec";
import type { RuleHit } from "./types";

// Pure per-line rules. Each returns a hit or null. No I/O.

const SPANNER: Record<number, [number, number]> = { 10: [17, 16], 12: [19, 18], 14: [22, 21], 22: [32, 34] };
const PACK = /\b(box|boxes|pack|packs|carton|cartons|bag|bags|pallet|pallets)\b|\bper\s*100\b/;
const APPROX = /\b(about|approx|approximately|roughly)\b/;

export function r9Quantity(s: LineSpec): RuleHit | null {
  if (s.quantity === null) return null;
  const q = s.quantity;
  const reasons: string[] = [];
  if (!Number.isInteger(q) || q < 1 || q > 100_000) reasons.push(`Quantity ${q} must be a whole number from 1 to 100,000.`);
  if (s.quantityEvidence && PACK.test(s.quantityEvidence)) reasons.push(`Quantity is given as packs ("${s.quantityEvidence}"): confirm the number of pieces.`);
  if (s.quantityEvidence && APPROX.test(s.quantityEvidence)) reasons.push(`Quantity is approximate ("${s.quantityEvidence}"): confirm the exact number.`);
  return reasons.length ? { ruleId: "R9", cls: "CL", reason: reasons.join(" "), basis: "house policy" } : null;
}

export function r1Substitution(s: LineSpec): RuleHit | null {
  if (!s.requestedStandard || (s.standard !== "ISO 4017" && s.standard !== "ISO 4014")) return null;
  const spanner = s.diameter !== null ? SPANNER[s.diameter] : undefined;
  const note = spanner ? ` Spanner size differs on M${s.diameter}: ${spanner[0]} mm (DIN) vs ${spanner[1]} mm (ISO).` : "";
  return {
    ruleId: "R1",
    cls: "NOTE",
    reason: `${s.requestedStandard} requested; ${s.standard} supplied as the current equivalent.${note}`,
    basis: "supplier practice",
  };
}

export function r6OutOfScope(s: LineSpec): RuleHit | null {
  const reasons: string[] = [];
  if (s.itemType === "nut" || s.itemType === "washer" || s.itemType === "other") {
    reasons.push(`Only hex bolts and screws are quoted; this line is ${s.itemType === "other" ? "another item type" : `a ${s.itemType}`}.`);
  }
  if (s.standard === "OTHER") reasons.push(`Standard "${s.evidence.standard}" is not supplied (ISO 4017 and ISO 4014 only).`);
  if (s.imperial) reasons.push("Imperial sizes are not supplied (metric only).");
  const coarse = s.diameter !== null ? COARSE_PITCH[s.diameter] : undefined;
  if (coarse !== undefined && s.pitch !== null && s.pitch !== coarse) {
    reasons.push(`Fine pitch M${s.diameter}x${s.pitch} is not supplied (coarse pitch is ${coarse}).`);
  }
  return reasons.length ? { ruleId: "R6", cls: "NM", reason: reasons.join(" "), basis: "catalogue scope" } : null;
}

export function r5Missing(s: LineSpec): RuleHit | null {
  const missing: string[] = [];
  if (s.diameter === null && !s.imperial) missing.push("thread size");
  if (s.lengthMm === null) missing.push("length");
  if (s.quantity === null) missing.push("quantity");
  if (s.group === null || s.group === "STAINLESS") missing.push("material grade");
  if (s.propertyClass === null) missing.push("property class");
  return missing.length
    ? { ruleId: "R5", cls: "CL", reason: `Missing: ${missing.join(", ")}.`, basis: "house policy" }
    : null;
}

export function r2StainlessNoGroup(s: LineSpec): RuleHit | null {
  if (s.group !== "STAINLESS") return null;
  const ask = s.coastal ? " The application looks coastal or marine, so A4 would be required." : "";
  return { ruleId: "R2", cls: "CL", reason: `Stainless stated without a grade: A2 or A4?${ask}`, basis: "house policy" };
}

export function r3StainlessWithCarbonClass(s: LineSpec): RuleHit | null {
  if ((s.group !== "A2" && s.group !== "A4") || s.propertyClass === null || !CARBON_CLASSES.includes(s.propertyClass)) return null;
  return {
    ruleId: "R3",
    cls: "CL",
    reason: `${s.group} stainless with class ${s.propertyClass} is contradictory: did you mean ${s.group}-70 or ${s.group}-80 stainless, or zinc-plated ${s.propertyClass} carbon steel?`,
    basis: "supplier practice",
  };
}

export function r4CoastalA2(s: LineSpec): RuleHit | null {
  if (!s.coastal || s.group !== "A2") return null;
  return { ruleId: "R4", cls: "NM", reason: "Coastal or marine application: A4 required (house policy), A2 is not quoted.", basis: "house policy" };
}

export function parseCheck(s: LineSpec): RuleHit | null {
  return s.parseIssues.length ? { ruleId: "PARSE", cls: "CL", reason: s.parseIssues.join(" "), basis: "data check" } : null;
}

export function standardCheck(s: LineSpec): RuleHit | null {
  return s.standardConflict ? { ruleId: "STD", cls: "CL", reason: s.standardConflict, basis: "data check" } : null;
}

export function finishCheck(s: LineSpec): RuleHit | null {
  if (s.finish !== "unknown") return null;
  return {
    ruleId: "R7",
    cls: "CL",
    reason: `Finish "${s.finishWord}" is not recognised. Finishes supplied: plain (stainless) and zinc plated (8.8).`,
    basis: "catalogue scope",
  };
}

// All pre-lookup rules, run every time so every reason is shown. R3 suppresses R4.
export function preLookupHits(s: LineSpec): RuleHit[] {
  const r3 = r3StainlessWithCarbonClass(s);
  const hits = [r9Quantity(s), r1Substitution(s), r6OutOfScope(s), r5Missing(s), r2StainlessNoGroup(s), r3, r3 ? null : r4CoastalA2(s), parseCheck(s), standardCheck(s), finishCheck(s)];
  return hits.filter((h): h is RuleHit => h !== null);
}

// Post-lookup rules.

export function r7Rows(rows: ProductRow[], description: string): RuleHit | null {
  if (rows.length === 0) return { ruleId: "R7", cls: "NM", reason: `No catalogue row matches ${description} exactly.`, basis: "catalogue scope" };
  if (rows.length > 1) return { ruleId: "R7", cls: "CL", reason: `More than one catalogue row matches ${description}; confirm the exact part.`, basis: "data check" };
  return null;
}

export function r8Stock(quantity: number, product: ProductRow): RuleHit | null {
  if (quantity <= product.stock_qty) return null;
  const shortfall = quantity - product.stock_qty;
  return {
    ruleId: "R8",
    cls: "NOTE",
    reason: `Only ${product.stock_qty} in stock as of ${product.stock_as_of.slice(0, 10)}; shortfall ${shortfall}. Lead time ${product.lead_time_days} days for the balance.`,
    basis: "house policy",
  };
}

export function r11BothStandards(): RuleHit {
  return {
    ruleId: "R11",
    cls: "CL",
    reason: "Thread type not stated and rows exist as ISO 4017 (fully threaded) and ISO 4014 (partly threaded): fully or partly threaded?",
    basis: "house policy",
  };
}

export function r11OneStandard(standard: "ISO 4017" | "ISO 4014"): RuleHit {
  const kind = standard === "ISO 4017" ? "fully threaded ISO 4017" : "partly threaded ISO 4014";
  return { ruleId: "R11", cls: "NOTE", reason: `Thread type not stated; ${kind} is what is supplied.`, basis: "house policy" };
}
