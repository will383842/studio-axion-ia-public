/**
 * Tests directs des contrôles « reference » (`controles-reference.ts`) et « reference/3 » (`controles-v3.ts`) que
 * aucun test n'appelait par leur nom : un cas conforme et un cas fautif par fonction, entrées faites à la main.
 */
import { describe, expect, it } from "vitest";
import { SEUILS_CONTROLE_IMAGE } from "@/briques/controle-image";
import { blocsTropLongsReference, dessinsParIdeeReference, horsZoneReference, pagesVidesReference, seuilsImageReference } from "@/moteurs/montage-tableau/controles-reference";
import { etiquettesAbsentes3, pagesChargees3, pagesProbleme3, taillesTropPetites3, visuelsNonDessines3 } from "@/moteurs/montage-tableau/controles-v3";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import type { ElementPlace, MiseEnPageTableau, RectPx } from "@/moteurs/montage-tableau/mise-en-page";

const R = (x: number, y: number, largeur: number, hauteur: number) => {
  const px: RectPx = { x, y, largeur, hauteur };
  return { px, fraction: { ...px } };
};
const ligne = (texte: string, y = 0, hauteur = 50) => ({ texte, ...R(0, y, 100, hauteur) });

/** Élément placé minimal (cast : seuls les champs lus par les contrôles sont renseignés). */
const el = (id: string, extra: Record<string, unknown> = {}): ElementPlace => {
  const rect = (extra.rect as RectPx | undefined) ?? { x: 100, y: 100, largeur: 200, hauteur: 100 };
  const reste = { ...extra };
  delete reste.rect;
  return { elementId: id, sceneId: `s-${id}`, type: "ligne", ordre: 0, lignes: [], ...R(rect.x, rect.y, rect.largeur, rect.hauteur), encombrement: R(rect.x, rect.y, rect.largeur, rect.hauteur), ...reste } as unknown as ElementPlace;
};
const page = (n: number, elements: ElementPlace[], gestes: unknown[] = []) => ({ page: n, echelle: 1, occupation: 1, elements, gestes });
const mise = (pages: ReturnType<typeof page>[], extra: Record<string, unknown> = {}): MiseEnPageTableau =>
  ({
    largeurPx: 1080,
    hauteurPx: 1000,
    zoneSure: R(0, 0, 1000, 1000),
    bandeSousTitres: R(0, 800, 1000, 200),
    cadre: R(0, 0, 1000, 800),
    pages,
    ...extra,
  }) as unknown as MiseEnPageTableau;

describe("controles-reference : seuilsImageReference", () => {
  it("style de base : tailles à 44 px de référence, contraste 4,5, durée +5 %, ni bande ni accroche changée", () => {
    const s = seuilsImageReference(mise([], { styleReference: { style: "reference/1", k: 2 } }));
    expect(s.tailleTexteMin).toBeCloseTo((44 * 2) / 1000, 5);
    expect(s.contrasteTexteMin).toBe(4.5);
    expect(s.bandeSousTitres).toBe(0);
    expect(s.accrocheMotsMax).toBe(SEUILS_CONTROLE_IMAGE.accrocheMotsMax);
    expect(s.dureeMaxSec).toBeCloseTo(SEUILS_CONTROLE_IMAGE.dureeMaxSec * 1.05, 9);
  });

  it("« reference/3 » : accroche de 14 mots, bande des sous-titres réservée, durée injectée prise puis majorée", () => {
    const s = seuilsImageReference(mise([], { styleReference: { style: "reference/3", k: 1 } }), { dureeMaxSec: 100 });
    expect(s.accrocheMotsMax).toBe(14);
    expect(s.bandeSousTitres).toBeCloseTo(200 / 1000, 9);
    expect(s.dureeMaxSec).toBeCloseTo(105, 9);
  });

  it("sans style de référence : k = 1", () => {
    expect(seuilsImageReference(mise([])).tailleTexteMin).toBeCloseTo(44 / 1000, 5);
  });
});

describe("controles-reference : horsZoneReference", () => {
  it("tout dans la zone sûre : aucune faute", () => {
    expect(horsZoneReference(mise([page(1, [el("a", { lignes: [ligne("Bonjour")] })])]))).toEqual([]);
  });

  it("un bloc qui dépasse la zone sûre est signalé avec sa page et sa scène", () => {
    const sort = el("b", { lignes: [ligne("Trop large")], rect: { x: 900, y: 100, largeur: 300, hauteur: 100 } });
    expect(horsZoneReference(mise([page(2, [sort])]))).toEqual([{ sceneId: "s-b", message: "page 2 : « Trop large » sort de la zone sûre" }]);
  });

  it("un geste dont la zone sort est signalé ; sans zone, rien", () => {
    const gestes = [
      { sceneId: "g1", elementId: "cible", zone: R(950, 100, 100, 50) },
      { sceneId: "g2", elementId: "autre" },
    ];
    expect(horsZoneReference(mise([page(1, [], gestes)]))).toEqual([{ sceneId: "g1", message: "page 1 : le geste « cible » sort de la zone sûre" }]);
  });

  it("est déterministe et ne modifie pas son entrée", () => {
    const m = mise([page(1, [el("b", { lignes: [ligne("Trop large")], rect: { x: 900, y: 100, largeur: 300, hauteur: 100 } })])]);
    const avant = structuredClone(m);
    expect(horsZoneReference(m)).toEqual(horsZoneReference(m));
    expect(m).toEqual(avant);
  });
});

describe("controles-reference : dessinsParIdeeReference", () => {
  const bloc = el("b1", { lignes: [ligne("Idée")] });
  it("un dessin rattaché à un bloc présent, ou seul au centre : aucune faute", () => {
    const rattache = el("d1", { type: "dessin", dessinId: "loupe", rattache: "b1", cote: "droite" });
    const centre = el("d2", { type: "dessin", dessinId: "ampoule", cote: "centre" });
    expect(dessinsParIdeeReference(mise([page(1, [bloc, rattache]), page(2, [centre])]))).toEqual([]);
  });

  it("un dessin sans bloc et pas au centre : « à côté d'aucune idée »", () => {
    const seul = el("d1", { type: "dessin", dessinId: "loupe", cote: "droite" });
    expect(dessinsParIdeeReference(mise([page(3, [seul])]))).toEqual([{ sceneId: "s-d1", message: "page 3 : le dessin « loupe » n'est à côté d'aucune idée" }]);
  });

  it("un dessin qui vise un bloc absent est signalé", () => {
    const perdu = el("d1", { type: "dessin", dessinId: "loupe", rattache: "fantome", cote: "droite" });
    expect(dessinsParIdeeReference(mise([page(1, [perdu])])).map((f) => f.message)).toEqual(["page 1 : le dessin « loupe » vise un bloc absent"]);
  });

  it("deux dessins pour la même idée : une faute sur la scène du bloc", () => {
    const d1 = el("d1", { type: "dessin", dessinId: "a", rattache: "b1", cote: "droite" });
    const d2 = el("d2", { type: "dessin", dessinId: "b", rattache: "b1", cote: "gauche" });
    expect(dessinsParIdeeReference(mise([page(1, [bloc, d1, d2])]))).toEqual([{ sceneId: "s-b1", message: "page 1 : 2 dessins pour la même idée (« b1 »)" }]);
  });
});

describe("controles-reference : blocsTropLongsReference", () => {
  const lignes = (n: number, ecart = 0) => Array.from({ length: n }, (_, i) => ligne(`l${i + 1}`, i * (50 + ecart)));
  it("3 lignes qui se suivent : conforme", () => {
    expect(blocsTropLongsReference(mise([page(1, [el("a", { lignes: lignes(3) })])]))).toEqual([]);
  });

  it("4 lignes qui se suivent : faute « plus de 3 lignes »", () => {
    expect(blocsTropLongsReference(mise([page(1, [el("a", { lignes: lignes(4) })])]))).toEqual([{ sceneId: "s-a", message: "page 1 : « l1 l2 l3 l4 » fait plus de 3 lignes" }]);
  });

  it("une preuve avant / après (écart entre les lignes) n'est pas comptée comme un seul bloc", () => {
    expect(blocsTropLongsReference(mise([page(1, [el("a", { lignes: lignes(4, 30) })])]))).toEqual([]);
  });

  it("un dessin n'est jamais jugé", () => {
    expect(blocsTropLongsReference(mise([page(1, [el("d", { type: "dessin", lignes: lignes(5) })])]))).toEqual([]);
  });
});

describe("controles-reference : pagesVidesReference", () => {
  it("une page avec un bloc écrit : conforme", () => {
    expect(pagesVidesReference(mise([page(1, [el("a", { lignes: [ligne("Texte")] })])]))).toEqual([]);
  });

  it("une page de dessins seuls : « aucun texte écrit », sur la scène du dernier élément", () => {
    const m = mise([page(1, [el("a", { lignes: [ligne("Texte")] })]), page(2, [el("d1", { type: "dessin" }), el("d2", { type: "dessin" })])]);
    expect(pagesVidesReference(m)).toEqual([{ sceneId: "s-d2", message: "page 2 : aucun texte écrit" }]);
  });

  it("une page sans aucun élément : faute avec scène vide", () => {
    expect(pagesVidesReference(mise([page(4, [])]))).toEqual([{ sceneId: "", message: "page 4 : aucun texte écrit" }]);
  });
});

describe("controles-v3 : pagesProbleme3", () => {
  const g = (sorte: string, texte: string, id = sorte) => el(id, { gabarit: { sorte }, lignes: [ligne(texte)] });
  it("« La douleur » en partie et un titre sans « problème » : conforme", () => {
    expect(pagesProbleme3(mise([page(1, [g("partie", "La douleur"), g("titre", "Ce qui coince")])]))).toEqual([]);
  });

  it("« Le problème » en partie et « Le vrai problème » en titre : deux fautes", () => {
    const r = pagesProbleme3(mise([page(1, [g("partie", "Le problème"), g("titre", "Le vrai problème")])]));
    expect(r.map((f) => f.sceneId)).toEqual(["s-partie", "s-titre"]);
    expect(r[0].message).toContain("le mot « problème » n'est jamais une étiquette ni un titre");
  });

  it("la graphie sans accent et la casse sont attrapées ; une phrase libre ne l'est pas", () => {
    expect(pagesProbleme3(mise([page(1, [g("titre", "PROBLEME résolu")])]))).toHaveLength(1);
    expect(pagesProbleme3(mise([page(1, [g("phrase", "Le problème est réel")])]))).toEqual([]);
  });
});

describe("controles-v3 : etiquettesAbsentes3", () => {
  const avecBarre = (parties: Record<number, string>, pages: ReturnType<typeof page>[]) =>
    mise(pages, { styleReference: { style: "reference/3", k: 1, barre: R(0, 0, 100, 10).px, nomsChapitres: { ...R(0, 10, 100, 20).px, taille: 20 }, parties } });

  it("chaque page a son chapitre nommé : conforme", () => {
    expect(etiquettesAbsentes3(avecBarre({ 1: "douleur", 2: "solution" }, [page(1, [el("a")]), page(2, [el("b")])]))).toEqual([]);
  });

  it("sans barre des chapitres : « aucun chapitre nommé » sur la scène du premier élément", () => {
    const m = mise([page(1, [el("a")])], { styleReference: { style: "reference/3", k: 1, parties: { 1: "douleur" } } });
    expect(etiquettesAbsentes3(m)).toEqual([{ sceneId: "s-a", message: "page 1 : aucun chapitre nommé dans la barre" }]);
  });

  it("page sans partie connue en tête : aucun chapitre nommé", () => {
    expect(etiquettesAbsentes3(avecBarre({}, [page(1, [el("a")])])).map((f) => f.message)).toEqual(["page 1 : aucun chapitre nommé dans la barre"]);
  });

  it("l'exemple sans repère « Exemple illustratif » est refusé, avec le repère il passe", () => {
    const repere = el("r", { gabarit: { sorte: "partie" }, lignes: [ligne("Exemple illustratif")] });
    expect(etiquettesAbsentes3(avecBarre({ 1: "exemple" }, [page(1, [el("a")])])).map((f) => f.message)).toEqual(["page 1 : l'exemple n'est pas marqué « Exemple illustratif »"]);
    expect(etiquettesAbsentes3(avecBarre({ 1: "exemple" }, [page(1, [el("a"), repere])]))).toEqual([]);
  });
});

describe("controles-v3 : pagesChargees3", () => {
  const blocs = (n: number) => Array.from({ length: n }, (_, i) => el(`b${i}`, { lignes: [ligne(`t${i}`)] }));
  it("3 blocs visibles : conforme", () => {
    expect(pagesChargees3(mise([page(1, blocs(3))]))).toEqual([]);
  });

  it("4 blocs visibles : faute sur la scène du dernier élément", () => {
    expect(pagesChargees3(mise([page(1, blocs(4))]))).toEqual([{ sceneId: "s-b3", message: "page 1 : 4 blocs visibles (3 au plus)" }]);
  });

  it("dessins, parties et visuels ne comptent pas ; une liste de cases compte pour un", () => {
    const decor = [el("d", { type: "dessin" }), el("p", { gabarit: { sorte: "partie" } }), el("v", { gabarit: { sorte: "visuel" } }), el("c1", { gabarit: { sorte: "case" } }), el("c2", { gabarit: { sorte: "case" } })];
    expect(pagesChargees3(mise([page(1, [...blocs(2), ...decor])]))).toEqual([]);
  });

  it("est déterministe et ne modifie pas son entrée", () => {
    const m = mise([page(1, blocs(5))]);
    const avant = structuredClone(m);
    expect(pagesChargees3(m)).toEqual(pagesChargees3(m));
    expect(m).toEqual(avant);
  });
});

describe("controles-v3 : taillesTropPetites3", () => {
  const t = (sorte: string | undefined, taillePx: number) => el("x", { taillePx, gabarit: sorte ? { sorte } : undefined, lignes: [ligne("Texte")] });
  it("tailles aux minimums du vertical : conforme", () => {
    const m = mise([page(1, [t("titre", 76), t("phrase", 72), t("accroche", 80), t("appel-plein", 72), t(undefined, 52)])]);
    expect(taillesTropPetites3(m)).toEqual([]);
  });

  it("un titre à 70 px en vertical : faute (au moins 76)", () => {
    expect(taillesTropPetites3(mise([page(1, [t("titre", 70)])]))).toEqual([{ sceneId: "s-x", message: "page 1 : « Texte » est écrit en 70 px (au moins 76)" }]);
  });

  it("un détail à 50 px : faute (au moins 52) ; 51,6 px passe grâce à la tolérance d'un demi-pixel", () => {
    expect(taillesTropPetites3(mise([page(1, [t(undefined, 50)])])).map((f) => f.message)).toEqual(["page 1 : « Texte » est écrit en 50 px (au moins 52)"]);
    expect(taillesTropPetites3(mise([page(1, [t(undefined, 51.6)])]))).toEqual([]);
  });

  it("le format carré a des minimums plus bas (titre 64) ; les décors ne sont pas jugés", () => {
    expect(taillesTropPetites3(mise([page(1, [t("titre", 70)])], { format: "carre" }))).toEqual([]);
    expect(taillesTropPetites3(mise([page(1, [t("titre", 60)])], { format: "carre" }))).toHaveLength(1);
    expect(taillesTropPetites3(mise([page(1, [t("partie", 10), t("pastille", 10)])]))).toEqual([]);
  });
});

describe("controles-v3 : visuelsNonDessines3", () => {
  const fiche = { scenes: [{ id: "s1", page: 1, gabarit: { visuel: { id: "balance" } } }, { id: "s2", page: 2, gabarit: {} }, { id: "s3", page: 3 }] } as unknown as FicheTableau;
  it("le visuel choisi est posé sur la page : conforme", () => {
    expect(visuelsNonDessines3(fiche, mise([page(1, [el("s1~visuel")])]))).toEqual([]);
  });

  it("le visuel choisi n'est pas posé : faute sur sa scène avec son identifiant", () => {
    expect(visuelsNonDessines3(fiche, mise([page(1, [el("autre")])]))).toEqual([{ sceneId: "s1", message: "page 1 : le visuel « balance » ne tient pas sur la page, il n'est pas dessiné" }]);
  });

  it("les scènes sans visuel choisi ne sont jamais fautives", () => {
    expect(visuelsNonDessines3({ scenes: [{ id: "s2", page: 2 }] } as unknown as FicheTableau, mise([]))).toEqual([]);
  });
});
