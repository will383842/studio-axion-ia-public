import React from "react";
/**
 * Écran « ouverture » de la variété (lot OUV-FIN) : aiguillage par code vers les 5 ouvertures validées (OUV-A … OUV-E),
 * en 9:16 ou 4:5. Sans données (aperçu, banc), le fond de la charte et la marque.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { Fond } from "../../../cas-concret/socle/Fond";
import { Entete } from "../../Entete";
import type { ProprietesEcranVariete } from "../CompositionVariete";
import type { DonneesOuverture } from "./donnees";
import { OuvertureA } from "./ouv-a";
import { OuvertureB } from "./ouv-b";
import { OuvertureC, type BoucleC } from "./ouv-c";
import { OuvertureD } from "./ouv-d";
import { OuvertureE } from "./ouv-e";

/** Une ouverture à l'instant `t` (s) ; `boucle` : redessinée dans son état final (FIN-C). */
export function DessinOuverture({ d, t, format, boucle }: { d: DonneesOuverture; t: number; format: FormatIV; boucle?: BoucleC }) {
  switch (d.code) {
    case "OUV-A":
      return <OuvertureA d={d} t={t} format={format} boucle={!!boucle} />;
    case "OUV-B":
      return <OuvertureB d={d} t={t} format={format} boucle={!!boucle} />;
    case "OUV-C":
      return <OuvertureC d={d} t={t} format={format} boucle={boucle} />;
    case "OUV-D":
      return <OuvertureD d={d} t={t} format={format} boucle={!!boucle} />;
    case "OUV-E":
      return <OuvertureE d={d} t={t} format={format} boucle={!!boucle} />;
  }
}

export function EcranOuverture(p: ProprietesEcranVariete) {
  const frame = useCurrentFrame();
  const d = p.bloc.donnees as DonneesOuverture | null;
  const format: FormatIV = p.variete?.format ?? (p.hauteur < p.largeur * 1.5 ? "4:5" : "9:16");
  if (!d) {
    return (
      <AbsoluteFill>
        <Fond fond="ivoire" largeur={p.largeur} hauteur={p.hauteur} />
        <Entete entete={null} ecoule={0} sortie={0} fond="ivoire" marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
      </AbsoluteFill>
    );
  }
  return <DessinOuverture d={d} t={frame / p.fps} format={format} />;
}
