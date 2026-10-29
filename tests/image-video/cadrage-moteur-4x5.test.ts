/**
 * Cadrage du moteur en 4:5 : la toile et la caméra du moteur sont calculées pour 1350 px de haut (comme le rendu, qui
 * recalcule en 1350), plus pour 1920 : un bloc posé pour 1920 tombait sous le fondu bas (blocs coupés, écrans vides,
 * sous-titre masqué). Le 9:16 ne change pas. Aucun appel, aucune date, aucun hasard.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boiteALEcran, cameraA, emprise, etatDansCadre } from "@/briques/schema-motion/camera";
import { CADRES_IV, type CodeVariante, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { controlerCadrage, disposerEtCadrer, ECRAN_IV, type CadrageCamera, type ProprietesSceneIV, type SchemaEntree } from "@/briques/schema-motion";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { ficheAdapteeIV, mettreEnSceneAvecFiletIV } from "@/moteurs/montage-image-video/adaptation-scene";
import { cadrageToile, mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { cadrageDeToile, calculerScene, noeudCourant, opaciteCadre } from "../../studio-rendu/compositions/image-video/plan";
import { motsSimules } from "./mots-simules";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const CARTES = ["A", "B", "C", "D", "E", "F", "faux-16-noeuds"] as const;
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const H45 = CADRES_IV["4:5"].hauteur;
/** Bas de la zone où un bloc lisible tient (fondu bas du 4:5) : 1015 px. */
const BAS_LISIBLE = Math.round(CADRES_IV["4:5"].sousTitres.haut - 0.02 * H45 + 0.0001);

/** Scène comme dans `cadrage.test.ts`, à la hauteur donnée, avec ou sans en-tête. */
function sceneDe(carte: CarteImage, hauteur: number, avecEntete: boolean): ProprietesSceneIV {
  const mots = motsSimules(carte);
  const dureeSec = mots[mots.length - 1].t + 3;
  const decision = carte.noeuds.find((n) => n.role === "decision");
  const motDecision = decision ? mots.find((m) => m.noeud === decision.id) : undefined;
  return {
    largeur: 1080,
    hauteur,
    fps: 25,
    dureeSec,
    fond: "ivoire",
    marque: "axion-ia.com",
    schema: carte as unknown as SchemaEntree,
    mots,
    separations: motDecision ? [{ noeud: motDecision.noeud, t: motDecision.t + 1.5 }] : [],
    coches: [],
    ...(avecEntete ? { entetes: [{ debut: 0, fin: dureeSec, etiquette: "Situation type", titre: "Un *titre.*" }] } : {}),
  };
}

const sansDebord = (c: CadrageCamera) => ({ ...c, debord: undefined });

describe("4:5 : le cadrage de la toile du moteur est celui du rendu", () => {
  for (const nom of CARTES) {
    for (const avecEntete of [true, false]) {
      it(`carte ${nom} ${avecEntete ? "avec" : "sans"} en-tête : cadrageToile = cadrageDeToile, même variante, même trajectoire`, () => {
        const p = sceneDe(lire(nom), H45, avecEntete);
        const rendu = calculerScene(p);
        const moteur = disposerEtCadrer(p.schema, rendu.mots, p.dureeSec, (toile) => cadrageToile(p, toile));
        expect(moteur.variante).toBe(rendu.variante);
        expect(moteur.trajectoire).toEqual(rendu.trajectoire);
        const toile = rendu.toile;
        const a = cadrageToile(p, toile);
        const b = cadrageDeToile(toile, p);
        expect(sansDebord(a)).toEqual(sansDebord(b));
        for (const x of toile.boites) expect((a.debord as (id: string) => unknown)(x.id)).toEqual((b.debord as (id: string) => unknown)(x.id));
      });
    }
  }

  it("le cadre 4:5 est celui des fractions de 1920 (k = 1350 / 1920), pas celui du 9:16", () => {
    const p = sceneDe(lire("C"), H45, true);
    const c = cadrageToile(p);
    const k = H45 / ECRAN_IV.hauteur;
    expect(c.cadre!.bas).toBeCloseTo(c.bande!.bas, 9);
    expect(c.cadre!.bas).toBeLessThan(k);
    expect(cadrageToile({ ...p, hauteur: ECRAN_IV.hauteur }).cadre).toEqual({ haut: 0.275, bas: 1 });
  });
});

describe("4:5 : séquence CAM-B sans bloc lisible sous le fondu bas", () => {
  const entree = (nom: keyof typeof IMAGES): EntreeMiseEnSceneIV => {
    const carte = lire(nom);
    const fiche = FICHES_SIMULEES[IMAGES[nom]];
    const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
    return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
  };
  const recette = (camera: CodeVariante<"camera">): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, camera });

  // D n'a aucune séquence de toile ; F (16 mots en rafale à 12,9 s) est trop dense pour tenir : voir le filet ci-dessous.
  for (const nom of ["C", "E"] as const) {
    it(`carte ${nom} : toile calculée pour 1350 px et aucun bloc lisible sous ${BAS_LISIBLE} px à l'écran`, () => {
      const { ligne } = mettreEnSceneIV({ ...entree(nom), variete: recette("CAM-B"), format: "4:5" });
      const toiles = ligne.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile");
      expect(toiles.length).toBeGreaterThan(0);
      for (const b of toiles) {
        expect(b.proprietes.hauteur).toBe(H45);
        for (const mot of b.proprietes.mots) {
          const pose = cameraA(b.trajectoire, mot.t);
          const x = b.toile.boites.find((y) => y.id === mot.noeud)!;
          const e = boiteALEcran(x, pose);
          // L'écran de 1350 px montre le haut des 1920 de référence : le bloc parlé finit au-dessus de la ligne.
          expect(e.y + e.hauteur, `${nom} ${b.id} ${mot.noeud}`).toBeLessThanOrEqual(BAS_LISIBLE + 1e-6);
        }
      }
    });
  }
});

describe("4:5 : le vrai défaut de la carte F reste une remarque (zéro blocage)", () => {
  it("F en 4:5 : Q15 voit le défaut, mais le filet garde la vidéo (aucun refus)", () => {
    const carte = lire("F");
    const fiche = FICHES_SIMULEES[IMAGES.F];
    for (const fin of planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins) {
      const entree: EntreeMiseEnSceneIV = { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
      const issue = mettreEnSceneAvecFiletIV((adaptes) => mettreEnSceneIV({ ...entree, format: "4:5", fiche: ficheAdapteeIV(fiche, adaptes) }), [], `F ${fin.id}`, fiche);
      expect(issue.refus, fin.id).toEqual([]);
      // Le défaut n'est pas caché : la remarque Q15 est bien dans le rapport de la vidéo gardée.
      const q15 = issue.resultat.rapport.lignes.find((l) => l.code === "Q15");
      expect(q15?.ok, fin.id).toBe(false);
      expect(q15?.details.join(" "), fin.id).toContain("séquence b05");
    }
  });
});

describe("4:5 : le filet cache le bloc coupé de la carte F (sans refuser la vidéo)", () => {
  it("F en 4:5, séquence b05 : à chaque instant où Q15 voit un bloc coupé, le bloc est en fondu puis caché (sauf le bloc parlé, toujours plein)", () => {
    const carte = lire("F");
    const fiche = FICHES_SIMULEES[IMAGES.F];
    const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
    const entree: EntreeMiseEnSceneIV = { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
    const { ligne } = mettreEnSceneIV({ ...entree, format: "4:5" });
    const b05 = ligne.blocs.find((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile" && b.id === "b05")!;
    const scene = calculerScene(b05.proprietes);
    expect(scene.trajectoire).toEqual(b05.trajectoire);
    const defauts = controlerCadrage(scene.toile, scene.trajectoire, scene.mots, scene.cadrage);
    expect(defauts.length).toBeGreaterThan(0);
    let caches = 0;
    for (const d of defauts) {
      const o = opaciteCadre(scene, scene.trajectoire.images, d.id, d.t);
      if (noeudCourant(scene, d.t) === d.id) {
        // Le bloc parlé reste plein tant qu'il est le courant et que la caméra est posée autour de l'instant ; s'il part
        // (mot suivant, panoramique), il s'efface avec les autres.
        const fenetre = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map((r) => d.t + r);
        const pose = cameraA(scene.trajectoire, fenetre[0]);
        const pose1 = cameraA(scene.trajectoire, fenetre[6]);
        const pose2 = cameraA(scene.trajectoire, d.t);
        const tenue = fenetre.every((x) => noeudCourant(scene, x) === d.id) && [pose1, pose2].every((q) => q.cx === pose.cx && q.cy === pose.cy && q.zoom === pose.zoom);
        if (tenue) expect(o, `${d.id} ${d.t}`).toBe(1);
      } else {
        // Le bloc est tout à fait caché à chaque instant où il est coupé (le fondu vient avant la coupe et après elle).
        expect(o, `${d.id} ${d.t}`).toBe(0);
        const tard = d.t + 0.15;
        const b = scene.parId.get(d.id);
        const toujours = !!b && [0, 0.05, 0.1, 0.15].every((r) => etatDansCadre(emprise(b, scene.cadrage), cameraA(scene.trajectoire, tard - r), scene.cadrage) === "coupe");
        if (toujours && noeudCourant(scene, tard) !== d.id) {
          expect(opaciteCadre(scene, scene.trajectoire.images, d.id, tard), `${d.id} ${tard}`).toBe(0);
          caches++;
        }
      }
    }
    expect(caches).toBeGreaterThan(0);
  });
});

describe("9:16 : rien ne change", () => {
  it("cadrageToile sans hauteur ou à 1920 donne le cadrage de toujours (cadre 0,275 → 1, bande jusqu'au bas de la zone utile)", () => {
    for (const nom of CARTES) {
      const p = sceneDe(lire(nom), ECRAN_IV.hauteur, true);
      const sans = { ...p, hauteur: undefined };
      const a = cadrageToile(sans);
      expect(sansDebord(cadrageToile(p))).toEqual(sansDebord(a));
      expect(a.cadre).toEqual({ haut: 0.275, bas: 1 });
      const rendu = calculerScene(p);
      const moteur = disposerEtCadrer(p.schema, rendu.mots, p.dureeSec, (toile) => cadrageToile(p, toile));
      expect(moteur.trajectoire).toEqual(rendu.trajectoire);
    }
  });

  it("propriétés et trajectoires 9:16 des 6 cartes : empreinte figée (avant le correctif)", () => {
    const empreinte = createHash("sha256");
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      for (const camera of ["CAM-B", "CAM-C"] as const) {
        const { ligne } = mettreEnSceneIV({ ...entree9(nom), variete: { ...RECETTE_REFERENCE_IV, camera } });
        empreinte.update(JSON.stringify(ligne.blocs.map((b) => (b.sorte === "toile" ? [b.proprietes, b.trajectoire, b.cadrage] : null))));
      }
    }
    expect(empreinte.digest("hex")).toBe("d1639f0cddecd2b233a1133015d81bc9ed7a21d7bb45564133dcd8e0cdd24ae0");
  });

  function entree9(nom: keyof typeof IMAGES): EntreeMiseEnSceneIV {
    const carte = lire(nom);
    const fiche = FICHES_SIMULEES[IMAGES[nom]];
    const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
    return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
  }
});
