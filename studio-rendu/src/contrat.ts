/**
 * Contrat de `studio-rendu` — COPIE de `src/fournisseurs/types.ts` (OperationRendu, DemandeRendu, EtatRendu)
 * du studio. Ce paquet est construit à part (image Docker sans le studio) : il ne l'importe pas.
 * La concordance des deux copies est vérifiée par un test du studio (`tests/studio-rendu.test.ts`).
 */
/** Une opération par ligne (fusions sans conflit entre lots). */
export type OperationRendu =
  | "nettoyage-audio"
  | "tranches-audio"
  | "analyse-media"
  | "mesure-son"
  | "composition"
  | "image-fixe"
  | "traitement-image"
  | "assemblage"
  | "capture-site"
  | "miniature"
  | "etalonnage"
  | "mixage"
  | "extrait"
  | "visuel-page"
  | "assemblage-pdf"
  | "toile-continue"; // file courte : toile large rendue puis découpée

export interface ErreurFournisseur {
  code: "fichier-inaccessible" | "indisponible" | "refuse" | "quota" | "inconnu";
  reessayable: boolean;
  message: string;
}

export interface DemandeRendu {
  idRendu: string;
  operation: OperationRendu;
  file: "courte" | "longue";
  /** Adresses de lecture signées, par nom d'entrée. */
  entrees: Record<string, string>;
  /** Adresse de dépôt signée et clé de stockage du résultat. */
  sortie: { urlDepot: string; cle: string };
  parametres: Record<string, unknown>;
}

export type EtatRendu =
  | { statut: "en_file"; rang: number }
  | { statut: "en_cours"; progression: number }
  | { statut: "termine"; sortieCle: string; mesures?: Record<string, number> }
  | { statut: "echec"; erreur: ErreurFournisseur }
  | { statut: "inconnu" };

export const OPERATIONS: readonly OperationRendu[] = [
  "nettoyage-audio",
  "tranches-audio",
  "analyse-media",
  "mesure-son",
  "composition",
  "image-fixe",
  "traitement-image",
  "assemblage",
  "capture-site",
  "miniature",
  "etalonnage",
  "mixage",
  "extrait",
  "visuel-page",
  "assemblage-pdf",
  "toile-continue",
];

/** Contexte donné à une opération : progression (0-100) et dossier de travail temporaire. */
export interface ContexteOperation {
  progression(p: number): void;
  dossier: string;
  signal: AbortSignal;
}

export type ResultatOperation = { mesures?: Record<string, number> };

/** Une opération lit ses entrées (adresses signées), produit le fichier et le DÉPOSE elle-même à `sortie.urlDepot`. */
export type Operation = (demande: DemandeRendu, contexte: ContexteOperation) => Promise<ResultatOperation>;

/** Erreur typée d'une opération. */
export class ErreurRendu extends Error {
  constructor(public readonly erreur: ErreurFournisseur) {
    super(erreur.message);
    this.name = "ErreurRendu";
  }
}

/** Validation d'une demande reçue (forme seulement). Renvoie un message d'erreur ou null. */
export function verifierDemande(d: unknown): string | null {
  if (!d || typeof d !== "object") return "demande illisible";
  const x = d as Partial<DemandeRendu>;
  if (typeof x.idRendu !== "string" || !/^[A-Za-z0-9_.:-]{1,120}$/.test(x.idRendu)) return "idRendu invalide";
  if (!x.operation || !OPERATIONS.includes(x.operation)) return "opération inconnue";
  if (x.file !== "courte" && x.file !== "longue") return "file inconnue";
  if (!x.entrees || typeof x.entrees !== "object") return "entrées manquantes";
  for (const v of Object.values(x.entrees)) if (typeof v !== "string" || !/^https?:\/\//.test(v)) return "entrée invalide";
  if (!x.sortie || typeof x.sortie.urlDepot !== "string" || typeof x.sortie.cle !== "string") return "sortie manquante";
  if (!x.parametres || typeof x.parametres !== "object") return "paramètres manquants";
  return null;
}
