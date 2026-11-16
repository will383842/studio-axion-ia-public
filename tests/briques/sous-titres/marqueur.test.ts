/** C2-U5 : surlignage « marqueur », trois teintes, paires de la charte seulement. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { donneesCalque, fabriquerSousTitres, MARQUEURS } from "@/briques/sous-titres";
import { autoriserTexte, contrasteWcag, PALETTE } from "@/briques/charte/axion-2026";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { ValeurStyleSousTitres } from "@/domaine/types";
import { SURLIGNAGE_CAS_CONCRET } from "@/moteurs/montage-cas-concret/sous-titres-variete";

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels.";
const MOTS = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(0.5 + i * 0.3).toFixed(3), finSec: +(0.5 + i * 0.3 + 0.26).toFixed(3) }));
const DUREE = +(MOTS.at(-1)!.finSec + 0.4).toFixed(3);
const calque = (style: ValeurStyleSousTitres) => {
  const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, mots: MOTS, emphase: ["mails"], style, base: "karaoke", intensite: "equilibre" });
  return donneesCalque({ segments, base: "karaoke", style });
};
const avecMarqueur = (plus: Partial<ValeurStyleSousTitres> = {}): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, texteEcran: { marqueur: { teinte: "terracotta" } }, ...plus });

describe("C2-U5 : marqueur", () => {
  it("(a) chaque paire (clair ou non) est une paire de la charte, contraste >= 4,5", () => {
    for (const m of Object.values(MARQUEURS)) {
      for (const [t, f] of [[m.texte, m.fond], [m.texteClair ?? m.texte, m.fondClair ?? m.fond]]) {
        expect(autoriserTexte(t, f)).toBe(true);
        expect(contrasteWcag(t, f)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("(b) aucune couleur en dur : tout vient de PALETTE, source sans hexadécimal ni alias @/", () => {
    const palette: string[] = Object.values(PALETTE);
    for (const m of Object.values(MARQUEURS)) for (const c of [m.fond, m.texte, m.fondClair, m.texteClair]) if (c) expect(palette).toContain(c);
    const src = readFileSync("src/briques/sous-titres/marqueur.ts", "utf8");
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(src).not.toContain('from "@/');
  });
  it("(c) texteEcran.marqueur donne le surlignage, et le mot souligné le porte", () => {
    const d = calque(avecMarqueur());
    expect(d.surlignage).toEqual(MARQUEURS.terracotta);
    const mots = d.segments.flatMap((s) => s.mots);
    const valeur = mots.find((m) => m.enValeur)!;
    const el = sceneAuTemps(d, valeur.finSec + 0.01);
    expect(el?.surlignage?.fond).toBe(PALETTE.terracotta);
  });
  it("(d) un surlignage explicite reste prioritaire", () => {
    expect(calque(avecMarqueur({ surlignage: SURLIGNAGE_CAS_CONCRET } as never)).surlignage).toEqual(SURLIGNAGE_CAS_CONCRET);
  });
  it("(e) éteint : sans texteEcran, aucune clé surlignage ; texteEcran sans marqueur = identique", () => {
    expect("surlignage" in calque(STYLE_SOUS_TITRES_AVOCAT)).toBe(false);
    expect(calque({ ...STYLE_SOUS_TITRES_AVOCAT, texteEcran: { varier: true } })).toEqual(calque(STYLE_SOUS_TITRES_AVOCAT));
  });
});
