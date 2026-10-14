// Evidence normalisation (file 01 section 2 step 1). Applied to the email, source text and evidence alike.
export function normalise(text: string): string {
  return text
    .replace(/[   ]/g, " ")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/×/g, "x")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Numbers in a text, with thousands separators removed ("10,000" -> 10000).
export function numbersIn(text: string): number[] {
  const cleaned = text.replace(/(\d),(?=\d{3}\b)/g, "$1");
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}
