/** Registre des sons existants — types. PUR, sans alias « @/ ». Aucun lien avec `DeclencheurBruitage` (`src/domaine/types.ts`). */
export interface EntreeSon {
  id: string;
  banque: "studio" | "interface-claire" | "v4-lot5";
  chemin: string;
  famille: string;
  dureeSec: number;
  droitId: string;
  ecoute: "porte-en-base" | "valide-par-decision";
  decision?: string;
  posablePar: ("*" | "facecam-animee-v4" | "tableau" | "effet-vitre")[];
}
