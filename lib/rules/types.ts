export type Outcome = "READY" | "CLARIFICATION" | "NO_MATCH";

// NM forces NO MATCH, CL forces CLARIFICATION, NOTE is information only.
export type RuleClass = "NM" | "CL" | "NOTE";

export type Basis = "house policy" | "supplier practice" | "catalogue scope" | "data check";

export type RuleHit = { ruleId: string; cls: RuleClass; reason: string; basis: Basis };

const RANK: Record<Outcome, number> = { READY: 0, CLARIFICATION: 1, NO_MATCH: 2 };

export function outcomeOf(hits: RuleHit[]): Outcome {
  if (hits.some((h) => h.cls === "NM")) return "NO_MATCH";
  if (hits.some((h) => h.cls === "CL")) return "CLARIFICATION";
  return "READY";
}

export function worst(outcomes: Outcome[]): Outcome {
  return outcomes.reduce<Outcome>((acc, o) => (RANK[o] > RANK[acc] ? o : acc), "READY");
}
