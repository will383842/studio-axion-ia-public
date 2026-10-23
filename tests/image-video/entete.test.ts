/**
 * Correction de L7 · le titre de l'en-tête ne descend JAMAIS sous le plancher de lisibilité (0,03 × hauteur) : il
 * rétrécit sur une ligne jusqu'au plancher, puis passe sur 2 lignes (sans déborder sous l'en-tête), et si même 2 lignes
 * ne tiennent pas, alerte bloquante (le rendu est refusé).
 */
import { describe, expect, it } from "vitest";
import { motsBalises } from "@/briques/ecrans-motion";
import { sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { galerieA, galerieB, galerieObjets } from "../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import { SCENES_GALERIE_OBJETS } from "../../studio-rendu/compositions/image-video/donnees-galerie-objets";
import { BAS_ENTETE } from "../../studio-rendu/compositions/image-video/plan";
import { controlerEntetes, HAUT_ENTETE, planTitre, TAILLE_TITRE_IV } from "../../studio-rendu/compositions/image-video/plan-objets";

const L = 1080;
const H = 1920;
const PLANCHER = 0.03 * H;
const ETIQUETTE = 0.0146 * H;

/** Bas du bloc titre (pixels) : haut de l'en-tête + étiquette + écart + lignes. */
const basDuTitre = (t: { taille: number; lignes: string[][] }) => HAUT_ENTETE * H + ETIQUETTE + 0.006 * H + t.lignes.length * t.taille * 1.05;

describe("titre de l'en-tête : plancher de lisibilité", () => {
  it("titre de 60 signes : au plancher ou au-dessus, sur 2 lignes, sans alerte, au-dessus de la toile", () => {
    const titre = "Un client vous écrit à 23h14 et personne ne lui répond *vite.*";
    expect(titre.replace(/\*/g, "")).toHaveLength(60);
    const t = planTitre(titre, L, H);
    expect(t.alerte).toBeNull();
    expect(t.taille).toBeGreaterThanOrEqual(PLANCHER);
    expect(t.lignes).toHaveLength(2);
    expect(basDuTitre(t)).toBeLessThanOrEqual(BAS_ENTETE * H + 1e-6);
    // Tous les mots, dans l'ordre, sans balise.
    expect(t.lignes.flat()).toEqual(motsBalises(titre).map((m) => m.mot));
  });

  it("titre court : une ligne, taille pleine (0,068 × hauteur)", () => {
    const t = planTitre("Une *alerte.*", L, H);
    expect(t.lignes).toHaveLength(1);
    expect(t.taille).toBeCloseTo(TAILLE_TITRE_IV * H, 6);
  });

  it("titre trop long même sur 2 lignes : alerte bloquante, jamais une taille sous le plancher", () => {
    const titre = "Un client vous écrit à 23h14 un dimanche soir et personne ne lui répond avant lundi midi passé, *hélas.*";
    const t = planTitre(titre, L, H);
    expect(t.alerte).toMatch(/Titre trop long/);
    expect(t.taille).toBeGreaterThanOrEqual(PLANCHER);
    expect(controlerEntetes({ largeur: L, hauteur: H, entetes: [{ debut: 0, fin: 1, etiquette: "x", titre }] })).toHaveLength(1);
  });

  it("de 1 à 120 signes : soit une taille ≥ plancher et un bloc qui tient, soit une alerte — jamais d'entre-deux", () => {
    const mots = "Votre client attend une réponse depuis hier soir et rien ne bouge chez vous jusqu'à demain matin neuf heures passées".split(" ");
    for (let n = 1; n <= mots.length; n++) {
      const titre = mots.slice(0, n).join(" ");
      const t = planTitre(titre, L, H);
      expect(t.taille, titre).toBeGreaterThanOrEqual(PLANCHER - 1e-9);
      if (t.alerte === null) {
        expect(t.lignes.length, titre).toBeLessThanOrEqual(2);
        expect(basDuTitre(t), titre).toBeLessThanOrEqual(BAS_ENTETE * H + 1e-6);
        expect(t.lignes.flat().join(" ")).toBe(titre);
      }
    }
  });

  it("les titres des galeries (C, D, E, F, A, B, objets) passent sans alerte", () => {
    expect(controlerEntetes(sceneGalerieC())).toEqual([]);
    for (const image of ["D", "E", "F"] as const) expect(controlerEntetes(SCENES_GALERIE_OBJETS[image]()), image).toEqual([]);
    for (const g of [galerieA(), galerieB(), galerieObjets()]) {
      const entetes = g.moments.flatMap((m) => (m.entete ? [{ ...m.entete, debut: m.debut, fin: m.fin }] : []));
      expect(controlerEntetes({ largeur: g.largeur, hauteur: g.hauteur, entetes })).toEqual([]);
    }
  });
});
