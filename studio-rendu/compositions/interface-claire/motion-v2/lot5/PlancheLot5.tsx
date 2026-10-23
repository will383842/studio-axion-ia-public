/**
 * Planche du lot 5 (rendu local de contrôle, NON utilisé en production) : chaque élément posé sur une image fixe de Will.
 * Composition `Lot5Planche` : propriété `element` = id de l'élément ; l'élément dit son mot à 0,5 s (image 15), donc
 * l'image `15 + i` de la composition est l'image `i` du standard (i0, i2, i4, i8, posé…).
 */
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { BadgeRoulant, EXEMPLE_BADGE_ROULANT as BadgeRoulant_DEF, ID_BADGE_ROULANT } from "./BadgeRoulant";
import { BlobMot, EXEMPLE_BLOB_MOT as BlobMot_DEF, ID_BLOB_MOT } from "./BlobMot";
import { BulleCri, EXEMPLE_BULLE_CRI as BulleCri_DEF, ID_BULLE_CRI } from "./BulleCri";
import { DalleClaquee, EXEMPLE_DALLE_CLAQUEE as DalleClaquee_DEF, ID_DALLE_CLAQUEE } from "./DalleClaquee";

const ext = <T extends { a: number; fin: number }>(d: T, a?: number, fin?: number): T => ({ ...d, a: a ?? d.a, fin: fin ?? d.fin });
export const ID_PLANCHE_LOT5 = "Lot5Planche";

export function Lot5Planche({ element, a, fin }: { element: string; a?: number; fin?: number }) {
  chargerPoliceMontserrat();
  const frame = useCurrentFrame();
  const t = frame / 30;
  const W = 1080;
  const H = 1920;
  return (
    <AbsoluteFill style={{ background: "#110A05" }}>
      {/* Prise commune 1080x1920 (planche-v2/prise-commune-1080x1920.png) : ni agrandissement, ni recadrage, ni décalage. */}
      <Img src={staticFile("prise.png")} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      {element === ID_BLOB_MOT && <BlobMot t={t} largeurImage={W} hauteurImage={H} donnees={ext(BlobMot_DEF, a, fin)} />}
      {element === ID_DALLE_CLAQUEE && <DalleClaquee t={t} largeurImage={W} hauteurImage={H} donnees={ext(DalleClaquee_DEF, a, fin)} />}
      {element === ID_BULLE_CRI && <BulleCri t={t} largeurImage={W} hauteurImage={H} donnees={ext(BulleCri_DEF, a, fin)} />}
      {element === ID_BADGE_ROULANT && <BadgeRoulant t={t} largeurImage={W} hauteurImage={H} donnees={ext(BadgeRoulant_DEF, a, fin)} />}
    </AbsoluteFill>
  );
}

export function RacineLot5() {
  return <Composition id={ID_PLANCHE_LOT5} component={Lot5Planche} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={{ element: ID_BLOB_MOT } as { element: string; a?: number; fin?: number }} />;
}
