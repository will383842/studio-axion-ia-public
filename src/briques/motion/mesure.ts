/**
 * MESURE DU TEXTE DES CARTES (brique `motion`) : largeur réelle des mots d'après la chasse lue dans les fichiers de
 * Poppins (`briques/sous-titres/metriques.ts`, généré), coupure en lignes comme le rendu, hauteur du bloc. Sert à
 * placer les éléments sans chevauchement, à réduire un titre qui ne tient pas et au contrôle « texte qui déborde ».
 * PUR, sans alias « @/ » : importable par Remotion.
 */
import { largeurMot } from "../sous-titres/mesure";
import { APPROCHE_EM, INTERLIGNE, type NiveauTexte } from "./jetons";

/** Marge de sécurité : SemiBold et Black sont un peu plus larges que les Medium et ExtraBold mesurés. */
const MARGE_GRAISSE = 1.04;
/** Espace entre les mots de la typographie cinétique (em). */
export const ESPACE_MOTS_EM = 0.27;

/** Le texte sans le balisage `*mot*` (mot en orange). */
export const sansBalises = (texte: string) => texte.replace(/\*/g, "");

/** Largeur (px) d'un mot à une taille et une graisse données, approche comprise. */
export function largeurMotMotion(mot: string, taillePx: number, graisse: number, approcheEm = 0): number {
  const police = graisse >= 700 ? "Poppins ExtraBold" : "Poppins Medium";
  return largeurMot(mot, police, taillePx) * MARGE_GRAISSE + Array.from(mot).length * approcheEm * taillePx;
}

/** Lignes du texte coupé comme le rendu (mot entier, jamais coupé au milieu). */
export function couperLignes(texte: string, taillePx: number, graisse: number, largeurMax: number, approcheEm = 0): string[][] {
  const mots = sansBalises(texte).split(/\s+/).filter(Boolean);
  const espace = ESPACE_MOTS_EM * taillePx;
  const lignes: string[][] = [];
  let courante: string[] = [];
  let largeur = 0;
  for (const m of mots) {
    const l = largeurMotMotion(m, taillePx, graisse, approcheEm);
    if (courante.length && largeur + espace + l > largeurMax) {
      lignes.push(courante);
      courante = [m];
      largeur = l;
    } else {
      largeur += (courante.length ? espace : 0) + l;
      courante.push(m);
    }
  }
  if (courante.length) lignes.push(courante);
  return lignes;
}

/** Hauteur (px) d'un bloc de texte d'un niveau de la charte. */
export function hauteurTexte(texte: string, niveau: NiveauTexte, taillePx: number, graisse: number, largeurMax: number): number {
  const n = Math.max(1, couperLignes(texte, taillePx, graisse, largeurMax, APPROCHE_EM[niveau]).length);
  return n * taillePx * INTERLIGNE[niveau] + (n - 1) * taillePx * 0.04;
}

/** Taille ramenée pour que le mot le plus long tienne sur une ligne (jamais agrandie, jamais sous `plancher`). */
export function tailleQuiTient(texte: string, taillePx: number, graisse: number, largeurMax: number, plancher = 0, approcheEm = 0): number {
  const plusLong = Math.max(0, ...sansBalises(texte).split(/\s+/).map((m) => largeurMotMotion(m, taillePx, graisse, approcheEm)));
  if (plusLong <= largeurMax) return taillePx;
  return Math.max(plancher, Math.floor((taillePx * largeurMax) / plusLong));
}

/** Plus grande largeur de ligne (px) une fois coupé (contrôle du débordement). */
export function largeurBloc(texte: string, taillePx: number, graisse: number, largeurMax: number, approcheEm = 0): number {
  const espace = ESPACE_MOTS_EM * taillePx;
  return Math.max(0, ...couperLignes(texte, taillePx, graisse, largeurMax, approcheEm).map((l) => l.reduce((s, m) => s + largeurMotMotion(m, taillePx, graisse, approcheEm), 0) + espace * (l.length - 1)));
}
