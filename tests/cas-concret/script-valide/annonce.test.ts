/**
 * V4-3 · L'ANNONCE RECADRÉE ET ZOOMÉE COMME LA V4 (`v4.html`, `tel7` : image de 505 px dans l'écran de 442 px, origine
 * à 50 % / 40 %, zoom de 1,02 à 1,12 sur la durée du plan, montée de −10 à −70 px). Seule l'image déclarée par le cas
 * (`visuels-cas-concret/…`) est cadrée ainsi ; une capture du site reste montrée entière, jamais rognée.
 */
import { describe, expect, it } from "vitest";
import { boiteCapture } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneCapture";

const ecran = { largeur: 442, hauteur: 892 };
const annonce = { sorte: "image" as const, largeur: 1080, hauteur: 1920, cle: "visuels-cas-concret/recrutement-apporteurs/annonce.png" };

describe("V4-3 · annonce cadrée et zoomée", () => {
  it("au début : 505 px × 1,02 de large, centrée ; à la fin : × 1,12, montée de 70 px", () => {
    const debut = boiteCapture(annonce, ecran, 0, 1.3);
    expect(debut.largeur).toBeCloseTo(505 * 1.02, 0);
    expect(debut.x + debut.largeur / 2).toBeCloseTo(221, 0);
    const fin = boiteCapture(annonce, ecran, 1.3, 1.3);
    expect(fin.largeur).toBeCloseTo(505 * 1.12, 0);
    // Origine du zoom à 40 % de la hauteur de l'image ; montée de −10 px au début, vers −70 px (v4 : `va(p(l, .2, d))`).
    const h = (505 * 1920) / 1080;
    expect(debut.y + 0.4 * debut.hauteur).toBeCloseTo(0.4 * h - 10, 0);
    const monte = 0.4 * h - (fin.y + 0.4 * fin.hauteur);
    expect(monte).toBeGreaterThan(40);
    expect(monte).toBeLessThanOrEqual(70);
  });

  it("une capture du site (sans clé du cas) reste entière dans l'écran", () => {
    const b = boiteCapture({ sorte: "image", largeur: 1080, hauteur: 1920, cle: "captures/rdv.jpg" }, ecran, 1, 2);
    expect(b.largeur).toBeLessThanOrEqual(ecran.largeur + 0.01);
    expect(b.hauteur).toBeLessThanOrEqual(ecran.hauteur + 0.01);
  });
});
