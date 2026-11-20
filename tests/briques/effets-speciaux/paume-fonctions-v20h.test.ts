import { describe, expect, it } from "vitest";
import {
  CONSEIL_PAUME,
  PAUME,
  paumeVersLeHaut,
  etatPaume,
  quaternionDeBase,
  reperePaume,
  tourner,
  vec3,
  versIso,
  type PointsMain,
  type ReperePaume,
  type Vec3,
} from "../../../src/briques/effets-speciaux/paume";

/** Main synthétique en coordonnées iso (y vers le bas) : poignet à l'origine, doigts vers le fond (z+), paume vers le haut (y−). */
function mainAPlat(longueurDoigt = 0.08): Vec3[] {
  const pts: Vec3[] = Array.from({ length: 21 }, () => [0, 0, 0.05] as Vec3);
  pts[0] = [0, 0, 0];
  const bases: [number, Vec3][] = [
    [5, [0.04, 0, 0.1]],
    [9, [0.01, 0, 0.11]],
    [13, [-0.02, 0, 0.1]],
    [17, [-0.05, 0, 0.085]],
  ];
  for (const [i, b] of bases) {
    pts[i] = b;
    pts[i + 3] = [b[0], b[1], b[2] + longueurDoigt];
  }
  return pts;
}

/** Même main retournée (dos vers le haut) : miroir sur y et sens des jointures inversé via le côté. */
const copie = (p: Vec3[]): Vec3[] => p.map((v) => [...v] as Vec3);

describe("vec3 et tourner", () => {
  it("opérations de base exactes", () => {
    expect(vec3.sous([3, 2, 1], [1, 1, 1])).toEqual([2, 1, 0]);
    expect(vec3.plus([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(vec3.fois([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(vec3.scal([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(vec3.vect([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(vec3.norme([3, 4, 0])).toBe(5);
  });
  it("unitaire : vecteur nul → nul (pas de NaN) ; sinon norme 1", () => {
    expect(vec3.unitaire([0, 0, 0])).toEqual([0, 0, 0]);
    expect(vec3.norme(vec3.unitaire([0, 3, 4]))).toBeCloseTo(1, 12);
  });
  it("tourner : quart de tour autour de z envoie x sur y ; angle 0 = identité ; l'entrée n'est pas modifiée", () => {
    const v: Vec3 = [1, 0, 0];
    const r = tourner(v, [0, 0, 1], Math.PI / 2);
    expect(r[0]).toBeCloseTo(0, 12);
    expect(r[1]).toBeCloseTo(1, 12);
    expect(r[2]).toBeCloseTo(0, 12);
    expect(tourner([1, 2, 3], [0, 0, 1], 0)).toEqual([1, 2, 3]);
    expect(v).toEqual([1, 0, 0]);
  });
});

describe("versIso", () => {
  it("multiplie x et z par largeur/hauteur, laisse y, n'abîme pas l'entrée", () => {
    const entree: PointsMain = [[0.5, 0.25, -0.1]];
    expect(versIso(entree, 2)).toEqual([[1, 0.25, -0.2]]);
    expect(entree).toEqual([[0.5, 0.25, -0.1]]);
  });
  it("liste vide → liste vide", () => {
    expect(versIso([], 1.78)).toEqual([]);
  });
});

describe("reperePaume", () => {
  it("rend null si moins de 21 points, point manquant ou non fini", () => {
    expect(reperePaume([])).toBeNull();
    expect(reperePaume(mainAPlat().slice(0, 20))).toBeNull();
    const nan = mainAPlat();
    nan[8] = [Number.NaN, 0, 0];
    expect(reperePaume(nan)).toBeNull();
  });
  it("rend null si la main est dégénérée (tous les points confondus)", () => {
    expect(reperePaume(Array.from({ length: 21 }, () => [0, 0, 0] as Vec3))).toBeNull();
  });
  it("main à plat côté droit : normale vers le haut (y −1), doigts vers le majeur (0,01 ; 0 ; 0,11) normalisé, ouverture 1, sûr", () => {
    const r = reperePaume(mainAPlat(), "droite") as ReperePaume;
    expect(r.normale[0]).toBeCloseTo(0, 9);
    expect(r.normale[1]).toBeCloseTo(-1, 9);
    expect(r.normale[2]).toBeCloseTo(0, 9);
    expect(r.doigts[0]).toBeCloseTo(0.01 / Math.hypot(0.01, 0.11), 9);
    expect(r.doigts[2]).toBeCloseTo(0.11 / Math.hypot(0.01, 0.11), 9);
    expect(r.ouverture).toBe(1);
    expect(r.sur).toBe(true);
    expect(r.largeur).toBeCloseTo(Math.hypot(0.09, 0, 0.015), 9);
    expect(r.longueur).toBeGreaterThanOrEqual(r.largeur * 1.3 - 1e-12);
  });
  it("le côté gauche inverse la normale ; sans côté et sans flexion : incertain", () => {
    const g = reperePaume(mainAPlat(), "gauche") as ReperePaume;
    expect(g.normale[1]).toBeCloseTo(1, 9);
    const sans = reperePaume(mainAPlat()) as ReperePaume;
    expect(sans.sur).toBe(false);
  });
  it("poing : doigts repliés → ouverture 0", () => {
    const r = reperePaume(mainAPlat(0), "droite") as ReperePaume;
    expect(r.ouverture).toBe(0);
  });
  it("ne modifie pas ses points", () => {
    const pts = mainAPlat();
    const avant = JSON.stringify(pts);
    reperePaume(pts, "droite");
    expect(JSON.stringify(pts)).toBe(avant);
  });
});

describe("etatPaume et paumeVersLeHaut", () => {
  it("null ou repère incertain → incertaine", () => {
    expect(etatPaume(null)).toEqual({ ok: false, raison: "incertaine" });
    expect(etatPaume(reperePaume(mainAPlat()))).toEqual({ ok: false, raison: "incertaine" });
  });
  it("paume ouverte vers le haut → ok", () => {
    expect(etatPaume(reperePaume(mainAPlat(), "droite"))).toEqual({ ok: true });
  });
  it("dos vers le haut (côté inversé) → retournee", () => {
    expect(etatPaume(reperePaume(mainAPlat(), "gauche"))).toEqual({ ok: false, raison: "retournee" });
  });
  it("poing paume en haut → fermee", () => {
    expect(etatPaume(reperePaume(mainAPlat(0), "droite"))).toEqual({ ok: false, raison: "fermee" });
  });
  it("paume montrée de face (normale vers la caméra) → de-face", () => {
    const r = reperePaume(mainAPlat(), "droite") as ReperePaume;
    expect(etatPaume({ ...r, normale: [0, 0, -1] })).toEqual({ ok: false, raison: "de-face" });
  });
  it("seuils : à hautMin exactement la paume passe ; juste en dessous elle est de face", () => {
    const r = reperePaume(mainAPlat(), "droite") as ReperePaume;
    expect(etatPaume({ ...r, normale: [0, -PAUME.hautMin, -0.8] })).toEqual({ ok: true });
    expect(etatPaume({ ...r, normale: [0, -(PAUME.hautMin - 0.01), -0.8] })).toEqual({ ok: false, raison: "de-face" });
  });
  it("paumeVersLeHaut : points absents → incertaine ; points valides → même résultat que le chemin long", () => {
    expect(paumeVersLeHaut(undefined, 1)).toEqual({ ok: false, raison: "incertaine" });
    const pts = copie(mainAPlat());
    expect(paumeVersLeHaut(pts, 1, "droite")).toEqual({ ok: true });
    expect(paumeVersLeHaut(pts.slice(0, 5), 1, "droite")).toEqual({ ok: false, raison: "incertaine" });
  });
  it("le conseil affiché est celui de la fiche", () => {
    expect(CONSEIL_PAUME).toContain("paume ouverte vers le haut");
  });
});

describe("quaternionDeBase", () => {
  it("base identité → quaternion identité [0,0,0,1]", () => {
    const q = quaternionDeBase([1, 0, 0], [0, 1, 0], [0, 0, 1]);
    expect(q[0]).toBeCloseTo(0, 12);
    expect(q[1]).toBeCloseTo(0, 12);
    expect(q[2]).toBeCloseTo(0, 12);
    expect(q[3]).toBeCloseTo(1, 12);
  });
  it("demi-tour autour de y (trace < 0) → [0,1,0,0] en norme 1", () => {
    const q = quaternionDeBase([-1, 0, 0], [0, 1, 0], [0, 0, -1]);
    expect(Math.hypot(...q)).toBeCloseTo(1, 12);
    expect(Math.abs(q[1])).toBeCloseTo(1, 12);
  });
  it("demi-tour autour de x et de z (autres branches) → axe unitaire, w ≈ 0", () => {
    const qx = quaternionDeBase([1, 0, 0], [0, -1, 0], [0, 0, -1]);
    expect(Math.abs(qx[0])).toBeCloseTo(1, 12);
    const qz = quaternionDeBase([-1, 0, 0], [0, -1, 0], [0, 0, 1]);
    expect(Math.abs(qz[2])).toBeCloseTo(1, 12);
  });
  it("quart de tour autour de z : [0,0,√½,√½]", () => {
    const q = quaternionDeBase([0, 1, 0], [-1, 0, 0], [0, 0, 1]);
    expect(q[2]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 12);
  });
});
