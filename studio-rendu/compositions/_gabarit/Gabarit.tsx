/**
 * COMPOSITION VIDE D'UN NOUVEAU GÉNÉRATEUR (G1-04). À COPIER vers `studio-rendu/compositions/<id>/`, jamais inscrite
 * dans `Racine.tsx` depuis ce dossier : l'inscription (geste 6 du guide `docs/formats/AJOUTER-UN-FORMAT.md`) se fait
 * sur la copie.
 *
 * Lue par le rendu : aucun import « @/ », seulement des chemins relatifs vers des dossiers déjà copiés dans l'image.
 * Police : Manrope seule (`chargerManrope`). Couleurs : `CHARTE_AXION`, jamais une valeur en dur.
 * Calques : le plan de scènes et les sous-titres passent par `CalquesCommuns` (ordre fixe, aucun dessin par défaut).
 */
import { AbsoluteFill } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../src/briques/jetons-motion";
import { CalquesCommuns, type ProprietesCalquesCommuns } from "../commune/CalquesCommuns";
import { chargerManrope } from "../plan-scenes/PlanDeScenes";

export type ProprietesGabarit = ProprietesCalquesCommuns;

export function Gabarit({ planScenes, sousTitres, children }: ProprietesGabarit) {
  chargerManrope();
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION }}>
      {/* Vos calques propres vont ici, en `children` de CalquesCommuns : sous les sous-titres, jamais devant un visage. */}
      <CalquesCommuns planScenes={planScenes} sousTitres={sousTitres}>
        {children}
      </CalquesCommuns>
    </AbsoluteFill>
  );
}
