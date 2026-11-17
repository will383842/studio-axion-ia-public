import React from "react";
/**
 * N-17 · PLANCHE DU REPLI (point d'entrée À PART, NON inscrit : jamais importé par la production). Le téléphone qui joue un extrait,
 * posé par le VRAI `rendreElementV4` (donc par le repli du lot 6) sur la prise commune, sans sous-titres.
 * Usage : `npx remotion still entree-repli-lot6.tsx PlancheRepliLot6 --frame=0|45|89` (3 images : début, milieu, fin), pour validation de Williams avant tout allumage.
 * Ce fichier a SON `registerRoot` : c'est pourquoi aucun autre fichier ne doit l'importer (test T4).
 */
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { mediaV4 } from "../communs/medias-v4";
import { rendreElementV4 } from "../registre-v4";
import "./rendus-lot6";

const DUREE_PLANCHE_REPLI_LOT6 = 90;
/** Vidéo d'exemple de `communs/broll` (propriété `media` de la composition pour en essayer une autre). */
const MEDIA_PAR_DEFAUT = "broll/broll-reunion-equipe.mp4";
type Props = { media?: string };

function ScenePlancheRepli({ media }: Props) {
  return (
    <AbsoluteFill>
      <img src={mediaV4("prise-commune-1080x1920.png")} style={{ width: 1080, height: 1920, objectFit: "cover" }} />
      {rendreElementV4({ id: "telephone-video", debut: 0, fin: 3, medias: [media || MEDIA_PAR_DEFAUT] }, { rang: 0 })}
    </AbsoluteFill>
  );
}

export function RacineRepliLot6() {
  return <Composition id="PlancheRepliLot6" component={ScenePlancheRepli} durationInFrames={DUREE_PLANCHE_REPLI_LOT6} fps={30} width={1080} height={1920} defaultProps={{} as Props} />;
}
registerRoot(RacineRepliLot6);
