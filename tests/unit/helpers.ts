import { PRODUCTS, type ProductRow } from "@/db/seed-data";
import type { ExtractedItem } from "@/lib/extraction/types";
import { decideRfq, type DecidedLine, type ProductQuery } from "@/lib/pipeline/decide";

export function f<T>(value: T, evidence: string) {
  return { value, evidence };
}

type LineSpec = {
  qty?: [number, string];
  size?: string; // thread-size evidence, e.g. "M10x50"; value and length derived like a model would
  length?: [number, string];
  pitch?: [number, string];
  material?: string; // material evidence, value = evidence
  cls?: [string, string];
  thread?: ["full" | "partial", string];
  standard?: string;
  item?: [string, string];
  app?: string;
  finish?: string;
};

export function line(source_text: string, s: LineSpec): ExtractedItem {
  let thread_size = null;
  let length_mm = s.length ? f(s.length[0], s.length[1]) : null;
  if (s.size) {
    const diameter = s.size.match(/m\s*(\d+)/i);
    thread_size = f(diameter ? `M${diameter[1]}` : s.size, s.size);
    const numbers = s.size.split(/x/i).slice(1).map((n) => parseFloat(n));
    const last = numbers[numbers.length - 1];
    if (!s.length && last !== undefined && last >= 5) length_mm = f(last, s.size);
  }
  return {
    item_type: s.item ? f(s.item[0], s.item[1]) : null,
    standard: s.standard ? f(s.standard, s.standard) : null,
    thread_size,
    pitch: s.pitch ? f(s.pitch[0], s.pitch[1]) : null,
    length_mm,
    material: s.material ? f(s.material, s.material) : null,
    property_class: s.cls ? f(s.cls[0], s.cls[1]) : null,
    thread_type: s.thread ? f(s.thread[0], s.thread[1]) : null,
    quantity: s.qty ? f(s.qty[0], s.qty[1]) : null,
    application: s.app ? f(s.app, s.app) : null,
    finish: s.finish ? f(s.finish, s.finish) : null,
    source_text,
  };
}

export function fixtureLookup(rows: ProductRow[] = PRODUCTS) {
  const calls: ProductQuery[] = [];
  const lookup = async (q: ProductQuery) => {
    calls.push(q);
    return rows.filter(
      (p) =>
        p.standard === q.standard &&
        p.thread_size === q.thread_size &&
        p.length_mm === q.length_mm &&
        p.material_group === q.material_group &&
        p.property_class === q.property_class &&
        (q.finish === undefined || p.finish === q.finish),
    );
  };
  return { lookup, calls };
}

export async function run(email: string, items: ExtractedItem[], rows?: ProductRow[]) {
  const { lookup, calls } = fixtureLookup(rows);
  const result = await decideRfq(email, { items }, lookup);
  return { ...result, calls };
}

export function ids(lineOrHits: DecidedLine | { ruleId: string }[]): string[] {
  const hits = Array.isArray(lineOrHits) ? lineOrHits : lineOrHits.hits;
  return hits.map((h) => h.ruleId);
}

export function expectNoProduct(l: DecidedLine) {
  if (l.product !== null) throw new Error(`line ${l.lineNo} carries product ${l.product.sku}`);
}
