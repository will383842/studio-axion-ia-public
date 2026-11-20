/**
 * T-VARIETE-CC-v20d · tests directs de `hacher32`, `hasardSeme`, `maquettesRecentes` et `misesEnPageL6`
 * (variete.ts). Entrées construites à la main, aucune horloge, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { MISE_EN_PAGE_V4, MISES_EN_PAGE_L6 } from "@/briques/ecrans-motion/mises-en-page";
import { entreeHistorique, estV4, FENETRE_MAQUETTES, hacher32, hasardSeme, maquettesRecentes, mettre, misesEnPageL6, tirer, TIRAGE_V4, type EcranAMettre, type EntreeHistorique, type Tirage } from "@/moteurs/montage-cas-concret/variete";

const LE = "2026-11-20T12:00:00.000Z";

/** Un tirage qui n'est pas la v4 (vérifié plus bas). */
const T: Tirage = tirer({ videoId: "essai-v20d-a", canaux: ["linkedin"], historique: [] });

/** Écrans à la main : contenus minimaux mais éligibles. */
const ECRANS: EcranAMettre[] = [
  { id: "e1", type: "accroche", fond: "sombre", contenu: { type: "accroche", lignes: ["On gagne 45 minutes", "par recrutement"] } as never },
  { id: "e2", type: "titre", fond: "ivoire", contenu: { type: "titre", lignes: ["Tout est automatique"] } as never },
  { id: "e3", type: "resultat", fond: "sombre", contenu: { type: "resultat", etiquette: "Résultat", titre: "Des heures gagnées", avant: "1 H 30", maintenant: "15 MIN", ligne: "chaque jour" } as never },
  { id: "e4", type: "question", fond: "ivoire", contenu: { type: "question", lignes: ["Et chez vous ?"], question: "Quelle tâche ?" } as never },
];
const BRUTE = mettre(T, ECRANS).ecrans;
/** Déclinaison sans fond fort (valeur à la main, indépendante du tirage). */
const DECLINAISON = Object.fromEntries(Object.entries(BRUTE).map(([k, v]) => [k, { ...v, fondFort: undefined }])) as typeof BRUTE;
const AVEC_FORT = { ...DECLINAISON, e3: { ...DECLINAISON.e3!, fondFort: true as const } } as typeof BRUTE;

/** Entrée d'historique à la main : graine propre, combinaison L6 et/ou types notés. */
function entree(n: number, extra: Partial<Tirage>, canaux: string[] = ["linkedin"]): EntreeHistorique {
  return entreeHistorique(`v-hist-${n}`, canaux, { ...T, graine: 5_000_000 + n, ...extra }, LE);
}

describe("hacher32", () => {
  it("rend la valeur FNV-1a fixe de « axion »", () => {
    expect(hacher32("axion")).toBe(1434251914);
  });
  it("rend l'offset de base pour le texte vide (0x811c9dc5)", () => {
    expect(hacher32("")).toBe(0x811c9dc5);
  });
  it("rend un entier de 32 bits non signé, toujours le même", () => {
    for (const s of ["axion", "cas-concret:v1", "é à ü 日本", "x".repeat(500)]) {
      const h = hacher32(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(hacher32(s)).toBe(h);
    }
  });
  it("distingue deux textes proches", () => {
    expect(hacher32("axion")).not.toBe(hacher32("axioN"));
  });
});

describe("hasardSeme", () => {
  const suite = (g: number, n = 5) => {
    const r = hasardSeme(g);
    return Array.from({ length: n }, () => r());
  };
  it("même graine : même suite de 5 nombres", () => {
    expect(suite(42)).toEqual(suite(42));
    expect(suite(42)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423]);
  });
  it("tous les nombres sont dans [0 ; 1[ (1000 tirages)", () => {
    const r = hasardSeme(hacher32("axion"));
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("deux graines différentes : deux suites différentes", () => {
    expect(suite(1)).not.toEqual(suite(2));
  });
  it("une graine négative ou décimale est ramenée à un entier non signé (>>> 0)", () => {
    expect(suite(-1)).toEqual(suite(0xffffffff));
  });
});

describe("maquettesRecentes", () => {
  it("sans historique : rien", () => {
    expect(maquettesRecentes(T, [])).toEqual({});
  });
  it("l'entrée de même graine est ignorée", () => {
    const h = [entree(1, { graine: T.graine, misesTypes: "resultat:res-coupe-deux" })];
    expect(maquettesRecentes(T, h)).toEqual({});
  });
  it("lit les types notés (misesTypes), v4 comprise, en ensembles par vidéo", () => {
    const h = [entree(1, { misesTypes: "resultat:res-coupe-deux,question:v4-centree" }), entree(2, { misesTypes: "resultat:res-mois-rempli" })];
    const r = maquettesRecentes(T, h);
    expect(r.resultat!.map((s) => [...s])).toEqual([["res-coupe-deux"], ["res-mois-rempli"]]);
    expect(r.question!.map((s) => [...s])).toEqual([[MISE_EN_PAGE_V4]]);
  });
  it("vidéo ancienne (sans misesTypes) : codes L6 de résultat et question seulement, raccords retirés", () => {
    const h = [entree(1, { misesEnPage: "acc-page-ecrite+objet,res-coupe-deux+dedans,que-geante,v4-centree" })];
    const r = maquettesRecentes(T, h);
    expect(Object.keys(r).sort()).toEqual(["question", "resultat"]);
    expect([...r.resultat![0]!]).toEqual(["res-coupe-deux"]);
    expect([...r.question![0]!]).toEqual(["que-geante"]);
  });
  it("misesTypes présent : misesEnPage n'est pas relu", () => {
    const h = [entree(1, { misesTypes: "resultat:res-mois-rempli", misesEnPage: "res-coupe-deux" })];
    expect(maquettesRecentes(T, h).resultat!.map((s) => [...s])).toEqual([["res-mois-rempli"]]);
  });
  it(`la fenêtre est bornée aux ${FENETRE_MAQUETTES} dernières vidéos (les plus anciennes sortent)`, () => {
    const h = [1, 2, 3, 4, 5].map((n) => entree(n, { misesTypes: `resultat:code-${n}` }));
    const r = maquettesRecentes(T, h);
    expect(FENETRE_MAQUETTES).toBe(3);
    expect(r.resultat!.map((s) => [...s])).toEqual([["code-3"], ["code-4"], ["code-5"]]);
  });
  it("l'entrée de même graine ne compte pas dans la fenêtre", () => {
    const h = [1, 2, 3].map((n) => entree(n, { misesTypes: `resultat:code-${n}` }));
    h.push(entree(9, { graine: T.graine, misesTypes: "resultat:code-9" }));
    expect(maquettesRecentes(T, h).resultat!.map((s) => [...s])).toEqual([["code-1"], ["code-2"], ["code-3"]]);
  });
});

describe("misesEnPageL6", () => {
  it("le tirage est choisi hors v4 pour ces essais", () => {
    expect(estV4(T)).toBe(false);
  });
  it("tirage v4 : la déclinaison est rendue telle quelle (même objet)", () => {
    const r = misesEnPageL6(TIRAGE_V4, ECRANS, DECLINAISON);
    expect(r.ecrans).toBe(DECLINAISON);
    expect(r.combinaison).toBeUndefined();
    expect(r.misesTypes).toBeUndefined();
  });
  it("aucun écran avec contenu : déclinaison inchangée, sans combinaison", () => {
    const sans: EcranAMettre[] = ECRANS.map(({ id, type, fond }) => ({ id, type, fond }));
    const r = misesEnPageL6(T, sans, DECLINAISON);
    expect(r.ecrans).toBe(DECLINAISON);
    expect(r.combinaison).toBeUndefined();
  });
  it("liste d'écrans vide : déclinaison inchangée", () => {
    expect(misesEnPageL6(T, [], DECLINAISON).ecrans).toBe(DECLINAISON);
  });
  it("même entrée : même sortie (deux appels)", () => {
    expect(misesEnPageL6(T, ECRANS, DECLINAISON)).toEqual(misesEnPageL6(T, ECRANS, DECLINAISON));
  });
  it("une mise en page par écran, dans le catalogue du type (ou la v4), combinaison à 4 morceaux", () => {
    const r = misesEnPageL6(T, ECRANS, DECLINAISON);
    expect(r.combinaison!.split(",")).toHaveLength(ECRANS.length);
    for (const e of ECRANS) {
      const code = r.ecrans[e.id]!.miseEnPage as string;
      expect([MISE_EN_PAGE_V4, ...(MISES_EN_PAGE_L6 as Record<string, readonly string[]>)[e.type]!]).toContain(code);
    }
  });
  it("misesTypes ne note que résultat et question, « type:code »", () => {
    const r = misesEnPageL6(T, ECRANS, DECLINAISON);
    const notes = r.misesTypes!.split(",");
    expect(notes.map((x) => x.split(":")[0])).toEqual(["resultat", "question"]);
    expect(notes[0]!.split(":")[1]).toBe(r.ecrans.e3!.miseEnPage);
    expect(notes[1]!.split(":")[1]).toBe(r.ecrans.e4!.miseEnPage);
  });
  it("un écran au fond fort garde la v4 et n'est pas noté dans misesTypes", () => {
    const r = misesEnPageL6(T, ECRANS, AVEC_FORT);
    expect(r.ecrans.e3!.miseEnPage).toBe(MISE_EN_PAGE_V4);
    expect(r.misesTypes!.split(",").map((x) => x.split(":")[0])).toEqual(["question"]);
    expect(r.combinaison!.split(",")[2]).toBe(MISE_EN_PAGE_V4);
  });
  it("jamais deux écrans de suite avec la même mise en page de même type (essai sur 30 graines)", () => {
    for (let i = 0; i < 30; i++) {
      const t = { ...T, graine: 7000 + i };
      const e2 = ECRANS.map((e, k) => (k === 1 ? { ...e, id: "e2", type: "accroche" as const, contenu: ECRANS[0]!.contenu } : e));
      const r = misesEnPageL6(t, e2, DECLINAISON);
      const [a, b] = [r.ecrans.e1!.miseEnPage, r.ecrans.e2!.miseEnPage];
      expect(a === b).toBe(false);
    }
  });
  it("les écrans absents de la déclinaison ne sont pas inventés ; les autres entrées sont recopiées", () => {
    const decl = { ...DECLINAISON, hors: DECLINAISON.e1! };
    const r = misesEnPageL6(T, ECRANS, decl);
    expect(r.ecrans.hors).toBe(decl.hors);
    const partielle = { e1: DECLINAISON.e1! };
    expect(Object.keys(misesEnPageL6(T, ECRANS, partielle).ecrans)).toEqual(["e1"]);
  });
  it("un écran sans contenu garde sa valeur de L2", () => {
    const e2 = ECRANS.map((e, k) => (k === 1 ? { id: e.id, type: e.type, fond: e.fond } : e));
    const r = misesEnPageL6(T, e2, DECLINAISON);
    expect(r.ecrans.e2!.miseEnPage).toBe(DECLINAISON.e2!.miseEnPage);
  });
  it("la combinaison déjà vue est évitée quand c'est possible (historique de la même combinaison)", () => {
    const premiere = misesEnPageL6(T, ECRANS, DECLINAISON).combinaison!;
    const h = [entree(1, { misesEnPage: premiere }, [])];
    const apres = misesEnPageL6(T, ECRANS, DECLINAISON, h).combinaison!;
    expect(apres).not.toBe(premiere);
  });
  it("la même maquette que la vidéo précédente du canal n'est pas reposée à l'accroche", () => {
    const sansHist = misesEnPageL6(T, ECRANS, DECLINAISON).ecrans.e1!.miseEnPage as string;
    if (sansHist === MISE_EN_PAGE_V4) return;
    const h = [entree(1, { misesEnPage: sansHist }, ["linkedin"])];
    const r = misesEnPageL6(T, ECRANS, DECLINAISON, h, ["linkedin"]);
    expect(r.ecrans.e1!.miseEnPage).not.toBe(sansHist);
  });
});
