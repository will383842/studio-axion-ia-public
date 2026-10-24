/** Clarté des scripts · le contrat `recit` d'un cas : facultatif, strict, sujet de 8 mots au plus, mots clés pris dans le sujet. */
import { describe, expect, it } from "vitest";
import { empreinteCas, verifierCas } from "@/formats/cas-concret/cas";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { RECIT_LT02 } from "./recits-de-test";

const lt02 = trouverCas("transporteur-demandes-de-cotation")!;
const avec = (recit: unknown) => verifierCas({ ...lt02, recit });

describe("recit · contrat du cas", () => {
  it("un récit valide passe", () => {
    const r = avec(RECIT_LT02);
    expect(r.ok).toBe(true);
  });
  it("un mot clé absent du sujet est refusé", () => {
    const r = avec({ ...RECIT_LT02, motsCles: ["demandes", "camion"] });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("n'est pas dans le sujet");
  });
  it("un sujet de 9 mots est refusé", () => {
    expect(avec({ ...RECIT_LT02, sujet: "Vos demandes de prix arrivent toujours sans le poids du colis.", motsCles: ["demandes", "prix"] }).ok).toBe(false);
  });
  it("moins de 2 ou plus de 3 mots clés, ou un champ en plus : refusé", () => {
    expect(avec({ ...RECIT_LT02, motsCles: ["demandes"] }).ok).toBe(false);
    expect(avec({ ...RECIT_LT02, motsCles: ["vos", "demandes", "prix", "poids"] }).ok).toBe(false);
    expect(avec({ ...RECIT_LT02, extra: 1 }).ok).toBe(false);
  });
  it("les accents et la casse ne comptent pas pour les mots clés", () => {
    expect(avec({ ...RECIT_LT02, sujet: "Vos DEMANDES de prix arrivent sans poids.", motsCles: ["demandés", "prix"] }).ok).toBe(true);
  });
  it("un cas sans récit reste valide et son empreinte ne bouge pas (les 22 du catalogue)", () => {
    for (const c of CATALOGUE_TS) {
      expect("recit" in c).toBe(false);
      const r = verifierCas(c);
      expect(r.ok, c.id).toBe(true);
      if (r.ok) expect(empreinteCas(r.cas)).toBe(empreinteCas(c));
    }
  });
});
