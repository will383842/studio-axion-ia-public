import React from "react";
import { registerRoot } from "remotion";
import { Maquette, SceneGalerieImageVideo, sceneGalerieC } from "../socle";
import { GalerieImageVideo } from "../../../../../../studio-rendu/compositions/image-video/Compositions";
import { galerieObjets } from "../../../../../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import * as CHI from "./chiffres";
import * as REC from "./recit";
import * as TYP from "./typo";

/** Références « aujourd'hui » : la vraie scène / la vraie galerie, à l'instant clé. */
const SceneReelle = () => <SceneGalerieImageVideo {...sceneGalerieC()} />;
const GalerieReelle = () => <GalerieImageVideo {...galerieObjets()} />;

function Racine() {
  return (
    <>
      <Maquette id="REC-A-1" rendu={SceneReelle} image={140} />
      <Maquette id="CHI-A-1" rendu={GalerieReelle} image={180} />
      <Maquette id="TYP-A-1" rendu={GalerieReelle} image={356} />
      <Maquette id="CHI-B-1" rendu={CHI.CHI_B_1} />
      <Maquette id="CHI-B-2" rendu={CHI.CHI_B_2} />
      <Maquette id="CHI-C-1" rendu={CHI.CHI_C_1} />
      <Maquette id="CHI-C-2" rendu={CHI.CHI_C_2} />
      <Maquette id="CHI-D-1" rendu={CHI.CHI_D_1} />
      <Maquette id="CHI-D-2" rendu={CHI.CHI_D_2} />
      <Maquette id="CHI-E-1" rendu={CHI.CHI_E_1} />
      <Maquette id="CHI-E-2" rendu={CHI.CHI_E_2} />
      <Maquette id="REC-B-1" rendu={REC.REC_B_1} />
      <Maquette id="REC-B-2" rendu={REC.REC_B_2} />
      <Maquette id="REC-C-1" rendu={REC.REC_C_1} />
      <Maquette id="REC-C-2" rendu={REC.REC_C_2} />
      <Maquette id="REC-D-1" rendu={REC.REC_D_1} image={25} />
      <Maquette id="REC-D-2" rendu={REC.REC_D_2} image={85} />
      <Maquette id="TYP-B-1" rendu={TYP.TYP_B_1} />
      <Maquette id="TYP-B-2" rendu={TYP.TYP_B_2} />
      <Maquette id="TYP-C-1" rendu={TYP.TYP_C_1} />
      <Maquette id="TYP-C-2" rendu={TYP.TYP_C_2} />
      <Maquette id="TYP-D-1" rendu={TYP.TYP_D_1} />
      <Maquette id="TYP-D-2" rendu={TYP.TYP_D_2} />
      <Maquette id="R45-CHI-B-1" rendu={CHI.R45_CHI_B_1} hauteur={1350} />
      <Maquette id="R45-CHI-D-1" rendu={CHI.R45_CHI_D_1} hauteur={1350} />
    </>
  );
}
registerRoot(Racine);
