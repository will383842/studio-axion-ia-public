/**
 * GV2-41 : le tableau animé trace le dessin du registre choisi pour le script (et non un dessin tiré de mots-clés).
 * Repli : le dessin du thème, comme avant (page sans dessin, dessin inconnu, chemin illisible).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DESSINS } from "../../../src/briques/dessins/registre/index";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { plume, graineDe, boiteTraits, type TraitTableau } from "../../../src/briques/tableau-scene/trois-styles/trace";
import { CHARTES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tracesDuRegistre } from "../../../src/moteurs/montage-tableau/mise-en-page-tableau";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { ficheDemonstration3Gestes } from "./fiches";

/** La page 2 de la démonstration, seule ; son dessin est celui demandé (`null` : aucun dessin). */
function page(style: StyleTableau, dessinId: string | null) {
  const f = ficheDemonstration3Gestes(style);
  const scenes = f.scenes
    .filter((x) => x.id === "s02")
    .map((x) => ({ ...x, elements: x.elements.flatMap((e): (typeof e)[] => (e.type !== "dessin" ? [e] : dessinId ? [{ ...e, dessinId } as typeof e] : [])) }));
  const m = mettreEnPage({ ...f, scenes } as FicheTableau, {});
  const el = m.pages[0].elements.find((e) => e.elementId === (dessinId ? "e03" : "s02~croquis")) as { tableau?: { apres?: TraitTableau[] } } | undefined;
  const traits: TraitTableau[] = el?.tableau?.apres ?? [];
  return { traits, m };
}
const empreinte = (ts: TraitTableau[]) => createHash("sha1").update(JSON.stringify(ts)).digest("hex").slice(0, 12);

const IDS = DESSINS.map((d) => d.id);

describe("GV2-41 : le dessin choisi pour le script est tracé", () => {
  it("le registre compte 40 dessins", () => expect(IDS).toHaveLength(40));

  for (const style of STYLES_TABLEAU)
    it(`${style} : chacun des 40 dessins donne des traits non vides, tous dans la boîte de la page`, () => {
      for (const id of IDS) {
        const { traits, m } = page(style, id);
        expect(traits.length, id).toBeGreaterThan(0);
        const b = boiteTraits(traits);
        expect(b.x, id).toBeGreaterThanOrEqual(-0.5);
        expect(b.y, id).toBeGreaterThanOrEqual(-0.5);
        expect(b.x + b.largeur, id).toBeLessThanOrEqual(m.largeurPx + 0.5);
        expect(b.y + b.hauteur, id).toBeLessThanOrEqual(m.hauteurPx + 0.5);
      }
    });

  for (const style of STYLES_TABLEAU)
    it(`${style} : la page qui porte le dessin « cible » ne trace plus le dessin du thème « notes »`, () => {
      const cible = page(style, "cible").traits;
      const notes = page(style, "dessin-inconnu-du-registre").traits;
      expect(notes.length).toBeGreaterThan(0);
      expect(empreinte(cible)).not.toBe(empreinte(notes));
      // Deux dessins du registre ne se ressemblent pas non plus.
      expect(empreinte(cible)).not.toBe(empreinte(page(style, "horloge").traits));
    });

  for (const style of STYLES_TABLEAU)
    it(`${style} : aucun des 40 dessins ne retombe sur le dessin du thème (aucun repli)`, () => {
      const theme = empreinte(page(style, "dessin-inconnu-du-registre").traits);
      const replis = IDS.filter((id) => empreinte(page(style, id).traits) === theme);
      expect(replis).toEqual([]);
    });

  for (const style of STYLES_TABLEAU)
    it(`${style} : deux rendus de la même page donnent les mêmes traits`, () => {
      for (const id of ["cible", "enveloppe", "engrenage"]) expect(page(style, id).traits).toEqual(page(style, id).traits);
    });

  // Empreintes relevées sur la branche de départ (avant GV2-41) : une page SANS dessin garde exactement ses traits.
  const AVANT: Record<StyleTableau, string> = { "tableau-blanc": "a4b8263c2dac", ardoise: "3909e03982c7", paperboard: "fbd8409f03e2" };
  for (const style of STYLES_TABLEAU)
    it(`${style} : une page sans dessin garde exactement les traits d'avant (même thème, même tracé)`, () => {
      expect(empreinte(page(style, null).traits)).toBe(AVANT[style]);
    });

  it("un dessin inconnu du registre : repli sur le thème, la page garde un dessin", () => {
    for (const style of STYLES_TABLEAU) expect(page(style, "dessin-inconnu-du-registre").traits.length).toBeGreaterThan(0);
    for (const style of STYLES_TABLEAU) expect(tracesDuRegistre(plume(CHARTES_TABLEAU[style], graineDe("x")), "dessin-inconnu-du-registre", style)).toBeNull();
  });

  it("chacun des 40 dessins du registre est lisible (aucun repli par thème n'est pris)", () => {
    for (const id of IDS) expect(tracesDuRegistre(plume(CHARTES_TABLEAU.ardoise, graineDe(id)), id, "ardoise"), id).not.toBeNull();
  });
});
