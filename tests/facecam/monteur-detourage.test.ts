/**
 * T-MONTEUR-DETOURAGE-v20d · tests directs de `monteur/detourage.ts` (module pur) : plaque vide, demande de segmentation,
 * bords du masque, décision des effets. Entrées faites à la main (aucun visage, aucun réseau, aucune horloge).
 */
import { describe, expect, it } from "vitest";
import {
  COUVERTURE_MEDIANE_MIN,
  LIBELLE_EFFET_RATE,
  SEUILS_BORDS,
  bordsAcceptables,
  deciderEffets,
  demandeSegmentation,
  reessayerEffet,
  sourcePlaque,
  type MesuresMasque,
} from "@/moteurs/montage-facecam/monteur/detourage";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur/appliquer";

function passage(id: string, type: string, debut: number, fin: number, extra: Record<string, unknown> = {}): PassageMonteur {
  return { id, operation: { type }, ancre: { debutPriseSec: debut, finPriseSec: fin }, detourage: true, ...extra } as unknown as PassageMonteur;
}

const BON: MesuresMasque = { instabiliteContour: 0, fuitesBords: 0, imagesSansPersonne: 0 };
const MSG_AUCUNE = "Impossible de vous faire disparaître : il manque la pièce vide. La prochaine fois, filmez 3 s sans vous au début.";

describe("sourcePlaque", () => {
  it("plaque filmée d'au moins 1 s : source filmée avec ses bornes", () => {
    expect(sourcePlaque({ filmee: { debutSec: 0, finSec: 3 } })).toEqual({ source: "filmee", debutSec: 0, finSec: 3 });
  });
  it("plaque filmée de 1 s pile : acceptée (borne)", () => {
    expect(sourcePlaque({ filmee: { debutSec: 2, finSec: 3 } }).source).toBe("filmee");
  });
  it("plaque filmée de moins de 1 s et pas de médiane : aucune", () => {
    expect(sourcePlaque({ filmee: { debutSec: 0, finSec: 0.9 } })).toEqual({ source: "aucune", message: MSG_AUCUNE });
  });
  it("médiane couvrant exactement 0,97 : médiane (borne)", () => {
    expect(COUVERTURE_MEDIANE_MIN).toBe(0.97);
    expect(sourcePlaque({ couvertureMediane: 0.97 })).toEqual({ source: "mediane" });
  });
  it("médiane à 0,96 : aucune, avec le message", () => {
    expect(sourcePlaque({ couvertureMediane: 0.96 })).toEqual({ source: "aucune", message: MSG_AUCUNE });
  });
  it("rien du tout : aucune", () => {
    expect(sourcePlaque({})).toEqual({ source: "aucune", message: MSG_AUCUNE });
  });
  it("plaque filmée trop courte mais médiane suffisante : médiane", () => {
    expect(sourcePlaque({ filmee: { debutSec: 0, finSec: 0.5 }, couvertureMediane: 1 })).toEqual({ source: "mediane" });
  });
});

describe("demandeSegmentation", () => {
  it("aucun passage : null", () => {
    expect(demandeSegmentation([], {}, 60)).toBeNull();
  });
  it("seulement masquerPersonne ou passage sans détourage : null", () => {
    const ps = [passage("a", "masquerPersonne", 1, 2), passage("b", "texteDerriere", 5, 6, { sansDetourage: true }), passage("c", "texteDerriere", 8, 9, { detourage: false })];
    expect(demandeSegmentation(ps, {}, 60)).toBeNull();
  });
  it("un passage : marge de 0,3 s de chaque côté et modèle fixe", () => {
    const d = demandeSegmentation([passage("a", "texteDerriere", 10, 12)], { filmee: { debutSec: 0, finSec: 3 } }, 60);
    expect(d?.plages).toHaveLength(1);
    expect(d?.plages[0].debutSec).toBeCloseTo(9.7, 10);
    expect(d?.plages[0].finSec).toBeCloseTo(12.3, 10);
    expect(d?.plaque).toBe("filmee");
    expect(d?.modele).toBe("mediapipe-selfie-multiclass");
  });
  it("2 passages : intervalles bornés à 0 et à la durée de la prise", () => {
    const d = demandeSegmentation([passage("b", "texteDerriere", 58, 59.9), passage("a", "texteDerriere", 0.1, 1)], { couvertureMediane: 0.99 }, 60);
    expect(d?.plages).toHaveLength(2);
    expect(d?.plages[0]).toEqual({ debutSec: 0, finSec: expect.closeTo(1.3, 10) });
    expect(d?.plages[1].debutSec).toBeCloseTo(57.7, 10);
    expect(d?.plages[1].finSec).toBe(60);
    expect(d?.plaque).toBe("mediane");
  });
  it("plages qui se touchent (marges) : fusionnées en une seule", () => {
    const d = demandeSegmentation([passage("a", "texteDerriere", 10, 12), passage("b", "texteDerriere", 12.4, 14)], {}, 60);
    expect(d?.plages).toHaveLength(1);
    expect(d?.plages[0].debutSec).toBeCloseTo(9.7, 10);
    expect(d?.plages[0].finSec).toBeCloseTo(14.3, 10);
    expect(d?.plaque).toBe("aucune");
  });
});

describe("bordsAcceptables", () => {
  it("seuils attendus", () => {
    expect(SEUILS_BORDS).toEqual({ instabiliteContour: 0.08, fuitesBords: 0.05, imagesSansPersonne: 0.02 });
  });
  it("mesures nulles : acceptables", () => {
    expect(bordsAcceptables(BON)).toBe(true);
  });
  for (const cle of Object.keys(SEUILS_BORDS) as (keyof MesuresMasque)[]) {
    it(`${cle} pile au seuil : acceptable`, () => {
      expect(bordsAcceptables({ ...BON, [cle]: SEUILS_BORDS[cle] })).toBe(true);
    });
    it(`${cle} juste au-dessus du seuil : refusé`, () => {
      expect(bordsAcceptables({ ...BON, [cle]: SEUILS_BORDS[cle] + 0.001 })).toBe(false);
    });
    it(`${cle} juste sous le seuil : acceptable`, () => {
      expect(bordsAcceptables({ ...BON, [cle]: SEUILS_BORDS[cle] - 0.001 })).toBe(true);
    });
  }
});

describe("deciderEffets", () => {
  const RATE = { livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" };
  it("libellé exact", () => {
    expect(LIBELLE_EFFET_RATE).toBe("Effet non réussi — Réessayer");
  });
  it("passage sans détourage demandé : ignoré", () => {
    expect(deciderEffets([passage("a", "texteDerriere", 1, 2, { detourage: false })], {}, {})).toEqual([]);
  });
  it("texte derrière sans mesure : variante sans détourage + Réessayer", () => {
    expect(deciderEffets([passage("a", "texteDerriere", 1, 2)], {}, {})).toEqual([{ passageId: "a", ...RATE }]);
  });
  it("texte derrière, mesure mauvaise : variante sans détourage", () => {
    expect(deciderEffets([passage("a", "texteDerriere", 1, 2)], {}, { a: { ...BON, fuitesBords: 0.2 } })).toEqual([{ passageId: "a", ...RATE }]);
  });
  it("texte derrière, mesure bonne : avec effet, sans message", () => {
    expect(deciderEffets([passage("a", "texteDerriere", 1, 2)], {}, { a: BON })).toEqual([{ passageId: "a", livre: "avec-effet" }]);
  });
  it("bords déjà ratés (sansDetourage) : sans détourage même avec bonne mesure", () => {
    expect(deciderEffets([passage("a", "texteDerriere", 1, 2, { sansDetourage: true })], {}, { a: BON })).toEqual([{ passageId: "a", ...RATE }]);
  });
  it("cache-moi sans plaque : impossible, avec le message de la plaque", () => {
    expect(deciderEffets([passage("m", "masquerPersonne", 1, 2)], {}, {})).toEqual([{ passageId: "m", livre: "impossible", message: MSG_AUCUNE }]);
  });
  it("cache-moi avec plaque filmée : avec effet, les mesures sont ignorées", () => {
    expect(deciderEffets([passage("m", "masquerPersonne", 1, 2)], { filmee: { debutSec: 0, finSec: 3 } }, { m: { ...BON, fuitesBords: 1 } })).toEqual([{ passageId: "m", livre: "avec-effet" }]);
  });
  it("plusieurs passages : une décision chacun, dans l'ordre", () => {
    const r = deciderEffets([passage("a", "texteDerriere", 1, 2), passage("m", "masquerPersonne", 3, 4)], { couvertureMediane: 0.97 }, { a: BON });
    expect(r.map((d) => [d.passageId, d.livre])).toEqual([["a", "avec-effet"], ["m", "avec-effet"]]);
  });
});

describe("reessayerEffet", () => {
  it("remet sansDetourage à false sur le seul passage visé", () => {
    const r = reessayerEffet([{ id: "a", sansDetourage: true }, { id: "b", sansDetourage: true }], "a");
    expect(r).toEqual([{ id: "a", sansDetourage: false }, { id: "b", sansDetourage: true }]);
  });
});
