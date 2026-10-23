import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte";
import { capaciteMotCarte } from "../../src/briques/visuels/registre-pages";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const carte = (titre: string) => ({ titre, corps: "Un texte court." });
const dense = (titres: string[]) => ({ type: "T02", titre: "Les bases", cartes: titres.map(carte) });
const spec = (page: object) => ({
  version: "carrousel/1",
  alt: "Carrousel d'exemple",
  pages: [{ type: "T01", titre: "Une couverture" }, page, { type: "T06", titre: "Une liste", points: [{ texte: "Un" }, { texte: "Deux" }, { texte: "Trois" }] }, { type: "T21" }],
});
const motsTropLongs = (page: object) => controlerCarrousel(spec(page), ctx).rapport.controles.filter((c) => c.code === "MOT_TROP_LONG");

describe("MOT_TROP_LONG : mot le plus long d'un titre de carte T02 (mesuré au rendu réel)", () => {
  it("budgets du registre : 10 signes pour 4 à 6 cartes, 15 pour 2 et 3", () => {
    expect([2, 3, 4, 5, 6].map(capaciteMotCarte)).toEqual([15, 15, 10, 10, 10]);
  });
  it.each([4, 5, 6])("%i cartes : un mot de 11 signes ou plus est rouge, 10 passe", (n) => {
    const titres = (mot: string) => Array.from({ length: n }, (_, i) => (i === 1 ? mot : "Planifier"));
    const rouges = motsTropLongs(dense(titres("communicatio")));
    expect(rouges).toHaveLength(1);
    expect(rouges[0]).toMatchObject({ niveau: "rouge", page: 2, chemin: "pages.1.cartes.1.titre" });
    expect(rouges[0].phrase).toMatch(/communicatio/);
    expect(motsTropLongs(dense(titres("communicat")))).toEqual([]);
    expect(motsTropLongs(dense(titres("communicati")))).toHaveLength(1);
  });
  it("2 cartes : 15 passe, 16 est rouge", () => {
    expect(motsTropLongs(dense(["automatiquement", "Ranger"]))).toEqual([]);
    expect(motsTropLongs(dense(["automatiquementx", "Ranger"]))).toHaveLength(1);
  });
  it("le tiret sépare les mots, l'apostrophe non (le navigateur ne coupe pas après une apostrophe)", () => {
    expect(motsTropLongs(dense(["Ranger", "Tenir l'agenda", "Lire", "Noter-tout"]))).toEqual([]);
    for (const apo of ["'", "’", "ʼ"]) {
      const rouges = motsTropLongs(dense(["Ranger", `Un d${apo}organisation`, "Lire", "Noter"]));
      expect(rouges).toHaveLength(1);
      expect(rouges[0].phrase).toMatch(/organisation/);
    }
    expect(motsTropLongs(dense(["Ranger", "Un accompagnement-bis", "Lire", "Noter"]))).toHaveLength(1);
    expect(motsTropLongs(dense(["Ranger", "Un accompa\u2010gnement", "Lire", "Noter"]))).toEqual([]);
  });
  it("l'espace insécable ne permet pas de retour à la ligne : il reste dans le mot", () => {
    expect(motsTropLongs(dense(["Ranger", "Un\u00A0accompagnement", "Lire", "Noter"]))).toHaveLength(1);
    expect(motsTropLongs(dense(["Ranger", "Les\u00A0bases", "Lire", "Noter"]))).toEqual([]);
  });
  it("les autres pages ne sont pas concernées", () => {
    const liste = { type: "T06", titre: "Une liste", points: [{ texte: "Accompagnement automatiquement" }, { texte: "Deux" }, { texte: "Trois" }] };
    expect(controlerCarrousel({ version: "carrousel/1", alt: "x", pages: [{ type: "T01", titre: "Une couverture" }, liste, { type: "T21" }] }, ctx).rapport.controles.filter((c) => c.code === "MOT_TROP_LONG")).toEqual([]);
  });
});
