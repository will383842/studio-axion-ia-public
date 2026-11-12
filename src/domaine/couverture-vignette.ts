/**
 * TITRE DE VIGNETTE (PUR) — le titre de couverture et son mot mis en valeur sont FIXÉS PAR WILLIAMS (3 à 5 mots).
 * À la création, le studio PROPOSE un titre court tiré de l'accroche du script (jamais une coupe de fin de phrase) ;
 * Williams le change quand il veut, sans blocage. Ici aussi : la miniature à montrer dans la liste (la CHOISIE).
 */
import { estFinInterdite, estMotOutil, motCleCouverture, motNormalise, titreSansCodeInterne } from "./miniatures";
import { interditsVignette } from "./vignettes";

export const MOTS_VIGNETTE_MIN = 3;
export const MOTS_VIGNETTE_MAX = 5;

/** Titre et mot-clé d'une vignette. `fixee` : écrits par Williams (jamais remplacés par une proposition). */
export interface CouvertureVignette {
  texte: string;
  motCle: string;
  fixee: boolean;
}

const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}€%]/u.test(m));
const nettoyer = (t: string) => t.replace(/[«»"“”]/g, "").replace(/[…]|\.{2,}/g, " ").replace(/\s+/g, " ").trim();
const plein = (m: string) => /[\p{L}\p{N}€%]/u.test(m);

/** Amorces de phrase sans valeur sur une vignette. */
const AMORCES = /^(?:saviez[\s-]+vous\s+que|et\s+si|imaginez(?:\s+que)?|voici|voilà|regardez|écoutez|attention|stop|alors|bon|donc|dites[\s-]moi)\b[\s,:!.-]*/i;

/** Première phrase de l'accroche qui dit quelque chose, sans amorce (« Stop. » seul ne compte pas). */
function premierePhrase(accroche: string): string {
  for (const phrase of nettoyer(accroche).split(/(?<=[?!.])\s+/)) {
    let p = phrase.replace(/[?!.]+$/, "");
    for (let i = 0; i < 3 && AMORCES.test(p); i++) p = p.replace(AMORCES, "");
    p = p.trim();
    if (mots(p).length >= 2) return p;
  }
  return "";
}

/** Un morceau de 3 à 5 mots qui commence et finit sur un mot plein, ou null. */
function fenetre(liste: string[]): string | null {
  let meilleur: { score: number; texte: string } | null = null;
  for (let debut = 0; debut < liste.length; debut++) {
    if (estMotOutil(liste[debut]) && !/\d/.test(liste[debut])) continue;
    for (let n = MOTS_VIGNETTE_MAX; n >= MOTS_VIGNETTE_MIN; n--) {
      const part = liste.slice(debut, debut + n);
      if (part.length < n) continue;
      if (estFinInterdite(part[n - 1])) continue;
      const contenu = part.filter((m) => !estMotOutil(m) || /\d/.test(m)).length;
      // Plus de mots pleins, un nombre en prime, un début de phrase de préférence.
      const score = contenu * 10 + (part.some((m) => /\d/.test(m)) ? 6 : 0) + n - debut * 0.5;
      if (!meilleur || score > meilleur.score) meilleur = { score, texte: part.join(" ") };
    }
  }
  return meilleur?.texte.replace(/[,;:!?.]+$/, "") ?? null;
}

/**
 * Titre et mot-clé PROPOSÉS depuis l'accroche (sinon depuis `repli`, le titre de la vidéo sans code interne).
 * 3 à 5 mots quand le texte le permet, jamais un mot outil en dernier, jamais « … ». Williams a toujours le dernier mot.
 */
export function proposerCouverture(accroche: string, repli = ""): { texte: string; motCle: string } {
  for (const source of [accroche, titreSansCodeInterne(repli)]) {
    const phrase = premierePhrase(source);
    if (!phrase) continue;
    const liste = phrase.split(" ").filter(plein);
    // La phrase entière si elle tient et finit proprement ; sinon la meilleure fenêtre de 3 à 5 mots (jamais une coupe de fin).
    const entiere = liste.length >= MOTS_VIGNETTE_MIN && liste.length <= MOTS_VIGNETTE_MAX && !estFinInterdite(liste.at(-1)!) && !estMotOutil(liste[0]) ? liste.join(" ") : null;
    let texte = entiere;
    texte ??= fenetre(liste);
    if (texte) return { texte, motCle: motCleCouverture(texte) };
  }
  const court = mots(premierePhrase(repli)).slice(0, MOTS_VIGNETTE_MAX).join(" ");
  return { texte: court, motCle: motCleCouverture(court) };
}

/** Problèmes du titre saisi (liste en français, vide = il peut partir). Le mot-clé vide est permis. */
export function verifierCouverture(texte: string, motCle: string): string[] {
  const pb: string[] = [];
  const n = mots(texte).length;
  if (n < MOTS_VIGNETTE_MIN) pb.push(`Le titre de la vignette doit compter ${MOTS_VIGNETTE_MIN} mots au moins.`);
  if (n > MOTS_VIGNETTE_MAX) pb.push(`Le titre de la vignette doit compter ${MOTS_VIGNETTE_MAX} mots au plus.`);
  const cle = motCle.trim();
  if (cle) {
    const dans = motNormalise(texte).includes(motNormalise(cle)) || texte.toLowerCase().includes(cle.toLowerCase());
    if (!dans) pb.push("Le mot à mettre en valeur doit faire partie du titre.");
  }
  for (const i of interditsVignette(texte)) pb.push(`Le titre contient un terme interdit : ${i}.`);
  return pb;
}

/** La miniature que la liste doit montrer : la CHOISIE de la vidéo (`miniatureChoisieId`), sinon celle marquée choisie, sinon aucune. */
export function miniatureAAfficher<M extends { id: string; choisie: boolean }>(video: { miniatureChoisieId?: string }, miniatures: M[]): M | null {
  return (video.miniatureChoisieId ? miniatures.find((m) => m.id === video.miniatureChoisieId) : undefined) ?? miniatures.find((m) => m.choisie) ?? null;
}
