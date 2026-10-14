import { normalise } from "./normalise";

export type ThreadDesignation = {
  diameter: number | null;
  pitch: number | null;
  length: number | null;
  imperial: boolean;
};

export type MaterialDesignation = { group: "A2" | "A4"; cls: string | null };

export const COARSE_PITCH: Record<number, number> = { 8: 1.25, 10: 1.5, 12: 1.75 };

const IMPERIAL = /\d+\s*\/\s*\d+|\b(unc|unf|bsw|bsf|whitworth)\b|\d\s*(in|inch|inches)\b|\d"/;
const METRIC = /\bm\s?(\d+(?:\.\d+)?)s?(?:\s*x\s*(\d+(?:\.\d+)?)s?)?(?:\s*x\s*(\d+(?:\.\d+)?)s?)?/;
const MATERIAL = /\ba([24])\b(?:\s?[-/]?\s?(\d{2,3})\b)?/g;

// M then diameter, optional x number, optional second x number. A second number below 5 is a
// pitch, otherwise a length (a house heuristic, not a standard).
export function parseThreadDesignation(text: string): ThreadDesignation {
  const t = normalise(text);
  if (IMPERIAL.test(t)) return { diameter: null, pitch: null, length: null, imperial: true };
  const m = t.match(METRIC);
  if (!m) return { diameter: null, pitch: null, length: null, imperial: false };
  const second = m[2] !== undefined ? Number(m[2]) : null;
  const third = m[3] !== undefined ? Number(m[3]) : null;
  const pitch = second !== null && second < 5 ? second : null;
  const length = second !== null && second >= 5 ? second : pitch !== null ? third : null;
  return { diameter: Number(m[1]), pitch, length, imperial: false };
}

// A2/A4 designations with an optional stainless class: a4-80, a4 80, a4/80, a2.
export function parseMaterialDesignations(text: string): MaterialDesignation[] {
  return [...normalise(text).matchAll(MATERIAL)].map((m) => ({
    group: m[1] === "2" ? "A2" : "A4",
    cls: m[2] ?? null,
  }));
}
