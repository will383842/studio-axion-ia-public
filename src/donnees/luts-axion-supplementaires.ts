/**
 * LES 3 LUT « AXION » SUPPLÉMENTAIRES (C6-H8, décision Q12 : 2 à 3 LUT sur planche, jamais sur la v4).
 * Fichiers `.cube` de 65 points fabriqués par `outils/lut/generer-supplementaires.py` (réglages dans
 * `outils/lut/parametres-supplementaires.md`), contrôlés comme les 4 livrées (`tests/luts-supplementaires.test.ts`).
 * AJOUT PUR : importé par rien en production (ni migration, ni écran : c'est C6-H9). `LUTS_AXION` est inchangé.
 * Aucune n'est le défaut d'un format (`formats: []`). PUR.
 */
import type { DefinitionLutAxion } from "./luts-axion";

export const LUTS_AXION_SUPPLEMENTAIRES: DefinitionLutAxion[] = [
  { id: "lut-axion-terracotta-chaud", nom: "Axion terracotta chaud", fichier: "axion-terracotta-chaud.cube", taille: 65, intensiteParDefaut: 65, formats: [], motsCles: ["couleurs", "étalonnage", "terracotta", "chaud"], apresDemo: "/demo/lut/axion-chaud.jpg" },
  { id: "lut-axion-ivoire-doux-contraste", nom: "Axion ivoire doux contrasté", fichier: "axion-ivoire-doux-contraste.cube", taille: 65, intensiteParDefaut: 60, formats: [], motsCles: ["couleurs", "étalonnage", "ivoire", "doux", "contrasté"], apresDemo: "/demo/lut/neutre.jpg" },
  { id: "lut-axion-encre-froid-neutre", nom: "Axion encre froid neutre", fichier: "axion-encre-froid-neutre.cube", taille: 65, intensiteParDefaut: 60, formats: [], motsCles: ["couleurs", "étalonnage", "encre", "froid", "neutre"], apresDemo: "/demo/lut/cinema.jpg" },
];
