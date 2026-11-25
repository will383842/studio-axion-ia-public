/** Racine des planches de petits objets (C9-39, C9-40a) : 2 formats × 2 fonds par famille. Entrée à part, jamais `compositions/Racine.tsx`. */
import { Composition } from "remotion";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import { chargerPoliceMarque } from "../../commune/police-marque";
import { PlancheTraits, DIMENSIONS_PLANCHE, FPS_PLANCHE, type FormatPlanche } from "./PlancheTraits";
import { PlancheEtiquettes } from "./PlancheEtiquettes";
import { PlancheEcrans } from "./PlancheEcrans";
import { PlancheManuscrit } from "./PlancheManuscrit";

const FORMATS: FormatPlanche[] = ["9x16", "4x5"];
const FONDS: FondAxion[] = ["ivoire", "noir"];

export const IDS_PLANCHES_TRAITS = FORMATS.flatMap((f) => FONDS.map((fond) => ({ id: `planche-traits-${f}${fond === "noir" ? "-noir" : "-ivoire"}`, format: f, fond })));

const FAMILLES = [
  { nom: "etiquettes", Planche: PlancheEtiquettes },
  { nom: "ecrans", Planche: PlancheEcrans },
  { nom: "manuscrit", Planche: PlancheManuscrit },
] as const;

export const IDS_PLANCHES_FAMILLES = FAMILLES.flatMap(({ nom, Planche }) =>
  FORMATS.flatMap((f) => FONDS.map((fond) => ({ id: `planche-${nom}-${f}-${fond}`, format: f, fond, Planche }))),
);

export function RacinePlanches() {
  chargerPoliceMarque();
  return (
    <>
      {IDS_PLANCHES_TRAITS.map(({ id, format, fond }) => (
        <Composition key={id} id={id} component={() => <PlancheTraits fond={fond} format={format} />} durationInFrames={1} fps={FPS_PLANCHE} width={DIMENSIONS_PLANCHE[format].largeur} height={DIMENSIONS_PLANCHE[format].hauteur} />
      ))}
      {IDS_PLANCHES_FAMILLES.map(({ id, format, fond, Planche }) => (
        <Composition key={id} id={id} component={() => <Planche fond={fond} format={format} />} durationInFrames={1} fps={FPS_PLANCHE} width={DIMENSIONS_PLANCHE[format].largeur} height={DIMENSIONS_PLANCHE[format].hauteur} />
      ))}
    </>
  );
}
