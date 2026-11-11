/** Lot B (audit du 11/11/2026) : une page d'appel seule, trop longue pour la plaque, a sa propre raison de refus. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "./decoupage";
import { diagnosticPageDePlus } from "./densite";
import type { FicheTableau } from "./fiche";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

describe("diagnosticPageDePlus : page d'appel seule", () => {
  it("la page d'appel (une seule scène, rôle appel) -> type « appel-long » avec la consigne des 35 caractères", () => {
    const derniere = temoin.scenes.at(-1)!;
    const d = diagnosticPageDePlus(temoin, derniere.page);
    expect(d?.type).toBe("appel-long");
    expect(d?.texte).toContain("35 caractères au plus");
    expect(d?.texte).toContain("est trop longue pour la plaque");
  });
});
