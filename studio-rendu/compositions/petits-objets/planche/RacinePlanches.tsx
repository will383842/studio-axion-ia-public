/** Racine des planches de petits objets (C9-39) : 2 formats × 2 fonds. Entrée à part, jamais `compositions/Racine.tsx`. */
import { Composition } from "remotion";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import { PlancheTraits, DIMENSIONS_PLANCHE, FPS_PLANCHE, type FormatPlanche } from "./PlancheTraits";

const FORMATS: FormatPlanche[] = ["9x16", "4x5"];
const FONDS: FondAxion[] = ["ivoire", "noir"];

export const IDS_PLANCHES_TRAITS = FORMATS.flatMap((f) => FONDS.map((fond) => ({ id: `planche-traits-${f}${fond === "noir" ? "-noir" : "-ivoire"}`, format: f, fond })));

export function RacinePlanches() {
  return (
    <>
      {IDS_PLANCHES_TRAITS.map(({ id, format, fond }) => (
        <Composition key={id} id={id} component={() => <PlancheTraits fond={fond} format={format} />} durationInFrames={1} fps={FPS_PLANCHE} width={DIMENSIONS_PLANCHE[format].largeur} height={DIMENSIONS_PLANCHE[format].hauteur} />
      ))}
    </>
  );
}
