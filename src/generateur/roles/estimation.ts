/**
 * ESTIMATION RÉALISTE D'UN APPEL (correction décidée après le banc G4, 03/10/2026), PUR.
 *
 * Le PIRE CAS (`pireCasRole` : toute l'entrée écrite en cache + `maxTokens` de sortie) reste la règle du plafond
 * MENSUEL Claude, du pré-vol et de la réservation de la brique Crédits (jamais sous-estimé). Mais vérifié contre le
 * plafond d'UN SUJET (1,50 $) ou d'un supplément (0,70 $, « + Je lis »), il arrêtait un corps avant la fin alors que la
 * dépense réelle restait loin du plafond (un sujet complet ≈ 0,70 $ mesuré). Le plafond du sujet se vérifie donc sur
 * une estimation RÉALISTE : la MÉDIANE du coût réel de ce rôle mesurée au banc G4 (52 appels réels, `docs/captures/
 * g4-banc/tour-*`), jamais moins que le coût de l'entrée seule, jamais plus que le pire cas.
 * Rôle jamais mesuré : entrée + un quart de `maxTokens` en sortie (jamais plus que le pire cas).
 */
import { pireCasUsd, tarifDe, jetonsEstimes } from "@/fournisseurs/claude/tarifs";
import { construireRequete, pireCasRole, type DefinitionRole, type EntreeRole } from "./types";

/** Coût réel médian par rôle, en dollars, mesuré au banc G4 (03/10/2026 ; Opus 5.5 pour écrire, Sonnet 5.5 pour juger). */
export const MEDIANES_BANC_G4_USD: Readonly<Record<string, number>> = {
  stratege: 0.1302,
  fond: 0.0604,
  accroches: 0.199,
  juge: 0.0191,
  plan: 0.0906,
  prose: 0.0827,
  reecriture: 0.0343,
  declinaison: 0.0265,
  // Chaîne courte, banc d'écriture n° 3 (15/10) : un appel de chaque rôle.
  "court-angle": 0.14,
  "court-script": 0.17,
  "court-relecture": 0.035,
};

/** Part de `maxTokens` comptée en sortie pour un rôle jamais mesuré. */
export const PART_SORTIE_NON_MESURE = 0.25;

function jetonsEntree(role: DefinitionRole, entree: EntreeRole): number {
  const r = construireRequete(role, entree);
  return jetonsEstimes([...r.systeme.map((b) => b.texte), ...r.messages.map((m) => m.contenu), r.schema ? JSON.stringify(r.schema) : ""].join("\n"));
}

/** Estimation réaliste d'un appel de ce rôle (dollars), entre le coût de l'entrée seule et le pire cas. */
export function estimationRealisteRole(role: DefinitionRole, entree: EntreeRole): number {
  const pire = pireCasRole(role, entree);
  const jetons = jetonsEntree(role, entree);
  const t = tarifDe(role.modele);
  const entreeSeule = (jetons * t.entree) / 1_000_000;
  const mediane = MEDIANES_BANC_G4_USD[role.id];
  const estimation = mediane !== undefined ? Math.max(mediane, entreeSeule) : pireCasUsd(role.modele, 0, Math.ceil(role.maxTokens * PART_SORTIE_NON_MESURE)) + entreeSeule;
  return Math.min(pire, estimation);
}

/* ------------------------------------------------------------------ */
/* Pire cas PRUDENT d'un appel et d'une chaîne (correctif relecture A09) */
/* ------------------------------------------------------------------ */

/**
 * Pire cas PRUDENT d'un appel, pour la réserve d'une chaîne entière (correctif après relecture, 15/10). Le pire cas du
 * pré-vol (`pireCasRole`) compte TOUTE l'entrée au prix d'écriture en cache (1,25 × l'entrée), à CHAQUE appel : sommé sur
 * vingt appels, il gonflait la chaîne d'un quart de son entrée. Ici : toute l'entrée au prix NORMAL (le cache lu coûte
 * 20 fois moins, il n'est jamais compté comme lu), `maxTokens` en sortie, et l'écriture en cache du socle (les blocs en
 * cache) comptée À PART, une fois par rôle (`totaliserPireCas`). `jetonsEnPlus` : ce que l'appel recevra en plus de ce qui
 * est connu (sorties des étapes précédentes, consignes ajoutées).
 */
export interface PireCasAppel {
  role: string;
  modele: string;
  jetonsEntree: number;
  maxTokens: number;
  /** Jetons des blocs en cache (le socle, puis le format et la consigne), écrits en cache une fois par rôle. */
  jetonsSocle: number;
  /** Part de `jetonsSocle` écrite pour 1 h (le socle de Will, 2 × l'entrée) ; le reste est écrit pour 5 min (1,25 ×). */
  jetonsSocle1h: number;
  /** Entrée au prix normal + `maxTokens` en sortie (dollars), jamais moins que l'estimation réaliste du plafond. */
  usd: number;
  /**
   * Écart avec le pire cas du pré-vol (dollars) : tant qu'un appel est en vol, la dépense du sujet le compte à ce pire cas
   * (`depenseGenerationUsd`) ; des appels partis ensemble se voient donc un peu plus chers qu'ici.
   */
  surcoutEnVolUsd: number;
}

export function pireCasPrudentAppel(role: DefinitionRole, entree: EntreeRole, jetonsEnPlus = 0): PireCasAppel {
  const t = tarifDe(role.modele);
  const jetons = jetonsEntree(role, entree) + jetonsEnPlus;
  const systeme = construireRequete(role, entree).systeme;
  const socle = jetonsEstimes(systeme.filter((b) => b.cache).map((b) => b.texte).join("\n"));
  // Cache 1 h (#242) : le socle, jusqu'à son point 1 h, s'écrit à 2 × l'entrée ; le compter à 1,25 × le sous-estimait.
  const fin1h = systeme.findIndex((b) => b.cache === "1h");
  const socle1h = fin1h >= 0 ? Math.min(socle, jetonsEstimes(systeme.slice(0, fin1h + 1).map((b) => b.texte).join("\n"))) : 0;
  const usd = Math.max(estimationRealisteRole(role, entree), (jetons * t.entree + role.maxTokens * t.sortie) / 1_000_000);
  return { role: role.id, modele: role.modele, jetonsEntree: jetons, maxTokens: role.maxTokens, jetonsSocle: socle, jetonsSocle1h: socle1h, usd, surcoutEnVolUsd: Math.max(0, pireCasUsd(role.modele, jetons, role.maxTokens, socle1h) - usd) };
}

/** Un appel prévu d'une chaîne : `n` fois au pire ; `parallele` : combien partent ensemble (juges, déclinaisons). */
export interface LignePireCas {
  etape: number;
  appel: PireCasAppel;
  n: number;
  parallele?: number;
}

export interface PireCasChaine {
  /** Total (dollars) : appels + écritures du socle en cache + marge des appels en vol. */
  usd: number;
  appels: number;
  detail: { etape: number; role: string; appels: number; usd: number; jetonsEntree: number; maxTokens: number; modele: string }[];
  /**
   * Écriture en cache : une fois par rôle (au pire, jamais partagée entre rôles), au surcoût de l'écriture : le socle de
   * Will au prix 1 h (1 × l'entrée en plus), le format et la consigne au prix 5 min (0,25 × l'entrée en plus).
   */
  ecritureCacheUsd: number;
  /** Plus grand surcoût d'appels partis ensemble, encore en vol quand le suivant est contrôlé. */
  margeEnVolUsd: number;
}

/**
 * Somme PRUDENTE des appels prévus (PUR) : chaque appel à son pire (`pireCasPrudentAppel`), l'écriture du socle une fois
 * par rôle, et la marge du plus grand groupe d'appels partis ensemble. Sert à la réserve d'une chaîne avant son premier
 * appel : sous ce montant, le contrôle appel par appel du plafond (estimation réaliste + appels en vol au pire) ne peut
 * pas l'arrêter au milieu.
 */
export function totaliserPireCas(lignes: LignePireCas[]): PireCasChaine {
  const detail = lignes.map((l) => ({ etape: l.etape, role: l.appel.role, appels: l.n, usd: l.n * l.appel.usd, jetonsEntree: l.appel.jetonsEntree, maxTokens: l.appel.maxTokens, modele: l.appel.modele }));
  const socles = new Map<string, number>();
  for (const l of lignes) {
    if (l.n <= 0) continue;
    const t = tarifDe(l.appel.modele);
    const a = l.appel;
    const surcout = (a.jetonsSocle1h * (t.cacheEcrit1h - t.entree) + (a.jetonsSocle - a.jetonsSocle1h) * (t.cacheEcrit - t.entree)) / 1_000_000;
    socles.set(a.role, Math.max(socles.get(a.role) ?? 0, surcout));
  }
  const ecritureCacheUsd = [...socles.values()].reduce((t, x) => t + x, 0);
  const margeEnVolUsd = lignes.reduce((m, l) => Math.max(m, Math.max(0, Math.min(l.n, l.parallele ?? 1) - 1) * l.appel.surcoutEnVolUsd), 0);
  return { usd: detail.reduce((t, x) => t + x.usd, 0) + ecritureCacheUsd + margeEnVolUsd, appels: detail.reduce((t, x) => t + x.appels, 0), detail, ecritureCacheUsd, margeEnVolUsd };
}
