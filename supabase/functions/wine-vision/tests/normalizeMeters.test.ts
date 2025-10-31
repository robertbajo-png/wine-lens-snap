import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeToFive } from "../index.ts";

Deno.test("normalizeToFive - basic numeric inputs", () => {
  assertEquals(normalizeToFive(0.8), 4.0, "0.8 → 4.0");
  assertEquals(normalizeToFive(3), 1.5, "3 → 1.5");
  assertEquals(normalizeToFive(8), 4.0, "8 → 4.0");
  assertEquals(normalizeToFive(100), 5.0, "100 → 5.0");
  assertEquals(normalizeToFive(0), 0, "0 → 0");
});

Deno.test("normalizeToFive - string fractions and percents", () => {
  assertEquals(normalizeToFive("3/5"), 3.0, "3/5 → 3.0");
  assertEquals(normalizeToFive("1/2"), 2.5, "1/2 → 2.5");
  assertEquals(normalizeToFive("20%"), 1.0, "20% → 1.0");
  assertEquals(normalizeToFive("50%"), 2.5, "50% → 2.5");
  assertEquals(normalizeToFive("80%"), 4.0, "80% → 4.0");
});

Deno.test("normalizeToFive - string numbers", () => {
  assertEquals(normalizeToFive("4"), 2.0);
  assertEquals(normalizeToFive("8"), 4.0);
  assertEquals(normalizeToFive("0.8"), 4.0);
  assertEquals(normalizeToFive("0,6"), 3.0);
});

Deno.test("normalizeToFive - invalid or out-of-range", () => {
  assertEquals(normalizeToFive("hej"), null);
  assertEquals(normalizeToFive(""), null);
  assertEquals(normalizeToFive(undefined), null);
  assertEquals(normalizeToFive(null), null);
  assertEquals(normalizeToFive("300%"), 5.0, "clamps to max 5.0");
});
