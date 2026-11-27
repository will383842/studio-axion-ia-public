/**
 * CIBLES DE PUBLICATION ZERNIO (z2e, D9) : où part un envoi, jamais une page par défaut.
 * Cibles du Studio : « accountId », « accountId:fb:<pageId> », « accountId:li:<n°> », « accountId:li:profil » (profil seulement
 * s'il est prouvé : le fournisseur ne le liste que dans ce cas). Ces identifiants vivent en base sur le serveur, jamais dans le dépôt.
 * Facebook et LinkedIn : la cible est TOUJOURS explicite (choisie parmi celles que le fournisseur liste).
 * Fonction sans effet de bord : elle lit la liste des comptes que le fournisseur rend, rien d'autre.
 */
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import type { IdReseau } from "@/domaine/types";
import { pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import { estCompteParDefaut } from "@/domaine/plan-editorial/compte-par-defaut";
import { journaliserEnvoi } from "./journal-envoi";

export type CiblesZernio = { ok: true; canaux: CanalPublication[] } | { ok: false; code: "CIBLE_ABSENTE" | "CIBLE_INCONNUE" | "CIBLE_AMBIGUE"; message: string };

/** Réseaux dont la cible doit être choisie à la main : plusieurs pages ou profils sous un même compte. */
export const CIBLE_EXPLICITE: readonly string[] = ["facebook", "linkedin", "pinterest"];

export async function ciblesZernioPour(service: FournisseurPublication, reseau: IdReseau, choisies?: string[]): Promise<CiblesZernio> {
  const c = await ciblesZernioPourInterne(service, reseau, choisies);
  // Trace sans nom ni identifiant de compte : le code du refus, ou « OK » et le nombre de comptes ciblés.
  journaliserEnvoi({ action: "ciblesZernioPour", outil: "zernio", reseau, code: c.ok ? "OK" : c.code, nbComptes: c.ok ? c.canaux.length : 0 });
  return c;
}

async function ciblesZernioPourInterne(service: FournisseurPublication, reseau: IdReseau, choisies?: string[]): Promise<CiblesZernio> {
  if (!service.listerCanaux) return { ok: false, code: "CIBLE_ABSENTE", message: "L'outil de publication ne donne pas la liste de ses comptes : l'envoi est refusé." };
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte && !canalInterdit(c));
  // Le marqueur « compte-studio » n'est jamais une cible choisie : il retombe sur la règle « rien de choisi ».
  const demandees = [...new Set((choisies ?? []).filter((c) => typeof c === "string" && c.trim() && !estCompteParDefaut(c)))];
  if (demandees.length) {
    // Traduction ambiguë (deux comptes de Zernio portent le nom choisi) : le refus nomme les choix, jamais un tirage au sort.
    const ambigu = demandees.find((id) => id.startsWith(`${SELECTION_NON_TRADUITE}|`));
    if (ambigu) return { ok: false, code: "CIBLE_AMBIGUE", message: ambigu.slice(SELECTION_NON_TRADUITE.length + 1) };
    const inconnues = demandees.filter((id) => !disponibles.some((c) => c.id === id));
    if (inconnues.length) return { ok: false, code: "CIBLE_INCONNUE", message: "Ce compte n'est plus relié à Zernio : recochez-le dans la liste des comptes. Rien n'est parti, rien n'a été supprimé." };
    return { ok: true, canaux: demandees.map((id) => disponibles.find((c) => c.id === id)!) };
  }
  // LinkedIn, rien de choisi : l'ORGANISATION seulement, et seulement s'il n'y en a qu'une. Jamais le profil personnel sans choix explicite.
  if (plateforme === "linkedin") {
    const organisations = disponibles.filter((c) => c.genre === "page");
    if (organisations.length === 1) return { ok: true, canaux: organisations };
  }
  // Rien de choisi : jamais pour Facebook ni Pinterest (aucune page ni aucun tableau par défaut) ; ailleurs, seulement s'il n'y a qu'un compte.
  if (CIBLE_EXPLICITE.includes(plateforme)) {
    const noms = disponibles.map((c) => `« ${c.nom} »`);
    const pinterest = plateforme === "pinterest";
    const aCocher = noms.length ? ` ${pinterest ? "Pages, profils ou tableaux" : "Pages ou profils"} reliés à Zernio : ${noms.join(", ")}.` : "";
    const quoi = pinterest ? "la page, le profil ou le tableau" : "la page ou le profil";
    return { ok: false, code: "CIBLE_ABSENTE", message: `Cochez ${quoi} de destination (liste des comptes de la page) : aucune cible par défaut n'est utilisée.${aCocher}` };
  }
  if (disponibles.length === 1) return { ok: true, canaux: disponibles };
  if (!disponibles.length) return { ok: false, code: "CIBLE_ABSENTE", message: "Aucun compte relié à l'outil de publication pour ce réseau." };
  return { ok: false, code: "CIBLE_AMBIGUE", message: "Plusieurs comptes sont reliés pour ce réseau : choisissez-en un." };
}

/** Marqueur d'une présélection qui n'est pas dans la liste actuelle de Zernio : jamais un identifiant de Zernio, donc refusé net (CIBLE_INCONNUE). Valeur interne, jamais stockée. */
export const SELECTION_NON_TRADUITE = "selection-non-traduite";

/** Identifiant de page d'un canal Facebook (« compte:fb:page »). */
const idPageDe = (c: CanalPublication) => (c.id.includes(":fb:") ? c.id.split(":fb:")[1] : undefined);

/** Page Facebook de la liste des pages jamais ciblées (identifiant de page ET nom normalisé). */
const canalInterdit = (c: CanalPublication) => c.service === "facebook" && pageInterdite(idPageDe(c), c.nom);

/**
 * Présélection de l'écran → cibles de ZERNIO, sans jamais deviner un compte.
 * Seul un identifiant présent dans la liste ACTUELLE de Zernio (ni déconnecté ni interdit) passe, tel quel. Aucune traduction par le nom.
 * - rien de coché : `undefined` (le choix habituel de Zernio s'applique : le seul compte, sinon refus clair) ;
 * - tous les identifiants sont dans la liste : ces identifiants, sans doublon ;
 * - au moins un absent (seul ou avec d'autres) : le marqueur, donc refus (« recochez-le »), rien ne part et rien n'est effacé.
 * Le dernier paramètre (ancienne liste mémorisée) est conservé pour les appelants et n'est JAMAIS lu ni modifié.
 * Fonction sans effet de bord : elle lit la liste des comptes de Zernio, rien d'autre.
 */
export async function traduireSelectionVersZernio(service: FournisseurPublication, reseau: IdReseau, choisis: string[] | undefined, _ancienneListe: CanalPublication[]): Promise<string[] | undefined> {
  const ids = [...new Set((choisis ?? []).filter((c) => typeof c === "string" && c.trim()))];
  if (!ids.length) return undefined;
  if (!service.listerCanaux) return [SELECTION_NON_TRADUITE];
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte && !canalInterdit(c));
  if (ids.some((id) => !disponibles.some((c) => c.id === id))) return [SELECTION_NON_TRADUITE];
  return ids;
}
