import { FIELD_KEYS, type ExtractedItem, type FieldKey } from "@/lib/extraction/types";
import { parseMaterialDesignations, parseThreadDesignation, type MaterialDesignation } from "./designation";
import { canonicalFinish, type CanonicalFinish } from "./finish";
import { normalise, numbersIn } from "./normalise";

export type Group = "A2" | "A4" | "CARBON" | "STAINLESS";
export type SupportedStandard = "ISO 4017" | "ISO 4014";

export type LineSpec = {
  sourceText: string;
  sourceNorm: string;
  evidence: Partial<Record<FieldKey, string>>;
  ungrounded: FieldKey[];
  itemType: "hex" | "nut" | "washer" | "other" | null;
  requestedStandard: string | null; // set only when a DIN standard was substituted (R1)
  standard: SupportedStandard | "OTHER" | null;
  diameter: number | null;
  imperial: boolean;
  pitch: number | null;
  lengthMm: number | null;
  group: Group | null;
  propertyClass: string | null;
  threadType: "full" | "partial" | null;
  quantity: number | null;
  quantityEvidence: string | null;
  coastal: boolean;
  finish: CanonicalFinish | null;
  finishWord: string | null;
  claim: MaterialDesignation | null; // stainless group and class this line claims (R13)
  parseIssues: string[];
  standardConflict: string | null;
};

export const CARBON_CLASSES = ["4.6", "5.8", "8.8", "10.9", "12.9"];

const COASTAL =
  /\b(coastal|coast|marine|harbour\w*|harbor\w*|marina|piers?|pontoons?|jetty|jetties|quay\w*|seafront|sea front|offshore|salt\w*|boats?|seawater|sea water)\b/;
const STAINLESS = /\b(stainless|inox|s\/s|ss)\b/;
const STANDARD = /\b(din|iso|en|bs)\s*-?\s*(\d{2,5})\b/;

export function isCoastalText(text: string): boolean {
  return COASTAL.test(normalise(text));
}

// Step 1: a field counts only if the source text is in the email and its evidence is in that source text.
function ground(item: ExtractedItem, emailNorm: string) {
  const sourceNorm = normalise(item.source_text);
  const sourceOk = sourceNorm.length > 0 && emailNorm.includes(sourceNorm);
  const grounded: Partial<Record<FieldKey, { value: unknown; evidence: string }>> = {};
  const ungrounded: FieldKey[] = [];
  for (const key of FIELD_KEYS) {
    const field = item[key];
    if (field === null) continue;
    const evidence = normalise(field.evidence);
    if (sourceOk && evidence.length > 0 && sourceNorm.includes(evidence)) grounded[key] = { value: field.value, evidence };
    else ungrounded.push(key);
  }
  return { sourceNorm, grounded, ungrounded };
}

type StatedStandard = { label: string; standard: SupportedStandard | "OTHER"; substituted: boolean };

function parseStandard(evidence: string): StatedStandard | null {
  const m = evidence.match(STANDARD);
  if (!m) return null;
  const label = `${m[1].toUpperCase()} ${m[2]}`;
  const map: Record<string, Omit<StatedStandard, "label">> = {
    "DIN 933": { standard: "ISO 4017", substituted: true },
    "DIN 931": { standard: "ISO 4014", substituted: true },
    "ISO 4017": { standard: "ISO 4017", substituted: false },
    "ISO 4014": { standard: "ISO 4014", substituted: false },
  };
  return { label, ...(map[label] ?? { standard: "OTHER", substituted: false }) };
}

function itemTypeOf(value: string): LineSpec["itemType"] {
  const v = value.toLowerCase();
  if (v.includes("nut")) return "nut";
  if (v.includes("washer")) return "washer";
  if (v.includes("hex") || v.includes("bolt") || v.includes("screw")) return "hex";
  return "other";
}

function classFrom(value: string): string | null {
  const m = normalise(value).match(/\d{1,2}\.\d|\d{2,3}/);
  return m ? m[0] : null;
}

export function buildLineSpec(item: ExtractedItem, emailNorm: string): LineSpec {
  const { sourceNorm, grounded, ungrounded } = ground(item, emailNorm);
  const issues: string[] = [];
  const ev = (key: FieldKey) => grounded[key]?.evidence ?? null;
  const num = (key: FieldKey) => (typeof grounded[key]?.value === "number" ? (grounded[key]!.value as number) : null);
  const str = (key: FieldKey) => (typeof grounded[key]?.value === "string" ? (grounded[key]!.value as string) : null);

  // Thread size, pitch and length: the designation parser reads the evidence and cross-checks the model.
  const threadEv = ev("thread_size");
  const parsed = threadEv ? parseThreadDesignation(threadEv) : { diameter: null, pitch: null, length: null, imperial: false };
  const modelDiameter = str("thread_size")?.match(/m\s?(\d+)/i);
  if (modelDiameter && parsed.diameter !== null && Number(modelDiameter[1]) !== parsed.diameter) {
    issues.push(`Thread size ${str("thread_size")} does not match "${threadEv}".`);
  }
  const modelPitch = num("pitch");
  if (modelPitch !== null && parsed.pitch !== null && modelPitch !== parsed.pitch) {
    issues.push(`Pitch ${modelPitch} does not match "${threadEv}".`);
  }
  const modelLength = num("length_mm");
  if (modelLength !== null && !numbersIn(ev("length_mm")!).includes(modelLength)) {
    issues.push(`Length ${modelLength} mm is not in its evidence "${ev("length_mm")}".`);
  } else if (modelLength !== null && parsed.length !== null && modelLength !== parsed.length) {
    issues.push(`Length ${modelLength} mm does not match "${threadEv}".`);
  }

  // Material group and class (steps 2 and 3).
  const materialEv = ev("material");
  const designations = materialEv ? parseMaterialDesignations(materialEv) : [];
  const distinct = new Set(designations.map((d) => `${d.group}/${d.cls ?? ""}`));
  if (distinct.size > 1) issues.push(`Material "${materialEv}" names more than one grade.`);
  const designation = designations[0] ?? null;
  const classValue = str("property_class");
  const classEv = ev("property_class");
  let propertyClass = classValue ? classFrom(classValue) : null;
  if (propertyClass !== null && classEv !== null && !classEv.includes(propertyClass)) {
    issues.push(`Class ${propertyClass} is not in its evidence "${classEv}".`);
    propertyClass = null;
  }
  if (propertyClass !== null && designation?.cls && designation.cls !== propertyClass) {
    issues.push(`Class ${propertyClass} does not match material "${materialEv}".`);
  }
  propertyClass = propertyClass ?? designation?.cls ?? null;
  let group: Group | null = designation?.group ?? null;
  if (group === null && materialEv && STAINLESS.test(materialEv)) group = "STAINLESS";
  if (group === null && propertyClass !== null && CARBON_CLASSES.includes(propertyClass)) group = "CARBON";

  // Standard and thread type (step 4).
  const threadValue = str("thread_type")?.toLowerCase() ?? "";
  const threadType = threadValue.startsWith("full") ? "full" : threadValue.startsWith("part") ? "partial" : null;
  const standardEv = ev("standard");
  const stated = standardEv ? parseStandard(standardEv) : null;
  if (standardEv && !stated) issues.push(`Standard "${standardEv}" is not recognised.`);
  let standard: LineSpec["standard"] = stated?.standard ?? null;
  let standardConflict: string | null = null;
  if (stated && stated.standard !== "OTHER" && threadType) {
    const implied = threadType === "full" ? "ISO 4017" : "ISO 4014";
    if (implied !== stated.standard) {
      standardConflict = `${stated.label} is ${stated.standard === "ISO 4017" ? "fully" : "partly"} threaded, but the email says ${threadType === "full" ? "fully" : "partly"} threaded.`;
    }
  }
  if (!stated && threadType) standard = threadType === "full" ? "ISO 4017" : "ISO 4014";

  // Quantity: the number must appear in its own evidence.
  const quantity = num("quantity");
  const quantityEvidence = ev("quantity");
  if (quantity !== null && !numbersIn(quantityEvidence!).includes(Math.abs(quantity))) {
    issues.push(`Quantity ${quantity} is not in its evidence "${quantityEvidence}".`);
  }

  const finishWord = ev("finish");
  const itemTypeValue = str("item_type");
  const application = grounded.application;

  return {
    sourceText: item.source_text,
    sourceNorm,
    evidence: Object.fromEntries(Object.entries(grounded).map(([k, g]) => [k, g!.evidence])),
    ungrounded,
    itemType: itemTypeValue ? itemTypeOf(itemTypeValue) : null,
    requestedStandard: stated?.substituted ? stated.label : null,
    standard,
    diameter: parsed.diameter,
    imperial: parsed.imperial,
    pitch: parsed.pitch ?? modelPitch,
    lengthMm: parsed.length ?? modelLength,
    group,
    propertyClass,
    threadType,
    quantity,
    quantityEvidence,
    coastal: isCoastalText(emailNorm) || (application !== undefined && isCoastalText(`${application.value} ${application.evidence}`)),
    finish: finishWord ? canonicalFinish(finishWord) : null,
    finishWord,
    claim: group === "A2" || group === "A4" ? { group, cls: propertyClass } : null,
    parseIssues: issues,
    standardConflict,
  };
}
