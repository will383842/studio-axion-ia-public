// Clés de parcours « une conversation par (personne, cible) » : fonctions PURES (aucun réseau, aucune base, aucun journal).
// Une clé = `racine` (empreinte de la personne) ou `racine|empreinte-courte`. Une clé SANS `|` est un enregistrement ANCIEN :
// mot absent = GUIDE, nature absente = premier. Rien n'appelle encore ce module.
import type { Conversation } from "./machine-conversation";

export interface EntreeDossier {
  cle: string;
  etat: Conversation;
}

/** Ce qui précède le premier `|` (la clé entière si elle n'en contient pas). */
export function racineDe(cle: string): string {
  const i = cle.indexOf("|");
  return i === -1 ? cle : cle.slice(0, i);
}

/** Clé d'un parcours : racine + 32 premiers caractères de la clé d'idempotence du guide. */
export function cleParcours(
  racine: string,
  cleIdempotenceGuide: string,
): string {
  return `${racine}|${cleIdempotenceGuide.slice(0, 32)}`;
}

/** Toutes les racines présentes (sans doublon, ordre d'apparition). */
export function racinesConnues(
  conv: Readonly<Record<string, Conversation>>,
): string[] {
  return [...new Set(Object.keys(conv).map(racineDe))];
}

/** Dossier d'une personne : les enregistrements dont la clé vaut la racine ou commence par `racine|`. */
export function dossierDe(
  racine: string,
  conv: Readonly<Record<string, Conversation>>,
): EntreeDossier[] {
  return Object.keys(conv)
    .filter((cle) => cle === racine || cle.startsWith(`${racine}|`))
    .map((cle) => ({ cle, etat: conv[cle] }));
}

/** Alias de la personne : ceux de l'enregistrement ANCIEN (clé = racine) + les entrées de la table d'alias qui pointent vers la racine. */
export function aliasDe(
  racine: string,
  conv: Readonly<Record<string, Conversation>>,
  alias: Readonly<Record<string, string>>,
): string[] {
  const ancien = Object.prototype.hasOwnProperty.call(conv, racine)
    ? (conv[racine].alias ?? [])
    : [];
  const table = Object.keys(alias).filter((a) => alias[a] === racine);
  return [...new Set([...ancien, ...table])];
}
