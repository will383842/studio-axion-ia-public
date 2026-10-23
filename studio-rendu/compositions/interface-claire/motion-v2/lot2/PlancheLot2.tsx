/**
 * PLANCHE DE CONTRÔLE du lot 2 : un extrait de 2 s (60 images à 30 i/s, i0 = image 9) posé sur la PRISE COMMUNE
 * (`prise.png` du dossier public passé au bundler, 1080×1920, sans recadrage). Sert à fabriquer les bandes d'images
 * et les extraits MP4 du § F.3 du standard. Aucun rôle en production : `entree-planche.tsx` n'est pas branché dans `Racine.tsx`.
 */
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../commune/polices";
import { BandesDiagonales } from "./BandesDiagonales";
import { DemiLuneBas } from "./DemiLuneBas";
import { DuelTriangles } from "./DuelTriangles";
import { LosangeCrans } from "./LosangeCrans";
import { PastilleChiffre } from "./PastilleChiffre";
import { FPS_V2 } from "./outils";

export type IdElementLot2 = "pastille-chiffre" | "bandes-diagonales" | "duel-triangles" | "demi-lune-bas" | "losange-crans";
export const ELEMENTS_LOT2: IdElementLot2[] = ["pastille-chiffre", "bandes-diagonales", "duel-triangles", "demi-lune-bas", "losange-crans"];

/** Instants des extraits de 2 s (i0 = 0,3 s). */
const D = 0.3;
export const PROPS_EXTRAIT = {
  "pastille-chiffre": { debut: D, fin: 1.95, nombre: "3" },
  "bandes-diagonales": { debut: D, fin: 1.95, mots: ["Simple", "Rapide"] as [string, string] },
  "duel-triangles": { debut: D, fin: 1.95, motA: "À la main", motB: "Automatisé", verdict: { gagnant: "B" as const, a: 1.05 } },
  "demi-lune-bas": { debut: D, fin: 1.95, mot: "Et voilà" },
  "losange-crans": {
    debut: D,
    fin: 1.97,
    etapes: [
      { icone: "loupe", a: D },
      { icone: "eclair", a: D + 0.5 },
      { icone: "graphique", a: D + 0.95 },
    ],
  },
};

export type PropsPlancheLot2 = { element: IdElementLot2; image: number };

/** `image` = numéro d'image de l'extrait (0 à 59). */
export function ElementLot2({ element, image }: PropsPlancheLot2) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const t = image / FPS_V2;
  const c = { t, largeurImage: 1080, hauteurImage: 1920 };
  switch (element) {
    case "pastille-chiffre":
      return <PastilleChiffre {...PROPS_EXTRAIT["pastille-chiffre"]} {...c} />;
    case "bandes-diagonales":
      return <BandesDiagonales {...PROPS_EXTRAIT["bandes-diagonales"]} {...c} />;
    case "duel-triangles":
      return <DuelTriangles {...PROPS_EXTRAIT["duel-triangles"]} {...c} />;
    case "demi-lune-bas":
      return <DemiLuneBas {...PROPS_EXTRAIT["demi-lune-bas"]} {...c} />;
    case "losange-crans":
      return <LosangeCrans {...PROPS_EXTRAIT["losange-crans"]} {...c} />;
  }
}

const Fond = ({ avecPrise }: { avecPrise: boolean }) => (avecPrise ? <Img src={staticFile("prise.png")} style={{ width: 1080, height: 1920 }} /> : null);

export function PlancheLot2({ element, image }: PropsPlancheLot2) {
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond avecPrise />
      <ElementLot2 element={element} image={image} />
    </AbsoluteFill>
  );
}

export function ExtraitLot2({ element, sansPrise }: { element: IdElementLot2; sansPrise?: boolean }) {
  const image = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond avecPrise={!sansPrise} />
      <ElementLot2 element={element} image={image} />
    </AbsoluteFill>
  );
}

export function RacinePlancheLot2() {
  return (
    <>
      <Composition id="PlancheLot2" component={PlancheLot2} durationInFrames={1} fps={FPS_V2} width={1080} height={1920} defaultProps={{ element: "pastille-chiffre" as IdElementLot2, image: 24 }} />
      <Composition id="ExtraitLot2" component={ExtraitLot2} durationInFrames={60} fps={FPS_V2} width={1080} height={1920} defaultProps={{ element: "pastille-chiffre" as IdElementLot2, sansPrise: false }} />
    </>
  );
}
