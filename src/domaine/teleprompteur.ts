/**
 * EXPORT TÉLÉPROMPTEUR (18/10) — PUR : client et serveur.
 *
 * Le texte à lire de la face caméra, mis en forme pour un téléprompteur : texte dit seul (aucune étiquette
 * accroche / corps / appel), paragraphes courts, pause marquée entre les blocs ; nom du fichier .txt ; lien et
 * défilement de la page « Lecture » (iPad / Safari). Aucune dépendance.
 */
import type { BlocScript } from "./types";

export const LIBELLE_COPIER = "Copier le texte";
export const LIBELLE_TELECHARGER = "Télécharger en .txt";
export const LIBELLE_LECTURE = "Lire sur l'iPad";

/** Marque de pause entre deux blocs (sur sa propre ligne). */
export const PAUSE = "[pause]";
/** Phrases au plus par paragraphe. */
const PHRASES_PAR_PARAGRAPHE = 2;

function phrasesDuBloc(bloc: BlocScript): string[] {
  return bloc.segments
    .map((s) => s.texte.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);
}

/** Texte dit seul : paragraphes courts séparés d'une ligne vide, `[pause]` entre les blocs. Vide s'il n'y a rien à dire. */
export function texteTeleprompteur(blocs: BlocScript[]): string {
  const parBloc = blocs.map((b) => {
    const phrases = phrasesDuBloc(b);
    const paragraphes: string[] = [];
    for (let i = 0; i < phrases.length; i += PHRASES_PAR_PARAGRAPHE) paragraphes.push(phrases.slice(i, i + PHRASES_PAR_PARAGRAPHE).join(" "));
    return paragraphes.join("\n\n");
  });
  return parBloc.filter(Boolean).join(`\n\n${PAUSE}\n\n`);
}

/** Nom du fichier à télécharger : sans accents ni signes, en minuscules, `.txt`. */
export function nomFichierTxt(titre: string): string {
  const base = titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "texte-a-lire"}.txt`;
}

/** Lien de la page Lecture : le texte voyage dans le fragment (jamais envoyé au serveur). */
export function lienLecture(texte: string, titre = ""): string {
  return `/lecture#t=${encodeURIComponent(texte)}&n=${encodeURIComponent(titre)}`;
}

/** Relit le fragment d'un lien de lecture ; un lien abîmé donne un texte vide, jamais une erreur. */
export function texteDepuisLien(fragment: string): { texte: string; titre: string } {
  const p = new URLSearchParams(fragment.replace(/^#/, ""));
  return { texte: p.get("t") ?? "", titre: p.get("n") ?? "" };
}

export const VITESSE_MIN = 1;
export const VITESSE_MAX = 10;
export const VITESSE_DEFAUT = 5;

/** Vitesse de défilement : entier de 1 à 10 (5 si illisible). */
export function vitesseBornee(v: number): number {
  if (!Number.isFinite(v)) return VITESSE_DEFAUT;
  return Math.min(VITESSE_MAX, Math.max(VITESSE_MIN, Math.round(v)));
}

/** Pixels dont le texte avance pendant `dtMs` à cette vitesse (14 px/s par cran). 0 en pause. */
export function defilementPx(vitesse: number, dtMs: number): number {
  if (!(dtMs > 0)) return 0;
  return (vitesseBornee(vitesse) * 14 * dtMs) / 1000;
}

/** Où va « Fermer » sur la page de lecture : en arrière s'il y a d'où l'on vient, sinon à l'assistant face caméra. */
export const LIEN_FERMETURE_LECTURE = "/nouvelle/facecam";
export function fermetureLecture(longueurHistorique: number): "retour" | "assistant" {
  return longueurHistorique > 1 ? "retour" : "assistant";
}
