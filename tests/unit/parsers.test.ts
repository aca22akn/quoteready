import { describe, expect, it } from "vitest";
import { normalise } from "@/lib/domain/normalise";
import { parseMaterialDesignations, parseThreadDesignation } from "@/lib/domain/designation";
import { canonicalFinish } from "@/lib/domain/finish";
import { formatPence } from "@/lib/money";
import { evalProfile } from "@/lib/server/env";

describe("normalise", () => {
  it.each([
    ["A4‑80", "a4-80"],
    ["A4–80", "a4-80"],
    ["40 x M10", "40 x m10"],
    ["  M10  ×  50 ", "m10 x 50"],
    ["M10X50", "m10x50"],
    ["Line one\n\n line two", "line one line two"],
  ])("%j -> %j", (input, expected) => {
    expect(normalise(input)).toBe(expected);
  });
});

describe("thread designation parser", () => {
  it.each([
    ["m10x1.25x50", { diameter: 10, pitch: 1.25, length: 50, imperial: false }],
    ["m10x50", { diameter: 10, pitch: null, length: 50, imperial: false }],
    ["m8x1.25", { diameter: 8, pitch: 1.25, length: null, imperial: false }],
    ["m10 x 50", { diameter: 10, pitch: null, length: 50, imperial: false }],
    ["m10s x 50s", { diameter: 10, pitch: null, length: 50, imperial: false }],
    ["m12", { diameter: 12, pitch: null, length: null, imperial: false }],
    ["3/8 unc x 2in", { diameter: null, pitch: null, length: null, imperial: true }],
  ])("%s", (input, expected) => {
    expect(parseThreadDesignation(input)).toEqual(expected);
  });
});

describe("material designation parser", () => {
  it("parses group and class in several spellings", () => {
    expect(parseMaterialDesignations("a4-80, a4 80, a4/80 and a2")).toEqual([
      { group: "A4", cls: "80" },
      { group: "A4", cls: "80" },
      { group: "A4", cls: "80" },
      { group: "A2", cls: null },
    ]);
  });
  it("does not read a carbon class as a stainless class", () => {
    expect(parseMaterialDesignations("a2 8.8")).toEqual([{ group: "A2", cls: null }]);
  });
});

describe("finish normalisation", () => {
  it.each([
    ["zinc", "zinc"],
    ["zinc plated", "zinc"],
    ["ZP", "zinc"],
    ["BZP", "zinc"],
    ["bright zinc", "zinc"],
    ["plain", "plain"],
    ["self colour", "plain"],
    ["bare", "plain"],
    ["uncoated", "plain"],
    ["galvanised", "unknown"],
    ["hot dip galv", "unknown"],
    ["yellow zinc", "unknown"],
    ["black", "unknown"],
  ])("%s -> %s", (input, expected) => {
    expect(canonicalFinish(input)).toBe(expected);
  });
});

describe("money", () => {
  it("formats integer pence only at the edge", () => {
    expect(formatPence(1234)).toBe("£12.34");
    expect(formatPence(5)).toBe("£0.05");
  });
});

describe("server-only alias", () => {
  it("lets the env module load outside Next", () => {
    expect(["haiku-low", "haiku-default", "sonnet"]).toContain(evalProfile());
  });
});
