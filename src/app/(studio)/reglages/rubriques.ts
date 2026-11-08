import type { NomIcone } from "@/components/ui/Icone";

/**
 * Les rubriques de la page Réglages, dans l'ordre d'usage (décision de Williams, 08/11) : la rangée de liens en haut et
 * les titres de la page viennent d'ici. « Avancé » est replié. Aucun mot technique dans les libellés.
 */
export type Rubrique = { id: string; libelle: string; icone: NomIcone; replie?: boolean };

export const RUBRIQUES: readonly Rubrique[] = [
  { id: "compte", libelle: "Votre compte", icone: "cadenas" },
  { id: "videos", libelle: "Vidéos et voix", icone: "film" },
  { id: "publication", libelle: "Publication", icone: "megaphone" },
  { id: "services", libelle: "Services reliés", icone: "prise" },
  { id: "avance", libelle: "Avancé", icone: "info", replie: true },
];
