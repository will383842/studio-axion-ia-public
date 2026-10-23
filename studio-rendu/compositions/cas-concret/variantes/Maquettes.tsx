import React from "react";
/**
 * Composition `CasConcretMaquette` (lot L1) : UNE maquette de variété, choisie par `nom`, rendue en image fixe par
 * `outils/maquettes-variete/`. Inscrite SEULEMENT par l'entrée propre aux maquettes (`variantes/entree.ts`) : la
 * racine du rendu de production ne la connaît pas. Les écrans « aujourd'hui » sont dessinés par le VRAI aiguillage du
 * format (`../Ecran.tsx`), sans le modifier.
 */
import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import type { DonneesCalque } from "../../../../src/briques/sous-titres/scene";
import { chargerPoliceAnton, chargerPoliceTitre } from "../../commune/polices";
import { CalqueSousTitres } from "../../sous-titres/CalqueSousTitres";
import { Ecran } from "../Ecran";
import { FORMAT_MAQUETTE, planVolet, proprietesAujourdhui, type NomMaquette } from "./donnees";
import {
  M01OuvertureChiffre,
  M02TitreGauche,
  M03EtapePleinCadre,
  M04EtapeObjetGauche,
  M05ListePile,
  M06Terracotta,
  M07Barres,
  M08ObjetCompose,
  M09Question,
  M10AvantApres,
  M11ZoomArriere,
  M12Citation,
  M13Comparatif,
  M14Journee,
  M15Jauge,
  M16FinVariante,
  M17Recrutement,
} from "./ecrans";
import { FondMaquette } from "./pieces";

export type ProprietesMaquette = {
  nom: NomMaquette;
  /** Sous-titres RÉELS (brique centrale `src/briques/sous-titres`), calculés par l'outil ; absents : ligne d'illustration. */
  sousTitres?: { donnees: DonneesCalque; instantSec: number };
};

/** Une maquette, à l'image courante. */
export function Maquette({ nom, sousTitres }: ProprietesMaquette) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const t = image / FORMAT_MAQUETTE.fps;
  const calque = sousTitres ? <CalqueSousTitres donnees={sousTitres.donnees} instantSec={sousTitres.instantSec} /> : undefined;
  switch (nom) {
    case "aujourdhui-accroche":
    case "aujourdhui-etape": {
      const p = proprietesAujourdhui()[nom === "aujourdhui-accroche" ? 0 : 1];
      return (
        <AbsoluteFill>
          <Ecran {...p} />
          {calque}
        </AbsoluteFill>
      );
    }
    case "m01-ouverture-chiffre":
      return <M01OuvertureChiffre t={t} calque={calque} />;
    case "m02-ouverture-titre-gauche":
      return <M02TitreGauche t={t} />;
    case "m03-etape-plein-cadre":
      return <M03EtapePleinCadre t={t} calque={calque} />;
    case "m04-etape-objet-gauche":
      return <M04EtapeObjetGauche t={t} />;
    case "m05-liste-pile":
      return <M05ListePile t={t} />;
    case "m06-fond-terracotta":
      return <M06Terracotta t={t} />;
    case "m07-barres-proportionnelles":
      return <M07Barres t={t} />;
    case "m08-objet-compose":
      return <M08ObjetCompose t={t} />;
    case "m09-ouverture-question":
      return <M09Question t={t} calque={calque} />;
    case "m10-ouverture-avant-apres":
      return <M10AvantApres t={t} />;
    case "m11-ouverture-zoom-arriere":
      return <M11ZoomArriere t={t} calque={calque} />;
    case "m12-citation-geante":
      return <M12Citation t={t} />;
    case "m13-comparatif-deux-colonnes":
      return <M13Comparatif t={t} />;
    case "m14-journee-8h-22h":
      return <M14Journee t={t} />;
    case "m15-jauge-13-criteres":
      return <M15Jauge t={t} calque={calque} />;
    case "m16-fin-variante":
      return <M16FinVariante t={t} />;
    case "m17-recrutement-autre-tirage":
      return <M17Recrutement t={t} />;
    case "t1-volet-entree":
    case "t2-volet-sortie":
      return <Volet t={t} />;
    case "t3-zoom-debut":
    case "t4-zoom-fin":
      return <M03EtapePleinCadre t={t} />;
  }
}

/**
 * Transition « volet terracotta » DESSINÉE DANS l'écran : un panneau terracotta balaie l'image de gauche à droite ;
 * l'écran A (étape plein cadre) est dessous à l'aller, l'écran B (étape objet à gauche) au retour.
 */
function Volet({ t }: { t: number }) {
  const v = planVolet(t);
  const largeur = FORMAT_MAQUETTE.largeur;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {v.montreB ? <M04EtapeObjetGauche t={t + 1.6} /> : <M03EtapePleinCadre t={t + 2} />}
      <div style={{ position: "absolute", top: -40, bottom: -40, left: v.gauche * largeur - 60, width: (v.droite - v.gauche) * largeur + 120, transform: "skewX(-6deg)", overflow: "hidden" }}>
        <FondMaquette fond="terracotta" />
      </div>
    </AbsoluteFill>
  );
}

/** Les compositions des maquettes (une seule, pilotée par `nom`). */
export function CompositionsMaquettes() {
  return (
    <Composition
      id="CasConcretMaquette"
      component={Maquette}
      durationInFrames={FORMAT_MAQUETTE.images}
      fps={FORMAT_MAQUETTE.fps}
      width={FORMAT_MAQUETTE.largeur}
      height={FORMAT_MAQUETTE.hauteur}
      defaultProps={{ nom: "m01-ouverture-chiffre" } as ProprietesMaquette}
    />
  );
}
