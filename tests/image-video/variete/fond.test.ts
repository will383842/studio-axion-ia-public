/**
 * Variété « Image → vidéo » · axe fond (FON-A..FON-E) : FON-A = rendu v4 exact, 5 styles distincts, texte lisible sur le halo.
 */
import { describe, expect, it } from "vitest";
import { COULEURS_DUO } from "@/briques/habillage/charte-duo";
import { CADRES_IV, VARIANTES_GARDEES } from "@/briques/schema-motion/variete";
import { couleursDuFond } from "../../../studio-rendu/compositions/cas-concret/plans/commun";
import { LUEURS, styleDuFond } from "../../../studio-rendu/compositions/cas-concret/plans/fond-fort";
import { LUEUR_DU_CODE_FOND } from "../../../studio-rendu/compositions/image-video/variete/fond/lueurs";

const CODES = ["FON-A", "FON-B", "FON-C", "FON-D", "FON-E"] as const;
const L = 1080;
const H = 1920;

/** Chaîne v4 (formules d'avant les lueurs). */
function styleV4(fond: "sombre" | "ivoire", largeur: number, hauteur: number) {
  const c = couleursDuFond(fond).degrade;
  const image =
    fond === "sombre"
      ? `radial-gradient(${largeur * 0.83}px ${hauteur * 0.36}px at 50% 78%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`
      : `radial-gradient(${largeur * 0.93}px ${hauteur * 0.47}px at 50% 45%, ${c.centre} 0%, ${c.milieu} 75%)`;
  return { backgroundColor: c.bord, backgroundImage: image };
}

const lum = (hex: string) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe("axe fond", () => {
  it("FON-A reproduit exactement le style v4 (sombre et ivoire, 9:16 et 4:5)", () => {
    for (const fond of ["sombre", "ivoire"] as const)
      for (const h of [1920, 1350]) expect(styleDuFond(fond, L, h, { lueur: LUEUR_DU_CODE_FOND[fond]["FON-A"] })).toEqual(styleV4(fond, L, h));
  });

  it("les 5 codes donnent 5 styles sombres distincts, les 3 positions ivoire sont distinctes, jamais le fond fort", () => {
    const sombres = CODES.map((c) => styleDuFond("sombre", L, H, { lueur: LUEUR_DU_CODE_FOND.sombre[c] }).backgroundImage);
    expect(new Set(sombres).size).toBe(5);
    const ivoires = CODES.map((c) => styleDuFond("ivoire", L, H, { lueur: LUEUR_DU_CODE_FOND.ivoire[c] }).backgroundImage);
    expect(new Set(ivoires).size).toBe(3);
    for (const s of [...sombres, ...ivoires]) expect(s).not.toContain(COULEURS_DUO.orange);
    for (const f of ["sombre", "ivoire"] as const) for (const c of CODES) expect(LUEUR_DU_CODE_FOND[f][c]).toBeLessThan(LUEURS[f].length);
  });

  it("variantes gardées : B à E", () => {
    expect(VARIANTES_GARDEES.fond).toEqual(["FON-B", "FON-C", "FON-D", "FON-E"]);
  });

  it("le texte ivoire reste lisible (>= 4,5:1) sur le halo, bande des sous-titres comprise (FON-E)", () => {
    const c = couleursDuFond("sombre");
    // Pire couleur du dégradé : le centre de la lueur (la plus claire), partout où elle peut tomber.
    expect(contraste(c.texte, c.degrade.centre)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(COULEURS_DUO.blanc, c.degrade.centre)).toBeGreaterThanOrEqual(4.5);
    // Texte encre sur le halo ivoire.
    const i = couleursDuFond("ivoire");
    expect(contraste(i.texte, i.degrade.milieu)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(i.texte, i.degrade.centre)).toBeGreaterThanOrEqual(4.5);
    // FON-E sombre : la lueur (y 56 %) couvre la bande des sous-titres, mais ses couleurs restent celles du dégradé testé.
    const g = LUEURS.sombre[LUEUR_DU_CODE_FOND.sombre["FON-E"]]!;
    const { haut, bas } = CADRES_IV["9:16"].sousTitres;
    expect(g.y / 100 * H).toBeGreaterThan(haut - H * g.h);
    expect(g.y / 100 * H).toBeLessThan(bas + H * g.h);
  });
});
