/**
 * Données de l'écran de fin (lot OUV-FIN), telles que les pose le moteur (`variete/axes/fin.ts`, type `DonneesFinIV`,
 * recopié ici : une composition n'importe jamais `src/moteurs/**`). Un test vérifie que les données du moteur s'y
 * assignent.
 */
import type { ChiffreOuverture, DonneesOuverture } from "../ouverture/donnees";

export type DonneesFin = { phrase: string; heures: number[]; mots: string[]; lignes: number[] } & (
  | { code: "FIN-C"; boucle: DonneesOuverture; deja: ChiffreOuverture | null; heure: { h: number; m: number } | null }
  | { code: "FIN-D"; chiffre: ChiffreOuverture; part: number | null }
);
