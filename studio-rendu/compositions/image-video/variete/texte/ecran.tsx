import React from "react";
/**
 * Écran « écran de texte » de la variété (lot TYP-SOU) : TYP-B un mot géant à la fois, TYP-C lignes qui glissent,
 * TYP-D le mot devient l'objet. Chaque mot arrive À L'HEURE DE SON MOT DIT (données du moteur, `axes/typo.ts`).
 * En 9:16, la zone d'appoint (sous les sous-titres) porte la carte de l'icône de la carte, sans mot. Sans données
 * (bouchon du banc) : le fond de la charte et la marque.
 */
import { useCurrentFrame } from "remotion";
import type { ProprietesEcranVariete } from "../CompositionVariete";
import { CadreTexte, CarteAppoint } from "./commun";
import { donneesTexte, rangeesTexte, zonesTexte } from "./donnees";
import { RangeesGlissantes } from "./lignes";
import { MotGeant } from "./mot-geant";
import { MotObjet } from "./mot-objet";

export function EcranTexte(p: ProprietesEcranVariete) {
  const frame = useCurrentFrame();
  const t = frame / p.fps;
  const d = donneesTexte(p.bloc.donnees);
  if (!d) return <CadreTexte fond="ivoire" largeur={p.largeur} hauteur={p.hauteur} marque={p.marque} />;
  const z = zonesTexte(p.hauteur);
  const code = p.bloc.code;
  let corps: React.ReactNode;
  if (code === "TYP-B") corps = <MotGeant d={d} t={t} haut={z.haut} bas={z.bas} />;
  else if (code === "TYP-D" && d.objet) corps = <MotObjet d={d} t={t} haut={z.haut} bas={z.bas} />;
  else corps = <RangeesGlissantes lignes={d.lignes} rangees={rangeesTexte(d.lignes, z.haut, z.bas, 920, 280)} fond={d.fond} t={t} haut={z.haut} bas={z.bas} />;
  return (
    <CadreTexte fond={d.fond} largeur={p.largeur} hauteur={p.hauteur} marque={p.marque}>
      {corps}
      {z.appoint ? <CarteAppoint y={z.appoint.y} h={z.appoint.h} fond={d.fond} icone={d.icone} t={t} /> : null}
    </CadreTexte>
  );
}
