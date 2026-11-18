/**
 * FIX-TABLEAU-BOUTON-MOTS (18/11) : le bouton de la page d'appel garde les mots de l'utilisateur ; repli sur la
 * constante seulement si ces mots ne tiennent pas (plus de 48 caractères ou plus large que le bouton).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUTON_APPEL_3 } from "../../../src/briques/tableau-scene/reference/charte";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { texteDuBouton } from "../../../src/moteurs/montage-tableau/mise-en-page-v3";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

/** Le témoin dont la ligne écrite d'appel est remplacée (le texte dit ne change pas). */
function avecLigneAppel(texte: string): FicheTableau {
  return {
    ...temoin,
    scenes: temoin.scenes.map((s, i) =>
      i === temoin.scenes.length - 1 ? { ...s, elements: s.elements.map((e) => (e.type === "ligne" && e.bloc === "appel" ? { ...e, texte } : e)) } : s,
    ),
  } as FicheTableau;
}
const pageAppel = (f: FicheTableau) => mettreEnPage(f, {}).pages.at(-1)!;
const bouton = (f: FicheTableau) => pageAppel(f).elements.find((e) => e.gabarit?.sorte === "bouton");
const textes = (f: FicheTableau) => pageAppel(f).elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ");

describe("texteDuBouton (fonction pure)", () => {
  it("reprend les mots, point final retiré ; repli au-delà de 48 caractères", () => {
    expect(texteDuBouton("Réservez votre appel gratuit de 15 minutes.")).toBe("Réservez votre appel gratuit de 15 minutes");
    expect(texteDuBouton("Réservez un appel de diagnostic")).toBe(BOUTON_APPEL_3);
    expect(texteDuBouton("Réservez votre appel gratuit de quinze minutes avec nous dès ce soir")).toBe(BOUTON_APPEL_3);
    expect(texteDuBouton("   ")).toBe(BOUTON_APPEL_3);
  });
});

describe("la page d'appel, par la vraie mise en page", () => {
  it("(a) « Réservez votre appel gratuit de 15 minutes. » : le bouton écrit exactement cela, sans « de diagnostic »", () => {
    const f = avecLigneAppel("Réservez votre appel gratuit de 15 minutes.");
    const b = bouton(f)!;
    expect(b).toBeDefined();
    expect(b.lignes.map((l) => l.texte).join(" ")).toBe("Réservez votre appel gratuit de 15 minutes");
    expect(textes(f)).not.toContain("Réservez un appel de diagnostic");
  });

  it("(e) le texte du bouton tient dans son cadre (largeur ≤ bouton)", () => {
    const b = bouton(avecLigneAppel("Réservez votre appel gratuit de 15 minutes."))!;
    if (b.gabarit?.sorte !== "bouton") throw new Error("bouton");
    for (const l of b.lignes) expect(l.px.largeur).toBeLessThanOrEqual(b.gabarit.cadre.largeur);
  });

  it("(b) 70 caractères : repli sur la constante", () => {
    const longue = "Réservez dès maintenant votre appel gratuit de quinze minutes avec nous";
    expect(longue.length).toBeGreaterThan(48);
    const f = avecLigneAppel(longue);
    expect(bouton(f)!.lignes.map((l) => l.texte).join(" ")).toBe(BOUTON_APPEL_3);
  });

  it("(c) la ligne est déjà « Réservez un appel de diagnostic » : page identique à master", () => {
    expect(bouton(temoin)!.lignes.map((l) => l.texte).join(" ")).toBe(BOUTON_APPEL_3);
    expect(JSON.stringify(mettreEnPage(avecLigneAppel("Réservez un appel de diagnostic"), {}).pages)).toBe(JSON.stringify(mettreEnPage(temoin, {}).pages));
  });
});
