// Synthetic demo catalogue (file 01 section 5). Source of truth for db/seed.sql and the test fixture.

export type Standard = "ISO 4017" | "ISO 4014";
export type MaterialGroup = "A2" | "A4" | "CARBON";
export type PropertyClass = "70" | "80" | "8.8";
export type Finish = "plain" | "zinc";

export type ProductRow = {
  sku: string;
  standard: Standard;
  thread_size: string;
  length_mm: number;
  material_group: MaterialGroup;
  property_class: PropertyClass;
  finish: Finish;
  price_pence: number;
  stock_qty: number;
  lead_time_days: number;
  stock_as_of: string;
};

export const STOCK_AS_OF = "2026-10-01T09:00:00Z";

type Material = { group: MaterialGroup; cls: PropertyClass; finish: Finish; code: string; base: number };

const A2_70: Material = { group: "A2", cls: "70", finish: "plain", code: "A2-70", base: 20 };
const A4_70: Material = { group: "A4", cls: "70", finish: "plain", code: "A4-70", base: 28 };
const A4_80: Material = { group: "A4", cls: "80", finish: "plain", code: "A4-80", base: 36 };
const C8_8: Material = { group: "CARBON", cls: "8.8", finish: "zinc", code: "88-ZN", base: 8 };

const ISO_4017: [Material, string[]][] = [
  [A2_70, ["M8x30", "M8x40", "M10x30", "M10x40", "M10x50", "M10x60", "M12x40", "M12x60"]],
  [A4_70, ["M8x30", "M8x40", "M8x50", "M10x40", "M10x50", "M10x60", "M10x80", "M12x60", "M12x80"]],
  [A4_80, ["M10x50", "M12x60"]],
  [C8_8, ["M8x30", "M8x40", "M10x30", "M10x40", "M10x50", "M10x60", "M12x50", "M12x60", "M12x80"]],
];

const ISO_4014: [Material, string[]][] = [
  [A4_70, ["M10x50", "M10x60", "M10x80", "M12x60", "M12x80"]],
  [C8_8, ["M8x40", "M10x50", "M10x80", "M10x100", "M12x60", "M12x80", "M12x100"]],
];

// Planted stock values (file 01 section 5, "Planted values" and minimums).
const STOCK_OVERRIDES: Record<string, { stock: number; lead: number }> = {
  "QR-4017-M12-060-A2-70": { stock: 400, lead: 2 },
  "QR-4017-M10-050-A4-70": { stock: 120, lead: 7 },
  "QR-4017-M12-080-A4-70": { stock: 0, lead: 21 },
  "QR-4017-M10-050-A4-80": { stock: 800, lead: 3 },
  "QR-4017-M12-060-A4-70": { stock: 500, lead: 3 },
  "QR-4017-M10-040-88-ZN": { stock: 2500, lead: 1 },
};

function build(standard: Standard, table: [Material, string[]][], startIndex: number): ProductRow[] {
  const rows: ProductRow[] = [];
  let index = startIndex;
  for (const [material, sizes] of table) {
    for (const size of sizes) {
      const [thread, lengthText] = size.split("x");
      const length = Number(lengthText);
      const diameter = Number(thread.slice(1));
      const sku = `QR-${standard.slice(4)}-${thread}-${String(length).padStart(3, "0")}-${material.code}`;
      const override = STOCK_OVERRIDES[sku];
      rows.push({
        sku,
        standard,
        thread_size: thread,
        length_mm: length,
        material_group: material.group,
        property_class: material.cls,
        finish: material.finish,
        price_pence: material.base + diameter * 3 + Math.round(length / 2) + (standard === "ISO 4014" ? 2 : 0),
        stock_qty: override ? override.stock : 150 + ((index * 373) % 4850),
        lead_time_days: override ? override.lead : 1 + (index % 5),
        stock_as_of: STOCK_AS_OF,
      });
      index += 1;
    }
  }
  return rows;
}

export const PRODUCTS: ProductRow[] = [...build("ISO 4017", ISO_4017, 0), ...build("ISO 4014", ISO_4014, 28)];
