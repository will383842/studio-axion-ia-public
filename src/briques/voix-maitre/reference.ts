/**
 * VOIX DE RÉFÉRENCE (décision de Will, 14/10) : la voix de TOUS les générateurs doit ressembler à la seconde 25-30 de
 * la vidéo v4 (`docs/voix-reference/voix-reference-v4-25-30s.wav`). Le clone HeyGen change d'une génération à l'autre
 * (essai du 14/10 : hauteur +9 %, variation +22 %) : chaque lecture payée est MESURÉE (`studio-rendu`, opération
 * `nettoyage-audio`, mode `mesure-voix`, portage de `docs/voix-reference/comparer-voix.py`), comparée ici, et relue au
 * plus `relancesMax` fois quand elle s'en écarte ; la prise la plus proche est gardée. PUR.
 */

import type { CommandeFabrication, LigneCout, VoixBrutePayee } from "@/domaine/types";
import { centimes } from "@/lib/montants";

/** Les six mesures de `comparer-voix.py` (mêmes définitions, mêmes unités). */
export interface MesureVoix {
  /** Hauteur médiane des fenêtres voisées (Hz). */
  hauteurHz: number;
  /** Écart type de la hauteur (Hz). */
  variationHz: number;
  /** Énergie moyenne (RMS) des fenêtres de parole. */
  energie: number;
  /** Écart type / moyenne de l'énergie des fenêtres de parole. */
  dynamique: number;
  /** Pics de l'enveloppe lissée par seconde. */
  rythmePicsParSec: number;
  /** Part des fenêtres de parole (0-1). */
  partieParole: number;
}

export type CleMesureVoix = keyof MesureVoix;

export const CLES_MESURE_VOIX: readonly CleMesureVoix[] = Object.freeze(["hauteurHz", "variationHz", "energie", "dynamique", "rythmePicsParSec", "partieParole"]);

/**
 * Version de la mesure (`studio-rendu`, `voix.versionMesure`) que la brique attend. 2 (15/10, v-dd3049053f88) : la part
 * de parole se compte entre la première et la dernière fenêtre de parole (les blancs de début et de fin du fichier ne
 * comptent plus). Une prise mesurée avant (version absente = 1) est RE-MESURÉE à la reprise, jamais relue.
 * 3 (19/10) : mesure Image → vidéo traitée comme une vidéo finie ; avocat, tableau et cas concret mesurés bruts (v2),
 * jamais re-mesurés.
 */
export const VERSION_MESURE_VOIX = 3;

/**
 * Traitement de mesure demandé à `studio-rendu` (`parametres.traitement` du mode `mesure-voix`). Absent : mesure brute
 * (version 2). Ne figure JAMAIS dans l'empreinte d'une prise (l'empreinte fait foi de la lecture payée).
 */
export type TraitementMesureVoix = "video-finie";

/** Version d'une mesure rendue par `studio-rendu` (`voix.versionMesure`) ; absente : 1 (mesure d'avant le 15/10). */
export function versionMesureDesMesures(mesures: Record<string, number> | undefined): number {
  const v = mesures?.["voix.versionMesure"];
  return typeof v === "number" && Number.isFinite(v) ? v : 1;
}

/** Rang de la première prise d'un rapport de ressemblance mesurée par une version antérieure ; -1 : aucune. PUR. */
export function rangMesureAncienne(rapport: { prises: readonly { versionMesure?: number }[] } | undefined): number {
  return rapport ? rapport.prises.findIndex((p) => (p.versionMesure ?? 1) < VERSION_MESURE_VOIX) : -1;
}

/** Ce son (maître) a-t-il une prise mesurée par une version antérieure de la mesure (à re-mesurer, gratuitement) ? PUR. */
export function mesureAncienne(audio: { ressemblance?: { prises: readonly { versionMesure?: number }[] } } | undefined): boolean {
  return rangMesureAncienne(audio?.ressemblance) >= 0;
}

/**
 * Son jugé NON ressemblant sur une mesure d'une version antérieure : la re-mesure (gratuite) peut changer son verdict.
 * Un son ressemblant, ou déjà mesuré à la version courante, n'a rien à y gagner. PUR.
 */
export function verdictSurMesureAncienne(audio: { ressemblance?: { ressemblante: boolean; prises: readonly { versionMesure?: number }[] } } | undefined): boolean {
  return audio?.ressemblance?.ressemblante === false && mesureAncienne(audio);
}

/** Mesures de la référence (LISEZ-MOI du 14/10 ; INCHANGÉES par les mesures versions 2 et 3 : 0,7702 de part de parole). */
export const REFERENCE_V4: Readonly<MesureVoix> = Object.freeze({ hauteurHz: 152.4, variationHz: 31.2, energie: 0.141, dynamique: 0.528, rythmePicsParSec: 5.0, partieParole: 0.77 });

/** Écart relatif toléré par mesure (provisoire, à régler à l'oreille avec Will). */
export const TOLERANCES_VOIX: Readonly<MesureVoix> = Object.freeze({ hauteurHz: 0.08, variationHz: 0.25, energie: 0.2, dynamique: 0.2, rythmePicsParSec: 0.12, partieParole: 0.12 });

const LIBELLES: Readonly<Record<CleMesureVoix, string>> = { hauteurHz: "hauteur", variationHz: "variation de hauteur", energie: "énergie", dynamique: "dynamique", rythmePicsParSec: "rythme", partieParole: "part de parole" };

export interface EcartVoix {
  mesure: CleMesureVoix;
  /** Écart relatif signé à la référence (0,09 = +9 %). */
  ecart: number;
  tolerance: number;
  /** Phrase lisible (« hauteur +9 % (toléré 8 %) »). */
  libelle: string;
}

/** Comparaison d'une mesure à la référence : `ecarts` ne liste que ce qui sort de la tolérance. */
export function comparerAReference(m: MesureVoix, reference: Readonly<MesureVoix> = REFERENCE_V4, tolerances: Readonly<MesureVoix> = TOLERANCES_VOIX): { ressemblante: boolean; ecarts: EcartVoix[] } {
  const ecarts: EcartVoix[] = [];
  for (const k of CLES_MESURE_VOIX) {
    const e = (m[k] - reference[k]) / reference[k];
    // Une mesure absente ou illisible (NaN : aucune fenêtre voisée) n'est jamais « ressemblante ».
    if (!Number.isFinite(e) || Math.abs(e) > tolerances[k]) {
      const pct = Number.isFinite(e) ? `${e >= 0 ? "+" : ""}${Math.round(e * 100)} %` : "non mesurée";
      ecarts.push({ mesure: k, ecart: Number.isFinite(e) ? e : Number.POSITIVE_INFINITY, tolerance: tolerances[k], libelle: `${LIBELLES[k]} ${pct} (toléré ${Math.round(tolerances[k] * 100)} %)` });
    }
  }
  return { ressemblante: ecarts.length === 0, ecarts };
}

/**
 * Écart pondéré d'une mesure : somme des écarts relatifs, chacun divisé par sa tolérance (une mesure à la limite de
 * sa tolérance pèse 1). Plus petit = plus proche de la référence. Une mesure illisible pèse l'infini.
 */
export function ecartPondere(m: MesureVoix, reference: Readonly<MesureVoix> = REFERENCE_V4, tolerances: Readonly<MesureVoix> = TOLERANCES_VOIX): number {
  let s = 0;
  for (const k of CLES_MESURE_VOIX) {
    const e = Math.abs((m[k] - reference[k]) / reference[k]) / tolerances[k];
    s += Number.isFinite(e) ? e : Number.POSITIVE_INFINITY;
  }
  return s;
}

/** Rang de la prise la plus proche de la référence (plus petit écart pondéré ; à égalité, la première). -1 : aucune. */
export function choisirMeilleurePrise(prises: readonly { mesure: MesureVoix }[], reference: Readonly<MesureVoix> = REFERENCE_V4): number {
  let meilleure = -1;
  let min = Number.POSITIVE_INFINITY;
  prises.forEach((p, i) => {
    const e = ecartPondere(p.mesure, reference);
    if (meilleure < 0 || e < min) {
      meilleure = i;
      min = e;
    }
  });
  return meilleure;
}

/** Mesures à plat renvoyées par `studio-rendu` (mode `mesure-voix`) → `MesureVoix` ; `null` si une valeur manque. */
export function mesureVoixDesMesures(mesures: Record<string, number> | undefined): MesureVoix | null {
  if (!mesures) return null;
  const m = {} as MesureVoix;
  for (const k of CLES_MESURE_VOIX) {
    const v = mesures[`voix.${k}`];
    if (typeof v !== "number") return null;
    m[k] = v;
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Réglage global « ressemblanceVoix »                                   */
/* ------------------------------------------------------------------ */

/** Réglage global (`voix.ressemblance`) : contrôle actif par défaut, 1 relance (2 lectures au plus) ; réglable de 0 à 2 relances. */
export interface ReglageRessemblanceVoix {
  actif: boolean;
  /** Relectures payées au plus après la première (0 à 2). */
  relancesMax: number;
}

export const RELANCES_VOIX_PLAFOND = 2;
/** Relances par défaut (décision de Will, 14/10 : budget d'essais serré) : 2 lectures au plus ; le réglage peut monter à 2 relances (3 lectures). */
export const RELANCES_VOIX_PAR_DEFAUT = 1;
export const RESSEMBLANCE_VOIX_PAR_DEFAUT: Readonly<ReglageRessemblanceVoix> = Object.freeze({ actif: true, relancesMax: RELANCES_VOIX_PAR_DEFAUT });
/** Clé du réglage global (Réglages, lu par les services ; figé dans la commande au lancement). */
export const PARAM_RESSEMBLANCE_VOIX = "voix.ressemblance";

/** Réglage lu (stocké ou figé dans une commande) → réglage propre ; absent ou mal formé : le défaut (ACTIF). */
export function lireReglageRessemblance(brut: unknown): ReglageRessemblanceVoix {
  if (!brut || typeof brut !== "object") return { ...RESSEMBLANCE_VOIX_PAR_DEFAUT };
  const r = brut as Partial<Record<keyof ReglageRessemblanceVoix, unknown>>;
  const actif = typeof r.actif === "boolean" ? r.actif : RESSEMBLANCE_VOIX_PAR_DEFAUT.actif;
  const n = typeof r.relancesMax === "number" && Number.isFinite(r.relancesMax) ? Math.floor(r.relancesMax) : RESSEMBLANCE_VOIX_PAR_DEFAUT.relancesMax;
  return { actif, relancesMax: Math.max(0, Math.min(RELANCES_VOIX_PLAFOND, n)) };
}

/**
 * Lectures payées AU PLUS pour un texte : 1 + relances quand le contrôle est actif, sinon 1. Le prix annoncé à Will
 * est ce maximum (règle « prix confirmé = prix affiché » : une relance ne doit jamais dépasser le prix confirmé).
 */
export function lecturesVoixMax(r: ReglageRessemblanceVoix | undefined): number {
  if (!r || !r.actif) return 1;
  return 1 + Math.max(0, Math.min(RELANCES_VOIX_PLAFOND, Math.floor(r.relancesMax)));
}

/** Entrée de la commande où le réglage est figé au lancement (tableau animé, cas concret). */
export const ENTREE_RESSEMBLANCE_VOIX = "ressemblanceVoix";

/**
 * Réglage figé dans une commande ; absent (commande d'avant, autre format) : `undefined`, contrôle COUPÉ — la commande
 * a été chiffrée sans relance, la chaîne n'en fait pas.
 */
export function ressemblanceDeLaCommande(entrees: Readonly<Record<string, unknown>> | undefined): ReglageRessemblanceVoix | undefined {
  const brut = entrees?.[ENTREE_RESSEMBLANCE_VOIX];
  return brut === undefined ? undefined : lireReglageRessemblance(brut);
}

/**
 * 14/10 (voix de référence) : ce qu'une maquette reprise peut encore payer pour la voix. Son brut déjà payé : rien, sauf
 * si le contrôle de ressemblance n'est pas fini (`controleVoix`) : les relectures encore permises, au prorata des lignes
 * « Voix » estimées (qui couvrent `lecturesVoixMax` lectures). PUR.
 */
export function lignesVoixMaquetteRestantes(lignesVoix: LigneCout[], vb: Pick<VoixBrutePayee, "controleVoix">, c: Pick<CommandeFabrication, "entrees">): LigneCout[] {
  if (!vb.controleVoix) return [];
  const max = lecturesVoixMax(ressemblanceDeLaCommande(c.entrees));
  const payees = vb.controleVoix.prises.length + (vb.controleVoix.phase === "a-relire" ? 0 : 1);
  const restantes = Math.max(0, max - payees);
  return restantes ? lignesVoix.map((l) => ({ ...l, quantite: Math.ceil((l.quantite * restantes) / max), total: centimes(Math.ceil((l.total.centimes * restantes) / max - 1e-9)) })) : [];
}
