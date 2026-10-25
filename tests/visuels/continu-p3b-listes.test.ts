import { describe, expect, it } from "vitest";
import { GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { BORNES_LISTES, budgetListe, LISTES } from "../../src/briques/visuels/continu/familles/listes";
import { NOMS_ICONES } from "../../src/briques/visuels/continu/icones";
import { ICONES_CONTINU } from "../../studio-rendu/compositions/visuels/continu/commun/icones-continu";
import { COMPOSANTS_PLAQUETTES } from "../../studio-rendu/compositions/visuels/continu/registre-composants";

/** Table attendue de la maquette v3 (`dk:1` → sombre, `or:1` → orangeFort) : aucune liste n'est sombre ni orange. */
const ATTENDU: Record<string, { nom: string; sombre: boolean; orangeFort: boolean; cas?: boolean }> = {
  L01: { nom: "Bento illustré", sombre: false, orangeFort: false },
  L02: { nom: "Liste à gros chiffres", sombre: false, orangeFort: false },
  L03: { nom: "Escalier", sombre: false, orangeFort: false },
  L04: { nom: "Chronologie", sombre: false, orangeFort: false, cas: true },
  L05: { nom: "Checklist", sombre: false, orangeFort: false },
  L06: { nom: "Matrice effort / impact", sombre: false, orangeFort: false },
  L07: { nom: "Grille d’icônes", sombre: false, orangeFort: false },
};

/** Champ de liste (nom de la liste, champs d'un élément) de chaque gabarit. */
const LISTE: Record<string, string> = { L01: "items", L02: "items", L03: "etapes", L04: "etapes", L05: "lignes", L06: "points", L07: "items" };

/** Élément réduit à des textes courts (« Ok ») : il passe tous les budgets, quel que soit le nombre d'éléments. */
const court = (e: Dict): Dict => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === "string" && k !== "icone" ? "Ok" : v]));

const g = (type: string) => LISTES.find((x) => x.type === type)!;
const mot = (n: number) => "é".repeat(n);
type Dict = Record<string, unknown>;
const exemple = (type: string) => g(type).exemple as Dict;

/** Remplace le premier élément de la liste par un élément dont le champ `champ` vaut `valeur`. */
function avecChamp(type: string, champ: string, valeur: unknown, racine = false): Dict {
  const base = exemple(type);
  if (racine) return { ...base, [champ]: valeur };
  const liste = (base[LISTE[type]] as Dict[]).map((e, i) => (i === 0 ? { ...e, [champ]: valeur } : e));
  return { ...base, [LISTE[type]]: liste };
}

describe("continu P3b : registre des listes", () => {
  it("sept gabarits L01 à L07, en rôle contenu, famille liste, actifs", () => {
    expect(LISTES.map((x) => x.type)).toEqual(Object.keys(ATTENDU));
    for (const x of LISTES) {
      expect(x.famille, x.type).toBe("liste");
      expect(x.role, x.type).toBe("contenu");
      expect(x.actif, x.type).toBe(true);
      expect(GABARITS_PRODUCTION.map((p) => p.type)).toContain(x.type);
    }
  });
  it("sombre, orangeFort, cas et nom conformes à la maquette", () => {
    for (const [type, a] of Object.entries(ATTENDU)) {
      expect(g(type).sombre, type).toBe(a.sombre);
      expect(g(type).orangeFort, type).toBe(a.orangeFort);
      expect(!!g(type).cas, type).toBe(!!a.cas);
      expect(g(type).nom, type).toBe(a.nom);
    }
  });
  it("version >= 1, alt d'exemple, bords libres", () => {
    for (const x of LISTES) {
      expect(x.version, x.type).toBeGreaterThanOrEqual(1);
      expect(String(exemple(x.type).alt).length, x.type).toBeGreaterThan(0);
      expect(x.bordsLibres.gauche.length, x.type).toBeGreaterThan(0);
      expect(x.bordsLibres.droite.length, x.type).toBeGreaterThan(0);
    }
  });
  it("chaque exemple passe son schéma, un champ inconnu (étiquette) est refusé", () => {
    for (const x of LISTES) {
      expect(x.schema.safeParse(x.exemple).success, x.type).toBe(true);
      expect(x.schema.safeParse({ ...exemple(x.type), etiquette: "Scénario type" }).success, x.type).toBe(false);
      expect(x.schema.safeParse(avecChamp(x.type, "etiquette", "x")).success, x.type).toBe(false);
    }
  });
  it("les textes visibles de l'exemple sont ceux de la maquette", () => {
    expect(exemple("L01").titre).toBe("Ce qui vous freine,");
    expect(exemple("L01").accent).toBe("souvent");
    expect((exemple("L02").items as Dict[]).map((i) => i.titre)).toEqual(["Auditer", "Choisir", "Installer", "Suivre"]);
    expect((exemple("L03").etapes as Dict[]).map((i) => i.label)).toEqual(["Écouter", "Choisir", "Installer", "Suivre"]);
    expect((exemple("L04").etapes as Dict[]).map((i) => i.jour)).toEqual(["Jour 1", "Jour 3", "Jour 7"]);
    expect((exemple("L05").lignes as Dict[]).map((i) => i.coche)).toEqual([true, true, true, true, false]);
    expect((exemple("L06").points as Dict[]).map((i) => i.label)).toEqual(["Relances", "Veille", "Refonte", "Compte rendu"]);
    expect((exemple("L07").items as Dict[]).length).toBe(9);
  });
  it("aucune étiquette fixe n'est un champ (Scénario type, Sans, Avec, numéros, axes)", () => {
    for (const x of LISTES) {
      const cles = JSON.stringify(Object.keys(x.schema.shape)) + JSON.stringify(exemple(x.type));
      expect(cles, x.type).not.toMatch(/Scénario|Impact|Facilité|Commencez ici/);
    }
    expect(Object.keys(g("L02").schema.shape)).not.toContain("numeros");
  });
});

describe("continu P3b : budgets et bornes", () => {
  it("le titre et l'accent au budget passent, au budget + 1 échouent", () => {
    for (const x of LISTES) {
      const b = budgetListe(x.type, (exemple(x.type)[LISTE[x.type]] as unknown[]).length).page;
      expect(x.schema.safeParse(avecChamp(x.type, "titre", mot(b.titre), true)).success, `${x.type} titre`).toBe(true);
      expect(x.schema.safeParse(avecChamp(x.type, "titre", mot(b.titre + 1), true)).success, `${x.type} titre+1`).toBe(false);
      expect(x.schema.safeParse(avecChamp(x.type, "accent", mot(b.accent), true)).success, `${x.type} accent`).toBe(true);
      expect(x.schema.safeParse(avecChamp(x.type, "accent", mot(b.accent + 1), true)).success, `${x.type} accent+1`).toBe(false);
    }
  });
  it("chaque champ d'élément au budget passe, au budget + 1 échoue, pour chaque nombre d'éléments", () => {
    for (const x of LISTES) {
      const [min, max] = BORNES_LISTES[x.type];
      for (let n = min; n <= max; n++) {
        const base = exemple(x.type)[LISTE[x.type]] as Dict[];
        const elements = Array.from({ length: n }, (_, i) => court(base[i % base.length]));
        const b = budgetListe(x.type, n).element;
        const cles = Object.keys(b);
        expect(cles.length, `${x.type} champs`).toBeGreaterThan(0);
        for (const c of cles) {
          const mettre = (v: string) => ({ ...exemple(x.type), [LISTE[x.type]]: elements.map((e, i) => (i === 0 ? { ...e, [c]: v } : e)) });
          expect(x.schema.safeParse(mettre(mot(b[c]))).success, `${x.type} n=${n} ${c}`).toBe(true);
          expect(x.schema.safeParse(mettre(mot(b[c] + 1))).success, `${x.type} n=${n} ${c}+1`).toBe(false);
        }
      }
    }
  });
  it("bornes min et max du nombre d'éléments", () => {
    for (const x of LISTES) {
      const [min, max] = BORNES_LISTES[x.type];
      const base = exemple(x.type)[LISTE[x.type]] as Dict[];
      const faire = (n: number) => ({ ...exemple(x.type), [LISTE[x.type]]: Array.from({ length: n }, (_, i) => court(base[i % base.length])) });
      expect(x.schema.safeParse(faire(min)).success, `${x.type} min`).toBe(true);
      expect(x.schema.safeParse(faire(max)).success, `${x.type} max`).toBe(true);
      expect(x.schema.safeParse(faire(min - 1)).success, `${x.type} min-1`).toBe(false);
      expect(x.schema.safeParse(faire(max + 1)).success, `${x.type} max+1`).toBe(false);
    }
    expect(BORNES_LISTES).toMatchObject({ L01: [3, 3], L02: [3, 4], L03: [3, 4], L04: [3, 4], L05: [4, 5], L06: [3, 4], L07: [6, 9] });
  });
  it("un lien dans un texte est refusé", () => {
    for (const x of LISTES) expect(x.schema.safeParse(avecChamp(x.type, "titre", "voir https://exemple.fr", true)).success, x.type).toBe(false);
  });
});

describe("continu P3b : icônes (liste fermée)", () => {
  it("la liste du schéma est celle de icones-continu.ts", () => {
    expect([...NOMS_ICONES].sort()).toEqual(Object.keys(ICONES_CONTINU).sort());
  });
  it("une icône inconnue est refusée, une icône connue passe", () => {
    for (const type of ["L01", "L02", "L03", "L04", "L05", "L07"]) {
      expect(g(type).schema.safeParse(avecChamp(type, "icone", "dragon")).success, type).toBe(false);
      expect(g(type).schema.safeParse(avecChamp(type, "icone", "mail")).success, type).toBe(true);
    }
  });
});

describe("continu P3b : composants", () => {
  it("chaque type du registre a son composant", () => {
    for (const x of LISTES) expect(typeof COMPOSANTS_PLAQUETTES[x.type], x.type).toBe("function");
  });
});
