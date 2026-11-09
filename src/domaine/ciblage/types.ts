/** Ciblage des scripts : qui est visé (métier, secteur, taille) et quel type d'automatisation. Tout est facultatif ailleurs. */

export type NiveauCible = "metier" | "secteur" | "taille";

export const LONGUEUR_MAX_LIBELLE = 80;

export interface Ciblage {
  niveau: NiveauCible;
  /** Une seule ligne, 80 caractères au plus. */
  libelle: string;
  origine: "saisie" | "deduite";
}

export type TailleId = "TPE" | "PME" | "ETI";

export const TAILLES: readonly { id: TailleId; libelle: string; effectif: string }[] = [
  { id: "TPE", libelle: "TPE (moins de 10 salariés)", effectif: "moins de 10 salariés" },
  { id: "PME", libelle: "PME (10 à 249 salariés)", effectif: "10 à 249 salariés" },
  { id: "ETI", libelle: "ETI (250 à 4 999 salariés)", effectif: "250 à 4 999 salariés" },
];

export const TYPES_AUTOMATISATION = [
  { id: "devis-factures", libelle: "Devis et factures" },
  { id: "relances-impayes", libelle: "Relances clients et impayés" },
  { id: "emails-messages", libelle: "E-mails et messages" },
  { id: "comptes-rendus", libelle: "Comptes rendus et notes de réunion" },
  { id: "rendez-vous-planning", libelle: "Rendez-vous et planning" },
  { id: "recrutement", libelle: "Recrutement et candidatures" },
  { id: "suivi-commercial", libelle: "Suivi commercial et prospects" },
  { id: "documents-signatures", libelle: "Documents administratifs et signatures" },
  { id: "publication-contenu", libelle: "Publication de contenu" },
  { id: "donnees-ia-sure", libelle: "Données protégées et IA sûre" },
  { id: "former-equipes", libelle: "Former les équipes à l'IA" },
  { id: "trouver-quoi-automatiser", libelle: "Trouver quoi automatiser" },
] as const;

/** Absence de type = « À classer » (ce n'est pas un 13e type). */
export type TypeAutomatisation = (typeof TYPES_AUTOMATISATION)[number]["id"];

export interface MarqueAncien {
  depuis: string;
  raison: "avant-ciblage" | "hors-sujet";
}
