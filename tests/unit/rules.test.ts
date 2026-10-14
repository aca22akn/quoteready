import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/db/seed-data";
import { expectNoProduct, ids, line, run } from "./helpers";

const E01 = "Hi, please quote 40 x M10x50 A4-80 hex bolts, fully threaded, for a harbour wall repair. Thanks, Dan";
const E01_LINE = line("40 x M10x50 A4-80 hex bolts, fully threaded, for a harbour wall repair", {
  qty: [40, "40 x"],
  size: "M10x50",
  material: "A4-80",
  cls: ["80", "A4-80"],
  item: ["hex_bolt", "hex bolts"],
  thread: ["full", "fully threaded"],
  app: "harbour wall repair",
});

describe("single-line rules", () => {
  it("T1 complete A4-80 coastal spec is READY with the ISO 4017 row", async () => {
    const r = await run(E01, [E01_LINE]);
    expect(r.badge).toBe("READY");
    expect(r.warnings).toEqual([]);
    expect(r.lines[0].outcome).toBe("READY");
    expect(r.lines[0].product?.sku).toBe("QR-4017-M10-050-A4-80");
  });

  it("T2 stainless with no group, length or class is CLARIFICATION by R2 and R5", async () => {
    const email = "20 stainless M10 bolts for a coastal install";
    const r = await run(email, [
      line(email, { qty: [20, "20"], size: "M10", material: "stainless", item: ["hex_bolt", "bolts"], app: "coastal install" }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("CLARIFICATION");
    expect(ids(l)).toEqual(expect.arrayContaining(["R2", "R5"]));
    const r5 = l.hits.find((h) => h.ruleId === "R5")!;
    expect(r5.reason).toMatch(/length/i);
    expect(r5.reason).toMatch(/class/i);
    expect(l.hits.find((h) => h.ruleId === "R2")!.reason).toMatch(/A4/);
    expectNoProduct(l);
    expect(r.calls).toHaveLength(0);
  });

  it("T3 A2 for a pontoon is NO MATCH by R4 with no lookup, even though the A2 row exists", async () => {
    const email = "Need 100 off A2-70 M12x60 DIN 933 for a pontoon build, price and lead time pls";
    expect(PRODUCTS.some((p) => p.sku === "QR-4017-M12-060-A2-70")).toBe(true);
    const r = await run(email, [
      line("100 off A2-70 M12x60 DIN 933 for a pontoon build", {
        qty: [100, "100 off"],
        size: "M12x60",
        material: "A2-70",
        cls: ["70", "A2-70"],
        standard: "DIN 933",
        app: "pontoon build",
      }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("NO_MATCH");
    expect(ids(l)).toEqual(expect.arrayContaining(["R1", "R4"]));
    expect(l.hits.find((h) => h.ruleId === "R4")!.reason).toMatch(/A4 required/i);
    expectNoProduct(l);
    expect(r.calls).toHaveLength(0);
    expect(r.badge).toBe("NO_MATCH");
  });

  it("T4 A2 with class 8.8 is CLARIFICATION by R3 offering both readings", async () => {
    const email = "10 x M10x50 A2 stainless but class 8.8 please";
    const r = await run(email, [
      line(email, { qty: [10, "10 x"], size: "M10x50", material: "A2 stainless", cls: ["8.8", "class 8.8"] }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("CLARIFICATION");
    expect(ids(l)).toContain("R3");
    expect(l.hits.find((h) => h.ruleId === "R3")!.reason).toMatch(/8\.8/);
    expectNoProduct(l);
  });

  it("T5 DIN 933 8.8 zinc is READY as ISO 4017 with substitution and spanner note", async () => {
    const email = "10 off DIN 933 M10x40 8.8 zinc plated";
    const r = await run(email, [
      line(email, { qty: [10, "10 off"], size: "M10x40", standard: "DIN 933", cls: ["8.8", "8.8"], finish: "zinc plated" }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("READY");
    expect(l.product?.sku).toBe("QR-4017-M10-040-88-ZN");
    expect(l.substitution).toEqual({ requested: "DIN 933", supplied: "ISO 4017" });
    const r1 = l.hits.find((h) => h.ruleId === "R1")!;
    expect(r1.cls).toBe("NOTE");
    expect(r1.reason).toMatch(/17/);
    expect(r1.reason).toMatch(/16/);
  });

  it("T6 quantity above stock stays READY with shortfall 380 and lead time 7 days", async () => {
    const email = "500 M10x50 A4-70 full thread bolts";
    const r = await run(email, [
      line(email, { qty: [500, "500"], size: "M10x50", material: "A4-70", thread: ["full", "full thread"] }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("READY");
    expect(l.product?.sku).toBe("QR-4017-M10-050-A4-70");
    expect(l.shortfall).toBe(380);
    expect(l.hits.find((h) => h.ruleId === "R8")!.reason).toMatch(/7 days/);
  });

  it("T7 absent length is NO MATCH by R7 after one exact lookup", async () => {
    const email = "30 x M10x55 A4-70 hex bolts fully threaded";
    const r = await run(email, [
      line(email, { qty: [30, "30 x"], size: "M10x55", material: "A4-70", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R7");
    expect(r.calls).toHaveLength(1);
  });

  it("T8 fine pitch M10x1.25 is NO MATCH by R6 with no lookup", async () => {
    const email = "10 x M10x1.25x50 hex bolts A4-70";
    const r = await run(email, [
      line(email, { qty: [10, "10 x"], size: "M10x1.25x50", pitch: [1.25, "M10x1.25x50"], material: "A4-70" }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R6");
    expect(r.calls).toHaveLength(0);
  });

  it("T9a fine pitch with missing length and class shows R6 and R5", async () => {
    const email = "M10x1.25 A4 bolts, 20 off";
    const r = await run(email, [
      line(email, { qty: [20, "20 off"], size: "M10x1.25", pitch: [1.25, "M10x1.25"], material: "A4" }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toEqual(expect.arrayContaining(["R6", "R5"]));
  });

  it("T9b M8x1.25 is coarse: CLARIFICATION for length, no R6", async () => {
    const email = "20 off M8x1.25 A4-70 bolts";
    const r = await run(email, [
      line(email, { qty: [20, "20 off"], size: "M8x1.25", pitch: [1.25, "M8x1.25"], material: "A4-70" }),
    ]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("R5");
    expect(ids(r.lines[0])).not.toContain("R6");
  });

  it("T10 imperial is NO MATCH by R6", async () => {
    const email = "2 x 3/8 UNC x 2in bolts, zinc";
    const r = await run(email, [line(email, { qty: [2, "2 x"], size: "3/8 UNC", finish: "zinc" })]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R6");
  });

  it.each([0, -5, 2.5, 10000000])("T15 quantity %s is CLARIFICATION by R9", async (q) => {
    const email = `${q} x M10x50 A4-80 fully threaded bolts`;
    const r = await run(email, [
      line(email, { qty: [q, `${q} x`], size: "M10x50", material: "A4-80", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("R9");
    expectNoProduct(r.lines[0]);
  });

  it("T15b pack quantity is CLARIFICATION by R9 even if the model multiplies it to 200", async () => {
    const email = "morning, can u do us 2 boxes of 100 M8x30 stainless set screws A2, ta";
    const r = await run(email, [
      line("2 boxes of 100 M8x30 stainless set screws A2", {
        qty: [200, "2 boxes of 100"],
        size: "M8x30",
        material: "stainless set screws A2",
        item: ["hex_screw", "set screws"],
      }),
    ]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toEqual(expect.arrayContaining(["R9", "R5"]));
  });

  it("T21 evidence not found in the text makes the field missing", async () => {
    const tampered = { ...E01_LINE, material: { value: "A4-80", evidence: "A4-80 stainless" } };
    const r = await run(E01, [{ ...tampered, property_class: null }]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("R5");
    expectNoProduct(r.lines[0]);
  });

  it("T30 non-breaking spaces and hyphens still give READY", async () => {
    const email = "40 x M10 x 50 A4‑80 hex bolts fully threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10 x 50", material: "A4-80", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("READY");
    expect(r.lines[0].product?.sku).toBe("QR-4017-M10-050-A4-80");
  });

  it("T31 parser disagreeing with the model's length is CLARIFICATION", async () => {
    const email = "40 x M10x50 A4-80 fully threaded";
    const item = line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-80", thread: ["full", "fully threaded"] });
    const r = await run(email, [{ ...item, length_mm: { value: 60, evidence: "M10x50" } }]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("PARSE");
  });

  it("T33a DIN 933 with partly threaded is a standard conflict", async () => {
    const email = "40 x DIN 933 M10x50 A4-70 partly threaded bolts";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-70", standard: "DIN 933", thread: ["partial", "partly threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("STD");
  });

  it("T33b fully threaded with no standard infers ISO 4017", async () => {
    const email = "40 x M10x50 A4-80 fully threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-80", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].product?.standard).toBe("ISO 4017");
    expect(r.calls).toHaveLength(1);
  });

  it("T34 partly threaded A4-80 has no row: NO MATCH, not a silent swap", async () => {
    const email = "40 x M10x50 A4-80 partly threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-80", thread: ["partial", "partly threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R7");
    expectNoProduct(r.lines[0]);
  });
});

describe("R11: standard and thread type both unstated", () => {
  it("T25 rows in both standards is CLARIFICATION naming both, two exact lookups, no SKU", async () => {
    const email = "40 x M10x50 A4-70 bolts";
    const r = await run(email, [line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-70" })]);
    const l = r.lines[0];
    expect(l.outcome).toBe("CLARIFICATION");
    expect(ids(l)).toContain("R11");
    expect(l.hits.find((h) => h.ruleId === "R11")!.reason).toMatch(/ISO 4017.*ISO 4014|ISO 4014.*ISO 4017/);
    expect(r.calls.map((c) => c.standard).sort()).toEqual(["ISO 4014", "ISO 4017"]);
    expectNoProduct(l);
  });

  it("rows in one standard only is READY with an R11 note", async () => {
    const email = "40 x M10x50 A4-80 bolts";
    const r = await run(email, [line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-80" })]);
    const l = r.lines[0];
    expect(l.outcome).toBe("READY");
    expect(l.product?.sku).toBe("QR-4017-M10-050-A4-80");
    expect(l.hits.find((h) => h.ruleId === "R11")!.cls).toBe("NOTE");
  });

  it("rows in neither standard is NO MATCH by R7", async () => {
    const email = "40 x M10x30 A4-80 bolts";
    const r = await run(email, [line(email, { qty: [40, "40 x"], size: "M10x30", material: "A4-80" })]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R7");
  });
});

describe("finish and exact lookup", () => {
  it.each(["zinc plated", "ZP", "BZP"])("T42 %s on 8.8 finds the zinc row", async (finish) => {
    const email = `40 x M10x40 8.8 ${finish} fully threaded`;
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x40", cls: ["8.8", "8.8"], finish, thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("READY");
    expect(r.lines[0].product?.sku).toBe("QR-4017-M10-040-88-ZN");
  });

  it("T42 galvanised is CLARIFICATION listing the finishes supplied, no lookup", async () => {
    const email = "40 x M10x40 8.8 galvanised fully threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x40", cls: ["8.8", "8.8"], finish: "galvanised", thread: ["full", "fully threaded"] }),
    ]);
    const l = r.lines[0];
    expect(l.outcome).toBe("CLARIFICATION");
    const r7 = l.hits.find((h) => h.ruleId === "R7")!;
    expect(r7.cls).toBe("CL");
    expect(r7.reason).toMatch(/plain/);
    expect(r7.reason).toMatch(/zinc/);
    expect(r.calls).toHaveLength(0);
  });

  it("T42 plain on 8.8 is NO MATCH", async () => {
    const email = "40 x M10x40 8.8 plain fully threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x40", cls: ["8.8", "8.8"], finish: "plain", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R7");
  });

  it("T42 plain on stainless is READY", async () => {
    const email = "40 x M10x50 A4-80 plain fully threaded";
    const r = await run(email, [
      line(email, { qty: [40, "40 x"], size: "M10x50", material: "A4-80", finish: "plain", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("READY");
  });

  it("more than one exact row is CLARIFICATION, never the first row", async () => {
    const row = PRODUCTS.find((p) => p.sku === "QR-4017-M10-050-A4-80")!;
    const r = await run(E01, [E01_LINE], [row, { ...row, sku: "QR-DUPLICATE" }]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("R7");
    expectNoProduct(r.lines[0]);
  });
});

describe("multi-line and RFQ level", () => {
  it("T11 three lines: READY, CLARIFICATION, NO MATCH; badge NO MATCH", async () => {
    const email =
      "Hi mate, three things. 40 x M10x50 A4-80 for the harbour wall (full thread). Then 10 x M10x50 A2 8.8. And 2 x 3/8 UNC x 2in";
    const r = await run(email, [
      line("40 x M10x50 A4-80 for the harbour wall (full thread)", {
        qty: [40, "40 x"],
        size: "M10x50",
        material: "A4-80",
        thread: ["full", "full thread"],
        app: "harbour wall",
      }),
      line("10 x M10x50 A2 8.8", { qty: [10, "10 x"], size: "M10x50", material: "A2", cls: ["8.8", "8.8"] }),
      line("2 x 3/8 UNC x 2in", { qty: [2, "2 x"], size: "3/8 UNC" }),
    ]);
    expect(r.lines.map((l) => l.outcome)).toEqual(["READY", "CLARIFICATION", "NO_MATCH"]);
    expect(ids(r.lines[1])).toContain("R3");
    expect(ids(r.lines[1])).not.toContain("R4");
    expect(r.badge).toBe("NO_MATCH");
    expect(r.warnings).toEqual([]);
  });

  it("T14 no items is CLARIFICATION by R10", async () => {
    const r = await run("Are you open on Saturday? Also do you deliver to Leeds?", []);
    expect(r.badge).toBe("CLARIFICATION");
    expect(ids(r.warnings)).toContain("R10");
    expect(r.calls).toHaveLength(0);
  });

  it("T26 bolts and nuts: the nut line is NO MATCH, never dropped", async () => {
    const email = "20 x M10x50 A4-80 fully threaded bolts and 20 nuts to suit";
    const r = await run(email, [
      line("20 x M10x50 A4-80 fully threaded bolts", { qty: [20, "20 x"], size: "M10x50", material: "A4-80", thread: ["full", "fully threaded"] }),
      line("20 nuts to suit", { qty: [20, "20 nuts"], item: ["nut", "nuts"] }),
    ]);
    expect(r.lines.map((l) => l.outcome)).toEqual(["READY", "NO_MATCH"]);
    expect(ids(r.lines[1])).toContain("R6");
    expect(r.badge).toBe("NO_MATCH");
  });

  it("T32 coastal word only in the signature refuses the A2 line, not the A4 line", async () => {
    const email =
      "1) 40 x M10x50 A2-70 fully threaded 2) 40 x M10x50 A4-80 fully threaded. Regards, Harbourside Marine Ltd";
    const r = await run(email, [
      line("40 x M10x50 A2-70 fully threaded", { qty: [40, "40 x"], size: "M10x50", material: "A2-70", thread: ["full", "fully threaded"] }),
      line("40 x M10x50 A4-80 fully threaded", { qty: [40, "40 x"], size: "M10x50", material: "A4-80", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("NO_MATCH");
    expect(ids(r.lines[0])).toContain("R4");
    expect(r.lines[1].outcome).toBe("READY");
  });

  it("T40 a snippet from line 2 attached to line 1 counts as missing", async () => {
    const email = "10 x M10x50 A4-80 fully threaded and 20 x M12x60 A4-70 fully threaded";
    const r = await run(email, [
      line("10 x M10x50 A4-80 fully threaded", { qty: [10, "10 x"], size: "M10x50", material: "A4-70", thread: ["full", "fully threaded"] }),
      line("20 x M12x60 A4-70 fully threaded", { qty: [20, "20 x"], size: "M12x60", material: "A4-70", thread: ["full", "fully threaded"] }),
    ]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expect(ids(r.lines[0])).toContain("R5");
    expectNoProduct(r.lines[0]);
    expect(r.lines[1].outcome).toBe("READY");
  });

  it("an ungrounded source text makes every field of that item missing", async () => {
    const r = await run(E01, [{ ...E01_LINE, source_text: "50 x M10x50 A4-80 hex bolts" }]);
    expect(r.lines[0].outcome).toBe("CLARIFICATION");
    expectNoProduct(r.lines[0]);
  });
});
