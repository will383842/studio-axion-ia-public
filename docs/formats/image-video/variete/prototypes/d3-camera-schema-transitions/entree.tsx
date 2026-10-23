import React from "react";
import { registerRoot } from "remotion";
import { Maquette, SceneGalerieImageVideo, sceneGalerieC } from "../socle";
import { CamB1, CamB2, CamC1, CamC2, CamD1, CamD2, CamE1, CamE2 } from "./camera";
import { AppB1, AppB2, AppC1, AppC2, AppD1 } from "./apparition";
import { R45CamC1, R45Ens1 } from "./r45";
import { TraB1, TraB2, TraC1, TraD1, TraE1 } from "./transitions";

/** La vraie scène de l'image C (référence « aujourd'hui »), à l'image demandée. */
const Reelle = () => <SceneGalerieImageVideo {...sceneGalerieC()} />;

function Racine() {
  return (
    <>
      <Maquette id="CAM-A-1" rendu={Reelle} image={140} />
      <Maquette id="CAM-A-2" rendu={Reelle} image={250} />
      <Maquette id="CAM-B-1" rendu={CamB1} />
      <Maquette id="CAM-B-2" rendu={CamB2} />
      <Maquette id="CAM-C-1" rendu={CamC1} />
      <Maquette id="CAM-C-2" rendu={CamC2} />
      <Maquette id="CAM-D-1" rendu={CamD1} />
      <Maquette id="CAM-D-2" rendu={CamD2} />
      <Maquette id="CAM-E-1" rendu={CamE1} />
      <Maquette id="CAM-E-2" rendu={CamE2} />
      <Maquette id="APP-A-1" rendu={Reelle} image={195} />
      <Maquette id="APP-A-2" rendu={Reelle} image={197} />
      <Maquette id="APP-B-1" rendu={AppB1} />
      <Maquette id="APP-B-2" rendu={AppB2} />
      <Maquette id="APP-C-1" rendu={AppC1} />
      <Maquette id="APP-C-2" rendu={AppC2} />
      <Maquette id="APP-D-1" rendu={AppD1} />
      <Maquette id="TRA-B-1" rendu={TraB1} />
      <Maquette id="TRA-B-2" rendu={TraB2} />
      <Maquette id="TRA-C-1" rendu={TraC1} />
      <Maquette id="TRA-D-1" rendu={TraD1} />
      <Maquette id="TRA-E-1" rendu={TraE1} />
      <Maquette id="R45-CAM-C-1" rendu={R45CamC1} hauteur={1350} />
      <Maquette id="R45-ENS-1" rendu={R45Ens1} hauteur={1350} />
    </>
  );
}
registerRoot(Racine);
