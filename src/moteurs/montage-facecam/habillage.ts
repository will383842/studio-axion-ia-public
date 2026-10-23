/**
 * HABILLAGE DU FACE CAMÉRA (lot C) : de la piste montée du lot B (10 bits, PRÉ-CADRÉE, son PCM) aux paramètres de la
 * composition finale (brique commune « composition », opération `composition` existante) et aux cartes de motion
 * design à rendre d'abord (opération `composition` sans mode). PUR : la chaîne (lot B) et le monteur (lot D)
 * fournissent la piste, les mots montés, le visage et les cartes posées ; ce fichier dit quoi rendre et comment.
 *
 *   - sous-titres : groupes de 1 à 4 mots coupés par le sens, calés sur une coupe à moins de 0,2 s, ligne à 55-72 %
 *     (juste sous la bouche) ; pendant un écran partagé, dans la moitié basse sous la bouche (finitions du 10/10 : à la
 *     jonction, elle masquait la dernière ligne de la carte) ; un groupe qui répète un titre affiché n'est pas dessiné ;
 *   - une liste qui ne tient pas dans la moitié haute (même resserrée) passe en plein écran ;
 *   - cartes : celles du monteur (modèle ou sur mesure contrôlée, sinon repli sur le modèle fixe) ET les cartes
 *     automatiques d'après les mots dits (`planifierCartesAuto`, 10/10 : une toutes les 12-20 s, moitié haute), gestes
 *     de Will appliqués (retirée, déplacée, texte changé depuis la fiche ; retirée depuis le chat, vérif V1) ; une carte
 *     automatique s'efface devant celle du monteur (avant : une seule carte demandée au chat effaçait toutes les cartes
 *     automatiques — constat en production du 10/10) ;
 *   - écran partagé : la personne en bas, yeux à 37,5 % de la demi-hauteur (cadrage par calque) ;
 *   - B-roll : LUT du Look Will (même cible) ; encodage : une seule compression 8 bits (`source10bits`).
 */
import type { EntreeComposition, RecetteComposition } from "@/briques/composition";
import { TAILLE_SOUS_TITRES_REFERENCE_PX } from "@/briques/composition";
import { dispositionQuiTient, GROUPEMENT_FACECAM, ligneSousTitresEcranPartage, positionSousTitresFacecam, SOUS_TITRES_FACECAM, sourceYMoitieBasse, textesAffichesDesCartes, type PhraseHorodatee } from "@/briques/habillage-facecam";
import { calerCarteTous, miseEnPage, preparerCarteTous, type CarteMotionTous, type CodeSurMesure, type ParametresRenduCarte, type StyleMotion } from "@/briques/motion";
import { grouperMots, recalerSurCoupes } from "@/briques/sous-titres/groupement";
import { recollerElisionsHorodatees } from "@/briques/sous-titres/recollage";
import { cartesAutoDeLaVideo, texteCarteMotion, type AjustementCarteAutoMonte, type CarteAutoVue } from "./cartes-video";
import { geometrieCote, geometrieVignette, type CoteWill, type ModeMiseEnPage } from "@/briques/habillage-facecam/mise-en-page";
import type { CarteAutoFacecam } from "@/domaine/facecam";
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";

/** Ce que le format face caméra dit à la brique « composition » (piste opaque, pré-cadrée, aucun décor ajouté). */
export const RECETTE_COMPOSITION_FACECAM: RecetteComposition = {
  id: "facecam",
  angles: { principal: "face" },
  decorRepli: { teinte: "#16120F", directionLumiere: "face", flouPx: 0, clair: false },
  nomDecorRepli: "Sombre chaud",
  // Fin : coupe sèche qui boucle (6 à 8 images après le dernier mot, fondu audio de 50 ms fait au montage).
  reductionLarge: { "9:16": 1, "4:5": 1, "1:1": 1 },
  centreSousTitres: { "9:16": SOUS_TITRES_FACECAM.positionParDefautPct, "4:5": SOUS_TITRES_FACECAM.positionParDefautPct, "1:1": SOUS_TITRES_FACECAM.positionParDefautPct },
  tailleSousTitresPx: TAILLE_SOUS_TITRES_REFERENCE_PX,
  incrustations: { hautPct: 50, montantTaillePx: 96, objetLargeurPct: 33, dureeMinSec: 0.4 },
  // Le Look est déjà dans la piste (passe image du lot B) : grain très léger (tramage), aucune vignette ajoutée.
  realisme: { grainPct: 2, grainTaillePx: 1.5, vignettePct: 0 },
  lutIntensiteParDefaut: 100,
};

/** Une carte posée par le monteur (lot D) ou choisie d'office. */
export interface CartePosee {
  id: string;
  debutSec: number;
  finSec: number;
  disposition: "plein-ecran" | "moitie-haute";
  /** L'un des 13 modèles de la brique motion (mission L). */
  carte?: CarteMotionTous;
  code?: CodeSurMesure;
  /** Modèle fixe de repli d'une carte sur mesure refusée par les garde-fous. */
  repli?: CarteMotionTous;
  /** Lot C2 : style de la carte (absent = Sobre, le style validé). */
  style?: StyleMotion;
  /** Lot G : Will sur un côté (la carte de l'autre) ou en vignette (la carte plein écran derrière). */
  miseEnPage?: { mode: ModeMiseEnPage; cote: CoteWill };
}

export interface EntreeHabillageFacecam {
  /** Clé R2 de la piste montée (10 bits, pré-cadrée 1080 × 1920, son PCM). */
  pisteMonteeCle: string;
  dureeSec: number;
  /** Mots de la vidéo montée (temps du montage). */
  mots: MotHorodate[];
  /** Raccords du montage (s) : les groupes de sous-titres s'y calent. */
  coupesSec?: number[];
  /** Visage médian dans la piste montée (% de la hauteur) : yeux et bouche. */
  visage?: { yeuxPct: number; bouchePct: number };
  /** Cartes posées par le monteur (les cartes automatiques s'y ajoutent, sans les chevaucher). */
  cartes?: CartePosee[];
  /** Vérif V1 : cartes automatiques retirées depuis le chat (identifiants `auto-…`, stables : tirés du contenu). */
  cartesAutoRetirees?: string[];
  /** 10/10 : gestes de Will sur les cartes automatiques depuis la fiche, en temps du montage (résolus par la chaîne). */
  cartesAuto?: AjustementCarteAutoMonte[];
  /** V6 : passages déjà pris (effets spéciaux posés en plein écran) : aucune carte automatique dessus. */
  occupes?: { debutSec: number; finSec: number }[];
  /** Plafond atteint ou monteur indisponible : modèles fixes seulement (aucune carte sur mesure). */
  versionSimple?: boolean;
  /** LUT du Look Will (pour les B-roll). */
  lookLutCle?: string;
  /** Préfixe des clés R2 des cartes rendues (ex. `studio/prod/videos/<id>/<version>/cartes`). */
  prefixeCartes: string;
}

export interface RenduCarte {
  id: string;
  /** Clé R2 où l'opération `composition` (sans mode) dépose le MP4 de la carte. */
  cle: string;
  parametres: ParametresRenduCarte;
  /** La carte sur mesure a été refusée : le modèle fixe la remplace (« Effet non réussi » n'est pas montré). */
  repli: boolean;
  erreurs: string[];
}

export interface HabillageFacecam {
  /** Cartes à rendre AVANT la composition finale (une demande `composition` sans mode chacune). */
  cartes: RenduCarte[];
  /** Vérif V1 : cartes automatiques posées (rangées dans la version : le monteur du chat les voit et peut les retirer). */
  cartesAuto: CarteAutoFacecam[];
  /** Ce qui s'ajoute à l'entrée de la composition (le reste : `parametresComposition` de la brique). */
  entree: EntreeComposition;
  segments: SegmentSousTitres[];
  /** 10/10 : les cartes automatiques de la vidéo et leur sort (posée, retirée par Will, masquée par une carte). */
  cartesAutoVues: CarteAutoVue[];
}

/**
 * Cartes à poser : celles du monteur, puis les cartes automatiques (gestes de Will appliqués) qui ne les chevauchent
 * pas, par ordre d'apparition. Mêmes cartes, mêmes instants dans tous les formats.
 */
export function cartesAPoser(e: Pick<EntreeHabillageFacecam, "mots" | "dureeSec" | "cartes" | "cartesAuto" | "cartesAutoRetirees">): { posees: CartePosee[]; cartesAuto: CarteAutoVue[] } {
  const r = cartesPosees(e);
  return { posees: r.posees, cartesAuto: r.vues };
}

/** Phrases horodatées depuis les mots (ponctuation forte, ou blanc de plus de 0,6 s). */
export function phrasesDesMots(mots: MotHorodate[]): PhraseHorodatee[] {
  const phrases: PhraseHorodatee[] = [];
  let courante: MotHorodate[] = [];
  mots.forEach((m, i) => {
    courante.push(m);
    const suivant = mots[i + 1];
    if (!suivant || /[.!?…]$/.test(m.mot) || suivant.debutSec - m.finSec > 0.6) {
      phrases.push({ texte: courante.map((x) => x.mot).join(" "), debutSec: courante[0].debutSec, finSec: courante[courante.length - 1].finSec });
      courante = [];
    }
  });
  return phrases;
}

/** Plan de la composition : la piste montée, un seul plan plein cadre (les tailles de plan sont déjà dans la piste). */
export function planUnique(dureeSec: number): PlanProduit[] {
  return [{ ordre: 1, debutSec: 0, finSec: dureeSec, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "face" } as PlanProduit];
}

/** Vérif V1 : textes et identifiant stable d'une carte automatique (définis avec les cartes de la vidéo). */
export { idCarteAuto, texteCarteMotion } from "./cartes-video";

const motNu = (m: string) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Vérif V1 : mots corrigés depuis le fil (« écris Certifexemple et pas Calliopi ») appliqués aux mots montés, partout où
 * l'ancien est dit (suite de mots comprise). La ponctuation du dernier mot est gardée ; les temps ne bougent pas.
 * Rend aussi le nombre de remplacements.
 */
export function corrigerMots(mots: MotHorodate[], corrections: { ancien: string; nouveau: string }[] = []): { mots: MotHorodate[]; remplaces: number } {
  let sortie = [...mots];
  let remplaces = 0;
  for (const { ancien, nouveau } of corrections) {
    const cherche = ancien.split(/\s+/).map(motNu).filter(Boolean);
    if (!cherche.length || !nouveau.trim()) continue;
    const suite: MotHorodate[] = [];
    for (let i = 0; i < sortie.length; ) {
      if (i + cherche.length <= sortie.length && cherche.every((c, k) => motNu(sortie[i + k].mot) === c)) {
        const dernier = sortie[i + cherche.length - 1];
        const fin = dernier.mot.match(/[.,;:!?…]+$/)?.[0] ?? "";
        suite.push({ ...sortie[i], mot: `${nouveau.trim()}${fin}`, finSec: dernier.finSec });
        remplaces++;
        i += cherche.length;
      } else suite.push(sortie[i++]);
    }
    sortie = suite;
  }
  return { mots: sortie, remplaces };
}

/**
 * Cartes posées : celles du monteur, puis les cartes automatiques qui ne les croisent pas, gestes de Will appliqués
 * (retirées depuis le chat — vérif V1 — ou depuis la fiche ; déplacées ; texte changé) et hors des passages occupés
 * (effets spéciaux, V6 P0 n° 9), par ordre d'apparition. Rend
 * aussi les cartes automatiques posées (`auto`, livrées au monteur du chat) et la vue de chacune (`vues`, fiche
 * « Cartes et effets »). Mêmes cartes, mêmes instants dans tous les formats (`declinaisons.ts`).
 */
export function cartesPosees(e: Pick<EntreeHabillageFacecam, "cartes" | "cartesAutoRetirees" | "cartesAuto" | "occupes" | "mots" | "dureeSec">): { posees: CartePosee[]; auto: CarteAutoFacecam[]; vues: CarteAutoVue[] } {
  const monteur = e.cartes ?? [];
  // V6 P0 n° 9 : ni sur une carte du monteur, ni sur un passage occupé (effet spécial en plein écran).
  const r = cartesAutoDeLaVideo(e.mots, e.dureeSec, e.cartesAuto ?? [], [...monteur, ...(e.occupes ?? [])], e.cartesAutoRetirees ?? []);
  const posees: CartePosee[] = [...monteur, ...r.posees].sort((a, b) => a.debutSec - b.debutSec);
  const auto: CarteAutoFacecam[] = r.vues.filter((v) => v.etat === "posee").map((v) => ({ id: v.idStable, debutSec: v.debutSec, finSec: v.finSec, modele: v.modele, texte: texteCarteMotion(v.carte) }));
  return { posees, auto, vues: r.vues };
}

/** Écart minimal entre une carte du monteur (ou un effet) et une carte automatique posée à côté (s). */
export { ECART_CARTES_OCCUPEES_SEC as ECART_CARTES_AUTO_SEC } from "./cartes-video";

/**
 * V6 P0 n° 9 : cartes du monteur PUIS cartes automatiques dans les trous (avant : une seule carte du monteur effaçait
 * toutes les automatiques). Une automatique qui toucherait une carte du monteur ou un passage occupé (effet spécial)
 * à moins de `ECART_CARTES_AUTO_SEC` est écartée ; celles du monteur ne bougent jamais. (Même règle que `cartesPosees`.)
 */
export function cartesAvecAutomatiques(monteur: CartePosee[] | undefined, mots: MotHorodate[], dureeSec: number, occupes: { debutSec: number; finSec: number }[] = []): CartePosee[] {
  return cartesPosees({ cartes: monteur, mots, dureeSec, occupes }).posees;
}

/** Tout l'habillage d'une vidéo face caméra en 9:16. */
export function habillageFacecam(e: EntreeHabillageFacecam): HabillageFacecam {
  const ratio = "9:16" as const;
  const hauteur = 1920;
  const demi = 960;
  // 1. Cartes : celles du monteur et les cartes automatiques d'après les mots dits (calées au mot dit, moitié haute)
  //    là où le monteur n'a rien posé ; une liste qui ne tient pas dans la moitié haute passe en plein écran.
  const { posees: brutes, auto: cartesAuto, vues: cartesAutoVues } = cartesPosees(e);
  const posees: CartePosee[] = brutes.map((c) => (c.miseEnPage ? c : { ...c, disposition: dispositionQuiTient(c.carte, c.disposition, ratio) }));
  const cartes: RenduCarte[] = [];
  const ecransPartages: NonNullable<EntreeComposition["ecransPartages"]> = [];
  const cartesPleinEcran: NonNullable<EntreeComposition["cartesPleinEcran"]> = [];
  const misesEnPage: NonNullable<EntreeComposition["misesEnPage"]> = [];
  const affichees: Parameters<typeof textesAffichesDesCartes>[0] = [];
  const sourceY = sourceYMoitieBasse({ yeuxY: ((e.visage?.yeuxPct ?? 33) / 100) * hauteur }, hauteur, demi);
  // Pendant un écran partagé : ligne des sous-titres dans la moitié basse, sous la bouche (jamais sur la carte).
  const ligne = { centrePct: ligneSousTitresEcranPartage(e.visage, demi, hauteur) };
  for (const c of posees) {
    const duree = c.finSec - c.debutSec;
    // Lot G : côté → carte rendue à la largeur de sa colonne ; vignette → carte plein écran.
    const cote = c.miseEnPage?.mode === "cote" ? geometrieCote(1080, c.miseEnPage.cote, e.visage ? { yeuxPct: e.visage.yeuxPct / 100 } : {}) : undefined;
    const base = miseEnPage(ratio, c.miseEnPage ? "plein-ecran" : c.disposition, duree);
    const mp = { ...base, ...(cote ? { largeur: cote.largeurCarte } : {}), ...(c.style ? { style: c.style } : {}) };
    const carte = c.carte ? calerCarteTous(c.carte, e.mots, c.debutSec, mp.images / mp.fps) : undefined;
    const r = preparerCarteTous({ carte, code: e.versionSimple ? undefined : c.code, repli: c.repli ? calerCarteTous(c.repli, e.mots, c.debutSec, mp.images / mp.fps) : undefined }, mp);
    if (!r.parametres) continue;
    const cle = `${e.prefixeCartes}/${c.id}.mp4`;
    const fin = +(c.debutSec + mp.images / mp.fps).toFixed(3);
    cartes.push({ id: c.id, cle, parametres: r.parametres, repli: r.repli, erreurs: r.erreurs });
    if (!c.miseEnPage) affichees.push({ debutSec: c.debutSec, finSec: Math.min(e.dureeSec, fin), disposition: c.disposition, carte });
    if (c.miseEnPage) {
      const geometrie = cote ? { cote } : { vignette: geometrieVignette(1080, hauteur, c.miseEnPage.cote, e.visage ? { yeuxPct: e.visage.yeuxPct / 100 } : {}) };
      misesEnPage.push({ debutSec: c.debutSec, finSec: Math.min(e.dureeSec, fin), carteCle: cle, mode: c.miseEnPage.mode, cote: c.miseEnPage.cote, geometrie });
    } else if (c.disposition === "moitie-haute") ecransPartages.push({ debutSec: c.debutSec, finSec: Math.min(e.dureeSec, fin), carteCle: cle, sourceY, ligne });
    else cartesPleinEcran.push({ debutSec: c.debutSec, finSec: Math.min(e.dureeSec, fin), carteCle: cle });
  }
  // 2. Sous-titres : 1 à 4 mots coupés par le sens, calés sur les raccords à moins de 0,2 s.
  const groupes = grouperMots(recollerElisionsHorodatees(e.mots), GROUPEMENT_FACECAM);
  const segments = e.coupesSec?.length ? recalerSurCoupes(groupes, e.coupesSec, { fenetreSec: SOUS_TITRES_FACECAM.fenetreCoupeSec }) : groupes;
  // Un titre affiché (appel à l'action, carte plein écran) n'est pas répété en sous-titre pendant la carte.
  const textesAffiches = textesAffichesDesCartes(affichees);
  // 3. Entrée de la composition : piste pré-cadrée 10 bits, cartes, ligne des sous-titres, Look sur les B-roll.
  const entree: EntreeComposition = {
    ratio,
    plans: planUnique(e.dureeSec),
    segments,
    dureeSec: e.dureeSec,
    mots: e.mots,
    audioCle: e.pisteMonteeCle,
    pistesDouble: { face: e.pisteMonteeCle },
    pistesDepuisLook: true,
    sourcePreCadree: true,
    source10bits: true,
    positionSousTitresPct: positionSousTitresFacecam(e.visage?.bouchePct),
    ...(ecransPartages.length ? { ecransPartages } : {}),
    ...(cartesPleinEcran.length ? { cartesPleinEcran } : {}),
    ...(misesEnPage.length ? { misesEnPage } : {}),
    ...(e.lookLutCle ? { lookBroll: { lutCle: e.lookLutCle } } : {}),
    ...(textesAffiches.length ? { textesAffiches } : {}),
  };
  return { cartes, entree, segments, cartesAuto, cartesAutoVues };
}
