/**
 * Un écran du format, rendu seul : aiguille sur son `type` vers la composition du type. L6 : une mise en page tirée
 * (`jeu.miseEnPage`, données présentes) remplace la composition v4 du type ; raccords modernes autour (`Raccorde`) ;
 * entrée, sortie, caméra, transition et mot par mot du jeu autour de tout (`Habillage`).
 * Sans `jeu`, l'arbre rendu est celui de la v4.
 */
import React from "react";
import type { ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { chargerPoliceAnton, chargerPoliceTitre } from "../commune/polices";
import { Accroche } from "./types/Accroche";
import { Chiffre } from "./types/Chiffre";
import { ListeAvant } from "./types/ListeAvant";
import { Titre } from "./types/Titre";
import { Etape } from "./types/Etape";
import { Objet } from "./types/Objet";
import { Preuve } from "./types/Preuve";
import { Resultat } from "./types/Resultat";
import { Question } from "./types/Question";
import { AppelMot } from "./types/AppelMot";
import { Promesse } from "./types/Promesse";
import { Lien } from "./types/Lien";
import { codeL6, EcranL6, Raccorde } from "./mises-en-page/MiseEnPage";
import { Habillage } from "./socle/Habillage";

export function Ecran(p: ProprietesEcran) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  if (!p.jeu) return ecranV4(p);
  const code = codeL6(p);
  return (
    <Habillage p={p}>
      <Raccorde p={p}>{code ? <EcranL6 p={p} code={code} /> : ecranV4(p)}</Raccorde>
    </Habillage>
  );
}

/** La composition v4 du type. */
function ecranV4(p: ProprietesEcran) {
  switch (p.type) {
    case "accroche":
      return <Accroche {...p} />;
    case "chiffre":
      return <Chiffre {...p} />;
    case "liste-avant":
      return <ListeAvant {...p} />;
    case "titre":
      return <Titre {...p} />;
    case "etape":
      return <Etape {...p} />;
    case "objet":
      return <Objet {...p} />;
    case "preuve":
      return <Preuve {...p} />;
    case "resultat":
      return <Resultat {...p} />;
    case "question":
      return <Question {...p} />;
    case "appel-mot":
      return <AppelMot {...p} />;
    case "promesse":
      return <Promesse {...p} />;
    case "lien":
      return <Lien {...p} />;
  }
}
