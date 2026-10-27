/**
 * Variété IV · lot TIR : historique et ressemblance de recette (doc 72 § 5 et § 6.1). Fonctions pures.
 * L'historique est reçu en paramètre, de la vidéo la PLUS RÉCENTE à la plus ancienne.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES_VARIETE, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { POIDS_AXES, POIDS_TOTAL, ressemblanceRecette, SEUIL_RESSEMBLANCE } from "@/moteurs/montage-image-video/variete/ressemblance";
import { accepteHistoriqueIV, meilleurRepliIV, ressemblanceMaxIV } from "@/moteurs/montage-image-video/variete/historique";
import { RECETTE_REFERENCE_IV, tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";

const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const R = (sur: Partial<RecetteVarieteIV>): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, ...sur });
/** Une recette dont TOUS les axes diffèrent de la référence. */
const AUTRE: RecetteVarieteIV = { ouverture: "OUV-A", recit: "REC-B", chiffres: "CHI-B", camera: "CAM-B", texte: "TYP-B", apparition: "APP-B", transitions: "TRA-B", fin: "FIN-B", matiere: "MAT-B", sousTitres: "SOU-A", fond: "FON-A", rail: "RAI-A", objets: "OBJ-A", entete: "ENT-B" };

describe("ressemblance de recette (doc 72 § 6.1)", () => {
  it("les poids valent 22 au total (somme calculée)", () => {
    expect(POIDS_TOTAL).toBe(22);
    expect(AXES_VARIETE.reduce((s, a) => s + POIDS_AXES[a], 0)).toBe(22);
    expect(POIDS_AXES).toMatchObject({ ouverture: 3, recit: 2, camera: 2, apparition: 2, fond: 2, chiffres: 1.5, transitions: 1.5, rail: 1.5, objets: 1.5, texte: 1, fin: 1, matiere: 1, entete: 1, sousTitres: 1 });
  });
  it("le seuil est de 50 %", () => expect(SEUIL_RESSEMBLANCE).toBe(0.5));
  it("caméra + matière seulement : 3 ÷ 17 (axes à un seul code tirable ignorés ; l'en-tête compte, il a 4 codes tirables)", () => {
    const s = ressemblanceRecette(R({}), { ...AUTRE, camera: "CAM-A", matiere: "MAT-A" });
    expect(s).toBeCloseTo(3 / 17, 10);
    expect(Math.round(s * 100)).toBe(18);
  });
  it("ne diffèrent que par la fin et les sous-titres : 11,5 ÷ 13,5 (CHI-A et APP-A communs, neutres, hors compte ; l'en-tête commun compte)", () => {
    const s = ressemblanceRecette(R({}), R({ fin: "FIN-B", sousTitres: "SOU-A" }));
    expect(s).toBeCloseTo(11.5 / 13.5, 10);
    expect(Math.round(s * 100)).toBe(85);
  });
  it("les axes ajoutés (un seul code tirable) ne comptent pas ; une recette ancienne sans eux se compare", () => {
    expect(ressemblanceRecette(R({ fond: "FON-B" }), R({}))).toBe(ressemblanceRecette(R({}), R({})));
    const ancienne = { ...R({}) } as Partial<RecetteVarieteIV>;
    for (const a of ["fond", "rail", "objets", "entete"] as const) delete ancienne[a];
    expect(ressemblanceRecette(ancienne as RecetteVarieteIV, R({}))).toBe(1);
  });
  it("identiques 1, tout différent 0, symétrique", () => {
    expect(ressemblanceRecette(AUTRE, AUTRE)).toBe(1);
    expect(ressemblanceRecette(R({}), AUTRE)).toBe(0);
    const a = R({ camera: "CAM-C" });
    expect(ressemblanceRecette(a, AUTRE)).toBe(ressemblanceRecette(AUTRE, a));
  });
});

describe("accepteHistoriqueIV (doc 72 § 5)", () => {
  it("historique vide : tout passe", () => expect(accepteHistoriqueIV(AUTRE, [])).toBe(true));
  it("ouverture égale à l'une des 3 dernières : refusée ; à la 4ᵉ : permise", () => {
    const h = (["REC-A", "REC-B", "REC-C"] as const).map((recit) => ({ ...AUTRE, ouverture: "OUV-A" as const, recit }));
    const cand = { ...AUTRE, ouverture: "OUV-A" as const, recit: "REC-D" as const, camera: "CAM-D" as const, apparition: "APP-C" as const, chiffres: "CHI-C" as const, transitions: "TRA-C" as const };
    expect(accepteHistoriqueIV(cand, h)).toBe(false);
    const h4 = [{ ...h[0], ouverture: "OUV-B" as const }, h[1], h[2], { ...h[2], ouverture: "OUV-C" as const }];
    expect(accepteHistoriqueIV({ ...cand, ouverture: "OUV-C" }, h4)).toBe(true);
  });
  it("ouverture + récit + caméra identiques à l'une des 10 dernières : refusée", () => {
    const vieille = { ...AUTRE, ouverture: "OUV-C" as const, recit: "REC-C" as const, camera: "CAM-C" as const };
    const h = [AUTRE, AUTRE, AUTRE, AUTRE, vieille]; // la 5ᵉ : l'ouverture seule serait permise
    const meme = R({ ouverture: "OUV-C", recit: "REC-C", camera: "CAM-C", apparition: "APP-C", chiffres: "CHI-C", transitions: "TRA-C", texte: "TYP-C", fin: "FIN-C", matiere: "MAT-C", sousTitres: "SOU-B" });
    expect(accepteHistoriqueIV(meme, h)).toBe(false);
  });
  it("ressemblance ≥ 50 % avec l'une des 10 dernières : refusée ; au-delà des 10 : ignorée", () => {
    const proche = R({ ouverture: "OUV-B" }); // 12,5 / 15,5 avec la référence
    expect(accepteHistoriqueIV(proche, [AUTRE, AUTRE, AUTRE, R({})])).toBe(false);
    expect(accepteHistoriqueIV(proche, [...Array(10).fill(AUTRE), R({})])).toBe(true);
  });
  it("meilleurRepliIV : la moins ressemblante, la première en cas d'égalité", () => {
    const c = [R({ fin: "FIN-B" }), AUTRE, R({ camera: "CAM-B" })];
    expect(meilleurRepliIV(c, [R({})])).toBe(AUTRE);
    expect(meilleurRepliIV([c[0], c[2]], [R({})])).toBe(c[2]); // 13,5 contre 14,5 sur 15,5
    expect(meilleurRepliIV([c[0], c[0]], [])).toBe(c[0]);
  });
});

describe("tirage avec historique : garanti", () => {
  const carte = carteDe("C");
  it("rouge sans le lot : 3 vidéos en OUV-A → le tirage ne reprend jamais OUV-A", () => {
    const h = (["REC-A", "REC-B", "REC-C"] as const).map((recit) => R({ ouverture: "OUV-A", recit }));
    for (let i = 0; i < 40; i++) expect(tirerVarieteIV({ graine: `g${i}`, carte, format: "9:16", historique: h }).ouverture).not.toBe("OUV-A");
  });
  it("30 tirages enchaînés : ouverture jamais sur 3, jamais ≥ 50 % sur 10, jamais la même combinaison forte", () => {
    const hist: RecetteVarieteIV[] = []; // la plus récente d'abord
    for (let i = 0; i < 30; i++) {
      const r = tirerVarieteIV({ graine: `video-${i}`, carte, format: "9:16", historique: hist });
      for (const p of hist.slice(0, 3)) expect(r.ouverture).not.toBe(p.ouverture);
      for (const p of hist.slice(0, 10)) {
        expect(ressemblanceRecette(r, p)).toBeLessThan(0.6);
        expect(`${r.ouverture}|${r.recit}|${r.camera}`).not.toBe(`${p.ouverture}|${p.recit}|${p.camera}`);
      }
      hist.unshift(r);
    }
  });
  it("aucun essai ne passe (carte A : OUV-D seule possible, OUV-D la dernière) : la moins ressemblante des candidates", () => {
    const a = carteDe("A");
    const h = [R({ ouverture: "OUV-D" })];
    const r = tirerVarieteIV({ graine: "g-repli", carte: a, format: "9:16", historique: h });
    expect(r.ouverture).toBe("OUV-D");
    expect(accepteHistoriqueIV(r, h)).toBe(false);
    // Jamais plus ressemblante que la première candidate (celle qu'on gardait avant le correctif).
    const premiere = tirerVarieteIV({ graine: "g-repli", carte: a, format: "9:16" });
    expect(ressemblanceMaxIV(r, h)).toBeLessThanOrEqual(ressemblanceMaxIV(premiere, h));
    expect(tirerVarieteIV({ graine: "g-repli", carte: a, format: "9:16", historique: h })).toEqual(r);
  });
  it("même historique, même graine → même choix", () => {
    const h = [R({}), AUTRE];
    expect(tirerVarieteIV({ graine: "x", carte, format: "9:16", historique: h })).toEqual(tirerVarieteIV({ graine: "x", carte, format: "9:16", historique: h }));
  });
});
