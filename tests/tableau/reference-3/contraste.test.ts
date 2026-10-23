/**
 * CONTRASTE MESURÉ du style « reference/3 » (regard de Will du 15/10/2026 : « il faut l'EXTRÊME PERFECTION et il manque
 * un peu de CONTRASTE ») : tout texte ≥ 4,5 pour 1 (WCAG AA) sur son fond, tout trait, icône ou élément graphique
 * porteur de sens ≥ 3 pour 1. Le rapport est celui des WCAG 2 (luminance relative de sRGB).
 *
 * Chaque couleur que dessine la page (`PageReference3.tsx`, `mise-en-page-v3.ts`, `animation-3.ts`) doit figurer
 * ci-dessous, avec son ou ses fonds, ou dans la courte liste des teintes qui ne sont que des fonds : une couleur
 * ajoutée sans mesure fait échouer le test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { C, MESURES_CONTRASTE_3, SEUILS_CONTRASTE, SEULEMENT_FONDS, mesuresContraste3, rapportContraste, type Cle } from "./contrastes";

describe("contraste mesuré du style reference/3", () => {
  it("le calcul suit les WCAG 2 (noir / blanc = 21, même couleur = 1)", () => {
    expect(rapportContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(rapportContraste("#B44F29", "#B44F29")).toBe(1);
  });

  for (const m of mesuresContraste3())
    it(`${m.sorte} ${m.nom} ${m.couleur} sur ${m.nomFond} ${m.fond} ≥ ${m.seuil} pour 1 (${m.usage})`, () => {
      expect(m.rapport, `${m.couleur} sur ${m.fond} : ${m.rapport} pour 1`).toBeGreaterThanOrEqual(m.seuil);
    });

  it("chaque couleur de la charte que la page dessine est mesurée", () => {
    const racine = join(__dirname, "../../..");
    const sources = ["studio-rendu/compositions/tableau/reference/PageReference3.tsx", "src/moteurs/montage-tableau/mise-en-page-v3.ts", "src/briques/tableau-scene/reference/animation-3.ts"].map((f) => readFileSync(join(racine, f), "utf8")).join("\n");
    const employees = new Set([...sources.matchAll(/\b(?:C|COULEURS_REFERENCE_3)\.(\w+)/g)].map((x) => x[1]));
    const mesurees = new Set<string>([...MESURES_CONTRASTE_3.map((m) => m.couleur), ...SEULEMENT_FONDS]);
    for (const c of employees) expect(Object.keys(C), `C.${c}`).toContain(c);
    expect([...employees].filter((c) => !mesurees.has(c)), "couleurs dessinées sans mesure de contraste").toEqual([]);
    // Toutes les couleurs dessinées en trait ou en texte sont mesurées, jamais seulement déclarées comme fond.
    for (const c of ["mention", "chapitreAVenir", "attente", "barreFond", "icone", "bordCarte", "accentTexte", "mine", "accent"] as const) expect(employees.has(c), c).toBe(true);
  });

  it("la hiérarchie reste : titres à l'encre, mentions un cran plus douces mais lisibles, chapitre à venir plus doux qu'un chapitre fait", () => {
    const r = (c: Cle) => rapportContraste(C[c], C.fond);
    expect(r("encre")).toBeGreaterThan(r("mention"));
    expect(r("mention")).toBeGreaterThan(r("chapitreAVenir"));
    expect(r("chapitreAVenir")).toBeGreaterThanOrEqual(SEUILS_CONTRASTE.texte);
  });
});
