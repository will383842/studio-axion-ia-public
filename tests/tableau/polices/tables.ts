/** Tables des chasses des polices du tableau animé, recalculées depuis les fichiers de police (génération et vérification). */
import { lireChasses } from "./lire-ttf";

export const FICHIER_MONTSERRAT = "studio-rendu/compositions/commune/polices/Montserrat-ExtraBold.ttf";
export const FICHIER_INTER = "studio-rendu/compositions/commune/polices/Inter-Bold.ttf";
/** Inter Medium : les détails et les mentions du style « reference/3 » (charte Axion, 15/10/2026). */
export const FICHIER_INTER_MEDIUM = "studio-rendu/compositions/commune/polices/Inter-Medium.ttf";

/** Caractères mesurés : ASCII imprimable, espaces insécables, ponctuation et lettres accentuées du français. */
export const CARACTERES_ECRITURE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("") + "  «»…’‘“”–—€°ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜŸàâäæçèéêëîïôœùûüÿ";

export function tableDepuis(fichier: string): { unitesParEm: number; largeurs: number[] } {
  const p = lireChasses(fichier);
  const n = p.chasse("n")!;
  const espace = p.chasse(" ")!;
  return { unitesParEm: p.unitesParEm, largeurs: Array.from(CARACTERES_ECRITURE).map((c) => p.chasse(c) ?? (c === " " || c === " " ? espace : n)) };
}
