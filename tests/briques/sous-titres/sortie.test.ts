/** C2-U19 (AM-08) : sortie animée d'un groupe de texte (fondu 0,2 s + glissement court, sans rebond). Éteinte. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SORTIE_ACTIVE, SORTIE_PAR_DEFAUT, segmentEnSortie, sortieDuGroupe, type SortieGroupe } from "@/briques/sous-titres/sortie";
import { sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";

const seg = (id: string, debutSec: number, finSec: number) => ({ id, debutSec, finSec, mots: [{ mot: "Bonjour", debutSec, finSec }], style: "base" as const, position: "auto" as const });
const base: DonneesCalque = { largeur: 1080, hauteur: 1920, segments: [seg("a", 1, 2), seg("b", 2, 3), seg("c", 4, 5)], base: "karaoke", couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" }, largeurMaxPx: 960, positions: { milieuPct: 48, hautPct: 20, basPct: 80 } };
const sortie: SortieGroupe = { ...SORTIE_PAR_DEFAUT };

describe("C2-U19 : interrupteur et constantes", () => {
  it("éteint, flou à 0 seulement, fondu 0,2 s, aucun rebond", () => {
    expect(SORTIE_ACTIVE).toBe(false);
    expect(SORTIE_PAR_DEFAUT.dureeSec).toBeCloseTo(0.2, 9);
    expect(SORTIE_PAR_DEFAUT.flouPx).toBe(0);
    expect(SORTIE_PAR_DEFAUT.glissementPx).toBeLessThanOrEqual(40);
  });
});

describe("C2-U19 : sortieDuGroupe (pur)", () => {
  it("avant la fin : rien à changer ; après la durée : fini", () => {
    expect(sortieDuGroupe(sortie, 2, 1.99)).toBeNull();
    expect(sortieDuGroupe(sortie, 2, 2.2)).toBeNull();
    expect(sortieDuGroupe(sortie, 2, 3)).toBeNull();
  });
  it("fondu monotone de 1 vers 0, glissement de 0 vers le maximum, jamais de dépassement (pas de rebond)", () => {
    let o = 1;
    let g = 0;
    for (let k = 0; k < 20; k++) {
      const r = sortieDuGroupe(sortie, 2, 2 + k * 0.01)!;
      expect(r.opacite).toBeLessThanOrEqual(o + 1e-9);
      expect(r.opacite).toBeGreaterThanOrEqual(0);
      expect(r.decalageYPx).toBeGreaterThanOrEqual(g - 1e-9);
      expect(r.decalageYPx).toBeLessThanOrEqual(sortie.glissementPx + 1e-9);
      o = r.opacite;
      g = r.decalageYPx;
    }
    expect(sortieDuGroupe(sortie, 2, 2)!.opacite).toBe(1);
    expect(sortieDuGroupe(sortie, 2, 2.199)!.opacite).toBeLessThan(0.01);
  });
  it("durée nulle ou négative : aucune sortie", () => {
    expect(sortieDuGroupe({ ...sortie, dureeSec: 0 }, 2, 2)).toBeNull();
  });
});

describe("C2-U19 : segmentEnSortie", () => {
  it("le groupe fini dans la fenêtre, jamais si un autre groupe est actif", () => {
    expect(segmentEnSortie(base.segments, sortie, 3.1)!.id).toBe("b");
    expect(segmentEnSortie(base.segments, sortie, 3.2)).toBeNull();
    expect(segmentEnSortie(base.segments, sortie, 2.05)).toBeNull();
    expect(segmentEnSortie(base.segments, sortie, 3.5)).toBeNull();
  });
});

describe("C2-U19 : filet « champ absent = rendu identique »", () => {
  const instants = [0, 0.5, 1, 1.5, 1.99, 2, 2.05, 2.1, 2.2, 2.5, 3, 3.05, 3.5, 4, 4.5, 5, 5.05, 5.1, 5.19, 5.3, 6];
  it("sans `sortie`, la scène disparaît net à la fin du groupe", () => {
    expect(sceneAuTemps(base, 3.05)).toBeNull();
    expect(sceneAuTemps(base, 5.05)).toBeNull();
    expect(sceneAuTemps(base, 4.5)!.opacite).toBe(1);
  });
  it("le champ posé mais l'interrupteur éteint : identique image pour image", () => {
    for (const t of instants) {
      expect(JSON.stringify(sceneAuTemps({ ...base, sortie }, t))).toBe(JSON.stringify(sceneAuTemps(base, t)));
      expect(empreinteTexte({ sousTitres: { ...base, sortie }, encadre: null, incrustations: [] } as never, t)).toBe(empreinteTexte({ sousTitres: base, encadre: null, incrustations: [] } as never, t));
    }
    const p = { encadre: null, incrustations: [], images: 180, fps: 30 } as never;
    expect(instantsTexte({ ...(p as object), sousTitres: { ...base, sortie } } as never)).toEqual(instantsTexte({ ...(p as object), sousTitres: base } as never));
  });
});

describe("C2-U19 : pièce sans effet de bord", () => {
  const src = readFileSync("src/briques/sous-titres/sortie.ts", "utf8");
  it("ni React, ni Remotion, ni alias @/, ni horloge, ni hasard", () => {
    expect(src).not.toMatch(/from "(react|remotion)|from "@\/|Date\.now|Math\.random|performance\.now/);
  });
});
