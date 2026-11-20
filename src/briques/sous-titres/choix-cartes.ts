/**
 * K2-T7-a : règle PURE « quel groupe de sous-titres devient une carte plein cadre ». Pièce NEUVE, éteinte, sans importeur.
 * Imports relatifs seulement. N'importe pas le module de la carte plein cadre (le type du fond y est recopié).
 * Jamais sur un visage : le groupe doit tenir ENTIÈREMENT dans un plan sans visage (bornes incluses).
 * Aucun hasard, aucune date : tri stable par `debutSec` puis `id`.
 */
import { motsAPlaque } from "./pave";
import { estNombre } from "./typographie";

/** Éteint par défaut : lu par personne tant que le branchement (K2-T7-b) n'est pas fait. */
export const CHOIX_CARTES_ACTIF = false;

/** Plafond de cartes par vidéo (choix proposé, à confirmer par Williams). */
export const MAX_CARTES_DEFAUT = 1;

/** Même type que `FondCarte` du module de la carte, recopié. */
export type FondChoisi = "ivoire" | "noir" | "terracotta";

/** Fond d'un groupe avec chiffre (choix proposé, à confirmer par Williams). */
export const FOND_AVEC_CHIFFRE: FondChoisi = "terracotta";
/** Fond par défaut (jamais « ivoire » seul). */
export const FOND_DEFAUT: FondChoisi = "noir";

export interface SegmentCarte {
  id: string;
  debutSec: number;
  finSec: number;
  mots: { mot: string }[];
  style?: string;
  souligne?: number | null;
}

/** Fait du script converti en secondes par l'appelant ; seuls `nombre` et `passage` sont un signal fort. */
export interface FaitCarte {
  type: string;
  debutSec: number;
  finSec: number;
}

export interface EntreeChoixCartes {
  segments: readonly SegmentCarte[];
  plansSansVisage: readonly { debutSec: number; finSec: number }[];
  maxCartes?: number;
  faits?: readonly FaitCarte[];
  /** Écart mini entre deux cartes (`impactEcartSec` du mélange) ; `null` ou absent : aucun écart exigé. */
  impactEcartSec?: number | null;
}

const TYPES_FORTS = new Set(["nombre", "passage"]);

function dansUnPlanSansVisage(s: SegmentCarte, plans: EntreeChoixCartes["plansSansVisage"]): boolean {
  return plans.some((p) => s.debutSec >= p.debutSec && s.finSec <= p.finSec);
}

function aSignalFort(s: SegmentCarte, faits: readonly FaitCarte[]): boolean {
  if (motsAPlaque(s, "forts-et-chiffres").length > 0) return true;
  return faits.some((f) => TYPES_FORTS.has(f.type) && f.debutSec < s.finSec && f.finSec > s.debutSec);
}

/** Renvoie `{ idSegment: fond }` ; `{}` si aucune carte n'est permise. */
export function choisirGroupesCarte(entree: EntreeChoixCartes): Record<string, FondChoisi> {
  const max = entree.maxCartes ?? MAX_CARTES_DEFAUT;
  const faits = entree.faits ?? [];
  const ecart = entree.impactEcartSec ?? 0;
  const candidats = [...entree.segments]
    .filter(
      (s) =>
        s.style === "impact" &&
        s.mots.length >= 1 &&
        s.finSec > s.debutSec &&
        dansUnPlanSansVisage(s, entree.plansSansVisage) &&
        aSignalFort(s, faits),
    )
    .sort((a, b) => a.debutSec - b.debutSec || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sortie: Record<string, FondChoisi> = {};
  let derniere: SegmentCarte | null = null;
  let n = 0;
  for (const s of candidats) {
    if (n >= max) break;
    if (derniere && s.debutSec - derniere.finSec < ecart) continue;
    sortie[s.id] = s.mots.some((m) => estNombre(m.mot)) ? FOND_AVEC_CHIFFRE : FOND_DEFAUT;
    derniere = s;
    n++;
  }
  return sortie;
}
