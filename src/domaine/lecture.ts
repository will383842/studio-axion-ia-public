/**
 * VITESSE DE LECTURE (moteur avocat B.5, v3.2). PUR, importable côté client.
 * Une phrase dite à plus de 5,5 mots/s est trop dense pour être lue en sous-titres : l'alerte s'affiche dans
 * l'atelier de scripts ET au contrôle qualité, pour corriger le TEXTE plutôt que les sous-titres. Jamais bloquant.
 * Signature figée au lot M0 : le lot M2 en affine le calcul (horodatage réel), le lot M3 l'affiche.
 */

/** Seuil v3.2 : 5,5 mots/s (5 signalerait les vidéos de référence elles-mêmes, à 3,9-5,0 mots/s). */
export const SEUIL_MOTS_PAR_SECONDE = 5.5;

export interface PhraseDense {
  /** Index de la phrase dans le texte. */
  index: number;
  phrase: string;
  motsParSeconde: number;
}

/** Découpe un texte en phrases (ponctuation forte), sans rien réécrire. */
export function phrasesDe(texte: string): string[] {
  return texte
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.?!…])\s+/)
    .filter(Boolean);
}

/** Débit de la voix en syllabes par seconde au débit de référence (B.4, v3.2 : cible 6,0-6,5 syll./s à 4,4 mots/s). */
export const SYLLABES_PAR_SECONDE_REFERENCE = 6.25;
const DEBIT_REFERENCE = 4.4;

/** Syllabes prononcées d'un mot français (estimation : groupes de voyelles, « e » muet final ; nombres lus). */
export function syllabes(mot: string): number {
  const propre = mot.toLowerCase().replace(/[«»"“”()[\]{}.,;:!?…  ]/g, "");
  if (!propre) return 0;
  if (/^\d+([.,]\d+)?$/.test(propre)) {
    if (/^0+$/.test(propre)) return 1; // « mille »
    return propre.length === 1 ? 1 : propre.length === 2 ? 2 : 3;
  }
  if (propre === "€") return 2;
  if (propre === "%") return 3;
  let n = 0;
  for (const partie of propre.split(/[-'’]/)) {
    const groupes = partie.match(/[aeiouyàâäéèêëîïôöùûüœæ]+/g)?.length ?? 0;
    const muet = groupes > 1 && /[^aeiouyàâäéèêëîïôöùûü](e|es|ent)$/.test(partie) ? 1 : 0;
    n += Math.max(partie ? 1 : 0, groupes - muet);
  }
  return Math.max(1, n);
}

/**
 * Durée parlée estimée d'une phrase : ses syllabes au débit de la voix (6,25 syll./s à 4,4 mots/s, proportionnel au
 * débit du format), plus les respirations (virgule 0,08 s, fin de phrase 0,15 s). Une phrase de mots courts se dit
 * plus vite, en mots par seconde, qu'une phrase de mots longs : c'est elle qui devient illisible en sous-titres.
 */
export function dureeParleeEstimee(phrase: string, motsParSecondeVoix: number): number {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const sps = SYLLABES_PAR_SECONDE_REFERENCE * (Math.max(0.1, motsParSecondeVoix) / DEBIT_REFERENCE);
  const total = mots.reduce((s, m) => s + syllabes(m), 0);
  const pauses = mots.filter((m) => /[,;:]$/.test(m)).length * 0.08 + 0.15;
  return total / sps + pauses;
}

/** Mots LUS d'une phrase (la ponctuation isolée « ? », « : » ne compte pas). */
function motsLus(phrase: string): number {
  return phrase.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/**
 * Phrases trop denses. Sans horodatage réel, la durée d'une phrase est estimée depuis ses SYLLABES au débit de la
 * voix (`motsParSecondeVoix`) ; avec l'horodatage (`dureesSec`, une durée par phrase), il prime.
 * Lot M2 : l'estimation par syllabes remplace « mots ÷ débit », qui ne pouvait jamais dépasser le débit lui-même.
 */
export function phrasesTropDenses(texte: string, motsParSecondeVoix: number, dureesSec?: number[]): PhraseDense[] {
  return phrasesDe(texte)
    .map((phrase, index) => {
      const mots = motsLus(phrase);
      const duree = dureesSec?.[index] ?? dureeParleeEstimee(phrase, motsParSecondeVoix);
      return { index, phrase, motsParSeconde: +(mots / Math.max(0.1, duree)).toFixed(2) };
    })
    .filter((p) => p.motsParSeconde > SEUIL_MOTS_PAR_SECONDE);
}
