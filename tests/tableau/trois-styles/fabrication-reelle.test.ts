/**
 * PANNE EN PRODUCTION DU 17/10/2026 (vidéo v-b2d772d28b97, série Formation donc ardoise, TikTok, fin « appel de
 * diagnostic ») : la fabrication s'arrêtait à l'étape « Les pages » : « Le dessin des scènes n'a pas abouti. Scène s01 ·
 * « s01~visuel » n'a pas de taille de texte… ». Les dessins des trois styles (croquis : dessin illustré, visuel, dessin
 * de la banque, séparateur, flèche, carte) ne portent que des traits, aucune ligne de texte ; le contrôle des propriétés
 * de scène (`controlerProprietes`) leur demandait une taille de texte. Les tests de #289 ne faisaient jamais passer une
 * fiche par ce contrôle.
 *
 * Ici, le VRAI chemin : (1) mise en page → propriétés de chaque scène → les contrôles de l'étape « scènes » de
 * `fabriquer.ts` (propriétés, animation « reference/3 », animation des trois styles), dans les 3 styles et les 4
 * formats ; (2) la fabrication entière (`fabriquerTableau`, doubles sans appel payant), toutes les sorties dont TikTok ;
 * (3) le contrôle refuse toujours un TEXTE sans taille.
 */
import { describe, expect, it } from "vitest";
import { controlerProprietes, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerAnimationTableau } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { problemesAnimation3 } from "../../../src/moteurs/montage-tableau/controles-v3";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_SORTIES } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { doubles } from "../fabriquer/doubles";
import { calee, contexteTableau, ficheDemonstration3Gestes, ficheTemoinV667Corrige } from "./fiches";

const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;
const FICHES: readonly [string, (s: StyleTableau) => FicheTableau][] = [
  ["témoin v-667edcd8e3a8", ficheTemoinV667Corrige],
  ["démonstration en 3 gestes (v-b2d772d28b97)", ficheDemonstration3Gestes],
];
const PREUVES = { "mat-mails-demo": { phrase: "Posez-moi trois questions", testeLe: "2026-10-09" }, "mat-compte-rendu-demo": { phrase: "Rédige le compte rendu", testeLe: "2026-10-09" } };

/** Les propriétés des scènes d'une sortie, comme l'étape « scènes » de `fabriquer.ts` les construit. */
function proprietesReelles(f: FicheTableau, format: (typeof FORMATS)[number]): ProprietesTableauScene[] {
  const c = calee(f);
  expect(c.refus).toEqual([]);
  const m = mettreEnPage(c.fiche, { preuves: PREUVES, ...(format === "vertical" ? {} : { format }) });
  return proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, preuves: PREUVES, mots: c.mots, temps3: tempsReference3(c.fiche, c.mots) });
}

/** Les contrôles de l'étape « scènes » de `fabriquer.ts` (ligne « const problemes = … »). */
const problemesEtapeScenes = (props: ProprietesTableauScene[]) => [...props.flatMap((p) => controlerProprietes(p)), ...problemesAnimation3(props as never), ...controlerAnimationTableau(props).map((x) => `${x.page ? `Page ${x.page} · ` : ""}${x.detail}`)];

describe("la fiche réaliste est une vraie fiche (acceptée par les 17 règles, calée)", () => {
  for (const style of STYLES_TABLEAU)
    it(style, () => {
      const f = ficheDemonstration3Gestes(style);
      const v = validerFicheTableau(f, contexteTableau(f));
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
      expect(calee(f).refus).toEqual([]);
      // Ce qui a arrêté la production : un visuel, un dessin de la banque, un exemple « Avant / Maintenant ».
      expect(f.scenes.some((s) => s.gabarit?.visuel)).toBe(true);
      expect(f.scenes.some((s) => s.elements.some((e) => e.type === "dessin"))).toBe(true);
    });
});

for (const style of STYLES_TABLEAU)
  for (const [nom, fiche] of FICHES)
    describe(`${style} · ${nom} : l'étape « scènes » de la fabrication accepte chaque scène`, () => {
      for (const format of FORMATS)
        it(format, () => {
          const props = proprietesReelles(fiche(style), format);
          expect(props.length).toBeGreaterThan(5);
          expect(problemesEtapeScenes(props)).toEqual([]);
          // Les dessins sont bien là (non masqués) : des éléments sans texte, faits de traits.
          const croquis = props.flatMap((p) => p.page.elements).filter((e) => !e.lignes.length && e.tableau?.apres?.length);
          expect(croquis.length).toBeGreaterThan(3);
        });
    });

describe("la fabrication entière (doubles, aucun appel payant), toutes les sorties dont TikTok et Shorts", () => {
  for (const style of STYLES_TABLEAU)
    for (const [nom, fiche] of FICHES)
      it(`${style} · ${nom}`, async () => {
        const f = fiche(style);
        const d = doubles(f);
        const r = await fabriquerTableau({ ...d.outils, contexte: contexteTableau(f), sorties: [...IDS_SORTIES], dejaVu: { coche: true, le: "2026-10-16" } });
        expect(r.manquantes ?? []).toEqual([]);
        expect(r.sorties.map((s) => s.format)).toEqual([...IDS_SORTIES]);
        expect(r.controles.bloquants.map((b) => `${b.libelle} : ${b.raison}`)).toEqual([]);
      }, 120_000);
});

describe("le contrôle des propriétés refuse toujours un TEXTE sans taille", () => {
  const scene = () => proprietesReelles(ficheDemonstration3Gestes("ardoise"), "vertical")[3];
  it("une ligne de texte sans taille → refusée", () => {
    const p = structuredClone(scene());
    const e = p.page.elements.find((x) => x.lignes.length && x.sceneId === p.scene.id)!;
    delete e.taillePx;
    expect(controlerProprietes(p)).toContain(`Scène ${p.scene.id} · « ${e.elementId} » n'a pas de taille de texte.`);
  });
  it("un élément qui écrit (police posée) sans ligne ni taille → refusé", () => {
    const p = structuredClone(scene());
    const e = p.page.elements.find((x) => x.lignes.length && x.tableau?.lignes.length)!;
    e.lignes = [];
    delete e.taillePx;
    expect(controlerProprietes(p).join(" ")).toMatch(/n'a pas de taille de texte/);
  });
  it("un élément vide (ni texte ni trait) → refusé", () => {
    const p = structuredClone(scene());
    const e = p.page.elements.find((x) => !x.lignes.length && x.tableau?.apres?.length)!;
    delete e.tableau;
    expect(controlerProprietes(p)).toContain(`Scène ${p.scene.id} · « ${e.elementId} » n'a pas de taille de texte.`);
  });
  it("un croquis (traits seuls) → accepté", () => {
    const p = scene();
    expect(p.page.elements.some((x) => !x.lignes.length && x.tableau?.apres?.length)).toBe(true);
    expect(controlerProprietes(p)).toEqual([]);
  });
});
