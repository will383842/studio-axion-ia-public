import { describe, expect, it } from "vitest";
import { empreinte } from "@/domaine/proximite/empreinte";
import { scoreProximite, voisines } from "@/domaine/proximite/score";

const e = (sujet: string, signatureUsine?: string) => empreinte({ sujet, signatureUsine });

describe("score de proximité", () => {
  it("1 si identiques (singulier/pluriel compris)", () => {
    expect(scoreProximite(e("Avocat fiscaliste"), e("avocats fiscalistes"))).toBe(1);
  });
  it("0 sans axe commun", () => {
    expect(scoreProximite(e("avocat"), e("boulangerie"))).toBe(0);
  });
  it("symétrique et strictement entre 0 et 1 si recouvrement partiel", () => {
    const a = e("avocat contrat client");
    const b = e("avocat facture");
    const s = scoreProximite(a, b);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
    expect(scoreProximite(b, a)).toBe(s);
  });
  it("une empreinte vide ne ressemble à rien, même à elle-même", () => {
    expect(scoreProximite(e(""), e(""))).toBe(0);
    expect(scoreProximite(e(""), e("avocat"))).toBe(0);
  });
  it("une signatureUsine identique est un axe commun", () => {
    expect(scoreProximite(e("avocat", "sig-a"), e("comptable", "sig-a"))).toBeGreaterThan(0);
    expect(scoreProximite(e("avocat", "sig-a"), e("comptable", "sig-b"))).toBe(0);
  });
  it("voisines : garde celles au seuil, triées par score décroissant", () => {
    const r = voisines(e("avocat contrat"), [
      { id: "x", empreinte: e("boulangerie") },
      { id: "y", empreinte: e("avocat") },
      { id: "z", empreinte: e("avocats contrats") },
    ], 0.4);
    expect(r.map((v) => v.id)).toEqual(["z", "y"]);
  });
});
