/**
 * CONTRÔLES DE RECETTE (lot A3), sur le patron de C94 (`probleme.ts`). PUR. Tous en ALERTE (information pour un texte de
 * Will) : ils signalent, ils ne bloquent jamais. Seuils et motif : `donnees/generateur/recette-script.ts` (une source).
 *  - C96 : tutoriel pas à pas (anti-pattern A1) : 2 consignes numérotées (« Un. Listez… ») ou 3 impératifs en tête de phrase ;
 *  - C97 : aucune question au spectateur (dans l'adresse de la vidéo) hors appel et boucle, posée après 40 % du texte dit, ou plus de `QUESTIONS_MAX` questions ;
 *  - C98 : la dernière phrase du corps redit l'accroche (3 racines communes, hors mot-clé) ; ignoré en boucle ;
 *  - C99 : pas de rupture « on s'en occupe pour vous » dans le dernier segment du corps ni dans l'appel.
 * C95 (positionnement) est dans `positionnement.ts`.
 */
import { QUESTIONS_MAX, ruptureDite } from "@/donnees/generateur/recette-script";
import { tutoriel } from "@/domaine/positionnement";
import { segmentsParles, type Analyse, type Collecte, type SegmentLu } from "./analyse";
import { normaliser, phrasesDe, sansAccents } from "./texte";
import type { EntreeControle } from "./types";

/** Mots sans poids pour comparer deux textes (copie de `racines()` du contrôle du tableau : pas d'import entre domaines). */
const MOTS_VIDES = new Set(
  "avant apres maintenant votre vos vous avec sans pour dans tout toute tous toutes plus moins cette ces cet comme elle elles ils leur leurs lui sont etre avoir fait faire chaque aussi mais donc alors encore deja entre sous vers chez quand celui celle ceux rien meme autre autres depuis toujours jamais puis voici voila ainsi tres peut doit bien seulement souvent quoi dont parce".split(" "),
);
/** Racines des mots qui portent le sens (4 lettres au moins, hors mots vides), sur les 5 premières lettres. */
export function racinesDe(t: string): string[] {
  return sansAccents(normaliser(t))
    .replace(/\b[ldjmtsnc]'|\bqu'/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m))
    .map((m) => m.slice(0, 5));
}

const texteDit = (segs: readonly SegmentLu[]) => segs.map((s) => s.dit).join(" ");
const corpsParle = (a: Analyse) => segmentsParles(a).filter((s) => s.role === "corps" || s.role === "promesse");

/** C96 : tutoriel pas à pas dans le corps. */
export function c96(e: EntreeControle, a: Analyse, col: Collecte): void {
  const n = tutoriel(texteDit(corpsParle(a)), e.adresse);
  if (n) col.ajouter("C96", `Tutoriel pas à pas (${n} consignes à l'impératif adressées au spectateur) : montrez UN mécanisme à l'indicatif, avec l'outil ou « on » comme sujet.`);
}

const VOUS = /\b(vous|votre|vos)\b/;
const TU = /\b(tu|ton|ta|tes|toi)\b|-tu\b/;

/** Part du texte dit avant laquelle la question au spectateur doit être posée (élément 3 de la recette). */
const QUESTION_AVANT = 0.4;

/** C97 : une question au spectateur (dans l'adresse de la vidéo) hors appel et boucle, dans les premiers 40 % du texte dit, deux au plus. */
export function c97(e: EntreeControle, a: Analyse, col: Collecte): void {
  const hors = segmentsParles(a).filter((s) => s.role !== "appel" && s.role !== "boucle");
  if (!hors.length) return;
  const toutes = phrasesDe(texteDit(hors));
  const total = toutes.reduce((n, p) => n + p.length + 1, 0);
  const adresse = e.adresse === "tu" ? TU : VOUS;
  let avant = 0;
  let premiere: number | null = null;
  for (const p of toutes) {
    if (p.trim().endsWith("?") && adresse.test(normaliser(p)) && premiere === null) premiere = avant / total;
    avant += p.length + 1;
  }
  const questions = toutes.filter((p) => p.trim().endsWith("?"));
  if (premiere === null) col.ajouter("C97", "Aucune question posée au spectateur (dans l'adresse de la vidéo, hors appel) : posez-en une.");
  else if (premiere > QUESTION_AVANT) col.ajouter("C97", `La question au spectateur arrive trop tard (à ${Math.round(premiere * 100)} % du texte dit) : avant ${Math.round(QUESTION_AVANT * 100)} %.`);
  else if (questions.length > QUESTIONS_MAX) col.ajouter("C97", `${questions.length} questions : ${QUESTIONS_MAX} au plus.`);
}

/** C98 : la dernière phrase du corps redit l'accroche (anti-pattern A3). Ignoré si la version boucle sur l'accroche. */
export function c98(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.boucle === true) return;
  const accroche = texteDit(a.accroche.filter((s) => s.texte.trim()));
  const derniere = phrasesDe(texteDit(corpsParle(a))).at(-1) ?? "";
  if (!accroche || !derniere) return;
  // Le mot-clé est dit exactement dans l'accroche et le corps (C10, C19) : ses racines ne comptent pas comme une redite.
  const motCle = new Set(racinesDe(e.motCle ?? ""));
  const racinesAccroche = new Set(racinesDe(accroche).filter((r) => !motCle.has(r)));
  const communes = [...new Set(racinesDe(derniere))].filter((r) => racinesAccroche.has(r));
  if (communes.length >= 3) col.ajouter("C98", `La dernière phrase du corps redit l'accroche (« ${derniere} ») : finissez sur la rupture « on s'en occupe pour vous ».`);
}

/** C99 : la rupture « on s'en occupe pour vous » est dite dans le dernier segment du corps ou dans l'appel. */
export function c99(_e: EntreeControle, a: Analyse, col: Collecte): void {
  const corps = corpsParle(a);
  const cherche = [...(corps.length ? [corps[corps.length - 1]] : []), ...segmentsParles(a).filter((s) => s.role === "appel")];
  if (!cherche.length) return;
  if (!cherche.some((s) => ruptureDite(s.dit))) col.ajouter("C99", "Aucune rupture « on s'en occupe pour vous » juste avant l'appel : dites que c'est NOUS qui le mettons en place.");
}
