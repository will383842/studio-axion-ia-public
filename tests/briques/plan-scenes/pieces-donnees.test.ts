import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATALOGUE_BRIQUES, poserInstantsSurMot, type IdPiece } from "@/briques/plan-scenes/catalogue";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";

type AvecMot = { surMot: number; aMs?: number };
const PIECES = ["compteur", "jauge", "avant-apres", "barres", "etapes", "liste-au-mot", "citation", "repere"] as const satisfies readonly IdPiece[];
const FPS = 25;
const DUREE = 125;

function rendre(id: IdPiece, image: number, parametres: unknown = CATALOGUE_BRIQUES[id].exemple): string {
  return renderToStaticMarkup(createElement(RENDUS_BRIQUES[id] as never, { image, fps: FPS, dureeImages: DUREE, fond: "ivoire", parametres }));
}

describe("pièces de données : rendu", () => {
  it.each(PIECES)("%s : rend à 0 %, 50 % et 100 % de sa durée, et la même chose deux fois", (id) => {
    for (const image of [0, Math.round(DUREE / 2), DUREE]) {
      expect(rendre(id, image).length).toBeGreaterThan(0);
      expect(rendre(id, image)).toBe(rendre(id, image));
    }
  });

  it("compteur 40 % : « 40 » à la fin, aucun nombre hors de 0 à 40 en route", () => {
    const parametres = { valeur: 40, unite: "%", surMot: 0, aMs: 0 };
    const fin = rendre("compteur", DUREE, parametres);
    expect(fin).toContain(">40<");
    expect(fin).toContain("%");
    for (let image = 0; image <= DUREE; image++) {
      const texte = rendre("compteur", image, parametres).replace(/<[^>]*>/g, " ");
      for (const n of texte.match(/\d+/g) ?? []) expect(Number(n)).toBeLessThanOrEqual(40);
    }
    expect(rendre("compteur", 0, parametres).replace(/<[^>]*>/g, " ")).not.toContain("40");
  });

  it("liste-au-mot : à 1,5 s, les deux premiers éléments sont visibles, le troisième non", () => {
    const parametres = {
      elements: [
        { texte: "Alpha", surMot: 0, aMs: 0 },
        { texte: "Bravo", surMot: 1, aMs: 1000 },
        { texte: "Charlie", surMot: 2, aMs: 2000 },
      ],
    };
    const html = rendre("liste-au-mot", Math.round(1.5 * FPS), parametres);
    const opacite = (mot: string) => {
      const m = html.match(new RegExp(`opacity:([0-9.]+)[^>]*>(?:(?!</div></div>).)*?${mot}`));
      return m ? Number(m[1]) : NaN;
    };
    expect(opacite("Alpha")).toBeGreaterThan(0);
    expect(opacite("Bravo")).toBeGreaterThan(0);
    expect(opacite("Charlie")).toBe(0);
  });

  it("sans aMs, les éléments sont répartis sur la première moitié de la scène", () => {
    const parametres = { elements: [{ texte: "Alpha", surMot: 0 }, { texte: "Bravo", surMot: 1 }, { texte: "Charlie", surMot: 2 }] };
    expect(rendre("etapes", 0, parametres)).not.toBe(rendre("etapes", DUREE, parametres));
    expect(rendre("etapes", DUREE, parametres)).toContain("Charlie");
  });
});

describe("pièces de données : paramètres", () => {
  it.each(PIECES)("%s : un champ inconnu (couleur, police) est refusé", (id) => {
    const def = CATALOGUE_BRIQUES[id];
    expect(def.schema.safeParse(def.exemple).success).toBe(true);
    for (const champ of ["couleur", "police"]) expect(def.schema.safeParse({ ...(def.exemple as object), [champ]: "x" }).success).toBe(false);
  });

  it("les bornes de la fiche sont tenues", () => {
    expect(CATALOGUE_BRIQUES.jauge.schema.safeParse({ valeur: 101, surMot: 0 }).success).toBe(false);
    expect(CATALOGUE_BRIQUES.barres.schema.safeParse({ barres: [{ libelle: "A", valeur: 1, surMot: 0 }] }).success).toBe(false);
    expect(CATALOGUE_BRIQUES.etapes.schema.safeParse({ elements: [{ texte: "A", surMot: 0 }] }).success).toBe(false);
    expect(CATALOGUE_BRIQUES.repere.schema.safeParse({ genre: "pays", texte: "X", surMot: 0 }).success).toBe(false);
    expect(CATALOGUE_BRIQUES.compteur.schema.safeParse({ valeur: 1, surMot: -1 }).success).toBe(false);
  });
});

describe("poserInstantsSurMot", () => {
  const mots = [{ debutMs: 1000 }, { debutMs: 1400 }, { debutMs: 2600 }];

  it("aMs = début du mot moins début de la scène, jamais négatif", () => {
    const sortie = poserInstantsSurMot<{ elements: ({ texte: string } & AvecMot)[] }>("liste-au-mot", { elements: [{ texte: "a", surMot: 1 }, { texte: "b", surMot: 2 }] }, mots, 1200);
    expect(sortie.elements.map((e) => e.aMs)).toEqual([200, 1400]);
    const avant = poserInstantsSurMot<{ valeur: number } & AvecMot>("compteur", { valeur: 3, surMot: 0 }, mots, 1200);
    expect(avant.aMs).toBe(0);
  });

  it("couvre chaque forme de pièce et ne modifie pas l'entrée", () => {
    const entree: { avant: AvecMot; apres: AvecMot } = { avant: { surMot: 0 }, apres: { surMot: 2 } };
    const copie = structuredClone(entree);
    const sortie = poserInstantsSurMot("avant-apres", entree, mots, 1000);
    expect(sortie.avant.aMs).toBe(0);
    expect(sortie.apres.aMs).toBe(1600);
    expect(entree).toEqual(copie);
    const barres = poserInstantsSurMot<{ barres: ({ libelle: string; valeur: number } & AvecMot)[] }>("barres", { barres: [{ libelle: "A", valeur: 1, surMot: 1 }, { libelle: "B", valeur: 2, surMot: 2 }] }, mots, 1000);
    expect(barres.barres.map((b) => b.aMs)).toEqual([400, 1600]);
  });

  it("un surMot hors du minutage laisse l'élément sans instant", () => {
    expect(poserInstantsSurMot<{ texte: string } & AvecMot>("citation", { texte: "t", surMot: 9 }, mots, 0).aMs).toBeUndefined();
  });
});
