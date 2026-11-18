/**
 * À TRAITER (L5-13) · onglets par réseau. Module PUR : aucun import serveur, utilisable dans l'écran comme dans les tests.
 * « Tous » montre tout (YouTube compris) ; chaque autre onglet ne montre que son réseau.
 */
import type { CarteATraiter, ReseauATraiter } from "./a-traiter-types";

export type OngletATraiter = "tous" | "linkedin" | "instagram" | "facebook" | "tiktok";

export const ONGLETS_A_TRAITER: readonly { id: OngletATraiter; libelle: string }[] = [
  { id: "tous", libelle: "Tous" },
  { id: "linkedin", libelle: "LinkedIn" },
  { id: "instagram", libelle: "Instagram" },
  { id: "facebook", libelle: "Facebook" },
  { id: "tiktok", libelle: "TikTok" },
];

export const LIBELLE_RESEAU_A_TRAITER: Record<ReseauATraiter, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** Carte déjà traitée, forme réduite et en lecture seule : aucune donnée de personne, aucun identifiant de compte. */
export interface CarteDejaTraitee {
  idEvenement: string;
  reseau: ReseauATraiter;
  extrait: string;
  creeLe: string;
  statut: "fait" | "ignore";
}

type AvecReseau = Pick<CarteATraiter, "reseau">;

export function filtrerParOnglet<T extends AvecReseau>(cartes: readonly T[], onglet: OngletATraiter): T[] {
  return onglet === "tous" ? [...cartes] : cartes.filter((c) => c.reseau === onglet);
}

export function compterParOnglet(cartes: readonly AvecReseau[]): Record<OngletATraiter, number> {
  const n: Record<OngletATraiter, number> = { tous: cartes.length, linkedin: 0, instagram: 0, facebook: 0, tiktok: 0 };
  for (const c of cartes) if (c.reseau !== "youtube") n[c.reseau] += 1;
  return n;
}
