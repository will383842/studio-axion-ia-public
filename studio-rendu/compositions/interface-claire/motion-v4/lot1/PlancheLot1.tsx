import React from "react";
/** Racine Remotion du banc d'essai du lot 1 v4 : une composition par extrait (`Extrait-<Nom>`) et l'enchaînement de 15 s. Contrôle seulement, jamais branché en production. */
import { Composition } from "remotion";
import { DUREES_EXTRAITS, IDS_ELEMENTS, Scene, TOTAL_ENCHAINEMENT, definitions, enchainement } from "./ScenesLot1";
import type { Palette } from "./commun-lot1";

type Props = { palette: Palette; fondTest?: string };
const Extrait = (id: string) => ({ palette, fondTest }: Props) => <Scene def={{ ...definitions(palette)[id], palette }} fondTest={fondTest} />;
const Ench = ({ palette, fondTest }: Props) => <Scene def={{ ...enchainement(palette), palette }} fondTest={fondTest} />;

export function RacineLot1() {
  return (
    <>
      {IDS_ELEMENTS.map((id) => (
        <Composition key={id} id={`Extrait-${id}`} component={Extrait(id)} durationInFrames={DUREES_EXTRAITS[id]} fps={30} width={1080} height={1920} defaultProps={{ palette: "B" as Palette, fondTest: "prise" }} />
      ))}
      <Composition id="Enchainement" component={Ench} durationInFrames={TOTAL_ENCHAINEMENT} fps={30} width={1080} height={1920} defaultProps={{ palette: "B" as Palette, fondTest: "prise" }} />
    </>
  );
}
