import { describe, expect, it } from "vitest";
import { COMPARAISONS, ICONES_COMPARAISON, TEXTES_FIXES_COMPARAISONS } from "../../src/briques/visuels/continu/familles/comparaisons";
import { GABARITS, GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { ICONES_CONTINU } from "../../studio-rendu/compositions/visuels/continu/commun/icones-continu";
import { COMPOSANTS_PLAQUETTES } from "../../studio-rendu/compositions/visuels/continu/registre-composants";

/** Table attendue (maquette v3, `add('Comparaisons', …)`) : `dk:1` → sombre ; `or:1` ou carte orange > 12 % de la page → orangeFort. */
const ATTENDU: Record<string, { nom: string; sombre: boolean; orangeFort: boolean; cas: boolean }> = {
  K01: { nom: "Avant / avec nous", sombre: false, orangeFort: false, cas: true },
  K02: { nom: "Mythe / réalité", sombre: false, orangeFort: true, cas: false },
  K03: { nom: "Tableau sans / avec", sombre: false, orangeFort: false, cas: false },
  K04: { nom: "Barres de durée", sombre: false, orangeFort: false, cas: false },
};

/** Budgets (nombre de caractères) par champ texte. */
const BUDGETS: Record<string, Record<string, number>> = {
  K01: { titre: 22, accent: 20 },
  K02: { mythe: 60, realite: 80 },
  K03: { titre: 22, accent: 20 },
  K04: { titre: 22, accent: 24, avant: 24, avec: 24, phrase: 70 },
};

const def = (t: string) => COMPARAISONS.find((g) => g.type === t)!;
const exemple = (t: string) => def(t).exemple as Record<string, unknown>;

describe("continu P3c : comparaisons (registre)", () => {
  it("quatre plaquettes K01 à K04, famille comparaison, actives, version >= 1", () => {
    expect(COMPARAISONS.map((g) => g.type)).toEqual(["K01", "K02", "K03", "K04"]);
    for (const g of COMPARAISONS) {
      expect(g.famille, g.type).toBe("comparaison");
      expect(g.actif, g.type).toBe(true);
      expect(g.version, g.type).toBeGreaterThanOrEqual(1);
      expect(g.role, g.type).toBe("contenu");
      expect(GABARITS_PRODUCTION, g.type).toContain(g);
      expect(GABARITS, g.type).toContain(g);
    }
  });
  it("noms, sombre, orangeFort et cas conformes à la maquette", () => {
    for (const [t, a] of Object.entries(ATTENDU)) {
      const g = def(t);
      expect({ nom: g.nom, sombre: g.sombre, orangeFort: g.orangeFort, cas: g.cas === true }, t).toEqual(a);
    }
  });
  it("chaque exemple passe son schéma, alt <= 125", () => {
    for (const g of COMPARAISONS) {
      expect(g.schema.safeParse(g.exemple).success, g.type).toBe(true);
      expect((g.exemple as { type: string }).type).toBe(g.type);
      expect(String(exemple(g.type).alt).length, g.type).toBeLessThanOrEqual(125);
      expect(String(exemple(g.type).alt).length, g.type).toBeGreaterThan(0);
    }
  });
  it("un champ inconnu (étiquette, titre de colonne…) est refusé : le schéma est strict", () => {
    for (const g of COMPARAISONS) {
      for (const cle of ["etiquette", "mytheLibelle", "sans", "inconnue"]) {
        if (cle in exemple(g.type)) continue;
        expect(g.schema.safeParse({ ...exemple(g.type), [cle]: "x" }).success, `${g.type}.${cle}`).toBe(false);
      }
    }
  });
  it("chaque texte passe à son budget et échoue à budget + 1", () => {
    for (const [t, champs] of Object.entries(BUDGETS)) {
      for (const [champ, max] of Object.entries(champs)) {
        const base = exemple(t);
        expect(champ in base, `${t}.${champ}`).toBe(true);
        expect(def(t).schema.safeParse({ ...base, [champ]: "a".repeat(max) }).success, `${t}.${champ} = ${max}`).toBe(true);
        expect(def(t).schema.safeParse({ ...base, [champ]: "a".repeat(max + 1) }).success, `${t}.${champ} = ${max + 1}`).toBe(false);
      }
    }
  });
  it("K01 : deux points par voie, à 34 caractères au plus ; K03 : 3 à 4 lignes", () => {
    const k1 = exemple("K01") as { avant: string[]; avec: string[] };
    expect(k1.avant).toHaveLength(2);
    expect(k1.avec).toHaveLength(2);
    for (const cle of ["avant", "avec"] as const) {
      expect(def("K01").schema.safeParse({ ...k1, [cle]: ["a".repeat(34), "b".repeat(34)] }).success, cle).toBe(true);
      expect(def("K01").schema.safeParse({ ...k1, [cle]: ["a".repeat(35), "b"] }).success, cle).toBe(false);
      expect(def("K01").schema.safeParse({ ...k1, [cle]: ["a"] }).success, cle).toBe(false);
      expect(def("K01").schema.safeParse({ ...k1, [cle]: ["a", "b", "c"] }).success, cle).toBe(false);
    }
    const k3 = exemple("K03") as { lignes: Record<string, string>[] };
    expect(k3.lignes.length).toBeGreaterThanOrEqual(3);
    expect(k3.lignes.length).toBeLessThanOrEqual(4);
    const avec = (lignes: unknown[]) => def("K03").schema.safeParse({ ...k3, lignes }).success;
    const ligne = k3.lignes[0];
    expect(avec([ligne, ligne])).toBe(false);
    expect(avec([ligne, ligne, ligne])).toBe(true);
    expect(avec([ligne, ligne, ligne, ligne])).toBe(true);
    expect(avec([ligne, ligne, ligne, ligne, ligne])).toBe(false);
    for (const [champ, max] of [["libelle", 22], ["sans", 12], ["avec", 12]] as const) {
      expect(avec([{ ...ligne, [champ]: "a".repeat(max) }, ligne, ligne]), champ).toBe(true);
      expect(avec([{ ...ligne, [champ]: "a".repeat(max + 1) }, ligne, ligne]), champ).toBe(false);
    }
    expect(avec([{ ...ligne, icone: "inconnue" }, ligne, ligne])).toBe(false);
    expect(avec([{ ...ligne, etiquette: "x" }, ligne, ligne])).toBe(false);
  });
  it("K04 : la longueur des barres est une clé technique `variante` parmi 3 profils, jamais un nombre", () => {
    const k4 = exemple("K04");
    const profils = ["a", "b", "c"];
    expect(profils).toContain(k4.variante);
    for (const v of profils) expect(def("K04").schema.safeParse({ ...k4, variante: v }).success, v).toBe(true);
    for (const v of ["d", "", "92", 92, 34, "A"]) expect(def("K04").schema.safeParse({ ...k4, variante: v }).success, String(v)).toBe(false);
    expect(def("K04").schema.safeParse({ ...k4, longueurAvant: 92 }).success).toBe(false);
  });
  it("les icônes proposées existent dans les icônes du continu", () => {
    for (const i of ICONES_COMPARAISON) expect(Object.keys(ICONES_CONTINU), i).toContain(i);
  });
  it("les textes fixes sont posés par le code, sans chiffre ni lien", () => {
    expect(TEXTES_FIXES_COMPARAISONS.mythe).toBe("Mythe");
    expect(TEXTES_FIXES_COMPARAISONS.realite).toBe("Réalité");
    expect(TEXTES_FIXES_COMPARAISONS.sans).toBe("Sans");
    expect(TEXTES_FIXES_COMPARAISONS.avec).toBe("Avec nous");
    expect(TEXTES_FIXES_COMPARAISONS.etiquetteDuree).toBe("Exemple illustratif · sans chiffre réel");
    for (const t of Object.values(TEXTES_FIXES_COMPARAISONS)) expect(t).not.toMatch(/\d|https?:|www\./);
  });
  it("les textes d'exemple respectent les interdits (vouvoiement, mots proscrits)", () => {
    for (const g of COMPARAISONS) {
      const texte = JSON.stringify(g.exemple);
      expect(texte, g.type).not.toMatch(/Grenoble|garanti|CPF|J'aide|\btu\b|\btoi\b|\bton\b|\bta\b|\btes\b/i);
    }
  });
  it("bordsLibres : intervalles ordonnés dans la page", () => {
    for (const g of COMPARAISONS) {
      for (const cote of [g.bordsLibres.gauche, g.bordsLibres.droite]) {
        for (const [a, b] of cote) {
          expect(a, g.type).toBeLessThan(b);
          expect(a, g.type).toBeGreaterThanOrEqual(0);
          expect(b, g.type).toBeLessThanOrEqual(1440);
        }
      }
    }
  });
  it("le composant de chaque type est déclaré dans registre-composants", () => {
    for (const g of COMPARAISONS) expect(typeof COMPOSANTS_PLAQUETTES[g.type], g.type).toBe("function");
  });
});
