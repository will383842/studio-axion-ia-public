/**
 * ART-1 : espaces insécables de la typographie française, appliquées à TOUS les textes de TOUTES les pages (`VisuelPage.tsx`).
 * Espace fine insécable (U+202F) avant « ? ! ; », insécable (U+00A0) avant « : » et « » », après « « » ; « : » et « ; » ne sont touchés que
 * suivis d'une espace ou de la fin du texte (« 9:30 », « https:// » restent collés) ; l'apostrophe droite entre deux lettres devient ’.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUBRIQUES, TEXTES_FIXES, TEXTES_FIXES_L9 } from "@/briques/visuels/textes-fixes";
import { espacerPage, typographieFrancaise } from "@/briques/visuels/typographie-francaise";

const FINE = "\u202f";
const INSECABLE = "\u00a0";

describe("typographieFrancaise", () => {
  it.each([
    ["Pourquoi ?", `Pourquoi${FINE}?`],
    ["Pourquoi?", `Pourquoi${FINE}?`],
    ["Enfin !", `Enfin${FINE}!`],
    ["un point ; un autre", `un point${FINE}; un autre`],
    ["Vous : la suite", `Vous${INSECABLE}: la suite`],
    ["Vous: la suite", `Vous${INSECABLE}: la suite`],
    ["« oui »", `«${INSECABLE}oui${INSECABLE}»`],
    ["«oui»", `«${INSECABLE}oui${INSECABLE}»`],
    [`Pas si vite${FINE}!`, `Pas si vite${FINE}!`],
    [`Pourquoi${INSECABLE}?`, `Pourquoi${FINE}?`],
    ["Vraiment ?!", `Vraiment${FINE}?!`],
  ])("%j → %j", (entree, attendu) => {
    expect(typographieFrancaise(entree)).toBe(attendu);
  });

  it("l'apostrophe droite entre deux lettres devient l'apostrophe typographique ’ ; la typographique ne change pas", () => {
    expect(typographieFrancaise("L’IA d’abord, l'équipe ensuite")).toBe("L’IA d’abord, l’équipe ensuite");
    expect(typographieFrancaise("QU'UN OUTIL")).toBe("QU’UN OUTIL");
    expect(typographieFrancaise("l'IA")).toBe("l’IA");
    expect(typographieFrancaise("aujourd'hui")).toBe("aujourd’hui");
  });

  it("une apostrophe droite qui n'est pas entre deux lettres reste droite (citation, chiffre)", () => {
    expect(typographieFrancaise("'oui'")).toBe("'oui'");
    expect(typographieFrancaise("les années 90'")).toBe("les années 90'");
  });

  it("« : » et « ; » collés à ce qui suit restent collés (heure, adresse, ratio) : aucune espace ajoutée", () => {
    expect(typographieFrancaise("Rendez-vous à 9:30")).toBe("Rendez-vous à 9:30");
    expect(typographieFrancaise("https://exemple")).toBe("https://exemple");
    expect(typographieFrancaise("a;b")).toBe("a;b");
    expect(typographieFrancaise("un ratio 3:1 ici")).toBe("un ratio 3:1 ici");
  });

  it("« : » et « ; » suivis d'une espace ou en fin de texte reçoivent l'espace insécable", () => {
    expect(typographieFrancaise("La suite:")).toBe(`La suite${INSECABLE}:`);
    expect(typographieFrancaise("Un point;")).toBe(`Un point${FINE};`);
    expect(typographieFrancaise(`Vous:${INSECABLE}oui`)).toBe(`Vous${INSECABLE}:${INSECABLE}oui`);
  });

  it("un signe en début de texte ne reçoit pas d'espace", () => {
    expect(typographieFrancaise("? reste")).toBe("? reste");
    expect(typographieFrancaise(": suite")).toBe(": suite");
  });

  it("idempotente : appliquée deux fois, même résultat", () => {
    const t = "« Prêt ? » : oui ; vraiment !";
    expect(typographieFrancaise(typographieFrancaise(t))).toBe(typographieFrancaise(t));
  });

  it("aucune espace ordinaire ne reste devant ? ! ; : » ni derrière «", () => {
    const t = typographieFrancaise("« A » B ? C ! D ; E : F");
    expect(t).not.toMatch(/ [?!;:»]|« /);
  });
});

describe("espacerPage", () => {
  it("traite toutes les chaînes d'une page (objets et listes imbriqués) sauf les identifiants", () => {
    const page = { type: "T23", titre: "Prêt ?", questions: [{ question: "Qui ?", aide: "Vous : oui", icone: "question" }], annotation: "« oui »" };
    expect(espacerPage(page)).toEqual({ type: "T23", titre: `Prêt${FINE}?`, questions: [{ question: `Qui${FINE}?`, aide: `Vous${INSECABLE}: oui`, icone: "question" }], annotation: `«${INSECABLE}oui${INSECABLE}»` });
  });

  it("la composition l'applique à chaque page du spec, avant le dessin", () => {
    const src = readFileSync(new URL("../../studio-rendu/compositions/visuels/VisuelPage.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/espacerPage\(pageDuSpec\(/);
  });
});

describe("textes posés par le code", () => {
  it("les textes fixes et les rubriques respectent déjà les espaces insécables", () => {
    for (const t of [...Object.values(TEXTES_FIXES), ...Object.values(TEXTES_FIXES_L9), ...Object.values(RUBRIQUES)]) expect(typographieFrancaise(t), t).toBe(t);
  });
});
