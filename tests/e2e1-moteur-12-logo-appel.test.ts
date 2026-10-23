/**
 * E2E-1 n° 12 (MINEUR, 03/10) — le logo d'appel (objet incrusté de la fin) garde un écart VISIBLE et constant sous les
 * sous-titres réellement dessinés, et la même taille d'un réseau à l'autre (avant : Shorts ≈ 2 × les autres).
 */
import { describe, expect, it } from "vitest";
import type { IdReseau } from "@/domaine/types";
import { ECART_OBJET_SOUS_TITRES_PX, recalerObjets, type IncrustationScene } from "@/briques/composition";
import { GEOMETRIE_INCRUSTATIONS_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";

const logo: IncrustationScene = { deSec: 12, aSec: 15, type: "objet", url: "entree:objet-9", centreXPx: 540, centreYPx: 1200, taillePx: 300 };
const RESEAUX: IdReseau[][] = [["tiktok"], ["instagram"], ["facebook"], ["youtube-shorts"], ["linkedin"]];

describe("E2E-1 n° 12 · logo d'appel : écart et taille constants", () => {
  it("même taille sur tous les réseaux, écart ≥ 48 px sous le bas des sous-titres", () => {
    const basTexte = 1150;
    const tailles = new Set<number>();
    for (const r of RESEAUX) {
      const [o] = recalerObjets([logo], "9:16", r, { geometrie: GEOMETRIE_INCRUSTATIONS_AVOCAT, basSousTitres: () => basTexte });
      tailles.add(o.taillePx);
      expect(o.centreYPx - o.taillePx / 2).toBeGreaterThanOrEqual(basTexte + ECART_OBJET_SOUS_TITRES_PX - 0.5);
    }
    expect(tailles.size).toBe(1);
  });

  it("sous-titres très bas : l'objet rétrécit ou remonte, jamais dans la zone protégée du bas ; les montants ne bougent pas", () => {
    const montant: IncrustationScene = { deSec: 3, aSec: 5, type: "montant", texte: "+ 2 500 €", centreXPx: 540, centreYPx: 1100, taillePx: 118 };
    const [o, m] = recalerObjets([logo, montant], "9:16", ["tiktok"], { geometrie: GEOMETRIE_INCRUSTATIONS_AVOCAT, basSousTitres: () => 1380 });
    expect(o.centreYPx + o.taillePx / 2).toBeLessThanOrEqual(0.74 * 1920);
    expect(o.taillePx).toBeGreaterThanOrEqual(120);
    expect(m).toEqual(montant);
  });
});
