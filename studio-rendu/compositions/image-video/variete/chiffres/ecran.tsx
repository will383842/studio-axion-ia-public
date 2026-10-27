import React from "react";
/**
 * Écran « chiffres » de la variété (lot CHI) : le bandeau montré par la variante tirée (CHI-B anneau, CHI-C duel,
 * CHI-D géant, CHI-E en objets), dans le cadre du format. Sans données (aperçu) : le fond de la charte et la marque.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FondIV } from "../fond/FondVarie";
import { Entete } from "../../Entete";
import type { ProprietesEcranVariete } from "../CompositionVariete";
import { CorpsChiffres } from "./corps";
import type { DonneesEcranChiffresRendu } from "./donnees";

export function EcranChiffres(p: ProprietesEcranVariete) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = p.bloc.donnees as DonneesEcranChiffresRendu | null;
  if (!d || !Array.isArray(d.chiffres) || !d.chiffres.length) {
    return (
      <AbsoluteFill>
        <FondIV fond="ivoire" largeur={p.largeur} hauteur={p.hauteur} />
        <Entete entete={null} ecoule={0} sortie={0} fond="ivoire" marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
      </AbsoluteFill>
    );
  }
  const echelle = p.largeur / 1080;
  return (
    <AbsoluteFill style={{ transform: `scale(${echelle})`, transformOrigin: "0 0", width: 1080, height: p.hauteur / echelle }}>
      <CorpsChiffres d={d} t={frame / fps} hauteur={p.hauteur / echelle} marque={p.marque} />
    </AbsoluteFill>
  );
}
