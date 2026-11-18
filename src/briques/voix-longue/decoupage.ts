/**
 * DÉCOUPAGE DE LA VOIX LONGUE (fiche VL-02, générateur « Vidéo longue », éteint). PUR : aucun réseau, aucun appel payant.
 *
 * La voix du double n'accepte que 5 000 caractères au plus par appel. Le script VALIDÉ (celui de l'utilisateur) est donc
 * coupé en morceaux, d'abord aux fins de chapitre, puis aux fins de phrase, en dernier recours à une virgule ou à un
 * espace. Aucun mot n'est ajouté, retiré ni modifié : seuls les blancs de jonction changent.
 * Un texte qui tient en un appel reste UN SEUL morceau (comportement identique à la voix d'aujourd'hui).
 */

/** Limite de la voix HeyGen par appel (`CARACTERES_MAX_HEYGEN`, `src/fournisseurs/heygen/voix.ts`). */
export const CARACTERES_MAX_MORCEAU = 5000;

export interface ChapitreScript {
  id: string;
  /** Texte validé du chapitre, tel que l'utilisateur l'a choisi. */
  texte: string;
}

export interface MorceauVoix {
  /** Rang du morceau, à partir de 0. */
  index: number;
  /** Texte envoyé à la voix. */
  texte: string;
  /** Chapitres dont au moins un mot est lu dans ce morceau. */
  chapitreIds: string[];
}

const SEPARATEUR_CHAPITRES = "\n\n";

/** Coupe un texte trop long en parties de `max` caractères au plus : fins de phrase, puis virgules, puis espaces. */
function couper(texte: string, max: number): string[] {
  const t = texte.trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const sortie: string[] = [];
  let reste = t;
  while (reste.length > max) {
    const fenetre = reste.slice(0, max + 1);
    let pos = dernierIndex(fenetre, /[.!?…]["»”)]*\s/g);
    if (pos < max * 0.3) pos = Math.max(pos, dernierIndex(fenetre, /[;:,]\s/g));
    if (pos < 1) pos = fenetre.lastIndexOf(" ");
    if (pos < 1) pos = max; // mot unique plus long que la limite : coupe sèche, jamais de perte
    sortie.push(reste.slice(0, pos).trim());
    reste = reste.slice(pos).trim();
  }
  if (reste) sortie.push(reste);
  return sortie.filter(Boolean);
}

/** Position juste APRÈS le dernier séparateur trouvé (le blanc de fin compris), ou -1. */
function dernierIndex(texte: string, re: RegExp): number {
  let dernier = -1;
  for (const m of texte.matchAll(re)) if (m.index !== undefined) dernier = m.index + m[0].length;
  return dernier;
}

/**
 * Découpe le script en morceaux de `max` caractères au plus. Les chapitres sont regroupés dans l'ordre tant que le
 * morceau tient ; un chapitre plus long que la limite est coupé aux fins de phrase.
 */
export function decouperScript(chapitres: ChapitreScript[], max = CARACTERES_MAX_MORCEAU): MorceauVoix[] {
  if (!Number.isInteger(max) || max < 1) throw new RangeError("La limite d'un morceau doit être un entier positif.");
  const morceaux: { texte: string; ids: string[] }[] = [];
  let courant: { texte: string; ids: string[] } | null = null;
  const fermer = () => {
    if (courant) morceaux.push(courant);
    courant = null;
  };
  for (const c of chapitres) {
    const t = c.texte.trim();
    if (!t) continue;
    if (courant && courant.texte.length + SEPARATEUR_CHAPITRES.length + t.length <= max) {
      courant.texte += SEPARATEUR_CHAPITRES + t;
      courant.ids.push(c.id);
      continue;
    }
    fermer();
    if (t.length <= max) {
      courant = { texte: t, ids: [c.id] };
      continue;
    }
    for (const partie of couper(t, max)) morceaux.push({ texte: partie, ids: [c.id] });
  }
  fermer();
  return morceaux.map((m, index) => ({ index, texte: m.texte, chapitreIds: m.ids }));
}
