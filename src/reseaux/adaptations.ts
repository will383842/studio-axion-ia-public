/**
 * ADAPTATIONS GRATUITES PAR RÉSEAU (lot D « Scripts exceptionnels »). PUR : aucun appel payant, aucune lecture de base.
 * Tout est derrière UN réglage, coupé par défaut : coupé, chaque fonction rend son entrée telle quelle (identité). Idem pour un script d'origine « will ».
 * Les valeurs viennent de `ecriture.ts` (règles par réseau) ; YouTube long 16:9 est hors périmètre (pas un `ReseauDeclinaison`).
 */
import type { Ratio, ReseauDeclinaison, TypeAppel } from "@/domaine/types";
import { obtenirReseau, type ZoneProtegee } from "./index";
import { ecritureReseau } from "./ecriture";

export const CLE_ADAPTATIONS_RESEAUX = "adaptations_reseaux.actif";
export const ADAPTATIONS_RESEAUX_PAR_DEFAUT = false;

/** D'où vient le script : « will » = collé par Will, pris À L'IDENTIQUE (aucune adaptation, quel que soit le réglage). */
export type OrigineScript = "will" | "machine";

/** Seul `true` strict allume le réglage : une valeur absente, nulle ou d'un autre type reste coupée. */
export function adaptationsActives(valeur: unknown): boolean {
  return valeur === true;
}

/* ------------------------------------------------------------------ */
/* 3 · Coupe du segment facultatif                                     */
/* ------------------------------------------------------------------ */

export interface SegmentFacultatif {
  id: string;
  dureeSec: number;
}

/**
 * Identifiants des segments facultatifs à GARDER pour ce réseau (ordre du script conservé).
 * S'applique UNIQUEMENT APRÈS `segmentRetenu` / `assemblerBlocs` (derivations-generateur.ts), sur la liste DÉJÀ filtrée : un
 * segment que le code actuel écarte n'est jamais rendu ici. Aujourd'hui TikTok, Instagram, Facebook et Shorts n'ont déjà
 * aucun facultatif ; la seule vraie nouveauté est le plafond de durée de LinkedIn (zone 32-60 s : un plafond, jamais un
 * plancher), appliqué dans l'ordre, en s'arrêtant au premier segment qui ne tient pas.
 * Réglage coupé : identité de ce que le code actuel retient (la liste reçue), PAS « tout garder ».
 */
export function segmentsFacultatifsRetenus(e: { actif: boolean; origine: OrigineScript; reseau: ReseauDeclinaison; dureeSansFacultatifSec: number; facultatifs: SegmentFacultatif[] }): string[] {
  if (!e.actif || e.origine === "will") return e.facultatifs.map((s) => s.id);
  // Garde-fou : un réseau qui ne retient pas le facultatif n'en garde aucun, même si on lui en passe.
  const regle = ecritureReseau(e.reseau);
  if (!regle.segmentFacultatif.valeur) return [];
  const plafond = regle.zoneDureeSec.valeur[1];
  const gardes: string[] = [];
  let total = e.dureeSansFacultatifSec;
  for (const s of e.facultatifs) {
    if (total + s.dureeSec > plafond) break;
    total += s.dureeSec;
    gardes.push(s.id);
  }
  return gardes;
}

/* ------------------------------------------------------------------ */
/* 4 · Boucle visuelle                                                  */
/* ------------------------------------------------------------------ */

/**
 * La dernière image rejoint-elle la première ? Règle `boucle` du réseau ; « sauf après question » lit l'appel.
 * Réglage coupé (ou script de Will) : `null` = rien à changer, ce qui n'est PAS « pas de boucle » (`false`).
 */
export function boucleVisuelle(e: { actif: boolean; origine: OrigineScript; reseau: ReseauDeclinaison; typeAppel: TypeAppel }): boolean | null {
  if (!e.actif || e.origine === "will") return null;
  const b = ecritureReseau(e.reseau).boucle.valeur;
  return b === "oui" || (b === "sauf-apres-question" && e.typeAppel !== "question-expert");
}

/* ------------------------------------------------------------------ */
/* 5 · Sous-titres et encadré                                          */
/* ------------------------------------------------------------------ */

const MARGE_SECURITE_PCT = 2;

export interface HabillageReseau {
  sousTitres: { margeBasPct: number; margeGauchePct: number; margeDroitePct: number; obligatoire: boolean; regleId: string };
  encadre: { margeHautPct: number; margeGauchePct: number; margeDroitePct: number };
}

/**
 * Marges (en % de l'image) pour que sous-titres et encadré restent hors de ce que l'interface du réseau recouvre.
 * Marges gauche et droite SÉPARÉES (les zones sont asymétriques : TikTok recouvre bien plus à droite qu'à gauche).
 * Réglage coupé, ou ratio dont le réseau ne connaît pas la zone : null (on n'invente rien).
 */
export function habillageReseau(e: { actif: boolean; origine: OrigineScript; reseau: ReseauDeclinaison; ratio: Ratio }): HabillageReseau | null {
  if (!e.actif || e.origine === "will") return null;
  const zone: ZoneProtegee | undefined = obtenirReseau(e.reseau).zonesProtegees[e.ratio];
  if (!zone) return null;
  const gauche = zone.gauche + MARGE_SECURITE_PCT;
  const droite = zone.droite + MARGE_SECURITE_PCT;
  const linkedin = e.reseau === "linkedin";
  return {
    sousTitres: { margeBasPct: zone.bas + MARGE_SECURITE_PCT, margeGauchePct: gauche, margeDroitePct: droite, obligatoire: linkedin, regleId: linkedin ? "li-sous-titres" : "hyp-ecriture-reseau" },
    encadre: { margeHautPct: zone.haut + MARGE_SECURITE_PCT, margeGauchePct: gauche, margeDroitePct: droite },
  };
}

/* ------------------------------------------------------------------ */
/* 6 · Ratio                                                            */
/* ------------------------------------------------------------------ */

/**
 * Ratio de la déclinaison. Coupé (ou script de Will) : celui de la mère. Allumé : le préféré du réseau s'il est disponible,
 * sinon la mère si le réseau l'accepte (hors 16:9, YouTube long étant hors périmètre), sinon le premier ratio disponible
 * accepté. LinkedIn sort en 9:16 (décision de Will du 19/10). Aucun ratio permis par le registre du réseau : `null` (pas de déclinaison possible), jamais un ratio refusé.
 */
export function ratioReseau(e: { actif: boolean; origine: OrigineScript; reseau: ReseauDeclinaison; disponibles: Ratio[]; mere: Ratio }): Ratio | null {
  if (!e.actif || e.origine === "will") return e.mere;
  const def = obtenirReseau(e.reseau);
  const permis = (r: Ratio) => r !== "16:9" && def.ratios.includes(r) && e.disponibles.includes(r);
  // LinkedIn : 9:16 comme les autres réseaux (décision de Will du 19/10, qui remplace « LinkedIn = 4:5 » du 18/10).
  const prefere: Ratio = def.ratioPrefere;
  if (permis(prefere)) return prefere;
  if (permis(e.mere)) return e.mere;
  return e.disponibles.find(permis) ?? null;
}

/* ------------------------------------------------------------------ */
/* 7 · Hypothèses non sourcées : OFF, en dur                            */
/* ------------------------------------------------------------------ */

/** Règle `hyp-voix-acceleree-tiktok` (hypothèse, aucune source) : la voix n'est jamais accélérée. */
export function vitesseVoix(_e: { actif: boolean; origine: OrigineScript; reseau: ReseauDeclinaison }): 1 {
  return 1;
}

/** Règle `hyp-resultat-d-abord` (hypothèse, aucune source) : l'ordre du script n'est jamais changé. */
export function ordreScript<T>(e: { actif: boolean; origine: OrigineScript; ordre: readonly T[] }): T[] {
  return [...e.ordre];
}
