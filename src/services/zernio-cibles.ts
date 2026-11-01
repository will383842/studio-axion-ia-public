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
