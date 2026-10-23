/** Diagnostic (sans rendu) : écrans refusés par les contrôles du dessin, fiches réelles et témoins, dans les 5 formats. */
import { cadresVidesV2, controleRemplissageV2, etiquettesIncoherentesV2, pictogrammesFautifsV2, textesCoupesV2, textesEnDoubleV2 } from "../../../src/briques/tableau-scene/v2/remplissage";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { FICHES_REELLES, appelDe, ficheReelle } from "./fiches-reelles";
import { ficheFormation } from "../style-v2/temoin-formation";
import { EXEMPLES } from "../regles/exemples";
const seules = process.argv.slice(2);
const fiches: [string, FicheTableau][] = [...FICHES_REELLES.map((f) => [f.nom, ficheReelle(f.nom)] as [string, FicheTableau]), ["Formation", ficheFormation()], ...Object.entries(EXEMPLES).map(([n, x]) => [n, { ...x, habillage: "blocs/2" }] as [string, FicheTableau])];
for (const [nom, f] of fiches) {
  if (seules.length && !seules.includes(nom)) continue;
  for (const fmt of IDS_FORMATS_SORTIE) {
    try {
      const m = mettreEnPage(f, { appel: appelDe(f), ...(fmt === "vertical" ? {} : { format: fmt }) });
      const g = m.styleV2!.geometrie;
      for (const e of m.styleV2!.ecrans) {
        const autorises = new Set(f.scenes.find((s) => s.id === e.sceneId)!.elements.flatMap((x) => (x.type === "dessin" ? [x.dessinId] : [])));
        const fautes = [controleRemplissageV2(e, g) ?? "", ...cadresVidesV2(e, g), ...textesCoupesV2(e, g), ...pictogrammesFautifsV2(e, autorises), ...etiquettesIncoherentesV2(e), ...textesEnDoubleV2(e).map((t) => `double « ${t} »`)].filter(Boolean);
        if (fautes.length) console.log(nom, fmt, e.id, e.gabarit, "→", fautes.join(" | "));
      }
    } catch (x) {
      console.log(nom, fmt, "ERREUR", String(x).slice(0, 200));
    }
  }
}
