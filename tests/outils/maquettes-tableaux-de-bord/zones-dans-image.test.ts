// POSTE-7 : zones du film ramenées dans l'image. AUCUN navigateur lancé ici.
import { describe, expect, it } from "vitest";
import { navigationJson, zoneDansImage } from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";
import { lireNavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";

const L = 1080;
const H = 1350;

describe("zoneDansImage", () => {
  it("zone dans l'image : inchangée, au centième", () => {
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
  it("balayage : toujours accepté par le lecteur, jamais de somme > 100", () => {
    for (let i = 0; i < 400; i += 1) {
      const r = { x: -200 + i * 3.37, y: -150 + i * 4.11, largeur: 17.3 + i * 2.9, hauteur: 9.7 + i * 3.1 };
      const z = zoneDansImage(r, L, H);
      if (!z) continue;
      expect(z.largeur).toBeGreaterThan(0);
      expect(z.hauteur).toBeGreaterThan(0);
      expect(z.x + z.largeur).toBeLessThanOrEqual(100);
      expect(z.y + z.hauteur).toBeLessThanOrEqual(100);
    }
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
