/** Lot D · étape 7 : les hypothèses non sourcées restent OFF, même réglage allumé. */
import { describe, expect, it } from "vitest";
import { ordreScript, vitesseVoix } from "@/reseaux/adaptations";

describe("hypothèses non sourcées", () => {
  it("la voix n'est jamais accélérée, sur aucun réseau, réglage allumé ou non", () => {
    for (const actif of [false, true]) for (const r of ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"] as const) expect(vitesseVoix({ actif, origine: "machine", reseau: r })).toBe(1);
  });
  it("l'ordre du script n'est jamais changé (résultat d'abord reste coupé)", () => {
    const ordre = ["accroche", "corps", "fin"];
    expect(ordreScript({ actif: true, origine: "machine", ordre })).toEqual(ordre);
    expect(ordreScript({ actif: false, origine: "machine", ordre })).toEqual(ordre);
  });
});
