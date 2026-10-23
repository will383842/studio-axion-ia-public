/**
 * RELECTURE DU 15/10 (défilement `docs/formats/apercus-reference-3/apres/defilement-vertical.jpg`) : le bas des pages
 * était vide, des pages presque vides (titre seul et crayon) pendant 2 s, la page d'appel figée ~10 s. Chaque règle a
 * son test, dans les quatre sorties, sur le témoin (v-f1739d6a4f51) ET sur le script Formation v3 :
 *  - le contenu fini de chaque page couvre ≥ 60 % de la hauteur utile, centré à ±12 % du centre de la zone sûre ;
 *  - en vertical : titre ≥ 110 px, texte principal ≥ 72 px, détails et listes ≥ 52 px (charte Axion, 15/10) ;
 *  - à chaque changement de page, le titre et la première phrase arrivent ensemble ;
 *  - la page d'appel n'arrive pas avant la voix, et ne reste jamais immobile plus de 3 s.
 */
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { battement3, immobileMax3, planPage3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { RYTHME_REFERENCE_3 } from "../../../src/briques/tableau-scene/reference/charte";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerAnimation3, mesureContenu3, pagesVides3 } from "../../../src/moteurs/montage-tableau/controles-v3";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeFormationV3, caleeTemoin3 } from "./fiches";

const VIDEOS = [
  ["témoin v-f1739d6a4f51", caleeTemoin3],
  ["script Formation v3", caleeFormationV3],
] as const;

const mise = (c: (typeof VIDEOS)[number][1], format: (typeof IDS_FORMATS_SORTIE)[number]) => mettreEnPage(c().fiche, format === "vertical" ? {} : { format });
const proprietes = (c: (typeof VIDEOS)[number][1], format: (typeof IDS_FORMATS_SORTIE)[number]) => {
  const { fiche, mots, elements } = c();
  return proprietesScenes({ miseEnPage: mise(c, format) as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, temps3: tempsReference3(fiche, mots) });
};

for (const [nom, calee] of VIDEOS)
  describe(nom, () => {
    it("chaque page : contenu ≥ 60 % de la hauteur utile, centré à ±12 % (quatre sorties)", () => {
      for (const format of IDS_FORMATS_SORTIE) {
        const m = mise(calee, format);
        expect(pagesVides3(m).map((f) => `${format} · ${f.message}`)).toEqual([]);
        for (const p of m.pages) {
          const x = mesureContenu3(m, p)!;
          expect(x.couverture, `${format} page ${p.page}`).toBeGreaterThanOrEqual(0.6);
          expect(Math.abs(x.ecartCentre), `${format} page ${p.page}`).toBeLessThanOrEqual(0.12);
        }
      }
    });

    it("le contrôle est vrai : un contenu collé en haut ou trop court est refusé", () => {
      const m = structuredClone(mise(calee, "vertical"));
      const p = m.pages[1];
      // Le défaut d'avant : le contenu ramassé en haut, sous l'étiquette (ici, 400 px de haut).
      const z = m.zoneSure.px;
      for (const e of p.elements) if (e.gabarit?.sorte !== "partie" && e.type !== "dessin") e.encombrement.px = { ...e.encombrement.px, y: z.y + 200, hauteur: 400 };
      expect(pagesVides3(m).map((f) => f.message).join(" ")).toMatch(/page 2 : le contenu ne couvre que \d+ %.*page 2 : le contenu est centré \d+ % au-dessus/);
    });

    it("vertical : titre ≥ 110 px, phrase clé ≥ 72 px, détails et listes ≥ 52 px", () => {
      const m = mise(calee, "vertical");
      const fautes: string[] = [];
      for (const p of m.pages)
        for (const e of p.elements) {
          const g = e.gabarit?.sorte;
          const min = g === "titre" ? 110 : g === "phrase" ? 72 : g === "appel-plein" ? 72 : g === "code" || g === "case" || (e.type === "ligne" && !g) ? 52 : null;
          if (min && (e.taillePx ?? 0) < min) fautes.push(`page ${p.page} · ${g ?? e.type} ${e.taillePx} px < ${min}`);
        }
      expect(fautes).toEqual([]);
    });

    it("animation : aucun contrôle en faute (titre jamais seul, appel à l'heure et animé…), quatre sorties", () => {
      for (const format of IDS_FORMATS_SORTIE) expect(controlerAnimation3(proprietes(calee, format)).flatMap((c) => c.fautes.map((f) => `${format} · ${c.libelle} : ${f.message}`))).toEqual([]);
    });

    it("à chaque changement de page, le titre et la phrase qui le suit arrivent ensemble", () => {
      const props = proprietes(calee, "vertical");
      for (const p of props) {
        const titre = p.page.elements.find((e) => e.gabarit?.sorte === "titre");
        if (!titre) continue;
        const suivant = p.page.elements.filter((e) => e.type !== "dessin" && e.lignes.length && !["partie", "titre", "pastille", "etiquette"].includes(e.gabarit?.sorte ?? "")).sort((a, b) => a.ordre - b.ordre)[0];
        expect(p.styleReference!.poses, `page ${p.page.page}`).toContain(titre.elementId);
        expect(p.styleReference!.poses, `page ${p.page.page}`).toContain(suivant.elementId);
      }
    });

    it("page d'appel : arrive quand la voix commence sa phrase, soulignée puis battements ; jamais immobile plus de 3 s", () => {
      const props = proprietes(calee, "vertical");
      const p = props.find((x) => x.page.elements.some((e) => e.gabarit?.sorte === "appel-plein"))!;
      const plan = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
      const debuts = p.page.elements.map((e) => p.styleReference!.temps3?.[`${e.elementId}~debut`]).filter((v): v is number => v !== undefined);
      expect(plan.debutPage * 1000).toBeGreaterThanOrEqual(Math.min(...debuts) - 200);
      expect(plan.actions.some((a) => a.partie.startsWith("souligne-appel"))).toBe(true);
      expect(plan.battement!.debuts.length).toBeGreaterThanOrEqual(2);
      const b = plan.battement!.debuts[0];
      expect(battement3(plan, b + RYTHME_REFERENCE_3.battementSec / 2)).toBeGreaterThan(1.02);
      expect(battement3(plan, b - 0.1)).toBe(1);
      const fin = props.at(-1)!.scene.finMs / 1000 - 0.5;
      expect(immobileMax3(plan, plan.finTransition, fin)).toBeLessThanOrEqual(3);
      // Sans les battements, elle resterait figée bien plus de 3 s.
      expect(immobileMax3({ ...plan, battement: { ...plan.battement!, debuts: [] } }, plan.finTransition, fin)).toBeGreaterThan(3);
    });
  });
