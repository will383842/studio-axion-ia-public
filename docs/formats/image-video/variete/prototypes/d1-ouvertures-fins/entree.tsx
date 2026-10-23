import React from "react";
import { registerRoot } from "remotion";
import { Maquette } from "../socle";
import { OuvA1, OuvA2, OuvB1, OuvB2, OuvC1, OuvC2, OuvD1, OuvD2, OuvE1, OuvE2 } from "./ouvertures";
import { FinA1, FinB1, FinB2, FinC1, FinC2, FinC3, FinD1, FinD2 } from "./fins";
import { MatA1, MatB1, MatC1, MatD1 } from "./matiere";
import { SouA1, SouB1, SouC1 } from "./soustitres";
import { R45FinD1, R45OuvA1 } from "./r45";

/** Groupe D1 · ouvertures, fins, matière, sous-titres (+ 4:5). Une composition = une image fixe. */
const Racine = () => (
  <>
    <Maquette id="OUV-A-1" rendu={OuvA1} />
    <Maquette id="OUV-A-2" rendu={OuvA2} />
    <Maquette id="OUV-B-1" rendu={OuvB1} />
    <Maquette id="OUV-B-2" rendu={OuvB2} />
    <Maquette id="OUV-C-1" rendu={OuvC1} />
    <Maquette id="OUV-C-2" rendu={OuvC2} />
    <Maquette id="OUV-D-1" rendu={OuvD1} />
    <Maquette id="OUV-D-2" rendu={OuvD2} />
    <Maquette id="OUV-E-1" rendu={OuvE1} />
    <Maquette id="OUV-E-2" rendu={OuvE2} />
    <Maquette id="FIN-A-1" rendu={FinA1} image={354} />
    <Maquette id="FIN-B-1" rendu={FinB1} />
    <Maquette id="FIN-B-2" rendu={FinB2} />
    <Maquette id="FIN-C-1" rendu={FinC1} />
    <Maquette id="FIN-C-2" rendu={FinC2} />
    <Maquette id="FIN-C-3" rendu={FinC3} largeur={1520} hauteur={1440} />
    <Maquette id="FIN-D-1" rendu={FinD1} />
    <Maquette id="FIN-D-2" rendu={FinD2} />
    <Maquette id="MAT-A-1" rendu={MatA1} />
    <Maquette id="MAT-B-1" rendu={MatB1} />
    <Maquette id="MAT-C-1" rendu={MatC1} />
    <Maquette id="MAT-D-1" rendu={MatD1} />
    <Maquette id="SOU-A-1" rendu={SouA1} />
    <Maquette id="SOU-B-1" rendu={SouB1} />
    <Maquette id="SOU-C-1" rendu={SouC1} />
    <Maquette id="R45-OUV-A-1" rendu={R45OuvA1} hauteur={1350} />
    <Maquette id="R45-FIN-D-1" rendu={R45FinD1} hauteur={1350} />
  </>
);
registerRoot(Racine);
