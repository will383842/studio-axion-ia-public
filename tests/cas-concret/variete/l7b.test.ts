import { verifierAnimations } from "./outils-l7";

/** L7b · animations 1 et 2 du chrono, du contrat, du dossier, de l'e-mail et des outils reliés. */
verifierAnimations("L7b", ["chrono", "contrat-signature", "dossier-classe", "e-mail", "outils-relies"]);

/* ------------------------------------------------------------------ */
/* Critique de la PR #287 : contrat anim 2 bien distinct de la v4 à l'instant de la planche (0,48 s).               */
/* ------------------------------------------------------------------ */

import { describe, expect, it } from "vitest";
import type { Mouvement } from "../../../studio-rendu/compositions/cas-concret/plans/anim-objets";
import { planL7 } from "./outils-l7";

type Ligne = { largeur: number; mouvement?: Mouvement };
const lignes = (image: number, anim?: number) => (planL7("contrat-signature", image, "ivoire", anim) as { lignes: Ligne[] }).lignes;

describe("L7b · contrat, anim 2 : lignes en fondu du bas vers le haut (ordre inverse de la v4)", () => {
  it("à 0,48 s : en v4 les lignes du haut s'écrivent et celles du bas manquent ; en anim 2 c'est l'inverse", () => {
    const v4 = lignes(12);
    expect(v4[0]!.largeur).toBeGreaterThan(0);
    expect(v4[7]!.largeur).toBe(0);
    const vues = lignes(12, 2).map((l) => l.mouvement!.opacite);
    expect(vues[7]).toBe(1);
    expect(vues[6]).toBe(1);
    expect(vues[0]).toBe(0);
    expect(vues[1]).toBe(0);
    // Une ligne après l'autre, de la dernière à la première.
    for (let i = 1; i < vues.length; i++) expect(vues[i - 1]).toBeLessThanOrEqual(vues[i]!);
  });

  it("anim 2 : toutes les lignes sont posées avant la fin de la signature", () => {
    for (const l of lignes(40, 2)) expect(l.mouvement!.opacite).toBe(1);
  });
});
