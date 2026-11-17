/**
 * PLANCHE « ÉCRANS » (C9-40a) : une case par exemple des pièces écran fusionnées (fenêtre, terminal, réglages, grille, vignettes,
 * pellicule, frise, dossier/chrono/barre, onde, objet tourné). Pas de volet avant/après (vraies captures nécessaires).
 * Socle commun dans `PlancheEtiquettes`. Pur, aucune image extérieure. Rien d'inscrit.
 */
import type { JSX } from "react";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import { EXEMPLES_FENETRE_APP, OBJET_FENETRE_APP } from "../../../../src/briques/motion/petits-objets/fenetre-app";
import { EXEMPLES_TERMINAL_COMMANDE, OBJET_TERMINAL_COMMANDE } from "../../../../src/briques/motion/petits-objets/terminal-commande";
import { EXEMPLES_PANNEAU_REGLAGES, OBJET_PANNEAU_REGLAGES } from "../../../../src/briques/motion/petits-objets/panneau-reglages";
import { EXEMPLES_GRILLE, EXEMPLES_VIGNETTES, OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES } from "../../../../src/briques/motion/petits-objets/grille-vignettes";
import { EXEMPLES_PELLICULE, OBJET_PELLICULE } from "../../../../src/briques/motion/petits-objets/pellicule";
import { EXEMPLES_FRISE, OBJET_FRISE_MONTAGE } from "../../../../src/briques/motion/petits-objets/frise-montage";
import { DEF_BARRE_PROGRESSION, DEF_CHRONO, DEF_DOSSIER, EXEMPLES_DOSSIER_CHRONO_BARRE } from "../../../../src/briques/motion/petits-objets/dossier-chrono-barre";
import { EXEMPLES_ONDE, OBJET_ONDE_MOTIF } from "../../../../src/briques/motion/petits-objets/onde";
import { EXEMPLES_OBJET_TOURNE, OBJET_TOURNE } from "../../../../src/briques/motion/petits-objets/objet-tourne";
import type { FormatPlanche } from "./PlancheTraits";
import { listerFamille, PlancheDeFamille, type EntreeFamille } from "./PlancheEtiquettes";

export const ENTREES_ECRANS: readonly EntreeFamille[] = [
  ...listerFamille([OBJET_FENETRE_APP], EXEMPLES_FENETRE_APP),
  ...listerFamille([OBJET_TERMINAL_COMMANDE], EXEMPLES_TERMINAL_COMMANDE),
  ...listerFamille([OBJET_PANNEAU_REGLAGES], EXEMPLES_PANNEAU_REGLAGES),
  ...listerFamille([OBJET_GRILLE_POINTILLEE], EXEMPLES_GRILLE),
  ...listerFamille([OBJET_VIGNETTES_NUMEROTEES], EXEMPLES_VIGNETTES),
  ...listerFamille([OBJET_PELLICULE], EXEMPLES_PELLICULE),
  ...listerFamille([OBJET_FRISE_MONTAGE], EXEMPLES_FRISE),
  ...listerFamille([DEF_DOSSIER], EXEMPLES_DOSSIER_CHRONO_BARRE.dossier),
  ...listerFamille([DEF_CHRONO], EXEMPLES_DOSSIER_CHRONO_BARRE.chrono),
  ...listerFamille([DEF_BARRE_PROGRESSION], EXEMPLES_DOSSIER_CHRONO_BARRE.barre),
  ...listerFamille([OBJET_ONDE_MOTIF], EXEMPLES_ONDE),
  ...listerFamille([OBJET_TOURNE], EXEMPLES_OBJET_TOURNE),
];

export function PlancheEcrans({ fond, format, image }: { fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  return <PlancheDeFamille nom="ecrans" entrees={ENTREES_ECRANS} fond={fond} format={format} image={image} />;
}
