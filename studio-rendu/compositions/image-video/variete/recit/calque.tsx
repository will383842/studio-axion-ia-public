import React from "react";
/**
 * Calque « récit » de la variété (lot REC) : lit `variete.donnees.recit` (posé par l'axe moteur) et dessine, PAR-DESSUS
 * la scène, ce qui accompagne le déroulé tiré : REC-B (résultat puis « comment »), REC-C (le message suivi), REC-D
 * (repère « k/3 » et les trois étapes). Sans données de récit : le contenu tel quel. Dessiné dans l'écran de
 * référence 1080 × 1920, ramené à la largeur de la composition ; la zone d'appoint n'existe qu'en 9:16.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneCalculee } from "../../plan";
import { useVariete } from "../ContexteVariete";
import { fondA, lireDonneesRecit, type DonneesRecit } from "./donnees";
import { RecitEtapes } from "./etapes";
import { hautPastilleRecitB, RecitComment, RecitResultat } from "./resultat";
import { RecitSuivi } from "./suivi";

function Dessin({ d, t, appoint, scene, haut, masques }: { d: DonneesRecit; t: number; appoint: boolean; scene: SceneCalculee | null; haut: number; masques: readonly { debut: number; fin: number }[] }) {
  const fond = fondA(d.fonds, t);
  switch (d.code) {
    case "REC-B":
      return d.role === "resultat" ? <RecitResultat t={t} fond={fond} cartes={d.appoint} appoint={appoint} /> : <RecitComment t={t} fond={fond} resultat={d.resultat} jusqua={d.jusqua} cartes={d.appoint} appoint={appoint} haut={haut} masques={masques} />;
    case "REC-C":
      return <RecitSuivi t={t} fond={fond} scene={scene} libelle={d.libelle} depart={d.depart} noeuds={d.noeuds} reponse={d.reponse} masques={d.masques} appoint={appoint} />;
    case "REC-D":
      return <RecitEtapes t={t} fond={fond} changements={d.changements} total={d.total} etapes={d.etapes} place={d.place} masques={d.masques} appoint={appoint} />;
  }
}

export function CalqueRecit({ children }: { children: ReactNode }) {
  const variete = useVariete();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const d = lireDonneesRecit(variete?.donnees.recit);
  if (!variete || !d) return <>{children}</>;
  const scene = variete.scene && typeof variete.scene === "object" && "parId" in variete.scene ? (variete.scene as SceneCalculee) : null;
  return (
    <>
      {children}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${width / 1080})`, transformOrigin: "0 0" }}>
          <Dessin d={d} t={frame / fps} appoint={variete.format === "9:16"} scene={scene} haut={hautPastilleRecitB(variete.format)} masques={variete.ensembles ?? []} />
        </div>
      </AbsoluteFill>
    </>
  );
}
