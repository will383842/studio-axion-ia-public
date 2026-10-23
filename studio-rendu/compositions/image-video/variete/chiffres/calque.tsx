import React from "react";
/**
 * Calque « chiffres » de la variété (lot CHI), autour de chaque scène : sur une toile, les chiffres qui claquent sur
 * une étape déjà posée (correctif doc 72 § 7 point 4, à la place du nœud dans la scène calculée) ; sur un bloc dont le
 * bandeau partage le bloc avec d'autres moments, l'écran de la variante pendant le moment. Sans données : le contenu
 * tel quel.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useVariete } from "../ContexteVariete";
import { AccentsToile, type SceneAccents } from "./accent";
import { CorpsChiffres } from "./corps";
import type { DonneesChiffresRendu } from "./donnees";

export function CalqueChiffres({ children }: { children: ReactNode }) {
  const v = useVariete();
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const d = v?.donnees.chiffres as DonneesChiffresRendu | undefined;
  if (!d || (!d.ecran && !d.accents?.length)) return <>{children}</>;
  const t = frame / fps;
  const echelle = width / 1080;
  const scene = v?.scene as SceneAccents | undefined;
  const ecran = d.ecran && t >= d.ecran.debut && t < d.ecran.fin ? d.ecran : null;
  return (
    <>
      {children}
      {d.accents?.length && scene?.parId ? (
        <AbsoluteFill style={{ transform: `scale(${echelle})`, transformOrigin: "0 0", width: 1080, height: height / echelle }}>
          <AccentsToile scene={scene} accents={d.accents} t={t} />
        </AbsoluteFill>
      ) : null}
      {ecran ? (
        <AbsoluteFill style={{ transform: `scale(${echelle})`, transformOrigin: "0 0", width: 1080, height: height / echelle }}>
          <CorpsChiffres d={ecran} t={t} hauteur={height / echelle} marque="axion-ia.com" />
        </AbsoluteFill>
      ) : null}
    </>
  );
}
