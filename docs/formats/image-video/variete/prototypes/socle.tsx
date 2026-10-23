import React from "react";
/**
 * SOCLE commun des maquettes de variété : réexporte les VRAIS composants de studio-rendu (scène de l'image C, fond,
 * en-tête, marque, témoin des sous-titres, nœuds, polices) et fournit `Maquette` : une composition = une image fixe.
 * Rien ici n'est branché dans le moteur.
 */
import { AbsoluteFill, Composition } from "remotion";
export { AbsoluteFill } from "remotion";
const SR = "../../../../../studio-rendu/compositions";
export { SceneImageVideo, SceneGalerieImageVideo } from "../../../../../studio-rendu/compositions/image-video/Compositions";
export { sceneGalerieC, INSTANTS_GALERIE_C } from "../../../../../studio-rendu/compositions/image-video/donnees-galerie";
export { Fond } from "../../../../../studio-rendu/compositions/cas-concret/socle/Fond";
export { Entete } from "../../../../../studio-rendu/compositions/image-video/Entete";
export { TemoinSousTitres } from "../../../../../studio-rendu/compositions/image-video/TemoinSousTitres";
export { PhraseChoc } from "../../../../../studio-rendu/compositions/image-video/PhraseChoc";
export { BandeauChiffres } from "../../../../../studio-rendu/compositions/image-video/BandeauChiffres";
export { Alerte } from "../../../../../studio-rendu/compositions/image-video/Alerte";
export { EmailStructure } from "../../../../../studio-rendu/compositions/image-video/EmailStructure";
export { Ensemble } from "../../../../../studio-rendu/compositions/image-video/Ensemble";
export { EcranPartage } from "../../../../../studio-rendu/compositions/image-video/EcranPartage";
export { RepereChapitre } from "../../../../../studio-rendu/compositions/image-video/RepereChapitre";
export { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
export { couleursDuFond, famille, graisse } from "../../../../../studio-rendu/compositions/cas-concret/plans/commun";
import { chargerPoliceAnton, chargerPoliceTitre, chargerPoliceInterMedium, chargerPoliceInterSemiBold, FAMILLE_ANTON, FAMILLE_TITRE } from "../../../../../studio-rendu/compositions/commune/polices";
export { FAMILLE_ANTON, FAMILLE_TITRE };
void SR;

/** Charge les polices de la charte (Anton, Inter Bold/SemiBold/Medium), en local. */
export function polices() {
  chargerPoliceAnton();
  chargerPoliceTitre();
  chargerPoliceInterMedium();
  chargerPoliceInterSemiBold();
}

/**
 * Une image fixe de maquette. `id` = nom du fichier (ex. "OUV-A-1"). `largeur`×`hauteur` : 1080×1920 (9:16) par
 * défaut, 1080×1350 pour le 4:5. Le composant reçoit `image` (numéro d'image, 25 i/s) s'il veut piloter une scène réelle.
 */
export function Maquette({ id, rendu, largeur = 1080, hauteur = 1920, image = 0 }: { id: string; rendu: React.FC; largeur?: number; hauteur?: number; image?: number }) {
  const Rendu = () => {
    polices();
    return <AbsoluteFill>{React.createElement(rendu)}</AbsoluteFill>;
  };
  return <Composition id={id} component={Rendu} width={largeur} height={hauteur} fps={25} durationInFrames={Math.max(1, image + 1)} defaultProps={{ image }} />;
}
