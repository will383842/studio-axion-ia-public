/**
 * Variété « Image → vidéo » · lot CAM-TRA, axe CAMÉRA : CAM-B (vue d'ensemble puis plongée), CAM-C (point lumineux sur
 * le fil), CAM-E (deux branches côte à côte). Rouge sans le lot : avec la recette CAM-B, la trajectoire est inchangée.
 * Aucun appel, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BORNES_CAMERA, mesurerTrajectoire } from "@/briques/schema-motion/camera";
import type { CodeVariante, FormatIV, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { controlerCamera } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_CAMERA, largeurBrancheCamE, refusCamE, type DonneesCameraToileIV } from "@/moteurs/montage-image-video/variete/axes/camera";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;

/** Entrée de la version TikTok d'une carte. */
function entree(nom: keyof typeof IMAGES, carte = carteDe(nom)): EntreeMiseEnSceneIV {
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const recette = (camera: CodeVariante<"camera">): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, camera });
const toiles = (blocs: BlocRenduIV[]) => blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile");
const donneesToile = (b: BlocRenduIV) => b.variete?.donnees?.camera as DonneesCameraToileIV | undefined;
const q15 = (b: Extract<BlocRenduIV, { sorte: "toile" }>) => controlerCamera({ id: b.id, toile: b.toile, trajectoire: b.trajectoire, mots: b.proprietes.mots, cadrage: b.cadrage });

describe("CAM-TRA · caméra · possibles", () => {
  it("CAM-D (retirée) n'est jamais possible ; CAM-E seulement avec deux branches (carte C)", () => {
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      const p = AXE_CAMERA.possibles(carteDe(nom), "9:16");
      expect(p).not.toContain("CAM-D");
      expect(p.includes("CAM-E"), nom).toBe(nom === "C");
    }
    expect(AXE_CAMERA.possibles(carteDe("C"), "9:16")).toEqual(["CAM-B", "CAM-C", "CAM-E"]);
  });

  it("CAM-E refusé en 4:5 (comme en 9:16) si une branche ferait moins que ce qu'il lui faut (400 px au moins)", () => {
    expect(largeurBrancheCamE("9:16")).toBeGreaterThanOrEqual(400);
    expect(largeurBrancheCamE("4:5")).toBeGreaterThanOrEqual(400);
    const c = carteDe("C");
    const longue = { ...c, noeuds: c.noeuds.map((n) => (n.id === "n08" ? { ...n, libelle: "Transmis anticonstitutionnellement" } : n)) };
    for (const format of ["9:16", "4:5"] as FormatIV[]) {
      expect(refusCamE(c, format)).toBeNull();
      expect(refusCamE(longue, format)).toMatch(/px/);
      expect(AXE_CAMERA.possibles(longue, format)).not.toContain("CAM-E");
    }
    const avec = mettreEnSceneIV({ ...entree("C", longue), variete: recette("CAM-E"), format: "4:5" });
    expect(avec.ligne.blocs.some((b) => b.sorte === "variete" && b.axe === "camera")).toBe(false);
    expect(avec.ligne.variete?.replis).toEqual([expect.objectContaining({ axe: "camera", code: "CAM-E" })]);
  });
});

describe("CAM-TRA · caméra · CAM-B", () => {
  it("rouge sans le lot : la trajectoire de la première toile change, part du zoom 0,8 et plonge", () => {
    const sans = mettreEnSceneIV(entree("C"));
    const avec = mettreEnSceneIV({ ...entree("C"), variete: recette("CAM-B") });
    const [a] = toiles(sans.ligne.blocs);
    const [b] = toiles(avec.ligne.blocs);
    expect(JSON.stringify(b.trajectoire.images)).not.toBe(JSON.stringify(a.trajectoire.images));
    expect(b.trajectoire.images[0].zoom).toBe(BORNES_CAMERA.zoomMin);
    const d = donneesToile(b)!;
    expect(d).toMatchObject({ code: "CAM-B", fond: "ivoire", vue: { noeud: b.proprietes.mots.slice().sort((x, y) => x.t - y.t)[0].noeud } });
    expect(d.trajectoire).toEqual(b.trajectoire.images);
  });

  it("Q15 : aucune séquence n'a plus de défauts caméra qu'avec la référence ; vitesse ≤ 1,2 écran/s ; zoom 0,8-1,6", () => {
    for (const nom of ["C", "D", "E", "F"] as const) {
      const sans = toiles(mettreEnSceneIV(entree(nom)).ligne.blocs);
      const avec = toiles(mettreEnSceneIV({ ...entree(nom), variete: recette("CAM-B") }).ligne.blocs);
      avec.forEach((b, i) => {
        const m = mesurerTrajectoire(b.trajectoire);
        expect(m.vitesseMax).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-3);
        expect(m.zoomMin).toBeGreaterThanOrEqual(BORNES_CAMERA.zoomMin - 1e-6);
        const ref = q15(sans[i]);
        const r = q15(b);
        expect(r.q15.filter((x) => !ref.q15.includes(x)), `${nom} ${b.id}`).toEqual([]);
        expect(r.coupes.filter((x) => !ref.coupes.includes(x)), `${nom} ${b.id}`).toEqual([]);
      });
    }
  });
});

describe("CAM-TRA · caméra · CAM-C", () => {
  it("courses du point sur le fil (de → vers reliés par une flèche), caméra plus lente, mêmes images clés en nombre", () => {
    const sans = toiles(mettreEnSceneIV(entree("C")).ligne.blocs);
    const avec = toiles(mettreEnSceneIV({ ...entree("C"), variete: recette("CAM-C") }).ligne.blocs);
    const d = donneesToile(avec[0])!;
    expect(d.code).toBe("CAM-C");
    expect(d.courses!.length).toBeGreaterThanOrEqual(3);
    const fils = new Set(avec[0].toile.fleches.map((f) => `${f.de}>${f.vers}`));
    for (const c of d.courses!) {
      expect(fils.has(`${c.de}>${c.vers}`)).toBe(true);
      expect(c.t1).toBeGreaterThan(c.t0);
    }
    expect(avec[0].trajectoire.images.length).toBe(sans[0].trajectoire.images.length);
    expect(JSON.stringify(avec[0].trajectoire.images)).not.toBe(JSON.stringify(sans[0].trajectoire.images));
    expect(mesurerTrajectoire(avec[0].trajectoire).vitesseMax).toBeLessThanOrEqual(mesurerTrajectoire(sans[0].trajectoire).vitesseMax + 1e-6);
    for (let i = 0; i < avec.length; i++) {
      const ref = q15(sans[i]);
      const r = q15(avec[i]);
      expect([...r.q15, ...r.coupes].filter((x) => ![...ref.q15, ...ref.coupes].includes(x))).toEqual([]);
    }
  });
});

describe("CAM-TRA · caméra · CAM-E", () => {
  it("règle d'or (intégration) : sur la carte C, CAM-E laisserait des changements comptés sans dessin → repli, la toile reste", () => {
    const sans = mettreEnSceneIV(entree("C")).ligne;
    const avec = mettreEnSceneIV({ ...entree("C"), variete: recette("CAM-E") }).ligne;
    expect(avec.blocs.some((b) => b.sorte === "variete" && b.axe === "camera")).toBe(false);
    expect(avec.variete?.replis).toEqual([expect.objectContaining({ axe: "camera", code: "CAM-E", raison: expect.stringMatching(/ne change pas à|ne montre pas le nœud/) })]);
    // Après l'ouverture (OUV-D de la recette de référence), les mêmes blocs qu'avec CAM-A.
    const reference = mettreEnSceneIV({ ...entree("C"), variete: recette("CAM-A") }).ligne;
    expect(avec.blocs.map((b) => [b.sorte, b.debut, b.fin])).toEqual(reference.blocs.map((b) => [b.sorte, b.debut, b.fin]));
    expect(sans.blocs.length).toBeGreaterThan(0);
  });
});

describe("CAM-TRA · caméra · invariants (ce qui est montré et dit ne change pas)", () => {
  const cas: [keyof typeof IMAGES, CodeVariante<"camera">][] = (["A", "B", "C", "D", "E", "F"] as const).flatMap((nom) => AXE_CAMERA.possibles(carteDe(nom), "9:16").map((c) => [nom, c as CodeVariante<"camera">] as [keyof typeof IMAGES, CodeVariante<"camera">]));
  it.each(cas)("carte %s · %s", (nom, code) => {
    const sans = mettreEnSceneIV(entree(nom));
    const avec = mettreEnSceneIV({ ...entree(nom), variete: recette(code) });
    expect(invariantsVarieteIV(sans, avec)).toEqual([]);
  });
});
