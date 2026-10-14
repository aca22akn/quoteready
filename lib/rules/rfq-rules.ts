import { parseMaterialDesignations, type MaterialDesignation } from "@/lib/domain/designation";
import { numbersIn } from "@/lib/domain/normalise";
import type { LineSpec } from "@/lib/domain/spec";
import type { RuleHit } from "./types";

// Pure RFQ-level rules: R10, R12 (revision check and coverage) and R13. Inputs are normalised text.

const REVISION_CUE = /\b(actually|make that|make it|change to|changed to|instead|revised|amended|correction|i meant|scrap that)\b/g;
const QTY_AFTER = /(\d+(?:\.\d+)?)\s*(?:x|off|pcs|pieces|units|boxes|packs)\b/g;
const QTY_BEFORE = /\b(?:qty|quantity|need|want|make that)\s*:?\s*(\d+(?:\.\d+)?)/g;

const DESIGNATIONS = [
  /\d+\s*\/\s*\d+\s*(?:unc|unf|bsw|bsf)?(?:\s*x\s*\d+(?:\.\d+)?\s*(?:in|inch|inches|")?)?/g,
  /\bm\s?\d+(?:\.\d+)?s?(?:\s*x\s*\d+(?:\.\d+)?s?){0,2}/g,
  /\b(?:din|iso|en|bs)\s*-?\s*\d+/g,
  /\ba[24]\b(?:\s?[-/]?\s?\d{2,3}\b)?/g,
  /\b(?:4\.6|5\.8|8\.8|10\.9|12\.9)\b/g,
  /\b\d+\s*mm\b/g,
];

export function stripDesignations(text: string): string {
  return DESIGNATIONS.reduce((t, re) => t.replace(re, " "), text);
}

export function quantityContextNumbers(text: string): number[] {
  const t = stripDesignations(text);
  return [...t.matchAll(QTY_AFTER), ...t.matchAll(QTY_BEFORE)].map((m) => Number(m[1]));
}

export function r10NoLines(lineCount: number): RuleHit | null {
  return lineCount === 0
    ? { ruleId: "R10", cls: "CL", reason: "No line items were found in the email.", basis: "house policy" }
    : null;
}

// Core, never cut: a revision cue followed by a number, or one line holding two different quantities.
export function r12Revision(emailNorm: string, lines: LineSpec[]): RuleHit | null {
  const stripped = stripDesignations(emailNorm);
  const cueWithNumber = [...stripped.matchAll(REVISION_CUE)].some((m) =>
    /\d/.test(stripped.slice(m.index + m[0].length, m.index + m[0].length + 40)),
  );
  const twoQuantities = lines.some((l) =>
    [l.quantityEvidence ?? "", l.sourceNorm].some((t) => new Set(quantityContextNumbers(t)).size > 1),
  );
  if (!cueWithNumber && !twoQuantities) return null;
  return {
    ruleId: "R12",
    cls: "CL",
    reason: "The email appears to revise a quantity. Confirm the final quantity before quoting.",
    basis: "house policy",
  };
}

// Cut-ladder tier 4: a quantity-like number that no line's quantity evidence covers.
export function r12Coverage(emailNorm: string, lines: LineSpec[]): RuleHit | null {
  if (lines.length === 0) return null;
  const covered = new Set(lines.flatMap((l) => (l.quantityEvidence ? numbersIn(l.quantityEvidence) : [])));
  const uncovered = [...new Set(quantityContextNumbers(emailNorm))].filter((n) => !covered.has(n));
  if (uncovered.length === 0) return null;
  return {
    ruleId: "R12",
    cls: "CL",
    reason: `Quantity ${uncovered.join(", ")} in the email is not covered by any line: a line may have been missed.`,
    basis: "house policy",
  };
}

function sameDesignation(a: MaterialDesignation, b: MaterialDesignation): boolean {
  return a.group === b.group && a.cls === b.cls;
}

function label(d: MaterialDesignation): string {
  return d.cls ? `${d.group}-${d.cls}` : d.group;
}

export type R13Result = { warnings: RuleHit[]; affected: Map<number, RuleHit> };

// Material designations in the email that no line claims. Compares parsed group and class.
export function r13Unclaimed(emailNorm: string, lines: LineSpec[]): R13Result {
  const found = parseMaterialDesignations(emailNorm);
  const unique = found.filter((d, i) => found.findIndex((e) => sameDesignation(d, e)) === i);
  const unclaimed = unique.filter(
    (d) => !lines.some((l) => l.claim && l.claim.group === d.group && (d.cls === null || l.claim.cls === d.cls)),
  );
  const warnings: RuleHit[] = [];
  const affected = new Map<number, RuleHit>();
  for (const d of unclaimed) {
    const reason = `Material ${label(d)} appears in the email but no line claims it. Confirm the material for each line.`;
    warnings.push({ ruleId: "R13", cls: "CL", reason, basis: "house policy" });
    const owners = lines.flatMap((l, i) => (parseMaterialDesignations(l.sourceNorm).some((x) => sameDesignation(x, d)) ? [i] : []));
    const targets = owners.length
      ? owners
      : lines.flatMap((l, i) => (l.group === "A2" || l.group === "A4" || l.group === "STAINLESS" ? [i] : []));
    for (const i of targets) affected.set(i, { ruleId: "R13", cls: "CL", reason, basis: "house policy" });
  }
  return { warnings, affected };
}
