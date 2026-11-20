// T-EXT-43 : formats, durée, accessibilité et « français seul » du tutoriel d'outil en V1 — règles chiffrées et contrôles SANS IA.
// Pur : aucun appel, aucun disque, aucune horloge ; ne lève jamais ; 0 €. Les messages vont à Williams : vouvoiement, sans sigle.
// La durée n'a AUCUNE constante propre : `DUREE_CIBLE_SEC` (chef de projet) est la seule source. Une durée hors cible est une
// remarque (jamais un refus, jamais une coupe) : le texte de Williams fait foi, c'est lui qui corrige le script.
import { contrasteWcag, PAIRES_TEXTE, SUR_CLAIR, SUR_SOMBRE } from "@/briques/charte/axion-2026";
import { SEUILS_CONTROLES } from "@/briques/plan-scenes/controles";
import type { HabillagePlan } from "@/briques/plan-scenes/schema";
import type { ResultatControleTutoriel } from "./equipe/controleur";
import { DUREE_CIBLE_SEC } from "./equipe/chef-de-projet";
import { formatDuRatio } from "./proprietes";
import { MOTS_PAR_SECONDE } from "./script";

export const RATIOS_V1 = ["4:5", "9:16", "1:1"] as const;
export const RATIO_PRINCIPAL = "4:5" as const;
/** Le moteur sait le rendre (`RATIOS_TUTORIEL` inchangé) ; l'ouvrir = une ligne dans `RATIOS_V1`, sur un mot de Williams. */
export const RATIOS_PLUS_TARD = ["16:9"] as const;
export const LANGUES_V1 = ["fr"] as const;
export const MUSIQUE_V1 = false;

/** Contraste minimal (WCAG 2.x AA) : texte courant, puis grand texte (titres). */
export const CONTRASTE_MIN_TEXTE = 4.5;
export const CONTRASTE_MIN_GRAND_TEXTE = 3;
/** Taille minimale du texte montré, en part de la hauteur de l'image (importée, jamais recopiée). */
export const PART_HAUTEUR_TEXTE_MIN = SEUILS_CONTROLES.TAILLE_MIN_PART_HAUTEUR;

export type CodeRemarqueDiffusion = "RATIO" | "DUREE_SCRIPT" | "DUREE_MESUREE" | "LANGUE" | "CONTRASTE" | "TAILLE_TEXTE";
export interface RemarqueDiffusion {
  code: CodeRemarqueDiffusion;
  message: string;
  /** Faux pour une durée : c'est une remarque à lire, jamais un refus. */
  bloquante: boolean;
}

const remarque = (code: CodeRemarqueDiffusion, message: string, bloquante = true): RemarqueDiffusion => ({ code, message, bloquante });
const virgule = (n: number, d = 1): string => (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",");

/** Hauteur du format (px) d'un ratio connu ; 0 sinon. */
function hauteurDuRatio(ratio: string): number {
  try {
    return formatDuRatio(ratio as "4:5").hauteur ?? 0;
  } catch {
    return 0;
  }
}

/** 41 px en 4:5 (1350 de haut). */
export function tailleTexteMinPx(ratio: string): number {
  return Math.ceil(PART_HAUTEUR_TEXTE_MIN * hauteurDuRatio(ratio));
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

export function controlerRatios(ratios: readonly string[]): RemarqueDiffusion[] {
  const liste = Array.isArray(ratios) ? ratios : [];
  const r: RemarqueDiffusion[] = [];
  if ((RATIOS_PLUS_TARD as readonly string[]).some((p) => liste.includes(p))) r.push(remarque("RATIO", "Le format 16:9 viendra plus tard : il n'est pas proposé en V1."));
  const inconnus = liste.filter((x) => !(RATIOS_V1 as readonly string[]).includes(x) && !(RATIOS_PLUS_TARD as readonly string[]).includes(x));
  if (inconnus.length) r.push(remarque("RATIO", `Ce format n'est pas proposé : ${inconnus.join(", ")}. Choisissez parmi ${RATIOS_V1.join(", ")}.`));
  if (!liste.includes(RATIO_PRINCIPAL)) r.push(remarque("RATIO", `Le format ${RATIO_PRINCIPAL} est le format principal : il doit faire partie de votre choix.`));
  return r;
}

/* ------------------------------------------------------------------ */
/* Durée (remarques seulement)                                         */
/* ------------------------------------------------------------------ */

const finiOuZero = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/** AVANT toute voix : durée estimée = mots / vitesse de voix + fin ; hors `DUREE_CIBLE_SEC` : une remarque, le texte n'est jamais raccourci. */
export function controlerLongueurScript(texte: string, dureeFinMs: number): RemarqueDiffusion[] {
  const mots = (typeof texte === "string" ? texte.trim() : "").split(/\s+/).filter(Boolean).length;
  const finSec = finiOuZero(dureeFinMs) / 1000;
  const totalMs = Math.round((mots / MOTS_PAR_SECONDE + finSec) * 1000);
  const [bas, haut] = DUREE_CIBLE_SEC;
  if (totalMs >= bas * 1000 && totalMs <= haut * 1000) return [];
  const a = Math.max(0, Math.round((bas - finSec) * MOTS_PAR_SECONDE));
  const b = Math.max(0, Math.round((haut - finSec) * MOTS_PAR_SECONDE));
  return [remarque("DUREE_SCRIPT", `Votre script ferait environ ${Math.round(totalMs / 1000)} s : visez ${bas} à ${haut} s (environ ${a} à ${b} mots).`, false)];
}

/** Même règle sur la voix MESURÉE (voix + fin choisie) : « À vérifier », jamais de coupe automatique. */
export function controlerDureeMesuree(dureeVoixMs: number, dureeFinMs: number): RemarqueDiffusion[] {
  const [bas, haut] = DUREE_CIBLE_SEC;
  if (!Number.isFinite(dureeVoixMs)) return [remarque("DUREE_MESUREE", "À vérifier : la durée de la voix n'est pas lisible.", false)];
  const totalMs = Math.round(dureeVoixMs + finiOuZero(dureeFinMs));
  if (totalMs >= bas * 1000 && totalMs <= haut * 1000) return [];
  return [remarque("DUREE_MESUREE", `À vérifier : la vidéo dure ${virgule(totalMs / 1000)} s, et la cible est de ${bas} à ${haut} s. Rien n'est coupé : corrigez le script si besoin.`, false)];
}

/* ------------------------------------------------------------------ */
/* Langue                                                              */
/* ------------------------------------------------------------------ */

export function controlerLangue(langue: string): RemarqueDiffusion[] {
  const l = typeof langue === "string" ? langue.trim().toLowerCase() : "";
  if (l === "fr" || l === "fr-fr") return [];
  return [remarque("LANGUE", "Le tutoriel est en français seulement pour le moment.")];
}

/* ------------------------------------------------------------------ */
/* Contraste                                                           */
/* ------------------------------------------------------------------ */

const seuilEgal = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

/** Paires de la charte sous le seuil du texte courant : réservées aux titres (listées ; la charte n'est jamais modifiée ici). */
export function pairesReserveesAuxTitres(): readonly (readonly [string, string])[] {
  return PAIRES_TEXTE.filter(([t, f]) => contrasteWcag(t, f) < CONTRASTE_MIN_TEXTE);
}

/** Chaque paire texte / fond de l'habillage est dans la charte et atteint son seuil : texte courant 4,5 ; accent (titres) 3. */
export function controlerContraste(habillage: HabillagePlan): RemarqueDiffusion[] {
  const sombre = habillage?.fond === "noir";
  const fond = sombre ? SUR_SOMBRE.fond : SUR_CLAIR.fond;
  const usages: { couleur: string; seuil: number }[] = [
    { couleur: sombre ? SUR_SOMBRE.texte : SUR_CLAIR.texte, seuil: CONTRASTE_MIN_TEXTE },
    { couleur: sombre ? SUR_SOMBRE.accent : SUR_CLAIR.accent, seuil: CONTRASTE_MIN_GRAND_TEXTE },
  ];
  const r: RemarqueDiffusion[] = [];
  for (const u of usages) {
    const dansCharte = PAIRES_TEXTE.some(([t, f]) => seuilEgal(t, u.couleur) && seuilEgal(f, fond));
    if (!dansCharte) r.push(remarque("CONTRASTE", "Une couleur de texte de l'habillage n'est pas dans la charte : choisissez un autre habillage."));
    else if (contrasteWcag(u.couleur, fond) < u.seuil) r.push(remarque("CONTRASTE", "Le texte de l'habillage se lit mal sur son fond : choisissez un autre habillage."));
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Taille du texte montré                                              */
/* ------------------------------------------------------------------ */

export function tailleEffectivePx(e: { taillePoliceCssPx: number; largeurScenarioPx: number; largeurFormatPx: number; zoom: number }): number {
  if (!(e.largeurScenarioPx > 0)) return 0;
  return e.taillePoliceCssPx * (e.largeurFormatPx / e.largeurScenarioPx) * e.zoom;
}

export interface CibleTexte {
  etapeId: string;
  taillePoliceCssPx: number;
  zoom: number;
}

/** Toute cible montrée pendant que la voix en parle doit atteindre `tailleTexteMinPx(ratio)`. */
export function controlerTailleTexte(cibles: readonly CibleTexte[], scenario: { largeur: number }, ratio: string): RemarqueDiffusion[] {
  const largeurFormatPx = (() => {
    try {
      return formatDuRatio(ratio as "4:5").largeur ?? 0;
    } catch {
      return 0;
    }
  })();
  const mini = tailleTexteMinPx(ratio);
  const r: RemarqueDiffusion[] = [];
  for (const c of Array.isArray(cibles) ? cibles : []) {
    const px = tailleEffectivePx({ taillePoliceCssPx: c.taillePoliceCssPx, largeurScenarioPx: scenario?.largeur ?? 0, largeurFormatPx, zoom: c.zoom });
    if (!(px >= mini)) r.push(remarque("TAILLE_TEXTE", `Étape ${c.etapeId} : le texte montré serait trop petit (${virgule(Number.isFinite(px) ? px : 0)} px) : zoomez davantage ou agrandissez-le dans la maquette.`));
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Ensemble                                                            */
/* ------------------------------------------------------------------ */

export interface EntreeDiffusion {
  ratios?: readonly string[];
  texteScript?: string;
  dureeFinMs?: number;
  dureeVoixMs?: number;
  langue?: string;
  habillage?: HabillagePlan;
  tailleTexte?: { cibles: readonly CibleTexte[]; scenario: { largeur: number }; ratio: string };
}

export interface VerdictDiffusion {
  /** Faux seulement si une remarque bloquante existe (les durées ne bloquent jamais). */
  ok: boolean;
  remarques: RemarqueDiffusion[];
}

/** Ne juge que ce qui est fourni ; ne lève jamais. */
export function controlerDiffusion(e: EntreeDiffusion): VerdictDiffusion {
  const remarques: RemarqueDiffusion[] = [];
  try {
    if (e.ratios) remarques.push(...controlerRatios(e.ratios));
    if (e.texteScript !== undefined) remarques.push(...controlerLongueurScript(e.texteScript, e.dureeFinMs ?? 0));
    if (e.dureeVoixMs !== undefined) remarques.push(...controlerDureeMesuree(e.dureeVoixMs, e.dureeFinMs ?? 0));
    if (e.langue !== undefined) remarques.push(...controlerLangue(e.langue));
    if (e.habillage) remarques.push(...controlerContraste(e.habillage));
    if (e.tailleTexte) remarques.push(...controlerTailleTexte(e.tailleTexte.cibles, e.tailleTexte.scenario, e.tailleTexte.ratio));
  } catch {
    remarques.push(remarque("RATIO", "Le contrôle des formats n'a pas pu être fait : rien n'est modifié."));
  }
  return { ok: !remarques.some((r) => r.bloquante), remarques };
}

/**
 * Pour le contrôleur sans IA (T-EXT-23) : deux contrôles, sans double remarque sur la durée MESURÉE (déjà jugée par `TUT-DUREE`).
 * `TUT-DIFFUSION` bloque avant l'écran de validation ; `TUT-DIFFUSION-DUREE` est une remarque seulement (jamais un refus).
 */
export function controlesDiffusion(e: EntreeDiffusion): ResultatControleTutoriel[] {
  const { remarques } = controlerDiffusion({ ...e, dureeVoixMs: undefined });
  const bloquantes = remarques.filter((r) => r.bloquante).map((r) => r.message);
  const durees = remarques.filter((r) => !r.bloquante).map((r) => r.message);
  return [
    { id: "TUT-DIFFUSION", libelle: "Formats, langue, contraste et taille du texte", bloquant: true, etat: bloquantes.length ? "echoue" : "reussi", details: bloquantes.length ? bloquantes : ["Formats, langue, contraste et taille du texte sont conformes."] },
    { id: "TUT-DIFFUSION-DUREE", libelle: "Longueur du script", bloquant: false, etat: durees.length ? "echoue" : "reussi", details: durees.length ? durees : ["Le script tient dans la durée visée."] },
  ];
}
