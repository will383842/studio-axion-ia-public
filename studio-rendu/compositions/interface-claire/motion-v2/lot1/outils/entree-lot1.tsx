import React from "react";
/**
 * BANC D'ESSAI du lot 1 (outil de planche, pas utilisé en production) : une composition par élément, fond TRANSPARENT,
 * 1080 × 1920 à 30 i/s, avec les données d'exemple. Les stills sont ensuite posés sur une image de Will (ffmpeg / PIL).
 */
import { Composition, Img, registerRoot, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../../commune/polices";
import { AutocollantMot } from "../AutocollantMot";
import { FlecheFeutre } from "../FlecheFeutre";
import { ScotchPostit } from "../ScotchPostit";
import { TamponDechirure } from "../TamponDechirure";
import { TicketDechireHaut } from "../TicketDechireHaut";

export const DEBUT_IMAGE = 12;
const W = 1080;
const H = 1920;
const fps = 30;

type Props = { fond?: boolean; debutImg?: number; visible?: number };

function Banc({ id, fond, debutImg = DEBUT_IMAGE, visible }: { id: string } & Props) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const f = useCurrentFrame();
  const t = f / fps;
  const debut = debutImg / fps;
  const dv = (defaut: number) => (visible !== undefined ? visible / fps : defaut);
  const base = { t, debut, largeurImage: W, hauteurImage: H };
  const el = (() => {
  switch (id) {
    case "autocollant-mot":
      return <AutocollantMot {...base} fin={debut + dv(1.5)} mot="DEVIS" />;
    case "scotch-postit":
      return <ScotchPostit {...base} fin={debut + dv(1.8)} lignes={["ENVOYER", "LE", "DEVIS"]} />;
    case "tampon-dechirure":
      return <TamponDechirure {...base} mot="RÉGLÉ" />;
    case "fleche-feutre":
      return <FlecheFeutre {...base} fin={debut + dv(1.6)} mot="REGARDEZ" />;
    case "ticket-dechire-haut":
      return <TicketDechireHaut {...base} fin={debut + dv(1.8)} mot="LE PROBLÈME" />;
    default:
      return null;
  }
  })();
  return (
    <>
      {fond && <Img src={staticFile("prise.png")} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />}
      {el}
    </>
  );
}

export const IDS_LOT1 = ["autocollant-mot", "scotch-postit", "tampon-dechirure", "fleche-feutre", "ticket-dechire-haut"] as const;

registerRoot(() => (
  <>
    {IDS_LOT1.map((id) => (
      <Composition key={id} id={id} component={(pr: Props) => <Banc id={id} {...pr} />} width={W} height={H} fps={fps} durationInFrames={90} />
    ))}
  </>
));
