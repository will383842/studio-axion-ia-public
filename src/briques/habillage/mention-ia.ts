/**
 * X1-14 — PASTILLE « RÉALISÉ AVEC L'IA ». PIÈCE PURE que rien n'appelle (non inscrite, éteinte).
 * DÉCISION DE WILLIAMS (16/11) : ÉTEINTE par défaut ; seul Williams l'allume, dans l'interface, avec double validation.
 * - AUCUN interrupteur n'est créé ici et aucun code n'écrit un réglage : `autorise` est un argument reçu, jamais lu ni écrit.
 *   Seul le booléen `true` strict allume ; absent, illisible, « true » en texte, 1, etc. = aucune pastille.
 * - La pastille n'existe que si le double OU la voix sont synthétiques (booléens `true` stricts dans les entrées de la vidéo).
 * - Texte = constante unique. Distinct de C10-14 (`etiquetage-ia.ts`, non touché).
 * - Placement : sous la zone du visage (jamais devant), dans la zone sûre du réseau, hors des boutons, au-dessus de la bande des sous-titres.
 * PUR, imports relatifs seulement (lu par le rendu) : même entrée = même sortie, jamais d'exception.
 */
import { seChevauchent, ZONE_VISAGE } from "../plan-scenes/zones";

/** Texte unique de la pastille (à faire confirmer par Williams avant tout allumage). */
export const TEXTE_PASTILLE_IA = "Réalisé avec l'IA";
/** Durée d'affichage, en millisecondes. */
export const DUREE_PASTILLE_IA_MS = 2000;
/** Taille du texte, en part de la hauteur du cadre (plancher de lisibilité de la charte). */
export const TAILLE_TEXTE_PASTILLE_IA = 0.03;

/** Marges protégées du réseau visé, en % du cadre (forme de `ZoneProtegee`, copiée). */
export interface MargesBoutonsIA {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

export interface EntreesMentionIA {
  doubleSynthetique?: unknown;
  voixSynthetique?: unknown;
}

export interface PastilleIA {
  texte: string;
  /** Boîte en % du cadre. */
  boite: { x: number; y: number; largeur: number; hauteur: number };
  debutMs: number;
  dureeMs: number;
}

/** Vrai si le double ou la voix sont synthétiques (booléen `true` strict). */
export function contenuSynthetique(e: EntreesMentionIA | null | undefined): boolean {
  return e?.doubleSynthetique === true || e?.voixSynthetique === true;
}

const marge = (n: number): number => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

const ECART_SOUS_VISAGE = 1;
const HAUTEUR_PASTILLE = 4.5;
const LARGEUR_PASTILLE = 54;

/**
 * Pastille à afficher, ou `null`. `autorise` = valeur du futur réglage, passée telle quelle par l'appelant : seul `true` allume.
 */
export function pastilleIA(p: { entrees: EntreesMentionIA | null | undefined; autorise: unknown; zone: MargesBoutonsIA }): PastilleIA | null {
  try {
    if (p.autorise !== true) return null;
    if (!contenuSynthetique(p.entrees)) return null;
    const gauche = marge(p.zone.gauche);
    const droite = marge(p.zone.droite);
    const x = gauche;
    const largeur = Math.min(LARGEUR_PASTILLE, Math.max(0, 100 - gauche - droite));
    const y = ZONE_VISAGE.y + ZONE_VISAGE.hauteur + ECART_SOUS_VISAGE;
    const boite = { x, y, largeur, hauteur: HAUTEUR_PASTILLE };
    if (largeur <= 0 || y + HAUTEUR_PASTILLE > 100 - marge(p.zone.bas)) return null;
    if (seChevauchent(boite, ZONE_VISAGE)) return null;
    return { texte: TEXTE_PASTILLE_IA, boite, debutMs: 0, dureeMs: DUREE_PASTILLE_IA_MS };
  } catch {
    return null;
  }
}

/** Visible pendant `dureeMs` à partir de `debutMs` (images → millisecondes à `fps`). */
export function pastilleVisible(pastille: PastilleIA, image: number, fps: number): boolean {
  if (!Number.isFinite(image) || !Number.isFinite(fps) || fps <= 0) return false;
  const ms = (image / fps) * 1000;
  return ms >= pastille.debutMs && ms < pastille.debutMs + pastille.dureeMs;
}
