/**
 * T-CALAGE-CARTES-v20g : tests directs de `instantDit`, `horairesParDefaut` et `calerCarte`
 * (`src/briques/motion/calage.ts`). Fonctions pures : aucune horloge, aucun hasard, aucun double de module.
 */
import { describe, expect, it } from "vitest";
import { calerCarte, horairesParDefaut, instantDit, type MotCalage } from "../../../src/briques/motion/calage";
import type { CarteModele } from "../../../src/briques/motion/types";

const mot = (m: string, debutSec: number): MotCalage => ({ mot: m, debutSec, finSec: debutSec + 0.3 });
const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("instantDit", () => {
  it("rend l'instant relatif au début de la carte, du premier mot porteur de sens retrouvé", () => {
    const mots = [mot("Alors", 11), mot("trois", 12.5)];
    expect(instantDit("Trois étapes", mots, 10)).toBe(2.5);
  });

  it("retrouve un nombre de 2 chiffres écrit par le mot dit", () => {
    expect(instantDit("12", [mot("douze", 14.25)], 10)).toBe(4.25);
  });

  it("essaie le mot clé suivant quand le premier n'est pas dit", () => {
    expect(instantDit("Rapide trois", [mot("trois", 12)], 10)).toBe(2);
  });

  it("accepte un mot de 5 lettres ou plus qui partage le même début", () => {
    expect(instantDit("installation", [mot("installer", 11.2)], 10)).toBe(1.2);
  });

  it("ignore les accents et la casse", () => {
    expect(instantDit("ÉTAPES", [mot("etapes", 1.5)], 0)).toBe(1.5);
  });

  it("ne retient que les mots dits après `apresSec`", () => {
    const mots = [mot("trois", 10.5), mot("trois", 13)];
    expect(instantDit("trois", mots, 10)).toBe(0.5);
    expect(instantDit("trois", mots, 10, 1)).toBe(3);
  });

  it("tolère un écart de 1e-6 sur la borne", () => {
    expect(instantDit("trois", [mot("trois", 11)], 10, 1.0000005)).toBe(1);
  });

  it("rend undefined : texte vide, mots vides seulement, mot absent, liste de mots vide", () => {
    expect(instantDit("", [mot("trois", 1)], 0)).toBeUndefined();
    expect(instantDit("le la les", [mot("le", 1)], 0)).toBeUndefined();
    expect(instantDit("quatre", [mot("trois", 1)], 0)).toBeUndefined();
    expect(instantDit("trois", [], 0)).toBeUndefined();
  });

  it("arrondit à 3 décimales et ne modifie pas les mots", () => {
    const mots = [mot("trois", 12.123456)];
    const avant = copie(mots);
    expect(instantDit("trois", mots, 10)).toBe(2.123);
    expect(mots).toEqual(avant);
  });
});

describe("horairesParDefaut", () => {
  it("avec titre : départ à 0,8 s, pas de 1,1 s", () => {
    expect(horairesParDefaut(3, 10, true)).toEqual([0.8, 1.9, 3]);
  });

  it("sans titre : départ à 0,25 s", () => {
    expect(horairesParDefaut(3, 10, false)).toEqual([0.25, 1.35, 2.45]);
  });

  it("un seul élément : l'instant de départ", () => {
    expect(horairesParDefaut(1, 10, false)).toEqual([0.25]);
    expect(horairesParDefaut(1, 10, true)).toEqual([0.8]);
  });

  it("aucun élément (ou négatif) : liste vide", () => {
    expect(horairesParDefaut(0, 10, true)).toEqual([]);
    expect(horairesParDefaut(-2, 10, true)).toEqual([]);
  });

  it("carte courte : les éléments sont serrés pour laisser 1,7 s à la fin", () => {
    expect(horairesParDefaut(4, 3, true)).toEqual([0.8, 0.967, 1.133, 1.3]);
  });

  it("carte plus courte que le départ : tous au même instant", () => {
    expect(horairesParDefaut(3, 1, false)).toEqual([0.25, 0.25, 0.25]);
  });
});

describe("calerCarte", () => {
  const liste = (elements: { texte: string; aSec?: number }[], titre?: string): CarteModele => ({ modele: "liste", donnees: { titre, elements } });

  it("liste sans parole : horaires par défaut", () => {
    const r = calerCarte(liste([{ texte: "a1" }, { texte: "b1" }, { texte: "c1" }]), [], 0, 10);
    expect(r.modele === "liste" && r.donnees.elements.map((e) => e.aSec)).toEqual([0.25, 1.35, 2.45]);
  });

  it("liste : chaque élément apparaît quand la voix le dit, dans l'ordre", () => {
    const mots = [mot("trois", 12), mot("quatre", 14)];
    const r = calerCarte(liste([{ texte: "Trois cartes" }, { texte: "Quatre pas" }], "Titre"), mots, 10, 10);
    expect(r.modele === "liste" && r.donnees.elements.map((e) => e.aSec)).toEqual([2, 4]);
  });

  it("liste : les instants croissent d'au moins 0,35 s, et les aSec fournis sont gardés", () => {
    const r = calerCarte(liste([{ texte: "a1", aSec: 2 }, { texte: "b1", aSec: 1 }, { texte: "c1", aSec: 1.1 }], "T"), [], 0, 10);
    expect(r.modele === "liste" && r.donnees.elements.map((e) => e.aSec)).toEqual([2, 2.35, 2.7]);
  });

  it("liste : la chute finale reste libre (plafond durée − 1,4 s)", () => {
    const r = calerCarte(liste([{ texte: "a1", aSec: 5 }, { texte: "b1", aSec: 6 }]), [], 0, 2);
    expect(r.modele === "liste" && r.donnees.elements.map((e) => e.aSec)).toEqual([0.6, 0.6]);
  });

  it("liste vide : reste vide ; le reste des données est conservé", () => {
    const r = calerCarte(liste([], "Titre"), [], 0, 10);
    expect(r).toEqual({ modele: "liste", donnees: { titre: "Titre", elements: [] } });
  });

  it("liste : l'entrée n'est pas modifiée", () => {
    const carte = liste([{ texte: "a1" }, { texte: "b1", aSec: 3 }], "T");
    const mots = [mot("a1", 1)];
    const [c0, m0] = [copie(carte), copie(mots)];
    const r = calerCarte(carte, mots, 0, 10);
    expect(carte).toEqual(c0);
    expect(mots).toEqual(m0);
    expect(r).not.toBe(carte);
  });

  it("ligne-de-temps : horaires par défaut, détail conservé", () => {
    const carte: CarteModele = { modele: "ligne-de-temps", donnees: { etapes: [{ titre: "a1", detail: "x" }, { titre: "b1" }, { titre: "c1" }] } };
    const r = calerCarte(carte, [], 0, 10);
    expect(r).toEqual({ modele: "ligne-de-temps", donnees: { etapes: [{ titre: "a1", detail: "x", aSec: 0.25 }, { titre: "b1", aSec: 1.35 }, { titre: "c1", aSec: 2.45 }] } });
  });

  it("ligne-de-temps : suit la voix", () => {
    const carte: CarteModele = { modele: "ligne-de-temps", donnees: { titre: "T", etapes: [{ titre: "Audit" }, { titre: "Lancement" }] } };
    const r = calerCarte(carte, [mot("audit", 3), mot("lancement", 7.5)], 2, 10);
    expect(r.modele === "ligne-de-temps" && r.donnees.etapes.map((e) => e.aSec)).toEqual([1, 5.5]);
  });

  it("chiffre : le mot du nombre, sinon 0,3 s, plafonné à durée − 1,4 s", () => {
    const donnees = { valeur: 12, libelle: "jours" };
    const aSecDe = (c: CarteModele) => (c.modele === "chiffre" ? c.donnees.aSec : null);
    expect(aSecDe(calerCarte({ modele: "chiffre", donnees }, [mot("douze", 12.5)], 10, 10))).toBe(2.5);
    expect(aSecDe(calerCarte({ modele: "chiffre", donnees }, [], 10, 10))).toBe(0.3);
    expect(aSecDe(calerCarte({ modele: "chiffre", donnees: { ...donnees, aSec: 99 } }, [], 10, 10))).toBe(8.6);
  });

  it("avant-apres : valeurs par défaut, minimum 1,1 s, plafond de fin", () => {
    const donnees = { avant: { valeur: 4, unite: "h" }, apres: { valeur: 1, unite: "h" } };
    const aSecDe = (c: CarteModele) => (c.modele === "avant-apres" ? c.donnees.aSecApres : null);
    expect(aSecDe(calerCarte({ modele: "avant-apres", donnees }, [], 0, 10))).toBe(1.8);
    expect(aSecDe(calerCarte({ modele: "avant-apres", donnees: { ...donnees, aSecApres: 0.2 } }, [], 0, 10))).toBe(1.1);
    expect(aSecDe(calerCarte({ modele: "avant-apres", donnees }, [], 0, 2))).toBeCloseTo(0.6, 9);
  });

  it("deux-colonnes : défauts, puis valeurs fournies avec 0,6 s d'écart minimum", () => {
    const donnees = { gauche: { titre: "A", points: [] }, droite: { titre: "B", points: [] }, commun: { points: [] } };
    const sorties = (c: CarteModele) => (c.modele === "deux-colonnes" ? [c.donnees.aSecDroite, c.donnees.aSecCommun] : null);
    expect(sorties(calerCarte({ modele: "deux-colonnes", donnees }, [], 0, 10))).toEqual([1.5, 2.7]);
    expect(sorties(calerCarte({ modele: "deux-colonnes", donnees: { ...donnees, aSecDroite: 3, aSecCommun: 3.2 } }, [], 0, 10))).toEqual([3, 3.6]);
  });

  it("modèle sans calage (titre) : la carte est rendue telle quelle", () => {
    const carte: CarteModele = { modele: "titre", donnees: { variante: "titre", titre: "Bonjour" } };
    expect(calerCarte(carte, [mot("bonjour", 1)], 0, 10)).toBe(carte);
  });
});
