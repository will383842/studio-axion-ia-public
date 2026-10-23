import { verifierAnimations } from "./outils-l7";

/** L7a · animations 1 et 2 du bouclier coché, de la bulle de lien, du calendrier, de la carte de tâches et du champ de saisie. */
verifierAnimations("L7a", ["bouclier-coche", "bulle-lien", "calendrier", "carte-taches", "champ-commentaire"]);

/* ------------------------------------------------------------------ */
/* Débordements corrigés (critique de la PR #286) : à chaque image, les pièces qui bougent restent dans leur carte.   */
/* ------------------------------------------------------------------ */

import { describe, expect, it } from "vitest";
import type { Mouvement } from "../../../studio-rendu/compositions/cas-concret/plans/anim-objets";
import { FIXTURES_L7, planL7, TOUTES_IMAGES } from "./outils-l7";

type Boite = { x: number; y: number; largeur: number; hauteur: number };
/** Boîte occupée par une pièce posée en `b`, déplacée et grossie depuis son centre (`echelle` : grossissement de la v4). */
const occupee = (b: Boite, m: Mouvement | undefined, echelle = 1): Boite => {
  const ex = (m?.echelleX ?? 1) * echelle;
  const ey = (m?.echelleY ?? 1) * echelle;
  const cx = b.x + b.largeur / 2 + (m?.dx ?? 0);
  const cy = b.y + b.hauteur / 2 + (m?.dy ?? 0);
  return { x: cx - (b.largeur * ex) / 2, y: cy - (b.hauteur * ey) / 2, largeur: b.largeur * ex, hauteur: b.hauteur * ey };
};
const dans = (b: Boite, l: number, h: number, quoi: string) => {
  expect(b.x, `${quoi} : bord gauche`).toBeGreaterThanOrEqual(-1e-6);
  expect(b.y, `${quoi} : bord haut`).toBeGreaterThanOrEqual(-1e-6);
  expect(b.x + b.largeur, `${quoi} : bord droit`).toBeLessThanOrEqual(l + 1e-6);
  expect(b.y + b.hauteur, `${quoi} : bord bas`).toBeLessThanOrEqual(h + 1e-6);
};

describe("L7a · débordements corrigés", () => {
  it("carte de tâches, toutes animations : à chaque image, chaque case visible reste dans la carte", () => {
    const { largeur, hauteur } = FIXTURES_L7["carte-taches"].boite;
    for (const anim of [0, 1, 2])
      for (const i of TOUTES_IMAGES) {
        const p = planL7("carte-taches", i, "ivoire", anim) as { cases: { index: number; boite: Boite; echelle: number; mouvement?: Mouvement }[] };
        for (const k of p.cases) if ((k.mouvement?.opacite ?? 1) > 0) dans(occupee(k.boite, k.mouvement, k.echelle), largeur, hauteur, `anim ${anim}, image ${i}, case ${k.index}`);
      }
  });

  it("calendrier, toutes animations : à chaque image, chaque case visible reste dans la page ; en anim 2, le bandeau descend", () => {
    const { largeur, hauteur } = FIXTURES_L7.calendrier.boite;
    for (const anim of [0, 1, 2])
      for (const i of TOUTES_IMAGES) {
        const p = planL7("calendrier", i, "ivoire", anim) as { cellules: Boite[]; mouvementsCellules?: Mouvement[]; jour: { index: number; echelle: number } };
        p.cellules.forEach((b, k) => {
          const m = p.mouvementsCellules?.[k];
          if ((m?.opacite ?? 1) > 0) dans(occupee(b, m, k === p.jour.index ? p.jour.echelle : 1), largeur, hauteur, `anim ${anim}, image ${i}, case ${k}`);
        });
      }
    // Le bandeau part du haut de la page et descend à sa place : à 0,24 s (planche), il est encore en chemin.
    const dy = (i: number) => (planL7("calendrier", i, "ivoire", 2) as { bandeau: { mouvement?: Mouvement } }).bandeau.mouvement!.dy;
    expect(dy(0)).toBeLessThan(0);
    expect(dy(6)).toBeLessThan(-20);
    expect(dy(20)).toBeCloseTo(0, 9);
    for (const i of TOUTES_IMAGES.slice(1)) expect(dy(i)).toBeGreaterThanOrEqual(dy(i - 1));
  });

  it("champ de saisie, anim 2 : le bouton d'envoi qui bat ne s'approche jamais du mot et reste dans le champ", () => {
    const { largeur, hauteur } = FIXTURES_L7["champ-commentaire"].boite;
    let battu = false;
    for (const i of TOUTES_IMAGES) {
      const p = planL7("champ-commentaire", i, "ivoire", 2) as { bouton: { droite: number; y: number; diametre: number; mouvement: Mouvement } };
      const { droite, y, diametre, mouvement: m } = p.bouton;
      const gauche = largeur - droite - diametre;
      if (m.echelleX > 1) battu = true;
      // Grossi depuis son bord gauche : ce bord ne bouge pas, le vide avant le mot reste celui de la v4.
      expect(m.origine).toBe("0% 50%");
      expect(m.dx).toBe(0);
      const b = { x: gauche, y: y + (diametre * (1 - m.echelleY)) / 2, largeur: diametre * m.echelleX, hauteur: diametre * m.echelleY };
      dans(b, largeur, hauteur, `image ${i}`);
    }
    expect(battu).toBe(true);
  });
});
