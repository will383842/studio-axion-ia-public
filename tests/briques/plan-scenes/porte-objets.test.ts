import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { consignePlan } from "@/briques/plan-scenes/generateur";

const AVANT = readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8");

describe("porte C9-33 : la consigne ne change pas", () => {
  it("sans argument : identique à la consigne d'avant la porte", () => {
    expect(consignePlan()).toBe(AVANT);
  });
});
