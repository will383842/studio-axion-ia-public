/**
 * REGISTRE DES LECTEURS DE CRÉDIT (lot « crédits », 02/10, D2 ; consigne `CREDITS-ET-CLES.md` §0 et §6).
 * Un lecteur par fournisseur PAYANT, l'identifiant étant celui de `LigneCout.fournisseur` (« heygen », « fal »…).
 * Une clé par service ET par usage, rangée UNIQUEMENT dans les variables d'environnement du service studio
 * (nommée `studio-video-prod` chez le fournisseur) : jamais en base, jamais renvoyée au navigateur, jamais journalisée.
 */
import { idFournisseur } from "@/domaine/credits";
import { SOURCES_ABONNEMENT, VARIABLE_CLE_CLAUDE_1, VARIABLE_CLE_CLAUDE_2, VARIABLE_CLE_CLAUDE_3, VARIABLE_CLE_CLAUDE_PAYANTE } from "@/domaine/source-claude";
import type { LecteurCredit } from "../types";
import { cleDans, type Env, type Fetch } from "./commun";
import { creerLecteurElevenLabs } from "./elevenlabs";
import { creerLecteurHeygen } from "./heygen";
import { creerLecteurAnthropic, creerLecteurFal } from "./suivis";

export { ErreurLecture } from "./commun";

/** Ordre d'affichage (Réglages > Crédits, Connexions). */
export const FOURNISSEURS_PAYANTS = ["heygen", "elevenlabs", "fal", "anthropic"] as const;

export function lecteursCredits(env: Env = process.env, appeler?: Fetch): LecteurCredit[] {
  return [creerLecteurHeygen(env, appeler), creerLecteurElevenLabs(env, appeler), creerLecteurFal(env, appeler), creerLecteurAnthropic(env, appeler)];
}

export function lecteurCredit(fournisseur: string, env: Env = process.env, appeler?: Fetch): LecteurCredit | undefined {
  const id = idFournisseur(fournisseur);
  return lecteursCredits(env, appeler).find((l) => l.fournisseur === id);
}

/** La clé de ce lecteur est-elle présente sur le serveur ? (jamais la clé elle-même) */
export function clePresente(l: Pick<LecteurCredit, "variableCle">, env: Env = process.env): boolean {
  // Claude : l'une des trois clés d'abonnement OU la clé payante suffit (sinon, avec le seul compte 2 ou 3, ou la seule API payante
  // choisie par Will, aucune réservation ne couvre le plafond du mois). Le CHOIX de la source reste dans `choisirSource`.
  if (l.variableCle === VARIABLE_CLE_CLAUDE_1) return [...SOURCES_ABONNEMENT.map((s) => s.variable), VARIABLE_CLE_CLAUDE_PAYANTE].some((v) => !!cleDans(env, v));
  return !!cleDans(env, l.variableCle);
}

/** Les clés connues (pour les masquer dans un texte) : utilisé seulement côté serveur, jamais renvoyé. */
export function clesConnues(env: Env = process.env): string[] {
  const lecteurs = lecteursCredits(env).map((l) => cleDans(env, l.variableCle));
  // Comptes Claude 2 et 3 et API payante : jamais lus ici pour un appel, seulement masqués.
  const autresClaude = [VARIABLE_CLE_CLAUDE_2, VARIABLE_CLE_CLAUDE_3, VARIABLE_CLE_CLAUDE_PAYANTE].map((v) => cleDans(env, v));
  return [...lecteurs, ...autresClaude].filter((c): c is string => !!c);
}
