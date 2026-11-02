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

export type CiblesZernio = { ok: true; canaux: CanalPublication[] } | { ok: false; code: "CIBLE_ABSENTE" | "CIBLE_INCONNUE" | "CIBLE_AMBIGUE"; message: string };

/** Réseaux dont la cible doit être choisie à la main : plusieurs pages ou profils sous un même compte. */
const CIBLE_EXPLICITE: readonly string[] = ["facebook", "linkedin"];

export async function ciblesZernioPour(service: FournisseurPublication, reseau: IdReseau, choisies?: string[]): Promise<CiblesZernio> {
  if (!service.listerCanaux) return { ok: false, code: "CIBLE_ABSENTE", message: "L'outil de publication ne donne pas la liste de ses comptes : l'envoi est refusé." };
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte);
  const demandees = [...new Set((choisies ?? []).filter((c) => typeof c === "string" && c.trim()))];
  if (demandees.length) {
    const inconnues = demandees.filter((id) => !disponibles.some((c) => c.id === id));
    if (inconnues.length) return { ok: false, code: "CIBLE_INCONNUE", message: "Le compte choisi n'est pas relié à l'outil de publication pour ce réseau." };
    return { ok: true, canaux: demandees.map((id) => disponibles.find((c) => c.id === id)!) };
  }
  // Rien de choisi : jamais pour Facebook ni LinkedIn (aucune page par défaut) ; ailleurs, seulement s'il n'y a qu'un compte.
  if (CIBLE_EXPLICITE.includes(plateforme)) return { ok: false, code: "CIBLE_ABSENTE", message: "Choisissez la page ou le profil de destination : aucune cible par défaut n'est utilisée." };
  if (disponibles.length === 1) return { ok: true, canaux: disponibles };
  if (!disponibles.length) return { ok: false, code: "CIBLE_ABSENTE", message: "Aucun compte relié à l'outil de publication pour ce réseau." };
  return { ok: false, code: "CIBLE_AMBIGUE", message: "Plusieurs comptes sont reliés pour ce réseau : choisissez-en un." };
}

/** Marqueur d'une présélection qui ne se traduit pas : jamais un identifiant de Zernio, donc refusé net (CIBLE_INCONNUE). */
export const SELECTION_NON_TRADUITE = "selection-buffer-non-traduite";

const normaliserNom = (nom: string) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Présélection de l'écran (identifiants de canaux BUFFER) → cibles de ZERNIO, par le service et le nom du compte.
 * Aucun identifiant ne passe d'un outil à l'autre : un compte Buffer sans homologue de même nom n'est jamais deviné.
 * - rien de présélectionné : `undefined` (le choix habituel de Zernio s'applique : le seul compte, sinon refus clair) ;
 * - un seul compte présélectionné sans homologue : `undefined` aussi (Zernio retombe sur son seul compte du réseau, ou refuse s'ils sont plusieurs) ;
 * - plusieurs comptes dont un sans homologue : le marqueur, donc refus (rien ne part sur un autre compte que ceux choisis).
 * Fonction sans effet de bord : elle lit la liste des comptes de Zernio, rien d'autre.
 */
export async function traduireSelectionVersZernio(service: FournisseurPublication, reseau: IdReseau, choisisBuffer: string[] | undefined, canauxBuffer: CanalPublication[]): Promise<string[] | undefined> {
  const ids = [...new Set((choisisBuffer ?? []).filter((c) => typeof c === "string" && c.trim()))];
  if (!ids.length) return undefined;
  if (!service.listerCanaux) return [SELECTION_NON_TRADUITE];
  const plateforme = plateformeZernio(reseau);
  const disponibles = (await service.listerCanaux()).filter((c) => c.service === plateforme && !c.deconnecte);
  const traduits: string[] = [];
  let sansHomologue = 0;
  for (const id of ids) {
    const source = canauxBuffer.find((c) => c.id === id);
    const homologue = source ? disponibles.filter((c) => normaliserNom(c.nom) === normaliserNom(source.nom)) : [];
    if (homologue.length === 1) traduits.push(homologue[0].id);
    else sansHomologue++;
  }
  if (!sansHomologue) return [...new Set(traduits)];
  if (ids.length === 1) return undefined;
  return [SELECTION_NON_TRADUITE];
}
