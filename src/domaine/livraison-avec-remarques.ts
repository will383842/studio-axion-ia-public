/**
 * « Prête, avec remarques » (S-13-a-v20j). Module pur, SANS importeur : rien ne l'utilise encore, aucune vidéo ne change.
 *
 * Décision n° 8 de Williams : une vidéo faite mais refusée par un contrôle sort « prête, avec remarques », SAUF pour une
 * liste FERMÉE de défauts graves (`RESTE_BLOQUANT`) ; décision n° 9 : la variété devient une remarque, plus un refus.
 *
 * Choix : AUCUN statut neuf. « Prête avec remarques » est un état LU : `statut: "prete"` + au moins une alerte
 * `gravite: "bloquant"` dont le message commence par `PREFIXE_REMARQUE_LIVRAISON`.
 */
import type { AlerteQualite, NoteQualite, Video } from "@/domaine/types";

/** Ce qui reste bloquant : les 8 premiers = décision n° 8 ; le 9e = A3 T17. Liste fermée. */
export const RESTE_BLOQUANT = Object.freeze([
  Object.freeze({ code: "mot-dit-faux", libelle: "Un mot dit n'est pas celui du texte validé" }),
  Object.freeze({ code: "chiffre-faux", libelle: "Un chiffre affiché ou dit est faux" }),
  Object.freeze({ code: "mot-interdit", libelle: "Un mot interdit apparaît" }),
  Object.freeze({ code: "voix-ou-accord", libelle: "La voix ou l'accord de la vidéo ne convient pas" }),
  Object.freeze({ code: "regles-h1-h2", libelle: "Une règle de fer du texte n'est pas respectée" }),
  Object.freeze({ code: "duree-plus-180-s", libelle: "La vidéo dure plus de 3 minutes" }),
  Object.freeze({ code: "phrase-non-choisie", libelle: "Une phrase non choisie est visible à l'image" }),
  Object.freeze({ code: "fin-absente", libelle: "L'écran de fin est absent à l'image" }),
  Object.freeze({ code: "image-noire-au-debut", libelle: "L'image est noire au début de la vidéo" }),
] as const);

export type CodeResteBloquant = (typeof RESTE_BLOQUANT)[number]["code"];

export function estResteBloquant(code: string): code is CodeResteBloquant {
  return RESTE_BLOQUANT.some((e) => e.code === code);
}

/** Début fixe du message d'une alerte de remarque de livraison. */
export const PREFIXE_REMARQUE_LIVRAISON = "Remarque de livraison · ";

/** Alerte « bloquante » qui, sur une vidéo prête, se lit comme une remarque (point final de la raison retiré). */
export function alerteRemarque(libelle: string, raison: string, code: AlerteQualite["code"] = "defaut-visuel"): AlerteQualite {
  return { code, gravite: "bloquant", message: `${PREFIXE_REMARQUE_LIVRAISON}${libelle} : ${raison.replace(/\.\s*$/, "")}` };
}

/** Les remarques de livraison d'une note, dans l'ordre ; aucune si la note est absente. */
export function remarquesDeLivraison(note: Pick<NoteQualite, "alertes"> | undefined): AlerteQualite[] {
  return (note?.alertes ?? []).filter((a) => a.gravite === "bloquant" && a.message.startsWith(PREFIXE_REMARQUE_LIVRAISON));
}

/** Vrai pour une vidéo prête qui porte au moins une remarque de livraison. */
export function estPreteAvecRemarques(v: Pick<Video, "statut" | "noteQualite">): boolean {
  return v.statut === "prete" && remarquesDeLivraison(v.noteQualite).length > 0;
}
