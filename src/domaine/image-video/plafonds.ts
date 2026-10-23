/**
 * IMAGE → VIDÉO · Plafonds de durée PAR RÉSEAU et règle en 4 cas (plan § 3, M6). PUR.
 *
 * Durée totale = corps + question de commentaire + fin, MESURÉE après la voix, pour chaque version :
 * 1. ≤ plafond conseillé → livrée telle quelle ;
 * 2. dépassement ≤ 15 % du plafond conseillé ET sous la limite dure → livrée avec la mention « un peu longue » ;
 * 3. au-delà → version courte demandée (chapitres non essentiels retirés, même voix) ;
 * 4. version courte encore trop longue (> 15 %) ou impossible → ce réseau n'est pas livré.
 */

/**
 * Réseaux que le dépôt Image → vidéo PROPOSE et fabrique. Will, 19/10/2026 : « SUPPRIME TIKTOK POUR IMAGE TO VIDEO »
 * (TikTok plafonne à 69 s, une image complexe donne 60 à 78 s : le refus tombait après le paiement de la voix).
 */
export const RESEAUX_IV = ["youtube-shorts", "linkedin", "instagram", "facebook"] as const;

/** Phrase quand une demande ne porte que TikTok (retiré d'Image → vidéo, 19/10/2026). */
export const PHRASE_TIKTOK_RETIRE_IV = "TikTok n'est plus proposé pour Image → vidéo : cochez au moins un autre réseau.";
/** Tous les réseaux que d'anciennes vidéos ont pu porter (TikTok compris) : lecture et affichage seulement, jamais proposés. */
export const RESEAUX_IV_HISTORIQUE = ["tiktok", ...RESEAUX_IV] as const;
export type ReseauIV = (typeof RESEAUX_IV_HISTORIQUE)[number];

export interface PlafondReseau {
  /** Nom montré à Will. */
  nom: string;
  conseilleSec: number;
  /** Limite dure du registre ; `null` = aucune. */
  dureSec: number | null;
}

export const PLAFONDS_IV: Readonly<Record<ReseauIV, PlafondReseau>> = Object.freeze({
  tiktok: { nom: "TikTok", conseilleSec: 60, dureSec: null },
  "youtube-shorts": { nom: "YouTube Shorts", conseilleSec: 60, dureSec: null },
  linkedin: { nom: "LinkedIn", conseilleSec: 60, dureSec: null },
  instagram: { nom: "Instagram", conseilleSec: 90, dureSec: null },
  facebook: { nom: "Facebook", conseilleSec: 90, dureSec: 90 },
});

/** Dépassement toléré avec mention (cas 2). */
export const DEPASSEMENT_TOLERE = 0.15;

export const MENTION_UN_PEU_LONGUE = "un peu longue pour ce réseau";

export type VerdictPlafond =
  | { cas: 1; verdict: "livree"; dureeSec: number }
  | { cas: 2; verdict: "mention"; dureeSec: number; phrase: string }
  | { cas: 3; verdict: "version-courte"; dureeSec: number; phrase: string }
  | { cas: 4; verdict: "non-livree"; dureeSec: number; phrase: string };

function secondes(s: number): string {
  return `${Math.round(s)} s`;
}

/** Cas 1 à 3 pour une durée mesurée. */
function casDeLaDuree(reseau: ReseauIV, dureeSec: number): 1 | 2 | 3 {
  const p = PLAFONDS_IV[reseau];
  if (dureeSec <= p.conseilleSec) return 1;
  const sousLaLimite = p.dureSec === null || dureeSec <= p.dureSec;
  return dureeSec <= p.conseilleSec * (1 + DEPASSEMENT_TOLERE) && sousLaLimite ? 2 : 3;
}

/**
 * Verdict d'une version pour un réseau.
 * - `versionCourteSec` absent : on ne sait pas encore si une version courte existe → au-delà du cas 2, « version courte » ;
 * - `versionCourteSec` = `null` : aucune version courte possible (aucun chapitre détachable) → non livrée ;
 * - `versionCourteSec` = durée mesurée de la version courte : elle est jugée à son tour (cas 1 ou 2, sinon non livrée).
 */
export function verdictPlafond(reseau: ReseauIV, dureeSec: number, versionCourteSec?: number | null): VerdictPlafond {
  const nom = PLAFONDS_IV[reseau].nom;
  const cas = casDeLaDuree(reseau, dureeSec);
  if (cas === 1) return { cas: 1, verdict: "livree", dureeSec };
  if (cas === 2) return { cas: 2, verdict: "mention", dureeSec, phrase: `${secondes(dureeSec)} : ${MENTION_UN_PEU_LONGUE}.` };
  const refus = (d: number): VerdictPlafond => ({
    cas: 4,
    verdict: "non-livree",
    dureeSec: d,
    phrase: `Trop longue pour ${nom} (${secondes(d)}) : raccourcissez le script ou retirez ce réseau`,
  });
  if (versionCourteSec === undefined) {
    return { cas: 3, verdict: "version-courte", dureeSec, phrase: `Trop longue pour ${nom} (${secondes(dureeSec)}) : une version courte est préparée.` };
  }
  if (versionCourteSec === null) return refus(dureeSec);
  const courte = casDeLaDuree(reseau, versionCourteSec);
  if (courte === 1) return { cas: 1, verdict: "livree", dureeSec: versionCourteSec };
  if (courte === 2) return { cas: 2, verdict: "mention", dureeSec: versionCourteSec, phrase: `${secondes(versionCourteSec)} : ${MENTION_UN_PEU_LONGUE}.` };
  return refus(versionCourteSec);
}

/** Jamais au-delà d'une limite dure (Facebook 90 s) : vrai si la durée passe la limite du réseau. */
export function depasseLimiteDure(reseau: ReseauIV, dureeSec: number): boolean {
  const dure = PLAFONDS_IV[reseau].dureSec;
  return dure !== null && dureeSec > dure;
}
