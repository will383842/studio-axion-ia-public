// POSTE-7 : zones du film ramenées dans l'image. AUCUN navigateur lancé ici.
import { describe, expect, it } from "vitest";
import { navigationJson, remarquesZones, zoneDansImage } from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";
import { lireNavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";

const L = 1080;
const H = 1350;

describe("zoneDansImage", () => {
  it("zone entièrement dans l'image : exprimée en % au centième", () => {
    expect(zoneDansImage({ x: 108, y: 135, largeur: 360, hauteur: 270 }, L, H)).toEqual({ x: 10, y: 10, largeur: 33.33, hauteur: 20 });
  });
  it("zone qui déborde à droite (cas réel 27,96 % + 81,8 %) : coupée à 100 %", () => {
    const z = zoneDansImage({ x: 0.2796 * L, y: 100, largeur: 0.818 * L, hauteur: 50 }, L, H);
    expect(z).toBeDefined();
    expect(z!.x).toBe(27.96);
    expect(z!.largeur).toBe(72.04);
    expect(z!.x + z!.largeur).toBeLessThanOrEqual(100);
  });
  it("zone qui déborde à gauche et en haut : coupée à 0", () => {
    expect(zoneDansImage({ x: -108, y: -135, largeur: 324, hauteur: 405 }, L, H)).toEqual({ x: 0, y: 0, largeur: 20, hauteur: 20 });
  });
  it("zone plus grande que l'image : toute l'image", () => {
    expect(zoneDansImage({ x: -50, y: -50, largeur: 5000, hauteur: 5000 }, L, H)).toEqual({ x: 0, y: 0, largeur: 100, hauteur: 100 });
  });
  it("zone entièrement hors image, nulle ou illisible : undefined", () => {
    expect(zoneDansImage({ x: L + 10, y: 0, largeur: 50, hauteur: 50 }, L, H)).toBeUndefined();
    expect(zoneDansImage({ x: 0, y: -100, largeur: 50, hauteur: 100 }, L, H)).toBeUndefined();
    expect(zoneDansImage({ x: 10, y: 10, largeur: 0, hauteur: 50 }, L, H)).toBeUndefined();
    expect(zoneDansImage({ x: Number.NaN, y: 0, largeur: 5, hauteur: 5 }, L, H)).toBeUndefined();
    expect(zoneDansImage({ x: 0, y: 0, largeur: 5, hauteur: 5 }, 0, H)).toBeUndefined();
  });
  it("balayage : lu par le vrai lecteur, au moins une zone gardée et une omise", () => {
    const mesures = Array.from({ length: 400 }, (_, i) => ({
      etapeId: `e${i}`,
      rectPx: { x: -200 + i * 3.37, y: -150 + i * 4.11, largeur: 17.3 + i * 2.9, hauteur: 9.7 + i * 3.1 },
      instantMs: i * 10,
      finMs: i * 10 + 5,
    }));
    const nav = navigationJson({ maquette: "m", largeur: L, hauteur: H, debutFilmMs: 0, dureeVoixMs: 5000, mesures });
    const gardees = nav.cibles.filter((c) => c.zonePct);
    const omises = nav.cibles.filter((c) => !c.zonePct);
    expect(gardees.length).toBeGreaterThan(0);
    expect(omises.length).toBeGreaterThan(0);
    for (const c of gardees) {
      const z = c.zonePct!;
      expect(z.largeur).toBeGreaterThan(0);
      expect(z.hauteur).toBeGreaterThan(0);
      expect(z.x + z.largeur).toBeLessThanOrEqual(100);
      expect(z.y + z.hauteur).toBeLessThanOrEqual(100);
    }
    // Le lecteur n'accepte que 1 à 9 cibles : on lit les cibles par paquets de 9.
    for (let i = 0; i < nav.cibles.length; i += 9) {
      const r = lireNavigationFilmee({ ...nav, cibles: nav.cibles.slice(i, i + 9), videoCle: "navigation.mp4" });
      expect(r.ok, r.ok ? "" : r.erreurs.join(" ")).toBe(true);
    }
    // Chaque cible omise a une remarque ; aucune n'est silencieuse.
    const rem = remarquesZones(mesures, L, H);
    for (const c of omises) expect(rem.some((t) => t.startsWith(`Étape ${c.etapeId} : la cible est entièrement hors`))).toBe(true);
  });
});

describe("remarquesZones", () => {
  it("omise, rognée, intacte, sans rectangle", () => {
    const rem = remarquesZones(
      [
        { etapeId: "e1", rectPx: { x: L + 40, y: 10, largeur: 100, hauteur: 100 }, instantMs: 0, finMs: 1 },
        { etapeId: "e2", rectPx: { x: L - 100, y: 10, largeur: 200, hauteur: 100 }, instantMs: 0, finMs: 1 },
        { etapeId: "e3", rectPx: { x: 10, y: 10, largeur: 100, hauteur: 100 }, instantMs: 0, finMs: 1 },
        { etapeId: "e4", instantMs: 0, finMs: 1 },
      ],
      L,
      H,
    );
    expect(rem).toEqual([
      "Étape e1 : la cible est entièrement hors de l'image filmée ; ni caméra, ni curseur, ni projecteur pour cette étape.",
      "Étape e2 : zone coupée par le bord de l'image, 50 % visible.",
    ]);
  });
  it("valeurs illisibles : omise, sans exception", () => {
    expect(remarquesZones([{ etapeId: "e1", rectPx: { x: Number.NaN, y: 0, largeur: 5, hauteur: 5 }, instantMs: 0, finMs: 1 }], L, H)).toHaveLength(1);
  });
});

describe("navigationJson : zones ramenées, lu par lireNavigationFilmee", () => {
  const nav = navigationJson({
    maquette: "05-stocks",
    largeur: L,
    hauteur: H,
    debutFilmMs: 800,
    dureeVoixMs: 18000,
    mesures: [
      { etapeId: "e1", rectPx: { x: 0.2796 * L, y: 100, largeur: 0.818 * L, hauteur: 80 }, instantMs: 500, finMs: 3000 },
      { etapeId: "e2", rectPx: { x: L + 40, y: 10, largeur: 100, hauteur: 100 }, instantMs: 3500, finMs: 6000 },
      { etapeId: "e3", rectPx: { x: -30, y: H - 20, largeur: 200, hauteur: 200 }, instantMs: 6500, finMs: 9000 },
      { etapeId: "e4", instantMs: 9500, finMs: 12000 },
    ],
    figees: [{ debutMs: 0, finMs: 600 }],
  });
  it("zones dans l'image, zone hors image omise, version inchangée", () => {
    expect(nav.version).toBe("navigation-filmee.v1");
    expect(nav.cibles[0].zonePct).toEqual({ x: 27.96, y: 7.41, largeur: 72.04, hauteur: 5.92 });
    expect(nav.cibles[1].zonePct).toBeUndefined();
    expect("zonePct" in nav.cibles[1]).toBe(false);
    expect(nav.cibles[2].zonePct).toEqual({ x: 0, y: 98.52, largeur: 15.74, hauteur: 1.48 });
  });
  it("la sortie passe lireNavigationFilmee", () => {
    const r = lireNavigationFilmee({ ...nav, videoCle: "navigation.mp4" });
    expect(r.ok, r.ok ? "" : r.erreurs.join(" ")).toBe(true);
    if (r.ok) expect(r.navigation.cibles).toHaveLength(4);
  });
});
