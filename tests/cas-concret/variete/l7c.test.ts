import { verifierAnimations } from "./outils-l7";

/** L7c · animations 1 et 2 de la pile de notifications, du programme, du rapport et des deux téléphones. */
verifierAnimations("L7c", ["pile-notifications", "programme", "rapport", "telephone-capture", "telephone-notification"]);

/* ------------------------------------------------------------------ */
/* Critique de la PR #288 : carte de notification dans l'écran, capture distincte selon l'animation.               */
/* ------------------------------------------------------------------ */

import { describe, expect, it } from "vitest";
import type { Mouvement } from "../../../studio-rendu/compositions/cas-concret/plans/anim-objets";
import { planL7, TOUTES_IMAGES } from "./outils-l7";

type Boite = { x: number; y: number; largeur: number; hauteur: number };

describe("L7c · débordement corrigé : téléphone notification", () => {
  it("toutes animations : à chaque image, la carte visible reste dans l'écran du téléphone", () => {
    for (const anim of [0, 1, 2])
      for (const i of TOUTES_IMAGES) {
        const p = planL7("telephone-notification", i, "ivoire", anim) as { ecran: Boite; carte: { boite: Boite; opacite: number; decalageY: number; echelle: number; mouvement?: Mouvement } };
        const c = p.carte;
        const m = c.mouvement;
        if (c.opacite * (m?.opacite ?? 1) <= 0) continue;
        const ex = c.echelle * (m?.echelleX ?? 1);
        const ey = c.echelle * (m?.echelleY ?? 1);
        const cx = c.boite.x + c.boite.largeur / 2 + (m?.dx ?? 0);
        const cy = c.boite.y + c.boite.hauteur / 2 + c.decalageY + (m?.dy ?? 0);
        const quoi = `anim ${anim}, image ${i}`;
        expect(cx - (c.boite.largeur * ex) / 2, `${quoi} : bord gauche`).toBeGreaterThanOrEqual(0);
        expect(cx + (c.boite.largeur * ex) / 2, `${quoi} : bord droit`).toBeLessThanOrEqual(p.ecran.largeur);
        expect(cy - (c.boite.hauteur * ey) / 2, `${quoi} : bord haut`).toBeGreaterThanOrEqual(0);
        expect(cy + (c.boite.hauteur * ey) / 2, `${quoi} : bord bas`).toBeLessThanOrEqual(p.ecran.hauteur);
      }
  });

  it("anim 1 : la carte glisse vraiment de côté (départ d'au moins 30 px de l'écran de référence)", () => {
    const p = planL7("telephone-notification", 18, "ivoire", 1) as { ecran: Boite; carte: { mouvement: Mouvement } };
    const debut = (planL7("telephone-notification", 0, "ivoire", 1) as { carte: { mouvement: Mouvement } }).carte.mouvement;
    expect(debut.dx).toBeGreaterThanOrEqual((30 * p.ecran.largeur) / 442);
  });
});

describe("L7c · téléphone capture : les trois animations se distinguent aux instants de la planche (0,16 et 0,28 s)", () => {
  const capture = (image: number, anim?: number) => (planL7("telephone-capture", image, "ivoire", anim) as { ecran: Boite; capture: { mouvement?: Mouvement } });
  it("anim 1 : capture encore sombre ; anim 2 : capture nettement plus bas que sa place ; v4 : capture en place", () => {
    for (const image of [4, 7]) expect(capture(image).capture.mouvement).toBeUndefined();
    expect(capture(4, 1).capture.mouvement!.opacite).toBeLessThan(0.8);
    const p2 = (image: number) => capture(image, 2);
    expect(p2(4).capture.mouvement!.dy).toBeGreaterThanOrEqual(p2(4).ecran.hauteur * 0.1);
    expect(p2(4).capture.mouvement!.opacite).toBeGreaterThan(0.5);
    expect(p2(7).capture.mouvement!.dy).toBeGreaterThanOrEqual(p2(7).ecran.hauteur * 0.04);
  });
});
