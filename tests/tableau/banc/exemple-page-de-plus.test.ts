/**
 * PANNE DU BROUILLON v-874530b87628 (17/10/2026, Formation → ardoise, même texte que v-6616b3800357) : la relecture
 * refusait « La ligne « Avant, ses notes partaient 3 jours après. » contient un chiffre sans élément chiffre sourcé ».
 * Cause : la page de plus (`pagesDuStyle`) sépare « Avant / Maintenant » de la scène qui porte la mention « Exemple
 * illustratif » ; la règle ne voyait plus la page suivante comme un exemple. L'exemple se lit maintenant par partie.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { pagesExempleIllustratif, regleChiffresSources } from "../../../src/moteurs/montage-tableau/regles";

const brut = JSON.parse(readFileSync(join(__dirname, "..", "temoins", "fiche-temoin-v-6616b3800357-reference-3.json"), "utf8"));
const temoin = (): FicheTableau => structuredClone(brut.fiche ?? brut);

/** La fiche telle que le découpage réel la rend après la page de plus : la mention reste sur « Un chef d'atelier ». */
function scindee(): FicheTableau {
  const f = temoin();
  for (const s of f.scenes) {
    if (s.id === "s08") s.elements = s.elements.filter((e) => e.type !== "mention");
    if (s.id === "s08" || s.page > 7) s.page += 1;
  }
  return f;
}

const contexte = { sourcesChiffres: [] } as unknown as Parameters<typeof regleChiffresSources>[1];

describe("l'exemple illustratif reste un exemple après une page de plus", () => {
  it("la page « Avant / Maintenant », séparée de sa mention, est une page d'exemple", () => {
    expect([...pagesExempleIllustratif(scindee()).keys()].sort()).toEqual([7, 8]);
  });

  it("ses chiffres dits (« 3 jours », « 10 min ») ne sont pas refusés", () => {
    expect(regleChiffresSources(scindee(), contexte).filter((m) => m.sceneId === "s08")).toEqual([]);
  });

  it("sans aucune mention dans la partie, la page n'est pas un exemple : le chiffre reste refusé", () => {
    const f = scindee();
    for (const s of f.scenes) s.elements = s.elements.filter((e) => e.type !== "mention");
    expect(pagesExempleIllustratif(f).size).toBe(0);
    expect(regleChiffresSources(f, contexte).some((m) => m.sceneId === "s08")).toBe(true);
  });
});
