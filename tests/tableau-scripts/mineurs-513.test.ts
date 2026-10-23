/** Mineurs de la PR #513 : « visez le haut des repères de CHAQUE passage » ne vaut que pour 60 s avec 2 constats ; 30 s et 3 constats ont leur consigne. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BORNES_PASSAGES, MOTS_SCRIPT, repereConstats } from "@/domaine/scripts-tableau-controles";
import { REGLES_TABLEAU } from "@/services/tableau-scripts/consignes";

const regles = readFileSync(new URL("../../docs/formats/tableau-anime-scripts/REGLES.md", import.meta.url), "utf8");
const PASSAGES = ["accroche", "douleur", "promesse", "exemple", "fin"] as const;
const somme = (d: 60 | 30, f: (r: [number, number]) => number) => PASSAGES.reduce((t, k) => t + f(BORNES_PASSAGES[d][k].repere), 0);
const haut = (d: 60 | 30) => somme(d, (r) => r[1]);
const milieu = (d: 60 | 30) => somme(d, (r) => (r[0] + r[1]) / 2);

describe("les chiffres derrière la consigne (aucune borne de code ne change)", () => {
  it("30 s, 2 constats de 13 mots : passages au haut = 71 + 26 = 97 > 95, refusé", () => {
    expect(haut(30) + 2 * repereConstats(30, 2)[1]).toBe(97);
    expect(97).toBeGreaterThan(MOTS_SCRIPT[30].max);
  });
  it("30 s, 2 constats : passages au milieu, le script tient dans 75 à 95", () => {
    const t = milieu(30) + 2 * ((repereConstats(30, 2)[0] + repereConstats(30, 2)[1]) / 2);
    expect(t).toBeGreaterThanOrEqual(MOTS_SCRIPT[30].min);
    expect(t).toBeLessThanOrEqual(MOTS_SCRIPT[30].max);
  });
  it("60 s, 3 constats : passages au haut + 3 constats au milieu = 148 > 145, refusé ; au milieu, 135 tient", () => {
    const c = 3 * ((repereConstats(60, 3)[0] + repereConstats(60, 3)[1]) / 2);
    expect(haut(60) + c).toBe(148);
    expect(148).toBeGreaterThan(MOTS_SCRIPT[60].max);
    expect(milieu(60) + c).toBeLessThanOrEqual(MOTS_SCRIPT[60].max);
    expect(milieu(60) + c).toBeGreaterThanOrEqual(MOTS_SCRIPT[60].min);
  });
});

describe.each([
  ["la consigne livrée (REGLES_TABLEAU)", REGLES_TABLEAU],
  ["REGLES.md", regles],
])("%s", (_nom, texte) => {
  it.skip("le haut des repères de chaque passage ne vaut que « en 60 s, avec 2 constats »", () => {
    expect(texte).toMatch(/en 60 s, avec 2 constats[^.;]*haut des repères de \*{0,2}CHAQUE passage|en 60 s, avec \*{0,2}2 constats\*{0,2}[^.;]*haut des repères de \*{0,2}chaque passage/i);
    expect(texte).not.toMatch(/[;:] avec \*{0,2}2 constats\*{0,2}, (visez|on vise) le haut/);
  });
  it.skip("30 s avec 2 constats : 10 à 13 mots, passages au milieu de leurs repères", () => {
    expect(texte).toMatch(/avec \*{0,2}2 constats\*{0,2} ?: ?10 à 13[^.;)]*passages au milieu de leurs repères/);
  });
  it.skip("3 constats : restez au milieu des repères des passages", () => {
    expect(texte).toMatch(/avec \*{0,2}3 constats\*{0,2},? restez au milieu des repères des passages/);
  });
});
