/**
 * Page d'appel dont la phrase est longue (audit du 11/11/2026) : « Prenez rendez-vous pour un diagnostic IA gratuit »
 * (48 caractères) n'a pas de bouton ; elle s'écrit sur la plaque, en capitales, et ne tenait pas en 2 lignes : la mise
 * en page levait une erreur. Elle essaie maintenant 3 lignes, puis l'écriture courante sans plaque.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "./decoupage";
import type { FicheTableau } from "./fiche";
import { mettreEnPage } from "./mise-en-page";

const brute = JSON.parse(readFileSync(join(process.cwd(), "tests", "tableau", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });

/** La fiche témoin en « tableau-blanc », dont la dernière scène ne dit que la demande donnée (seule ligne, sans bouton). */
function avecAppel(demande: string): FicheTableau {
  const scenes = temoin.scenes.map((s, i, t) =>
    i === t.length - 1
      ? { ...s, texteDit: demande, elements: s.elements.filter((e) => e.type === "ligne" && e.bloc === "appel").map((e) => ({ ...e, texte: demande.replace(/\.$/, ""), ancre: 0 })) }
      : s,
  );
  return { ...temoin, styleTableau: "tableau-blanc", scenes } as FicheTableau;
}

/** Couleur du bouton d'appel (`fondBouton` des trois styles). */
const FOND_BOUTON = "#B44F29";

const derniere = (f: FicheTableau) => mettreEnPage(f, {}).pages.at(-1)!;

describe("page d'appel : phrase d'appel longue sans bouton", () => {
  it("« Prenez rendez-vous pour un diagnostic IA gratuit » ne fait pas échouer la mise en page (9:16)", () => {
    const f = avecAppel("Prenez rendez-vous pour un diagnostic IA gratuit.");
    expect(() => mettreEnPage(f, {})).not.toThrow();
    const page = derniere(f);
    expect(page.elements.map((e) => e.lignes.map((l) => l.texte).join(" ")).join(" ").toLowerCase()).toContain("diagnostic");
    // La page reste dans le cadre de la mise en page.
    const mise = mettreEnPage(f, {});
    const { x, y, largeur, hauteur } = mise.cadre.px;
    for (const e of page.elements) {
      const r = e.encombrement.px;
      expect(r.x).toBeGreaterThanOrEqual(x - 1);
      expect(r.y).toBeGreaterThanOrEqual(y - 1);
      expect(r.x + r.largeur).toBeLessThanOrEqual(x + largeur + 1);
      expect(r.y + r.hauteur).toBeLessThanOrEqual(y + hauteur + 1);
    }
  });

  it("une ligne courte garde la plaque : objet plaque/carte et fond égaux à la couleur du bouton (le repli sans plaque n'en a pas)", () => {
    const f = avecAppel("Réservez votre diagnostic gratuit.");
    const page = derniere(f);
    const plaque = page.elements.find((e) => e.gabarit?.sorte === "appel-plein");
    expect(plaque).toBeDefined();
    const g = plaque?.gabarit;
    expect(g && "fond" in g ? g.fond : undefined).toBe(FOND_BOUTON);
    const objets = plaque?.tableau?.objets ?? [];
    expect(objets.some((o) => (o.sorte === "plaque" || o.sorte === "carte") && o.c === FOND_BOUTON)).toBe(true);
  });

  it("une phrase longue sans plaque (repli) n'a ni objet plaque ni fond du bouton", () => {
    const page = derniere(avecAppel("Prenez rendez-vous pour un diagnostic IA gratuit et sans engagement aujourd'hui même."));
    const el = page.elements.find((e) => e.gabarit?.sorte === "appel-plein");
    if (el) {
      const g = el.gabarit;
      const aPlaque = (el.tableau?.objets ?? []).some((o) => o.sorte === "plaque" || o.sorte === "carte");
      expect(aPlaque || (g && "fond" in g && g.fond === FOND_BOUTON)).toBe(false);
    }
  });
});
