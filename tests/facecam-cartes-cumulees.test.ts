/**
 * RAPPORT V6 — P0 n° 9 « animations nombreuses » : les cartes du monteur et les cartes automatiques se CUMULENT.
 * Avant : `e.cartes ?? planifierCartesAuto(…)` — dès qu'une seule carte venait du monteur (« Monteur, mets le chiffre
 * 32 % »), toutes les cartes automatiques disparaissaient. Vraie prise IMG_7747 (mots du montage réel), 9:16 et formats.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { carteDepuisTextes } from "@/briques/motion";
import { cartesAvecAutomatiques, habillageFacecam, type CartePosee } from "@/moteurs/montage-facecam/habillage";
import { habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const mots = reel.mots;
const duree = Math.ceil(mots[mots.length - 1].finSec + 1);
const base = { pisteMonteeCle: "piste.mov", dureeSec: duree, mots, prefixeCartes: "cartes" };

/** Une carte demandée au monteur, au milieu de la vidéo. */
const MONTEUR: CartePosee = { id: "pas-1", debutSec: 40, finSec: 45, disposition: "moitie-haute", carte: carteDepuisTextes("chiffre", ["32 %", "de temps gagné"])! };

const seChevauchent = (l: { debutSec: number; finSec: number }[]) => l.some((a, i) => l.some((b, j) => i < j && a.debutSec < b.finSec - 1e-6 && b.debutSec < a.finSec - 1e-6));

describe("V6 P0 n° 9 · cartes du monteur + cartes automatiques", () => {
  it("une carte du monteur n'efface plus les cartes automatiques (IMG_7747 : au moins 5 cartes, aucune superposée)", () => {
    const seules = habillageFacecam(base).cartes;
    expect(seules.length).toBeGreaterThanOrEqual(5);
    const h = habillageFacecam({ ...base, cartes: [MONTEUR] });
    expect(h.cartes.length).toBeGreaterThanOrEqual(5);
    expect(h.cartes.map((c) => c.id)).toContain("pas-1");
    const posees = cartesAvecAutomatiques([MONTEUR], mots, duree);
    expect(seChevauchent(posees)).toBe(false);
    // Les cartes du monteur passent d'abord : une automatique qui la recouvrirait est écartée, pas la sienne.
    expect(posees.filter((c) => c.id.startsWith("auto-")).every((c) => c.finSec <= MONTEUR.debutSec || c.debutSec >= MONTEUR.finSec)).toBe(true);
  });

  it("les passages occupés (effets spéciaux) ne reçoivent pas de carte automatique", () => {
    const tout = cartesAvecAutomatiques([], mots, duree);
    const premiere = tout[0];
    const posees = cartesAvecAutomatiques([], mots, duree, [{ debutSec: premiere.debutSec, finSec: premiere.finSec }]);
    expect(posees.some((c) => c.debutSec < premiere.finSec && premiere.debutSec < c.finSec)).toBe(false);
  });

  it("formats 4:5 / 1:1 / 16:9 : même cumul", () => {
    for (const ratio of ["4:5", "1:1", "16:9"] as const) {
      const h = habillageFacecamRatio({ ...base, cartes: [MONTEUR] }, ratio);
      expect(h.cartes.length, ratio).toBeGreaterThanOrEqual(5);
    }
  });
});
