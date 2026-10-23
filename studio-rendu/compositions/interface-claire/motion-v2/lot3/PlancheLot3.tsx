/**
 * APERÇU DU LOT 3 (outil de validation, pas un élément) : une composition « prise fixe + UN élément du lot », rendue en images
 * fixes par `rendre-planche-lot3.mjs`. Ne touche ni `Racine.tsx` ni `Compositions.tsx` : l'aperçu a sa propre entrée
 * (`entree-lot3.ts`) et sa propre racine.
 */
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { MotSaute } from "./MotSaute";
import { MotVerticalBord } from "./MotVerticalBord";
import { RafaleTroisMots } from "./RafaleTroisMots";
import { PileLettres } from "./PileLettres";
import { MotBarreRemplace } from "./MotBarreRemplace";
import { FPS, PRISE_COMMUNE_LOT } from "./outils3";
import type { PriseLot } from "./outils3";

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
/** Les éléments commencent à 0,5 s : on voit la prise seule avant. */
export const DEBUT = 0.5;

/** Prise de Will sur l'image fixe de la planche (yeux à 0,34 H, tête décalée à droite : mesuré sur l'image). */
export const PRISE_WILL: PriseLot = PRISE_COMMUNE_LOT;

export const ELEMENTS_LOT3 = ["mot-saute", "mot-vertical-bord", "rafale-trois-mots", "pile-de-lettres", "mot-barre-remplace"] as const;
export type IdLot3 = (typeof ELEMENTS_LOT3)[number];

/** Durée (s) de chaque élément dans l'aperçu. */
export const DUREES: Record<IdLot3, number> = { "mot-saute": 2.0, "mot-vertical-bord": 3.0, "rafale-trois-mots": 40 / FPS, "pile-de-lettres": 2.4, "mot-barre-remplace": 2.2 };

export function ApercuLot3({ element, prise, duree }: { element: IdLot3; prise?: PriseLot; duree?: number }) {
  chargerPoliceMontserrat();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const commun = { t, debut: DEBUT, fin: DEBUT + (duree ?? DUREES[element]), largeurImage: LARGEUR, hauteurImage: HAUTEUR, prise: prise ?? PRISE_WILL };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img src={staticFile("prise-commune.png")} style={{ width: LARGEUR, height: HAUTEUR, objectFit: "cover" }} />
      {element === "mot-saute" ? <MotSaute {...commun} mot="retard" /> : null}
      {element === "mot-vertical-bord" ? <MotVerticalBord {...commun} mot="temps" /> : null}
      {element === "rafale-trois-mots" ? <RafaleTroisMots {...commun} mots={["devis", "relances", "factures"]} /> : null}
      {element === "pile-de-lettres" ? <PileLettres {...commun} mot="agenda" /> : null}
      {element === "mot-barre-remplace" ? <MotBarreRemplace {...commun} motA="chaos" motB="méthode" /> : null}
    </AbsoluteFill>
  );
}

export function RacineLot3() {
  return (
    <Composition
      id="ApercuLot3"
      component={ApercuLot3 as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={150}
      fps={FPS}
      width={LARGEUR}
      height={HAUTEUR}
      defaultProps={{ element: "mot-saute" as IdLot3, duree: undefined as number | undefined }}
    />
  );
}
