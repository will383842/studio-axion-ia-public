/**
 * PAGES FACEBOOK JAMAIS CIBLÉES (FIX-DOUBLON). Une page de cette liste n'est ni proposée, ni choisie par défaut, ni gardée
 * « parce qu'il n'en reste qu'une » : le Studio la retire des canaux et le corps d'envoi la refuse.
 * Deux clés : l'identifiant de la page, et l'empreinte SHA-256 du nom normalisé (minuscules, sans accents, espaces simples).
 * Le dépôt est public : le nom n'y figure pas en clair, seulement son empreinte.
 */
import { createHash } from "node:crypto";

export interface PagesInterdites {
  ids: readonly string[];
  empreintesNom: readonly string[];
}

export const PAGES_FACEBOOK_INTERDITES: PagesInterdites = {
  // Identifiant de la page : à compléter si Will le communique (le nom suffit déjà par son empreinte).
  ids: [],
  empreintesNom: ["c04e28d36b3737b8032499fe8ec367028d20aa63e10427288c44869e3aa1250d"],
};

export const normaliserNomPage = (nom: string) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
export const empreinteNomPage = (nom: string) => createHash("sha256").update(normaliserNomPage(nom)).digest("hex");

export function pageInterdite(idPage: string | undefined, nom: string | undefined, liste: PagesInterdites = PAGES_FACEBOOK_INTERDITES): boolean {
  if (idPage && liste.ids.includes(idPage)) return true;
  return !!nom && liste.empreintesNom.includes(empreinteNomPage(nom));
}
