/**
 * G6 · C6, C7, C10, C11 et C26 relancés sur l'horodatage RÉEL d'une vidéo fabriquée (plan v5 B.7.1) : aucune marge de
 * 10 % (le temps est mesuré), seuls ces cinq contrôles, les durées de phrase de C26 suivent le débit réel.
 */
import { describe, expect, it } from "vitest";
import { codesLeves, CONTROLES_HORODATAGE_REEL, controlerVersion, horodaterSegments, recontrolerSurHorodatageReel } from "@/domaine/controles-script";
import { temoin } from "./helpers/g3";

/** Horodatage « réel » = l'estimation étirée d'un facteur (débit réel plus lent ou plus rapide). */
function reel(facteur: number) {
  const e = temoin();
  return horodaterSegments([...e.ouverture, ...e.corps, ...e.fin], e.debit).map((h) => ({ debutSec: +(h.debutSec * facteur).toFixed(3), finSec: +(h.finSec * facteur).toFixed(3) }));
}

describe("G6 · contrôles sur l'horodatage réel", () => {
  it("au même rythme que l'estimation : rien de neuf parmi C6, C7, C10, C11, C26", () => {
    const avant = codesLeves(controlerVersion(temoin())).filter((c) => (CONTROLES_HORODATAGE_REEL as readonly string[]).includes(c));
    const apres = codesLeves(recontrolerSurHorodatageReel(temoin(), reel(1)));
    expect(apres.filter((c) => !avant.includes(c))).toEqual([]);
  });

  it("un double plus lent de 70 % : appui, mot-clé ou relance arrivent trop tard, et seuls ces codes sont relancés", () => {
    const r = recontrolerSurHorodatageReel(temoin(), reel(1.7));
    const codes = codesLeves(r);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((c) => (CONTROLES_HORODATAGE_REEL as readonly string[]).includes(c))).toBe(true);
    expect(codes.some((c) => ["C7", "C10", "C11", "C26"].includes(c))).toBe(true);
  });

  it("aucune marge de 10 % : le temps mesuré est comparé tel quel au seuil", () => {
    // Mot-clé dit à 4,7 s réelles : passe (≤ 5 s) sans marge ; le même instant estimé passerait aussi, la marge le rapprocherait.
    const e = temoin();
    const h = reel(1);
    const decalage = 4.7 - h[1].finSec;
    const decale = h.map((x, i) => (i >= 1 ? { debutSec: +(x.debutSec + decalage).toFixed(3), finSec: +(x.finSec + decalage).toFixed(3) } : x));
    const r = recontrolerSurHorodatageReel(e, decale);
    expect(r.violations.filter((v) => v.controle === "C10" && /dit à/.test(v.message))).toEqual([]);
    const tard = h.map((x, i) => (i >= 1 ? { debutSec: +(x.debutSec + decalage + 0.6).toFixed(3), finSec: +(x.finSec + decalage + 0.6).toFixed(3) } : x));
    expect(recontrolerSurHorodatageReel(e, tard).violations.some((v) => v.controle === "C10" && /dit à 5\.3/.test(v.message))).toBe(true);
  });

  it("C26 suit la durée réelle de la phrase (débit réel), pas l'estimation", () => {
    const e = temoin();
    const h = reel(1);
    // La phrase de c3 dure 2 fois plus longtemps à l'écran : plus de 3,5 s sans changement visuel annoté.
    const i = 3;
    const etire = h.map((x, k) => (k === i ? { debutSec: x.debutSec, finSec: +(x.debutSec + (x.finSec - x.debutSec) * 2.2).toFixed(3) } : k > i ? { debutSec: +(x.debutSec + (h[i].finSec - h[i].debutSec) * 1.2).toFixed(3), finSec: +(x.finSec + (h[i].finSec - h[i].debutSec) * 1.2).toFixed(3) } : x));
    const avant = recontrolerSurHorodatageReel(e, h).violations.filter((v) => v.controle === "C26" && v.segmentIndex === i);
    const apres = recontrolerSurHorodatageReel(e, etire).violations.filter((v) => v.controle === "C26" && v.segmentIndex === i);
    expect(avant).toEqual([]);
    expect(apres.length).toBe(1);
  });
});
