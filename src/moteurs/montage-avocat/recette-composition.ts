/**
 * RECETTE DE COMPOSITION DU FORMAT AVOCAT — tout ce que le moteur avocat dit à la brique commune « composition »
 * (`@/briques/composition`). La mise en image elle-même (décor, double, recadrage, micro, illustrations,
 * incrustations, couleurs, passe FFmpeg) n'est plus écrite ici : elle est commune à tous les formats.
 *
 * Restent propres à l'avocat : cette recette, le RYTHME et les CADRAGES (`decoupage.ts`, `RECETTE_MONTAGE_AVOCAT`),
 * le TITRE d'ouverture (`ENCADRE_OUVERTURE_AVOCAT`), la voix et son nettoyage (`nettoyage.ts`, `report.ts`) et les
 * règles du format (`formats/avocat`). Valeurs réglées sur les captures des lots M4 et M4b.
 */
import { TAILLE_SOUS_TITRES_REFERENCE_PX, type DecorScene, type GeometrieIncrustations, type RecetteComposition, type ReductionLarge } from "@/briques/composition";
import { ENCADRE_OUVERTURE_AVOCAT, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";

/** Décor de repli (aucun décor choisi, ou Look réaliste encore simulé) : N1, noir brun et lueur orange. */
export const DECOR_REPLI_AVOCAT: DecorScene = { teinte: "#110A05", teinteLumiere: "#C65A2E", directionLumiere: "face", flouPx: 0, clair: false };

/** Plan « large » hors 9:16 : 4:5 ≈ 85 %, 1:1 ≈ 72 % de la hauteur (B.7, réglé sur capture au lot M4). */
export const REDUCTION_LARGE_AVOCAT: ReductionLarge = { "9:16": 1, "4:5": 0.85, "1:1": 0.72 };
/** Bande de 52 % jusqu'à la limite basse de la zone protégée, montant 118 px, objet à 35 % de la largeur (B.2). */
export const GEOMETRIE_INCRUSTATIONS_AVOCAT: GeometrieIncrustations = { hautPct: 52, montantTaillePx: 118, objetLargeurPct: 35, dureeMinSec: 0.4 };

export const RECETTE_COMPOSITION_AVOCAT: RecetteComposition = {
  id: "avocat",
  angles: { principal: RECETTE_MONTAGE_AVOCAT.angles.principal, second: RECETTE_MONTAGE_AVOCAT.angles.second },
  encadreParDefaut: ENCADRE_OUVERTURE_AVOCAT,
  decorRepli: DECOR_REPLI_AVOCAT,
  nomDecorRepli: "Halo orange",
  // Correcteur réel 2 : vraie fin, l'image et le son s'éteignent (sauf option « fin en boucle »).
  fonduFinMaxSec: 1,
  // Plan « large » hors 9:16 : 4:5 ≈ 85 %, 1:1 ≈ 72 % de la hauteur (B.7, réglé sur capture au lot M4).
  reductionLarge: REDUCTION_LARGE_AVOCAT,
  // 4:5 et 1:1 : le double, réduit et ancré en bas, a le visage plus haut dans l'image ; à 48 %, la ligne tomberait
  // sur le visage. Elle descend sur la poitrine (réglé sur les captures du lot M4).
  centreSousTitres: { "9:16": 48, "4:5": 57, "1:1": 61 },
  tailleSousTitresPx: TAILLE_SOUS_TITRES_REFERENCE_PX,
  // Bande de 52 % jusqu'à la limite basse de la zone protégée, montant 118 px, objet à 35 % de la largeur (B.2).
  incrustations: GEOMETRIE_INCRUSTATIONS_AVOCAT,
  // Grain 4 % de 2 px (la recompression ne l'efface pas), vignette 8 %, si le profil de réalisme n'en dit rien.
  realisme: { grainPct: 4, grainTaillePx: 2, vignettePct: 8 },
  lutIntensiteParDefaut: 70,
};
