import { z } from "zod";
import type { Extraction } from "./types";

// JSON schema sent to the model. additionalProperties false everywhere, no numeric or string
// constraints, no reasoning field, and no SKU, price, stock, lead time or status field.
// 11 nullable fields = 11 union types (cap 12); source_text is a plain required string.

function nullableField(valueSchema: Record<string, unknown>) {
  return {
    anyOf: [
      {
        type: "object",
        properties: { value: valueSchema, evidence: { type: "string" } },
        required: ["value", "evidence"],
        additionalProperties: false,
      },
      { type: "null" },
    ],
  };
}

const itemProperties = {
  item_type: nullableField({ type: "string", enum: ["hex_bolt", "hex_screw", "nut", "washer", "other"] }),
  standard: nullableField({ type: "string" }),
  thread_size: nullableField({ type: "string" }),
  pitch: nullableField({ type: "number" }),
  length_mm: nullableField({ type: "number" }),
  material: nullableField({ type: "string" }),
  property_class: nullableField({ type: "string" }),
  thread_type: nullableField({ type: "string", enum: ["full", "partial"] }),
  quantity: nullableField({ type: "number" }),
  application: nullableField({ type: "string" }),
  finish: nullableField({ type: "string" }),
  source_text: { type: "string" },
};

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: itemProperties,
        required: Object.keys(itemProperties),
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

// Strict validation after the call: any extra key (for example "sku") fails.
function field<T extends z.ZodType>(value: T) {
  return z.object({ value, evidence: z.string() }).strict().nullable();
}

const itemSchema = z
  .object({
    item_type: field(z.string()),
    standard: field(z.string()),
    thread_size: field(z.string()),
    pitch: field(z.number()),
    length_mm: field(z.number()),
    material: field(z.string()),
    property_class: field(z.string()),
    thread_type: field(z.string()),
    quantity: field(z.number()),
    application: field(z.string()),
    finish: field(z.string()),
    source_text: z.string(),
  })
  .strict();

export const extractionValidator = z.object({ items: z.array(itemSchema) }).strict();

export function validateExtraction(raw: unknown): Extraction | null {
  const result = extractionValidator.safeParse(raw);
  return result.success ? result.data : null;
}
