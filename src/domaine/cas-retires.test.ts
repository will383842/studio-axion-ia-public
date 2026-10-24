import { describe, expect, it } from "vitest";
import { casRetires, estRetire } from "./cas-retires";

describe("cas retirés (pur)", () => {
  it("retiré : retireLe sans remise", () => {
    expect(estRetire({ retireLe: "2026-10-24T10:00:00.000Z", titre: "A" })).toBe(true);
  });
  it("remis ensuite : plus retiré", () => {
    expect(estRetire({ retireLe: "2026-10-24T10:00:00.000Z", remisLe: "2026-10-24T11:00:00.000Z", titre: "A" })).toBe(false);
  });
  it("retiré de nouveau après la remise : retiré", () => {
    expect(estRetire({ retireLe: "2026-10-24T12:00:00.000Z", remisLe: "2026-10-24T11:00:00.000Z", titre: "A" })).toBe(true);
  });
  it("une entrée illisible est ignorée", () => {
    const s = casRetires({ a: { retireLe: "2026-10-24T10:00:00.000Z", titre: "A" }, b: "oups", c: { retireLe: "pas une date" }, d: null, e: [1], f: { remisLe: "2026-10-24T10:00:00.000Z" } });
    expect([...s]).toEqual(["a"]);
    expect(casRetires(null).size).toBe(0);
    expect(casRetires([] as never).size).toBe(0);
  });
});
