/**
 * BR-TABLEAU-RACCORDS-b · l'option `raccords` des outils du moteur tableau pose les fondus entre scènes dessinées.
 * Chemin réel : vraie `fabriquerTableau`, outils simulés, dépôts en mémoire, aucune dépense. Éteint = identique.
 * Le réglage qui passera l'option est lu par BR-TABLEAU-RACCORDS-c (pas ici).
 */
import { describe, expect, it } from "vitest";
import { commandeTableau, fabriquerTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ParametresDemandeComposition } from "../../../src/briques/composition/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { RECETTE_COMPOSITION_AVOCAT } from "../../../src/moteurs/montage-avocat/recette-composition";
import { argumentsImageFfmpeg } from "../../../studio-rendu/src/composition/image-ffmpeg";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

type Complet = Extract<ParametresDemandeComposition, { mode: "complet" }>;
const COULEURS = { grainPct: 0, grainTaillePx: 2, vignettePct: 0 };

async function fabriquer(raccords: boolean) {
  const d = doubles(ficheDemonstration, { fin: "Enregistrez cette vidéo pour la refaire" });
  await fabriquerTableau(raccords ? { ...d.outils, raccords: true } : d.outils);
  return { p: d.compositionsSoumises()[0].parametres as unknown as Complet, cle: d.journal.valeur!.etapes.composition!.empreinte };
}

describe("tableau : raccords entre scènes (option des outils)", () => {
  it("(a) sans option : aucun raccord, commande et clé de composition comme avant", async () => {
    const { p, cle } = await fabriquer(false);
    expect(p.image.raccords).toBeUndefined();
    expect((await fabriquer(false)).cle).toBe(cle);
  });

  it("(b) avec raccords: true : des fondus entre voisines assez longues, durée identique, clé différente, xfade au rendu", async () => {
    const a = await fabriquer(false);
    const b = await fabriquer(true);
    const r = b.p.image.raccords!;
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(x.type).toBe("fondu");
      for (const pl of [b.p.image.plans[x.indexAvant]!, b.p.image.plans[x.indexAvant + 1]!]) {
        expect(pl.type).toBe("illustration");
        expect(pl.finSec - pl.debutSec).toBeGreaterThanOrEqual(0.6 - 1e-9);
      }
    }
    expect(b.p.image.images).toBe(a.p.image.images);
    expect(b.cle).not.toBe(a.cle);
    const illustrations = Object.fromEntries(b.p.image.plans.map((_, i) => [i, { fichier: `s${i}.mp4`, video: true }]));
    const args = argumentsImageFfmpeg(b.p.image, COULEURS, { doubles: { principal: { fichier: "d.mp4", video: true } }, illustrations, luts: [], son: "son.wav" }, b.p.image.images / b.p.image.fps, "m.mov");
    expect(args.join(" ")).toContain("xfade");
  });

  it("(c) paramètres : sans entrée → jamais de raccords (tableau, avocat) ; chaîne « true » → rien ; true exact → des raccords", () => {
    const scenes = [0, 1, 2].map((k) => ({ id: `s${k}`, debutSec: k * 2, finSec: k * 2 + 2, cle: `k${k}.mp4` }));
    const base = commandeTableau({ videoId: "v", fiche: ficheDemonstration, texteScript: "un deux trois", dureeSec: 6, centreSousTitresPct: 50, scenes });
    const calcul = (entrees: Record<string, unknown> | null, recette: typeof RECETTE_COMPOSITION_TABLEAU) =>
      parametresComposition(entrees ? { ...base, entrees } : base, { ratio: "9:16", plans: plansTableau(scenes), segments: [], dureeSec: 6, pistesDouble: { face: "k0.mp4" } }, recette).image.raccords;
    for (const recette of [RECETTE_COMPOSITION_TABLEAU, RECETTE_COMPOSITION_AVOCAT]) {
      expect(calcul(null, recette)).toBeUndefined();
      expect(calcul({}, recette)).toBeUndefined();
      expect(calcul({ raccordsTableau: "true" }, recette)).toBeUndefined();
      expect(calcul({ raccordsTableau: 1 }, recette)).toBeUndefined();
    }
    expect(calcul({ raccordsTableau: true }, RECETTE_COMPOSITION_TABLEAU)).toEqual([{ indexAvant: 0, type: "fondu" }, { indexAvant: 1, type: "fondu" }]);
  });
});
