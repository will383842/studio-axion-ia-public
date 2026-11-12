/** GV-VG-04 · couverture : meilleure image de l'accroche, titre court dans la bande centrale, instant en millisecondes. */
import { describe, expect, it } from "vitest";
import {
  BANDE_TITRE_COUVERTURE_9_16,
  choisirImageDebut,
  ECART_TRANSITION,
  FENETRE_COUVERTURE_SEC,
  instantsDebut,
  noterImage,
  type MesureImage,
} from "../studio-rendu/src/operations/miniature";
import { boiteTitre, MISES } from "../studio-rendu/compositions/commune/vignette/mises";
import { instantCouvertureMs, REGLAGE_TITRE_COUVERTURE } from "../src/domaine/vignettes";

const nette = (t: number, plus: Partial<MesureImage> = {}): MesureImage => ({ instantSec: t, flou: 2, luminosite: 135, contraste: 100, ecartVoisine: 1, ...plus });

describe("instantsDebut : fenêtre de l'accroche", () => {
  it("13 images au plus : 0,05 s puis tous les 0,25 s jusqu'à 3 s", () => {
    const { premiers } = instantsDebut(30);
    expect(FENETRE_COUVERTURE_SEC).toBe(3);
    expect(premiers).toHaveLength(13);
    expect(premiers.slice(0, 3)).toEqual([0.05, 0.25, 0.5]);
    expect(premiers.at(-1)).toBe(3);
  });
  it("secours : de 3,25 s à 6 s par pas de 0,5 s", () => {
    const { secours } = instantsDebut(30);
    expect(secours[0]).toBe(3.25);
    expect(secours[1]).toBe(3.75);
    expect(secours.at(-1)).toBeLessThanOrEqual(6);
  });
});

describe("noterImage", () => {
  it("reste entre 0 et 100", () => {
    for (const m of [nette(1), nette(1, { flou: 500, luminosite: 0, contraste: 0, ecartVoisine: 255 }), { instantSec: 1 }]) {
      const n = noterImage(m);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
  it("une image nette et stable bat une image floue", () => {
    expect(noterImage(nette(1))).toBeGreaterThan(noterImage(nette(1, { flou: 20 })));
  });
  it("une image bien exposée (vers le milieu) bat une image très claire", () => {
    expect(noterImage(nette(1))).toBeGreaterThan(noterImage(nette(1, { luminosite: 225 })));
  });
});

describe("choisirImageDebut : la mieux notée", () => {
  it("la plus nette de l'accroche, pas la première", () => {
    const r = choisirImageDebut([nette(0.05, { flou: 15 }), nette(0.5, { flou: 2 }), nette(1, { flou: 14 })]);
    expect(r?.instantSec).toBe(0.5);
  });
  it("une image en transition (fondu) est écartée même très nette", () => {
    const r = choisirImageDebut([nette(0.25, { ecartVoisine: ECART_TRANSITION + 5, flou: 0 }), nette(0.5, { flou: 6 })]);
    expect(r?.instantSec).toBe(0.5);
  });
  it("à moins de 5 points d'écart, la plus tôt", () => {
    expect(choisirImageDebut([nette(1.5), nette(0.5), nette(1)])?.instantSec).toBe(0.5);
    expect(choisirImageDebut([nette(0.2), nette(0.3)])?.instantSec).toBe(0.2);
  });
  it("seules les images de l'accroche comptent quand une passe ; sinon le repli (3 à 6 s)", () => {
    const noire = (t: number): MesureImage => ({ instantSec: t, flou: 2, luminosite: 5, contraste: 3 });
    expect(choisirImageDebut([noire(0.05), noire(1), nette(4)])?.instantSec).toBe(4);
    expect(choisirImageDebut([noire(0.05), noire(1), noire(4)])).toBeNull();
  });
});

describe("bande du titre en 9:16", () => {
  it("la mise m2 tient entre 270 et 1250 px, sur 2 et 3 lignes", () => {
    for (const lignes of [2, 3]) {
      const b = boiteTitre(MISES["9:16"].m2.titre, lignes, 128);
      expect(b.y).toBeGreaterThanOrEqual(BANDE_TITRE_COUVERTURE_9_16.haut);
      expect(b.y + b.hauteur).toBeLessThanOrEqual(BANDE_TITRE_COUVERTURE_9_16.bas);
    }
    expect(BANDE_TITRE_COUVERTURE_9_16).toEqual({ haut: 270, bas: 1250 });
  });
});

describe("instant de couverture en millisecondes", () => {
  it("1,25 s = 1250 ms ; inconnu = undefined", () => {
    expect(instantCouvertureMs({ instantSec: 1.25 })).toBe(1250);
    expect(instantCouvertureMs({ instantSec: undefined })).toBeUndefined();
    expect(REGLAGE_TITRE_COUVERTURE).toBe("couverture.titreParDefaut");
  });
});
