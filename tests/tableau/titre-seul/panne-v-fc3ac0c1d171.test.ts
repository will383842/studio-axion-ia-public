/**
 * PANNE DE LA VIDÉO v-fc3ac0c1d171 (17/10/2026, Formation → ardoise) : le texte de v-6616b3800357, page 2 découpée
 * autrement. Voix « Le compte rendu arrive enfin : quatre pages. On y cherche encore qui fait quoi. Alors on refait la
 * réunion. » ; écrit : le TITRE « Qui fait quoi » (un fragment de la 2e phrase), la phrase « On y cherche encore qui fait
 * quoi. », puis « Alors on refait la réunion. » ; un dessin (document) dit dès le début de la page.
 * Refus après la voix : « Scène s02 · Titre jamais seul : page 2 : le titre « Qui fait quoi » reste seul 1,2 s avant que
 * « On y cherche encore qui fait quoi. » commence à s'écrire. » Cause : le dessin, dit au début de la page, se traçait
 * entre le titre et la phrase (l'outil fait une chose à la fois) ; la garde de #312 ne le déplaçait pas, son heure
 * tombant pile à la fin de l'effacement. Le moteur serre désormais le titre et le bloc qui le suit (`serrerTitre`).
 */
import { describe, expect, it } from "vitest";
import { planPage3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { problemesAnimation3, titreSeulSec, TITRE_SEUL_TABLEAU_MAX_SEC } from "../../../src/moteurs/montage-tableau/controles-v3";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { contexteBanc, ficheV6616, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { doubles } from "../fabriquer/doubles";
import { ficheVfc3, proprietesVfc3 } from "./fiche-vfc3";

const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;

describe("v-fc3ac0c1d171 : un titre qui arrive avant la voix ne fait plus échouer la vidéo", () => {
  it("la fiche est celle du témoin v-6616b3800357, seule la page 2 change", () => {
    const a = ficheV6616();
    const b = ficheVfc3();
    expect(b.scenes.map((s) => s.texteDit)).toEqual(a.scenes.map((s) => s.texteDit));
    const p2 = b.scenes.find((s) => s.id === "s02")!;
    expect(p2.elements.map((e) => (e.type === "ligne" ? `${e.bloc}:${e.texte}` : e.type))).toEqual(["titre:Qui fait quoi", "phrase-cle:On y cherche encore qui fait quoi.", "dessin", "detail:Alors on refait la réunion."]);
  });
  for (const style of STYLES_TABLEAU)
    it(`${style} : page 2, la phrase suit le titre sans attendre (4 formats), le contrôle passe`, () => {
      for (const format of FORMATS) {
        const props = proprietesVfc3(style, format);
        expect(problemesAnimation3(props), format).toEqual([]);
        const p2 = props.find((x) => x.page.page === 2)!;
        const plan = planPage3(p2.page, p2.styleReference!, { largeur: p2.largeur, hauteur: p2.hauteur });
        const m = titreSeulSec(plan, p2.page)!;
        expect(m.seul, format).toBeLessThanOrEqual(TITRE_SEUL_TABLEAU_MAX_SEC);
        // Le dessin dit au début de la page se trace quand même, juste après la phrase (rien n'est perdu).
        const dessin = plan.actions.filter((a) => a.id === p2.page.elements.find((e) => e.type === "mention" && e.tableau?.apres?.length)?.elementId);
        expect(dessin.length, format).toBeGreaterThan(0);
        expect(Math.min(...dessin.map((a) => a.debut)), format).toBeGreaterThan(Math.min(...plan.actions.filter((a) => a.id === m.suivant).map((a) => a.debut)));
      }
    }, 120_000);
  for (const style of STYLES_TABLEAU)
    it(`${style} : la vraie fabrication passe (9:16, 4:5, carré, 16:9)`, async () => {
      const f = { ...ficheVfc3(), styleTableau: style };
      const d = doubles(f);
      const r = await fabriquerTableau({ ...d.outils, contexte: contexteBanc(f, MOTS_DOULEUR_V6616), sorties: [...FORMATS], dejaVu: { coche: true, le: "2026-10-17" } });
      expect(r.manquantes ?? []).toEqual([]);
      expect(r.sorties.map((s) => s.format)).toEqual([...FORMATS]);
      for (const s of r.sorties) expect(s.controles.bloquants, s.format).toEqual([]);
    }, 300_000);
});
