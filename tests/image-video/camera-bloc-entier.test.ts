/**
 * 17/10 · Prod (après la variété, rejoué sur le serveur avec 0c61896e) : rythme et règle d'or passent, mais la mise en
 * scène reste refusée sur les 5 réseaux par la caméra de la toile :
 *  - Q15 « séquence b06 : au mot du bloc n03 (0,9 s), le bloc n'est pas entier dans le cadre » (n06 dans la b08) ;
 *  - Q23 « séquence b06 : à 0,7 / 0,9 / 2,9 s, le bloc n03 est coupé par le bord de l'écran ».
 * Cause : deux mots se suivent de trop près pour la vitesse de la caméra (≤ 1,2 écran/s) sur une toile plus large que
 * l'écran (cartes grandes du lot G, branches côte à côte). La caméra partait aussitôt et arrivait APRÈS le mot : le bloc
 * parlé n'était pas entier sur son mot, et les blocs posés traversaient le bord pendant le panoramique.
 * Règle : au mot d'un bloc, la caméra cadre ce bloc entier (marge de sécurité) ; si elle ne peut pas y glisser à temps,
 * elle COUPE franc d'une pose propre à l'autre (aucun bloc posé n'est jamais coupé par le bord pendant qu'il est vu).
 * Fiche réelle reproduite sur la carte C (chatbot) : un écran `embranchement` cite [g-branche-a, n03, c02, l02], un écran
 * `micro-objet` sans bénéfice (repassé en `toile` par #320) cite [n06, n07, l05, l06].
 */
import { describe, expect, it, vi } from "vitest";
import { BORNES_CAMERA, controlerCadrage, mesurerTrajectoire, trajectoireCamera } from "@/briques/schema-motion/camera";
import type { DispositionToile } from "@/briques/schema-motion/types";
import type { CodeVariante, FormatIV, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { controlerCamera } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { scenesPermises } from "@/moteurs/montage-image-video/recettes";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { calculerScene } from "../../studio-rendu/compositions/image-video/plan";
import { carteFixe } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 300_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Image = keyof typeof IMAGES;
const CAMERAS: CodeVariante<"camera">[] = ["CAM-A", "CAM-B", "CAM-C", "CAM-E"];
/** Les seuls refus visés ici : un bloc pas entier sur son mot (Q15), un bloc coupé par le bord (Q23). */
const CADRAGE = /pas entier dans le cadre|coupé par le bord/;

function entreeDe(nom: Image, fiche: FicheImage, reseau: string, variete?: RecetteVarieteIV, format?: FormatIV): EntreeMiseEnSceneIV {
  const carte = carteFixe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau as never))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV, ...(variete ? { variete, format: format ?? "9:16" } : {}) };
}

/** Fiche du chatbot comme en prod : embranchement [groupe, nœud de la branche, chiffre, lien], puis toile [nX, nY, l1, l2]. */
function ficheChatbot(): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  Object.assign(par("e06"), { scene: "embranchement", refs: ["g-branche-a", "n03", "c02", "l02"] });
  Object.assign(par("e08"), { scene: "toile", refs: ["n04", "n05", "l03", "l04"] });
  Object.assign(par("e09"), { scene: "micro-objet", refs: ["n06", "n07", "l05", "l06"] });
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

const toiles = (blocs: BlocRenduIV[]) => blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile");
/** Refus de cadrage (Q15 bloc pas entier, Q23 coupé par le bord) d'une mise en scène. */
const refusCadrage = (e: EntreeMiseEnSceneIV) =>
  mettreEnSceneIV(e)
    .rapport.lignes.filter((l) => !l.ok && (l.code === "Q15" || l.code === "Q23"))
    .flatMap((l) => l.details)
    .filter((d) => CADRAGE.test(d));

describe("caméra : au mot d'un bloc, le bloc est entier ; aucun bloc posé n'est coupé par le bord", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : fiche du chatbot, sans recette et recette de référence`, () => {
      expect(refusCadrage(entreeDe("C", ficheChatbot(), reseau))).toEqual([]);
      expect(refusCadrage(entreeDe("C", ficheChatbot(), reseau, RECETTE_REFERENCE_IV))).toEqual([]);
    });
  }

  for (const camera of CAMERAS) {
    for (const format of ["9:16", "4:5"] as FormatIV[]) {
      it(`${camera} en ${format} : fiche du chatbot, aucun refus de cadrage`, () => {
        expect(refusCadrage(entreeDe("C", ficheChatbot(), format === "4:5" ? "linkedin" : "youtube-shorts", { ...RECETTE_REFERENCE_IV, camera }, format))).toEqual([]);
      });
    }
  }

  it("la caméra contrôlée reste celle que rend la composition (L7), coupe franche comprise", () => {
    const r = mettreEnSceneIV(entreeDe("C", ficheChatbot(), "youtube-shorts"));
    const coupes = toiles(r.ligne.blocs).filter((b) => b.trajectoire.images.some((x, k, l) => k > 0 && l[k - 1].t === x.t));
    expect(coupes.length).toBeGreaterThan(0);
    for (const b of toiles(r.ligne.blocs)) expect(calculerScene(b.proprietes).trajectoire, b.id).toEqual(b.trajectoire);
  });

  it("garde le gain du lot G : les cartes ne rapetissent pas (zoom de la caméra ≥ zoom préféré sur chaque mot)", () => {
    const r = mettreEnSceneIV(entreeDe("C", ficheChatbot(), "youtube-shorts"));
    for (const b of toiles(r.ligne.blocs)) {
      const m = mesurerTrajectoire(b.trajectoire);
      expect(m.vitesseMax, b.id).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-3);
      expect(m.zoomMin, b.id).toBeGreaterThanOrEqual(1 - 1e-6);
    }
  });
});

describe("brique : deux mots trop proches pour un panoramique → coupe franche propre", () => {
  // Deux cartes côte à côte, trop loin l'une de l'autre pour un panoramique en 0,4 s.
  const toile: DispositionToile = {
    largeur: 2200,
    hauteur: 1920,
    boites: [
      { id: "a", x: 120, y: 800, largeur: 700, hauteur: 260, couche: 0, colonne: null, couleur: "noir", textes: [] },
      { id: "b", x: 1380, y: 800, largeur: 700, hauteur: 260, couche: 0, colonne: null, couleur: "noir", textes: [] },
    ],
    fleches: [],
    branches: [],
  } as unknown as DispositionToile;
  const mots = [
    { noeud: "a", t: 0.5 },
    { noeud: "b", t: 0.9 },
  ];

  it("sans coupe franche : la caméra arrive trop tard (rouge d'origine)", () => {
    const traj = trajectoireCamera(toile, mots, 3);
    const r = controlerCamera({ id: "s", toile, trajectoire: traj, mots });
    expect([...r.q15, ...r.coupes].join(" ")).toMatch(CADRAGE);
  });

  it("avec coupe franche : bloc entier sur son mot, rien de coupé, vitesse jamais dépassée", () => {
    const cadrage = { coupeFranche: true };
    const traj = trajectoireCamera(toile, mots, 3, cadrage);
    const r = controlerCamera({ id: "s", toile, trajectoire: traj, mots, cadrage });
    expect(r).toEqual({ q15: [], coupes: [] });
    expect(controlerCadrage(toile, traj, mots, cadrage, Array.from({ length: 151 }, (_, k) => k / 50))).toEqual([]);
    expect(mesurerTrajectoire(traj).vitesseMax).toBeLessThanOrEqual(BORNES_CAMERA.vitesseMax + 1e-3);
  });
});

describe("balayage : cartes A-F × scènes forcées × caméras → jamais « pas entier » ni « coupé par le bord »", () => {
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : chaque scène forcée sur chaque écran citant des nœuds, chaque caméra`, () => {
      const base = FICHES_SIMULEES[IMAGES[nom]];
      const carte = carteFixe(nom);
      const permises = [...scenesPermises(carte.types)].filter((s) => s !== "ensemble");
      const ids = new Set(carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => n.id));
      const echecs: string[] = [];
      for (const ecran of base.ecrans.filter((e) => e.refs.some((r) => ids.has(r)))) {
        for (const scene of permises) {
          const fiche = structuredClone(base);
          fiche.ecrans.find((e) => e.id === ecran.id)!.scene = scene as Scene;
          for (const camera of CAMERAS) {
            const refus = refusCadrage(entreeDe(nom, fiche, "youtube-shorts", { ...RECETTE_REFERENCE_IV, camera }));
            if (refus.length) echecs.push(`${ecran.id}→${scene} ${camera}: ${refus[0]}`);
          }
        }
      }
      expect(echecs).toEqual([]);
    });
  }
});
