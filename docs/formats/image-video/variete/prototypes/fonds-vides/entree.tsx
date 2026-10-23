import React from "react";
import { registerRoot } from "remotion";
import { Maquette } from "../socle";
import { C, Ecran } from "../d1-ouvertures-fins/objets";

/**
 * FONDS VIDES de référence pour la mesure d'occupation (`occupation.py`) : le vrai fond de la charte (nuit, ivoire, et
 * le panneau orange des écrans de texte), marque comprise, sans aucun contenu. La mesure retire le plus proche.
 */
const Racine = () => (
  <>
    <Maquette id="FOND-S" rendu={() => <Ecran fond="sombre" />} />
    <Maquette id="FOND-I" rendu={() => <Ecran fond="ivoire" />} />
    <Maquette id="FOND-O" rendu={() => <Ecran fond="sombre"><div style={{ position: "absolute", left: 0, top: 220, width: 1080, bottom: 0, background: C.orangeVif }} /></Ecran>} />
  </>
);
registerRoot(Racine);
