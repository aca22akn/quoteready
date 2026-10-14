import { normalise } from "./normalise";

export type CanonicalFinish = "zinc" | "plain" | "unknown";

const ZINC = new Set(["zinc", "zinc plated", "zinc-plated", "zinc plate", "bright zinc", "bright zinc plated", "bzp", "zp"]);
const PLAIN = new Set(["plain", "plain finish", "self colour", "self color", "self-colour", "bare", "uncoated"]);

// Whole-phrase match only, so "yellow zinc" is unknown rather than zinc.
export function canonicalFinish(text: string): CanonicalFinish {
  const t = normalise(text).replace(/[.,;:!]+$/, "");
  if (ZINC.has(t)) return "zinc";
  if (PLAIN.has(t)) return "plain";
  return "unknown";
}
