/**
 * 25/10 · En-tête de l'écran : la seconde ligne du texte ne devient l'ÉTIQUETTE (petit surtitre) que si elle PRÉCÈDE le
 * titre. Écran « *80%* — Réponse connue » puis « 20% — Limite atteinte » : l'ancien code mettait « 20% — Limite atteinte »
 * au-dessus de « 80% — Réponse connue » (deux pourcentages contradictoires). Et l'étiquette de repli (aucun groupe) n'est
 * jamais la marque : « Vue d'ensemble » sur l'écran d'ensemble, sinon rien. Aucun appel, pur.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

function entree(nom: Nom, fiche: FicheImage = FICHES_SIMULEES[IMAGES[nom]], carte: CarteImage = carteDe(nom)): EntreeMiseEnSceneIV {
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}

type Entete = { etiquette: string; titre: string };
/** Tous les en-têtes (étiquette + titre) des blocs, quelle que soit la sorte de bloc. */
function entetesDe(blocs: unknown): Entete[] {
  const trouves: Entete[] = [];
  const parcourir = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(parcourir);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.etiquette === "string" && typeof o.titre === "string") trouves.push({ etiquette: o.etiquette, titre: o.titre });
      Object.values(o).forEach(parcourir);
    }
  };
  parcourir(blocs);
  return trouves;
}

/** Fiche de l'image avec, pour UN écran à la fois, ces lignes à l'écran ; rend les en-têtes de chaque essai. */
function entetesAvecLignes(nom: Nom, lignes: string[]): Entete[] {
  const base = FICHES_SIMULEES[IMAGES[nom]];
  const tous: Entete[] = [];
  base.ecrans.forEach((e, i) => {
    if (!e.textesEcran?.length) return;
    const fiche: FicheImage = structuredClone(base);
    fiche.ecrans[i].textesEcran = lignes;
    tous.push(...entetesDe(mettreEnSceneIV(entree(nom, fiche)).ligne.blocs));
  });
  return tous;
}

const pourcentages = (t: string) => new Set([...t.matchAll(/(\d+)\s*%/g)].map((m) => m[1]));

describe("en-tête · la seconde ligne devient étiquette seulement si elle précède le titre", () => {
  it("« *80%* — Réponse connue » puis « 20% — Limite atteinte » (non relançable) : aucun en-tête n'a « 20% — Limite atteinte » en étiquette", () => {
    const entetes = entetesAvecLignes("C", ["*80%* — Réponse connue", "20% — Limite atteinte"]);
    expect(entetes.some((e) => /Réponse connue/.test(e.titre)), "le titre est bien montré").toBe(true);
    for (const e of entetes) expect(e.etiquette, JSON.stringify(e)).not.toMatch(/20\s*%\s*—\s*Limite atteinte/);
  });

  it("non-régression : « Réponse générée » écrite AVANT le titre « Envoyée en *4 sec* » reste l'étiquette", () => {
    const entetes = entetesAvecLignes("C", ["Réponse générée", "Envoyée en *4 sec*"]);
    expect(entetes.some((e) => e.etiquette === "Réponse générée" && /4 sec/.test(e.titre)), JSON.stringify(entetes)).toBe(true);
  });

  it("aucune paire étiquette / titre ne contient deux pourcentages différents, sur les 6 cartes", () => {
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      for (const e of entetesDe(mettreEnSceneIV(entree(nom)).ligne.blocs)) {
        vus++;
        expect(pourcentages(`${e.etiquette} ${e.titre}`).size, `${nom} · ${e.etiquette} | ${e.titre}`).toBeLessThanOrEqual(1);
      }
    }
    expect(vus).toBeGreaterThan(10);
  });
});

describe("en-tête · l'étiquette de repli n'est jamais la marque", () => {
  /** Carte C sans groupes : l'étiquette de chaque en-tête retombe sur le titre de l'image. */
  const sansGroupes = (titre: string): CarteImage => ({ ...carteDe("C"), titre, groupes: [], noeuds: carteDe("C").noeuds.map(({ groupe, ...n }) => (void groupe, n)) as CarteImage["noeuds"] });
  const net = (t: string) => t.toLowerCase().replace(/[^a-z]/g, "");

  it("témoin : titrée « Chatbot support client », l'étiquette de repli est le titre de l'image (comportement inchangé)", () => {
    const entetes = entetesDe(mettreEnSceneIV(entree("C", FICHES_SIMULEES[IMAGES.C], sansGroupes("Chatbot support client"))).ligne.blocs);
    expect(entetes.filter((e) => e.etiquette === "Chatbot support client").length).toBeGreaterThan(0);
  });

  for (const titre of ["Axion-IA", "AXION-IA", "axion-ia.com"]) {
    it(`titrée « ${titre} » : aucune étiquette ne redit la marque ; « Vue d'ensemble » ou rien`, () => {
      const entetes = entetesDe(mettreEnSceneIV(entree("C", FICHES_SIMULEES[IMAGES.C], sansGroupes(titre))).ligne.blocs);
      expect(entetes.length).toBeGreaterThan(0);
      for (const e of entetes) expect(net(e.etiquette), JSON.stringify(e)).not.toMatch(/^axionia(com)?$/);
      // Les étiquettes de repli (celles que le titre de l'image donnait) sont devenues vides ou « Vue d'ensemble » ; les écrites (« Situation type ») restent.
      const repli = entetes.filter((e) => e.etiquette === "" || e.etiquette === "Vue d'ensemble");
      expect(repli.length).toBeGreaterThan(0);
    });
  }

  it("la carte C (avec ses groupes), titrée « Axion-IA », garde ses étiquettes de groupe", () => {
    const groupes = (es: Entete[]) => es.filter((e) => e.etiquette === "Réponse connue" || e.etiquette === "Limite atteinte").length;
    const sans = entetesDe(mettreEnSceneIV(entree("C")).ligne.blocs);
    const avec = entetesDe(mettreEnSceneIV(entree("C", FICHES_SIMULEES[IMAGES.C], { ...carteDe("C"), titre: "Axion-IA" })).ligne.blocs);
    expect(groupes(sans)).toBeGreaterThan(0);
    expect(groupes(avec)).toBe(groupes(sans));
  });
});
