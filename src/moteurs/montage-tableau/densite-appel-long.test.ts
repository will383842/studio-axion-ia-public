/** Lot B (audit du 11/11/2026) : une page d'appel seule dont la LIGNE ÉCRITE est trop longue pour la plaque a sa propre raison de refus. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "./decoupage";
import { diagnosticPageDePlus } from "./densite";
import type { FicheTableau } from "./fiche";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

/** La fiche témoin dont la ligne écrite d'appel est remplacée (le texte dit ne change pas). */
function avecLigneAppel(texte: string): FicheTableau {
  return {
    ...temoin,
    scenes: temoin.scenes.map((s, i) =>
      i === temoin.scenes.length - 1 ? { ...s, elements: s.elements.map((e) => (e.type === "ligne" && e.bloc === "appel" ? { ...e, texte } : e)) } : s,
    ),
  } as FicheTableau;
}

describe("diagnosticPageDePlus : page d'appel seule", () => {
  it("ligne écrite de plus de 35 caractères -> « appel-long », qui cite CETTE ligne", () => {
    const ligne = "Réservez dès maintenant votre appel de diagnostic gratuit";
    const fiche = avecLigneAppel(ligne);
    const d = diagnosticPageDePlus(fiche, fiche.scenes.at(-1)!.page);
    expect(d?.type).toBe("appel-long");
    expect(d?.texte).toContain(ligne);
    expect(d?.texte).toContain("35 caractères au plus");
    expect(d?.texte).toContain("est trop longue pour la plaque");
  });

  it("témoin : ligne courte (« Réservez un appel de diagnostic », 31 car.) avec un texte dit long -> PAS « appel-long »", () => {
    const derniere = temoin.scenes.at(-1)!;
    expect(derniere.texteDit.length).toBeGreaterThan(35);
    const d = diagnosticPageDePlus(temoin, derniere.page);
    expect(d?.type).not.toBe("appel-long");
  });
});
