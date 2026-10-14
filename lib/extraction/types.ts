// What the model returns. No SKU, price, stock, lead time or status field exists here, by design.

export type Field<T> = { value: T; evidence: string } | null;

export type ExtractedItem = {
  item_type: Field<string>;
  standard: Field<string>;
  thread_size: Field<string>;
  pitch: Field<number>;
  length_mm: Field<number>;
  material: Field<string>;
  property_class: Field<string>;
  thread_type: Field<string>;
  quantity: Field<number>;
  application: Field<string>;
  finish: Field<string>;
  source_text: string;
};

export type Extraction = { items: ExtractedItem[] };

export const FIELD_KEYS = [
  "item_type",
  "standard",
  "thread_size",
  "pitch",
  "length_mm",
  "material",
  "property_class",
  "thread_type",
  "quantity",
  "application",
  "finish",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
