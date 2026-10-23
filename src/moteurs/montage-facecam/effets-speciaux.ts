/**
 * EFFETS SPÉCIAUX DU FACE CAMÉRA (lot F3) : des passages posés par le monteur (`objetMain`, `vitreBrisee`,
 * `transitionEcran`) aux demandes de rendu (opération `composition` existante, sans mode) et aux plans à poser dans
 * la composition finale. PUR : la chaîne (lot B/E) fournit la piste du visage et des mains, les coupes actives, le
 * recadrage et les clés R2 ; ce fichier dit quoi rendre, quoi poser et quoi dire à Will.
 *
 *   - objet dans la main : main ouverte trouvée assez longtemps → rendu ; sinon la vidéo sort SANS l'effet, le
 *     passage est marqué `sansDetourage` (même drapeau que les effets à détourage : « Effet non réussi —
 *     Réessayer » s'affiche déjà sur « Votre vidéo ») et `echecsEffet` compte les essais (le second essai assouplit
 *     le seuil) ;
 *   - transitions : calées sur un raccord tout proche (vrai « plan suivant »), point d'impact hors du visage, carte
 *     titre révélée rendue d'abord par la brique motion ; bruitage de verre ajouté si demandé.
 */
import {
  ENTREE_CARTE,
  ENTREE_PISTE,
  preparerObjetMain,
  preparerTransition,
  visagePx,
  type EchantillonMainDetaille,
  type CadreMontage,
  type CaracterePrise,
  type CarteEnvironnement,
  type Lumiere,
  type ParametresRenduEffet,
} from "@/briques/effets-speciaux";
import type { CarteModele } from "@/briques/motion";
import type { PisteVisage } from "@/briques/realisation/piste";
import type { PassageFacecam } from "@/domaine/facecam";
import { LIBELLE_EFFET_RATE, type DecisionEffet } from "./monteur/detourage";
import { passageEffetSpecial } from "./monteur/effets";
import type { PassageMonteur } from "./monteur/appliquer";
import { monteeVersPrise, priseVersMontee, type Intervalle } from "./monteur/temps";

/** Passage d'effet spécial : le passage du monteur, plus le nombre d'essais ratés (« Réessayer »). */
export type PassageEffet = PassageMonteur & { echecsEffet?: number };

export interface EntreeEffetsFacecam {
  passages: PassageFacecam[];
  /** Piste `/visages` (visage et mains). */
  piste?: PisteVisage;
  /** Coupes actives (temps de la prise). */
  coupes: Intervalle[];
  /** Fenêtre de la source montrée dans la piste montée (recadrage 9:16) : constante, ou celle du plan à un instant monté. */
  cadre: CadreMontage;
  largeur: number;
  hauteur: number;
  /** Raccords de la vidéo montée (s) : les transitions s'y calent. */
  raccordsSec?: number[];
  /** Clé R2 de la piste montée (entrée `piste` de chaque demande). */
  pisteMonteeCle: string;
  /** Préfixe des clés R2 des effets rendus (ex. `studio/prod/videos/<id>/<version>/effets`). */
  prefixe: string;
  lumiere?: Lumiere;
  /** Lot I2 (raccordé à l'intégration Z) : reflets et caractère (flou, grain) de la prise, pour l'objet posé. */
  environnement?: CarteEnvironnement;
  prise?: CaracterePrise;
}

export interface RenduEffetFacecam {
  passageId: string;
  /** Clé R2 où l'opération `composition` (sans mode) dépose le MP4 de l'effet. */
  cle: string;
  parametres: ParametresRenduEffet;
  /** Entrées de la demande : la piste montée et, pour une vitre qui révèle une carte, la carte rendue avant. */
  entrees: Record<string, string>;
  /** Intervalle monté couvert par l'effet (le MP4 s'y pose comme un plan, coupe franche autour). */
  debutSec: number;
  finSec: number;
  /** Carte titre à rendre AVANT l'effet (brique motion, plein écran), déposée à `entrees.carte`. */
  carteARendre?: { cle: string; carte: CarteModele; dureeSec: number };
}

export interface BruitageEffet {
  passageId: string;
  nom: "verre";
  monteeSec: number;
}

export interface EffetsFacecam {
  rendus: RenduEffetFacecam[];
  /** Effets ratés ou livrés, pour « Votre vidéo » (« Effet non réussi — Réessayer »). */
  decisions: DecisionEffet[];
  /** Passages mis à jour (drapeaux d'échec) ; les autres passages sont rendus tels quels. */
  passages: PassageFacecam[];
  bruitages: BruitageEffet[];
}

/** Durée de la carte révélée par une vitre (s). */
const DUREE_CARTE_REVELEE_SEC = 3;

export function preparerEffetsFacecam(e: EntreeEffetsFacecam): EffetsFacecam {
  const rendus: RenduEffetFacecam[] = [];
  const decisions: DecisionEffet[] = [];
  const bruitages: BruitageEffet[] = [];
  const versMontee = (s: number) => priseVersMontee(s, e.coupes);
  const versPrise = (s: number) => monteeVersPrise(s, e.coupes);
  const passages = e.passages.map((brut): PassageFacecam => {
    const op = passageEffetSpecial(brut);
    if (!op) return brut;
    const p = brut as PassageEffet;
    // « Réessayer » remet `sansDetourage` à faux : un passage déjà raté une fois est réanalysé avec le seuil assoupli.
    if (p.sansDetourage) {
      decisions.push({ passageId: p.id, livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer" });
      return p;
    }
    const cle = `${e.prefixe}/${p.id}.mp4`;
    if (op.type === "objetMain") {
      const r = preparerObjetMain({
        objet: op.objet,
        debutPriseSec: p.ancre.debutPriseSec,
        finPriseSec: p.ancre.finPriseSec,
        mains: e.piste?.mains as EchantillonMainDetaille[] | undefined,
        visage: e.piste?.echantillons,
        priseVersMontee: versMontee,
        monteeVersPrise: versPrise,
        cadre: e.cadre,
        largeur: e.largeur,
        hauteur: e.hauteur,
        lumiere: e.lumiere,
        ...(e.environnement ? { environnement: e.environnement } : {}),
        ...(e.prise ? { prise: e.prise } : {}),
        luminanceVisage: e.piste?.luminanceVisage,
        reessai: (p.echecsEffet ?? 0) > 0,
        graine: graineDe(p.id),
      });
      if (!r.ok) {
        decisions.push({ passageId: p.id, livre: "sans-detourage", message: LIBELLE_EFFET_RATE, geste: "Réessayer", ...(r.analyse.raison === "main-retournee" && r.analyse.conseil ? { conseil: r.analyse.conseil } : {}) });
        return { ...p, sansDetourage: true, echecsEffet: (p.echecsEffet ?? 0) + 1 } as PassageEffet;
      }
      rendus.push({ passageId: p.id, cle, parametres: r.parametres, entrees: { [ENTREE_PISTE]: e.pisteMonteeCle }, debutSec: r.debutSec, finSec: r.finSec });
      decisions.push({ passageId: p.id, livre: "avec-effet" });
      return p;
    }
    const style = op.type === "vitreBrisee" ? "vitre-brisee" : op.style;
    // Visage du plan RÉVÉLÉ (juste après le mot) : les éclats l'évitent, le point d'impact reste hors de lui.
    const apresSec = p.debutSec + 0.1;
    const visage = visagePx(e.piste?.echantillons, versPrise(apresSec), e.cadre, e.largeur, e.hauteur, apresSec);
    const carte = op.type === "vitreBrisee" && op.revele === "carte" && !!op.texteCarte;
    const r = preparerTransition({ style, auSec: p.debutSec, dureeSec: op.dureeSec, raccordsSec: e.raccordsSec, largeur: e.largeur, hauteur: e.hauteur, visage, carte, graine: graineDe(p.id) });
    const entrees: Record<string, string> = { [ENTREE_PISTE]: e.pisteMonteeCle };
    let carteARendre: RenduEffetFacecam["carteARendre"];
    if (carte && op.type === "vitreBrisee") {
      const cleCarte = `${e.prefixe}/${p.id}-carte.mp4`;
      entrees[ENTREE_CARTE] = cleCarte;
      carteARendre = { cle: cleCarte, dureeSec: DUREE_CARTE_REVELEE_SEC, carte: { modele: "titre", donnees: { variante: "titre", titre: op.texteCarte! } } };
    }
    rendus.push({ passageId: p.id, cle, parametres: r.parametres, entrees, debutSec: r.debutSec, finSec: r.finSec, ...(carteARendre ? { carteARendre } : {}) });
    if (op.type === "vitreBrisee" && op.bruitage) bruitages.push({ passageId: p.id, nom: "verre", monteeSec: r.debutSec });
    decisions.push({ passageId: p.id, livre: "avec-effet" });
    return p;
  });
  return { rendus, decisions, passages, bruitages };
}

/**
 * Les effets rendus, au format du supplément `cartesPleinEcran` de la composition commune (lot C) : chaque MP4 se
 * pose comme un plan d'illustration vidéo, coupe franche autour, le son de la piste continue dessous.
 * ATTENTION intégration : `lookBroll` pose la LUT du Look sur TOUS les plans d'illustration ; or la piste montée a
 * déjà le Look (passe image du lot B) — exclure ces plages du Look (voir JOURNAL-F3).
 */
export function cartesPleinEcranEffets(rendus: RenduEffetFacecam[]): { debutSec: number; finSec: number; carteCle: string }[] {
  return rendus.map((r) => ({ debutSec: r.debutSec, finSec: r.finSec, carteCle: r.cle }));
}

/** Graine stable d'après l'identifiant du passage (même effet à chaque rendu de la même version). */
function graineDe(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
}
