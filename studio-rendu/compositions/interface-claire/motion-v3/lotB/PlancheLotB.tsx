/**
 * PLANCHE DE CONTRÔLE du lot B : extrait de 2,8 s (84 images à 30 i/s) de CHAQUE élément, et enchaînement de 15 s du lot,
 * posés sur la PRISE COMMUNE (`prise.png` du dossier public passé au bundler, 1080×1920, sans recadrage ni décalage), avec
 * les BRUITAGES (`<Audio>`, fichiers de `sons/` copiés dans `<public>/sons/`) et les SOUS-TITRES du vrai moteur `SousTitres.tsx`
 * sur la phrase d'exemple commune. Aucun rôle en production : `entree-lotB.tsx` n'est branché nulle part.
 * `blob-video` est abandonné (doublon du cercle, critique du 16/10).
 */
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../commune/polices";
import { ArcheBas } from "./ArcheBas";
import { BandeVideo } from "./BandeVideo";
import { CercleEpaule } from "./CercleEpaule";
import { PiluleCote } from "./PiluleCote";
import { FPS, SousTitresLotB, groupesPhrase } from "./commun-lotB";

export type IdElementLotB = "pilule-cote" | "cercle-epaule" | "bande-video" | "arche-bas";
export const ELEMENTS_LOTB: IdElementLotB[] = ["pilule-cote", "cercle-epaule", "bande-video", "arche-bas"];

/** B-roll du pool partagé (copiés dans `<public>/broll/`), nets (1080 px) et vivants (10 % de pixels qui bougent). */
export const SOURCES = {
  pilule: "broll/chantier-perceuse-vertical.mp4",
  cercle: "broll/chantier-reparation-mur-vertical.mp4",
  bande: "broll/chantier-beton-paysage.mp4",
  arche: "broll/chantier-tablette-vertical.mp4",
} as const;

/** Durée d'un extrait : 2,8 s. `i0` (= `debut`) tombe à 0,2 s ; chaque élément a sa propre durée de présence. */
export const IMAGES_EXTRAIT = 84;
export const IMAGES_ENCHAINEMENT = 450;
const D = 0.2;
const DUREES: Record<IdElementLotB, number> = { "pilule-cote": 2.5, "cercle-epaule": 2.4, "bande-video": 2.3, "arche-bas": 2.5 };
const LARGEUR = 1080;
const HAUTEUR = 1920;

type Cadre = { t: number; largeurImage: number; hauteurImage: number };

/** Un élément à l'instant `t`, avec son instant `debut` (secondes) et son côté (miroir). */
export function ElementLotB({ element, c, debut, cote }: { element: IdElementLotB; c: Cadre; debut: number; cote?: "gauche" | "droite" }) {
  const fin = debut + DUREES[element];
  switch (element) {
    case "pilule-cote":
      return <PiluleCote {...c} debut={debut} fin={fin} src={staticFile(SOURCES.pilule)} etiquette="Devis" cote={cote ?? "gauche"} />;
    case "cercle-epaule":
      return <CercleEpaule {...c} debut={debut} fin={fin} src={staticFile(SOURCES.cercle)} cote={cote === "droite" ? "droite" : "gauche"} />;
    case "bande-video":
      return <BandeVideo {...c} debut={debut} fin={fin} src={staticFile(SOURCES.bande)} etiquette="Seuls" />;
    case "arche-bas":
      return <ArcheBas {...c} debut={debut} fin={fin} src={staticFile(SOURCES.arche)} etiquette="Chantier" cote={cote === "gauche" ? "gauche" : "droite"} />;
  }
}

const Fond = () => <Img src={staticFile("prise.png")} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR }} />;

export function PlancheLotB({ element, image }: { element: IdElementLotB; image: number }) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const c = { t: image / FPS, largeurImage: LARGEUR, hauteurImage: HAUTEUR };
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      <ElementLotB element={element} c={c} debut={D} />
      <SousTitresLotB t={c.t} groupes={groupesPhrase(0)} W={LARGEUR} H={HAUTEUR} />
    </AbsoluteFill>
  );
}

export function ExtraitLotB({ element }: { element: IdElementLotB }) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const c = { t: image / FPS, largeurImage: LARGEUR, hauteurImage: HAUTEUR };
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      <ElementLotB element={element} c={c} debut={D} />
      <SousTitresLotB t={c.t} groupes={groupesPhrase(0)} W={LARGEUR} H={HAUTEUR} />
    </AbsoluteFill>
  );
}

/** Enchaînement de 15 s : gauche, droite, bas-gauche, diagonale ; V1 respectée (emplacement, forme, entrée, sortie jamais répétés). */
export const PLAN_ENCHAINEMENT: { element: IdElementLotB; debut: number; cote?: "gauche" | "droite" }[] = [
  { element: "pilule-cote", debut: 0.9 },
  { element: "arche-bas", debut: 4.4 },
  { element: "cercle-epaule", debut: 8.0, cote: "gauche" },
  { element: "bande-video", debut: 11.6 },
];
const PHRASES = [0.3, 4.1, 7.9, 11.7].flatMap((t0) => groupesPhrase(t0));

export function EnchainementLotB() {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const c = { t: image / FPS, largeurImage: LARGEUR, hauteurImage: HAUTEUR };
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      {PLAN_ENCHAINEMENT.map((e) => (
        <ElementLotB key={e.element} element={e.element} c={c} debut={e.debut} cote={e.cote} />
      ))}
      <SousTitresLotB t={c.t} groupes={PHRASES} W={LARGEUR} H={HAUTEUR} />
    </AbsoluteFill>
  );
}

export function RacinePlancheLotB() {
  return (
    <>
      <Composition id="PlancheLotB" component={PlancheLotB} durationInFrames={1} fps={FPS} width={LARGEUR} height={HAUTEUR} defaultProps={{ element: "pilule-cote" as IdElementLotB, image: 24 }} />
      <Composition id="ExtraitLotB" component={ExtraitLotB} durationInFrames={IMAGES_EXTRAIT} fps={FPS} width={LARGEUR} height={HAUTEUR} defaultProps={{ element: "pilule-cote" as IdElementLotB }} />
      <Composition id="EnchainementLotB" component={EnchainementLotB} durationInFrames={IMAGES_ENCHAINEMENT} fps={FPS} width={LARGEUR} height={HAUTEUR} />
    </>
  );
}
