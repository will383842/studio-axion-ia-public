import React from "react";
/**
 * Écran « fin » de la variété (lot OUV-FIN) : le moment de la phrase-choc en FIN-C (boucle) ou FIN-D (le chiffre qui
 * reste), en 9:16 ou 4:5. Sans données (aperçu, banc), le fond de la charte et la marque.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { FondIV } from "../fond/FondVarie";
import { Entete } from "../../Entete";
import type { ProprietesEcranVariete } from "../CompositionVariete";
import type { DonneesFin } from "./donnees";
import { FinC } from "./fin-c";
import { FinD } from "./fin-d";

export function EcranFin(p: ProprietesEcranVariete) {
  const frame = useCurrentFrame();
  const d = p.bloc.donnees as DonneesFin | null;
  const format: FormatIV = p.variete?.format ?? (p.hauteur < p.largeur * 1.5 ? "4:5" : "9:16");
  if (!d) {
    return (
      <AbsoluteFill>
        <FondIV fond="ivoire" largeur={p.largeur} hauteur={p.hauteur} />
        <Entete entete={null} ecoule={0} sortie={0} fond="ivoire" marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
      </AbsoluteFill>
    );
  }
  const t = frame / p.fps;
  return d.code === "FIN-C" ? <FinC d={d} t={t} format={format} /> : <FinD d={d} t={t} format={format} />;
}
