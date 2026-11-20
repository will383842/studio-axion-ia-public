/**
 * Transitions des effets spéciaux (v20d) : tests directs des fonctions pures de `transitions.ts`
 * (durée bornée, découpe au cadre, aire, pli, zoom). Entrées construites à la main, aucun réseau, aucune horloge.
 */
import { describe, expect, it } from "vitest";
import {
  airePolygone,
  bornerDureeTransition,
  decouperAuCadre,
  dessinPli,
  dessinTransition,
  dessinZoom,
  DUREE_TRANSITION,
  echelleApres,
  type ParametresTransition,
} from "@/briques/effets-speciaux/transitions";

type P2 = [number, number];

const PARAMS: ParametresTransition = { largeur: 1080, hauteur: 1920, dureeSec: 1.1, point: { x: 540, y: 1500 }, visageApres: [380, 500, 320, 400], graine: 7 };

describe("bornerDureeTransition", () => {
  it("relève une durée sous le minimum à 0,6 s", () => {
    expect(bornerDureeTransition(0.1, "vitre-brisee")).toBe(0.6);
  });
  it("ramène une durée au-dessus du maximum à 1,5 s", () => {
    expect(bornerDureeTransition(9, "ecran-plie")).toBe(1.5);
  });
  it("garde une durée valable telle quelle", () => {
    expect(bornerDureeTransition(1, "zoom-traversant")).toBe(1);
  });
  it("NaN, null et undefined prennent la durée par défaut du style", () => {
    expect(bornerDureeTransition(NaN, "vitre-brisee")).toBe(DUREE_TRANSITION.parDefautSec["vitre-brisee"]);
    expect(bornerDureeTransition(null, "ecran-plie")).toBe(1.1);
    expect(bornerDureeTransition(undefined, "zoom-traversant")).toBe(1);
  });
  it("Infinity n'est pas fini : durée par défaut", () => {
    expect(bornerDureeTransition(Infinity, "vitre-brisee")).toBe(1.2);
  });
});

describe("airePolygone", () => {
  const carre: P2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  it("carré 10 × 10 = 100", () => {
    expect(airePolygone(carre)).toBe(100);
  });
  it("sens inverse : même valeur absolue", () => {
    expect(airePolygone([...carre].reverse())).toBe(100);
  });
  it("triangle rectangle 6 × 4 = 12", () => {
    expect(airePolygone([[0, 0], [6, 0], [0, 4]])).toBe(12);
  });
  it("polygone aplati (points alignés) = 0", () => {
    expect(airePolygone([[0, 0], [5, 5], [10, 10]])).toBe(0);
  });
});

describe("decouperAuCadre", () => {
  it("polygone entièrement dedans : inchangé", () => {
    const p: P2[] = [[10, 10], [50, 10], [50, 50], [10, 50]];
    expect(decouperAuCadre(p, 100, 100)).toEqual(p);
  });
  it("polygone à cheval sur le bord droit : découpé à x = 100", () => {
    const r = decouperAuCadre([[50, 10], [150, 10], [150, 50], [50, 50]], 100, 100);
    expect(r.length).toBeGreaterThanOrEqual(4);
    for (const [x, y] of r) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
    expect(airePolygone(r)).toBeCloseTo(50 * 40, 6);
  });
  it("polygone débordant de tous côtés : le cadre entier", () => {
    const r = decouperAuCadre([[-50, -50], [200, -50], [200, 200], [-50, 200]], 100, 80);
    expect(airePolygone(r)).toBeCloseTo(100 * 80, 6);
  });
  it("polygone entièrement hors du cadre : liste vide", () => {
    expect(decouperAuCadre([[200, 200], [300, 200], [300, 300], [200, 300]], 100, 100)).toEqual([]);
  });
});

describe("echelleApres", () => {
  it("hors zoom traversant : toujours 1", () => {
    expect(echelleApres("vitre-brisee", 0, 1)).toBe(1);
    expect(echelleApres("ecran-plie", 0.5, 1)).toBe(1);
  });
  it("zoom traversant à t = 0 : 1,45 (arrive de plus près)", () => {
    expect(echelleApres("zoom-traversant", 0, 1)).toBeCloseTo(1.45, 10);
  });
  it("zoom traversant à t = durée : 1 (se pose)", () => {
    expect(echelleApres("zoom-traversant", 1, 1)).toBeCloseTo(1, 10);
  });
  it("décroît sans remonter entre 0 et la durée", () => {
    let prec = Infinity;
    for (let i = 0; i <= 10; i++) {
      const e = echelleApres("zoom-traversant", i / 10, 1);
      expect(e).toBeLessThanOrEqual(prec + 1e-12);
      prec = e;
    }
  });
});

const fini = (v: unknown): boolean => {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(fini);
  if (v && typeof v === "object") return Object.values(v).every(fini);
  return true;
};

describe("dessinPli", () => {
  it("après la durée : plus rien", () => {
    expect(dessinPli(PARAMS, PARAMS.dureeSec)).toEqual([]);
  });
  it("même entrée → même sortie", () => {
    expect(dessinPli(PARAMS, 0.4)).toEqual(dessinPli(PARAMS, 0.4));
  });
  it("valeurs finies, commence par l'ombre et finit par le liseré", () => {
    const r = dessinPli(PARAMS, 0.4);
    expect(r.length).toBeGreaterThan(100);
    expect(fini(r)).toBe(true);
    expect(r[0].type).toBe("ombre");
    expect(r[r.length - 1].type).toBe("contour");
    expect(r.filter((d) => d.type === "triangle").length).toBe(r.length - 2);
  });
});

describe("dessinZoom", () => {
  it("après la durée : plus rien", () => {
    expect(dessinZoom(PARAMS, 5)).toEqual([]);
  });
  it("à t = 0 : échelle 1, iris 0, centre au point", () => {
    const [z] = dessinZoom(PARAMS, 0);
    expect(z).toMatchObject({ type: "zoom", centre: [540, 1500], echelle: 1, iris: 0, anneau: 0, lumiere: 0 });
  });
  it("même entrée → même sortie, valeurs finies", () => {
    const a = dessinZoom(PARAMS, 0.5);
    expect(a).toEqual(dessinZoom(PARAMS, 0.5));
    expect(a).toHaveLength(1);
    expect(fini(a)).toBe(true);
  });
  it("l'échelle ne diminue pas pendant la plongée", () => {
    const ech = [0, 0.2, 0.4, 0.6, 0.8].map((t) => (dessinZoom(PARAMS, t)[0] as { echelle: number }).echelle);
    for (let i = 1; i < ech.length; i++) expect(ech[i]).toBeGreaterThanOrEqual(ech[i - 1]);
  });
});

describe("dessinTransition (aiguillage)", () => {
  it("t négatif : l'image figée entière, sans trou", () => {
    expect(dessinTransition("ecran-plie", PARAMS, -0.1)).toEqual([{ type: "image", trous: [] }]);
  });
  it("ecran-plie et zoom-traversant renvoient les mêmes dessins que les fonctions directes", () => {
    expect(dessinTransition("ecran-plie", PARAMS, 0.3)).toEqual(dessinPli(PARAMS, 0.3));
    expect(dessinTransition("zoom-traversant", PARAMS, 0.3)).toEqual(dessinZoom(PARAMS, 0.3));
  });
});
