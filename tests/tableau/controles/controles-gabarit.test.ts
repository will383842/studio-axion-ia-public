/**
 * Contrôles du gabarit clair (« reference/2 ») : appels DIRECTS des 6 contrôles de `controles-gabarit.ts`.
 * Entrées construites à la main (aucun fichier de données, aucune horloge).
 */
import { describe, expect, it } from "vitest";
// Charger la fiche d'abord (cycle fiche ↔ gabarit : voir le journal, DEFAUT VU).
import "@/moteurs/montage-tableau/fiche";
import { COULEURS_REFERENCE, TAILLES_GABARIT } from "@/briques/tableau-scene/reference/charte";
import {
  REMPLISSAGE_MIN_GABARIT,
  blocsTropLongsGabarit,
  couleursHorsGabarit,
  numerosAbsentsGabarit,
  pagesTropVidesGabarit,
  taillesTropPetitesGabarit,
  titresAbsentsGabarit,
} from "@/moteurs/montage-tableau/controles-gabarit";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import type { ElementPlace, MiseEnPageTableau, PagePlacee } from "@/moteurs/montage-tableau/mise-en-page";

const C = COULEURS_REFERENCE;
const RECT = { px: { x: 0, y: 0, largeur: 10, hauteur: 10 }, fraction: { x: 0, y: 0, largeur: 0.1, hauteur: 0.1 } };
const ligne = (texte: string) => ({ ...RECT, texte });

type Sorte = "titre" | "phrase" | "detail" | "pastille";
function el(sceneId: string, texte: string, extra: { sorte?: Sorte; n?: number; taillePx?: number; fond?: string; texteCouleur?: string; nb?: number; type?: string } = {}): ElementPlace {
  const nb = extra.nb ?? 1;
  const gabarit = extra.sorte === "pastille" ? { sorte: "pastille", n: extra.n } : extra.sorte ? { sorte: extra.sorte } : undefined;
  return {
    elementId: `${sceneId}-e`,
    sceneId,
    type: extra.type ?? "texte",
    ordre: 0,
    taillePx: extra.taillePx ?? 100,
    couleurTexte: extra.texteCouleur ?? C.encre,
    couleurFond: extra.fond ?? C.fond,
    lignes: Array.from({ length: nb }, () => ligne(texte)),
    encombrement: RECT,
    ...(gabarit ? { gabarit } : {}),
  } as unknown as ElementPlace;
}
const page = (n: number, elements: ElementPlace[], occupation = 0.9): PagePlacee => ({ page: n, echelle: 1, occupation, elements, gestes: [] });
const mise = (pages: PagePlacee[], k?: number): MiseEnPageTableau =>
  ({ version: 1, largeurPx: 1080, hauteurPx: 1920, pages, ...(k ? { styleReference: { k } } : {}) }) as unknown as MiseEnPageTableau;
const fiche = (scenes: { id: string; page: number; texteDit: string }[]): FicheTableau => ({ scenes }) as unknown as FicheTableau;

describe("titresAbsentsGabarit", () => {
  it("conforme : chaque page a un titre → []", () => {
    expect(titresAbsentsGabarit(mise([page(1, [el("s1", "Titre", { sorte: "titre" })]), page(2, [el("s2", "Autre", { sorte: "titre" })])]))).toEqual([]);
  });
  it("fautif : page 2 sans titre → 1 faute qui nomme la page 2 et la scène du premier élément", () => {
    const r = titresAbsentsGabarit(mise([page(1, [el("s1", "Titre", { sorte: "titre" })]), page(2, [el("s2", "Phrase", { sorte: "phrase" })])]));
    expect(r).toEqual([{ sceneId: "s2", message: "page 2 : aucun titre" }]);
  });
  it("page sans aucun élément : scène vide, page nommée", () => {
    expect(titresAbsentsGabarit(mise([page(3, [])]))).toEqual([{ sceneId: "", message: "page 3 : aucun titre" }]);
  });
});

describe("numerosAbsentsGabarit", () => {
  const dit = [{ id: "s1", page: 1, texteDit: "Un. Ouvrez le menu." }];
  it("conforme : la pastille 1 est écrite → []", () => {
    expect(numerosAbsentsGabarit(fiche(dit), mise([page(1, [el("s1", "1", { sorte: "pastille", n: 1 })])]))).toEqual([]);
  });
  it("conforme : la voix ne compte rien → []", () => {
    expect(numerosAbsentsGabarit(fiche([{ id: "s1", page: 1, texteDit: "Ouvrez le menu." }]), mise([page(1, [])]))).toEqual([]);
  });
  it("fautif : aucune pastille → 1 faute, page 1, numéro 1", () => {
    const r = numerosAbsentsGabarit(fiche(dit), mise([page(1, [el("s1", "Titre", { sorte: "titre" })])]));
    expect(r).toEqual([{ sceneId: "s1", message: "page 1 : la voix dit « 1 », aucune pastille 1 n'est écrite" }]);
  });
  it("fautif : pastille d'un autre numéro → 1 faute", () => {
    const r = numerosAbsentsGabarit(fiche(dit), mise([page(1, [el("s1", "2", { sorte: "pastille", n: 2 })])]));
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("page 1");
  });
  it("fautif : page absente de la mise en page → 1 faute", () => {
    expect(numerosAbsentsGabarit(fiche(dit), mise([]))).toHaveLength(1);
  });
});

describe("taillesTropPetitesGabarit", () => {
  it("conforme : titre, phrase et détail à leur taille minimale exacte → []", () => {
    const m = mise([page(1, [el("s1", "T", { sorte: "titre", taillePx: TAILLES_GABARIT.titreMin }), el("s1", "P", { sorte: "phrase", taillePx: TAILLES_GABARIT.phraseMin }), el("s1", "D", { sorte: "detail", taillePx: TAILLES_GABARIT.detailMin })])]);
    expect(taillesTropPetitesGabarit(m)).toEqual([]);
  });
  it("tolérance de 0,5 px : minimum − 0,5 accepté", () => {
    expect(taillesTropPetitesGabarit(mise([page(1, [el("s1", "T", { sorte: "titre", taillePx: TAILLES_GABARIT.titreMin - 0.5 })])]))).toEqual([]);
  });
  it("fautif : titre à 60 px → 1 faute, page 1, au moins 70", () => {
    const r = taillesTropPetitesGabarit(mise([page(1, [el("s1", "Titre", { sorte: "titre", taillePx: 60 })])]));
    expect(r).toEqual([{ sceneId: "s1", message: "page 1 : « Titre » est écrit en 60 px (au moins 70)" }]);
  });
  it("fautif : détail à 40 px → 1 faute (au moins 44)", () => {
    const r = taillesTropPetitesGabarit(mise([page(1, [el("s1", "Detail", { taillePx: 40 })])]));
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("au moins 44");
  });
  it("le facteur k de la mise en page multiplie le minimum", () => {
    const r = taillesTropPetitesGabarit(mise([page(1, [el("s1", "Titre", { sorte: "titre", taillePx: 100 })])], 2));
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("au moins 140");
  });
  it("un dessin n'est pas contrôlé", () => {
    expect(taillesTropPetitesGabarit(mise([page(1, [el("s1", "x", { type: "dessin", taillePx: 1 })])]))).toEqual([]);
  });
});

describe("couleursHorsGabarit", () => {
  it("conforme : encre, terracotta, sauge sur le fond → []", () => {
    const m = mise([page(1, [el("s1", "a", { texteCouleur: C.encre }), el("s1", "b", { texteCouleur: C.terracotta }), el("s1", "c", { texteCouleur: C.sauge })])]);
    expect(couleursHorsGabarit(m)).toEqual([]);
  });
  it("conforme : texte clair sur un fond plein du gabarit (terracotta) → []", () => {
    expect(couleursHorsGabarit(mise([page(1, [el("s1", "a", { texteCouleur: C.fond, fond: C.terracotta })])]))).toEqual([]);
  });
  it("fautif : texte rouge vif sur le fond → 1 faute, page 1", () => {
    const r = couleursHorsGabarit(mise([page(1, [el("s1", "Mot", { texteCouleur: "#FF0000" })])]));
    expect(r).toEqual([{ sceneId: "s1", message: "page 1 : « Mot » est écrit en #FF0000 sur " + C.fond }]);
  });
  it("fautif : texte clair sur un fond qui n'est pas du gabarit → 1 faute", () => {
    expect(couleursHorsGabarit(mise([page(1, [el("s1", "Mot", { texteCouleur: C.fond, fond: "#123456" })])]))).toHaveLength(1);
  });
  it("un dessin n'est pas contrôlé", () => {
    expect(couleursHorsGabarit(mise([page(1, [el("s1", "x", { type: "dessin", texteCouleur: "#FF0000" })])]))).toEqual([]);
  });
});

describe("blocsTropLongsGabarit", () => {
  it("conforme : titre de 2 rangées, bloc de 4 → []", () => {
    expect(blocsTropLongsGabarit(mise([page(1, [el("s1", "T", { sorte: "titre", nb: 2 }), el("s1", "D", { nb: 4 })])]))).toEqual([]);
  });
  it("fautif : titre de 3 rangées → 1 faute (2 au plus), page 1", () => {
    const r = blocsTropLongsGabarit(mise([page(1, [el("s1", "T", { sorte: "titre", nb: 3 })])]));
    expect(r).toHaveLength(1);
    expect(r[0].sceneId).toBe("s1");
    expect(r[0].message).toContain("page 1");
    expect(r[0].message).toContain("fait 3 rangées (2 au plus)");
  });
  it("fautif : bloc de 5 rangées → 1 faute (4 au plus)", () => {
    const r = blocsTropLongsGabarit(mise([page(1, [el("s1", "D", { nb: 5 })])]));
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("fait 5 rangées (4 au plus)");
  });
});

describe("pagesTropVidesGabarit", () => {
  it("conforme : pages à 0,9 → []", () => {
    expect(pagesTropVidesGabarit(mise([page(1, [el("s1", "a")], 0.9)]))).toEqual([]);
  });
  it("fautif : page 2 remplie à 50 % → 1 faute qui nomme la page et la dernière scène", () => {
    const r = pagesTropVidesGabarit(mise([page(1, [el("s1", "a")], 0.9), page(2, [el("s2", "a"), el("s3", "b")], 0.5)]));
    expect(r).toEqual([{ sceneId: "s3", message: "page 2 : la page n'est remplie qu'à 50 % (au moins 75 %)" }]);
  });
  it("bord : remplissage exactement égal au minimum → accepté", () => {
    expect(pagesTropVidesGabarit(mise([page(1, [el("s1", "a")], REMPLISSAGE_MIN_GABARIT)]))).toEqual([]);
  });
  it("bord : juste sous le minimum (− 0,001) → refusé", () => {
    expect(pagesTropVidesGabarit(mise([page(1, [el("s1", "a")], REMPLISSAGE_MIN_GABARIT - 0.001)]))).toHaveLength(1);
  });
  it("le minimum vaut 0,75", () => {
    expect(REMPLISSAGE_MIN_GABARIT).toBe(0.75);
  });
});

describe("déterminisme et pureté", () => {
  const m = mise([page(1, [el("s1", "Mot", { texteCouleur: "#FF0000", taillePx: 10, nb: 5 })], 0.1)]);
  const f = fiche([{ id: "s1", page: 1, texteDit: "Un. Ouvrez." }]);
  it("même entrée, même sortie ; entrée inchangée", () => {
    const avantM = structuredClone(m);
    const avantF = structuredClone(f);
    for (const fn of [titresAbsentsGabarit, taillesTropPetitesGabarit, couleursHorsGabarit, blocsTropLongsGabarit, pagesTropVidesGabarit]) {
      expect(fn(m)).toEqual(fn(m));
    }
    expect(numerosAbsentsGabarit(f, m)).toEqual(numerosAbsentsGabarit(f, m));
    expect(m).toEqual(avantM);
    expect(f).toEqual(avantF);
  });
});
