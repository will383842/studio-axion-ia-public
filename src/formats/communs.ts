/** Morceaux partagés par les définitions de formats. PUR. */
import type { BriqueFacultative } from "@/domaine/types";
import type { ChampReglage, DefinitionFormat, EntreeFormat, RecetteScript } from "./types";

/**
 * Toutes les briques facultatives au choix (cas courant). La mention IA est « au choix, COUPÉE par défaut »
 * pour tous les formats (décision de Will du 01/10).
 */
export function briquesAuChoix(sauf: BriqueFacultative[] = []): DefinitionFormat["briques"] {
  const toutes: BriqueFacultative[] = ["sous-titres", "etalonnage", "illustrations", "son", "habillage", "texte-ecran", "mention-ia"];
  return Object.fromEntries(toutes.map((b) => [b, sauf.includes(b) ? "desactivee" : b === "mention-ia" ? "au-choix-coupee" : "au-choix"]));
}

/** Répartition du temps entre l'angle principal et le second (réglage `repartitionAngles`, B.0 §3). */
export const REPARTITIONS_ANGLES: Record<"principal" | "egal" | "un-angle", { principal: number; second: number }> = {
  principal: { principal: 0.85, second: 0.15 },
  egal: { principal: 0.5, second: 0.5 },
  "un-angle": { principal: 1, second: 0 },
};

/** Lit le réglage `repartitionAngles` d'une vidéo ; absent : l'angle principal domine (85 / 15). */
export function repartitionDepuisReglages(reglages: Record<string, unknown>): { principal: number; second: number } {
  const v = reglages.repartitionAngles;
  return typeof v === "string" && v in REPARTITIONS_ANGLES ? REPARTITIONS_ANGLES[v as keyof typeof REPARTITIONS_ANGLES] : REPARTITIONS_ANGLES.principal;
}

export const CRITERES_STANDARD: RecetteScript["criteres"] = [
  { id: "accroche", nom: "Accroche", poids: 3 },
  { id: "clarte", nom: "Clarté", poids: 2 },
  { id: "rythme", nom: "Rythme", poids: 2 },
  { id: "duree", nom: "Durée", poids: 1 },
  { id: "appel", nom: "Appel à l'action", poids: 1 },
];

/** Règles d'écriture communes. Le tu / vous n'y est PAS : il est généré depuis l'adresse de chaque vidéo (B.0 §15). */
export const REGLES_COMMUNES = [
  "Phrases courtes : 12 mots au plus.",
  "Un seul message par vidéo.",
  "Écrire « Axion-IA » avec le tiret.",
];

export const champCarteFinale: ChampReglage = {
  cle: "carteFinale",
  libelle: "Carte de fin avec appel à l'action",
  type: "interrupteur",
};

export function entree(
  cle: EntreeFormat["cle"],
  nom: string,
  aide: string,
  options: Partial<Pick<EntreeFormat, "obligatoire" | "multiple" | "accepte">> = {},
): EntreeFormat {
  return {
    cle,
    nom,
    aide,
    obligatoire: options.obligatoire ?? false,
    multiple: options.multiple ?? true,
    accepte: options.accepte ?? ["image/*", "video/*"],
  };
}

/** Migration neutre : renvoie les réglages tels quels. */
export function migrationIdentite(reglages: Record<string, unknown>): Record<string, unknown> {
  return { ...reglages };
}
