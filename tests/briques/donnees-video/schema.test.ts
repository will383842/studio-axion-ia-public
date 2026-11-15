/**
 * Schéma strict `tableau-de-bord.v1` (G4-01).
 * TOUS LES EXEMPLES SONT FICTIFS : aucun chiffre réel d'un client, aucun nom, aucune donnée personnelle.
 */
import { describe, expect, it } from "vitest";
import { lireTableauDeBord } from "@/briques/donnees-video/types";

const minimal = {
  version: "tableau-de-bord.v1",
  titre: "Exemple fictif",
  periode: { debut: "2026-01-01", fin: "2026-01-31", libelle: "Janvier (exemple)" },
  source: "Outil exemple",
  indicateurs: [],
  series: [],
  comparaisons: [],
  alertes: [],
  calculs: [],
};

const complet = () => ({
  ...minimal,
  titre: "Tableau complet (exemple fictif)",
  indicateurs: [
    { id: "visites", libelle: "Visites", valeur: 1200, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Taux de rebond", valeur: 42.5, unite: "%", precision: 1, sens: "baisse-bonne" },
    { id: "avant", libelle: "Avant", valeur: 10, unite: "visites", precision: 0, sens: "hausse-bonne" },
  ],
  series: [
    { id: "s1", libelle: "Visites par semaine", unite: "visites", points: [{ x: "S1", valeur: 100 }, { x: "S2", valeur: 140 }] },
  ],
  comparaisons: [{ avant: "avant", apres: "visites" }],
  alertes: [{ texte: "Le rebond dépasse le seuil", indicateurId: "rebond" }],
  calculs: [{ id: "c1", formule: "visites - avant", resultat: 1190 }],
});

const erreurs = (e: unknown) => {
  const r = lireTableauDeBord(e);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.erreurs;
};
type Champs = { [cle: string]: string | number | undefined };
type Brouillon = {
  [cle: string]: unknown;
  version: string;
  titre: string;
  periode: Champs;
  indicateurs: Champs[];
  series: Array<Champs & { points: Champs[] }>;
  comparaisons: Champs[];
  alertes: Champs[];
  calculs: Champs[];
};
const clone = (): Brouillon => structuredClone(complet()) as unknown as Brouillon;

describe("tableau-de-bord.v1 — exemples valides", () => {
  it("accepte un exemple minimal", () => {
    expect(lireTableauDeBord(minimal).ok).toBe(true);
  });
  it("accepte un exemple complet", () => {
    const r = lireTableauDeBord(complet());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnee.indicateurs).toHaveLength(3);
  });
});

describe("tableau-de-bord.v1 — refus", () => {
  it("refuse un champ inconnu à chaque niveau", () => {
    const niveaux: Array<(d: Brouillon) => void> = [
      (d) => (d.extra = 1),
      (d) => (d.periode.extra = 1),
      (d) => (d.indicateurs[0].extra = 1),
      (d) => (d.series[0].extra = 1),
      (d) => (d.series[0].points[0].extra = 1),
      (d) => (d.comparaisons[0].extra = 1),
      (d) => (d.alertes[0].extra = 1),
      (d) => (d.calculs[0].extra = 1),
    ];
    for (const modifier of niveaux) {
      const d = clone();
      modifier(d);
      expect(erreurs(d).length).toBeGreaterThan(0);
    }
  });
  it("refuse une série à un seul point", () => {
    const d = clone();
    d.series[0].points = [{ x: "S1", valeur: 1 }];
    expect(erreurs(d).join(" ")).toMatch(/point/i);
  });
  it("refuse plus de 12 points", () => {
    const d = clone();
    d.series[0].points = Array.from({ length: 13 }, (_, i) => ({ x: `P${i}`, valeur: i }));
    expect(erreurs(d).join(" ")).toMatch(/12/);
  });
  it("refuse une unité absente", () => {
    const d = clone();
    delete d.indicateurs[0].unite;
    expect(erreurs(d).join(" ")).toMatch(/unité/i);
  });
  it("refuse une comparaison vers un id inexistant", () => {
    const d = clone();
    d.comparaisons[0].apres = "inconnu";
    expect(erreurs(d).join(" ")).toMatch(/inconnu/);
  });
  it("refuse un sens inconnu", () => {
    const d = clone();
    d.indicateurs[0].sens = "stable";
    expect(erreurs(d).length).toBeGreaterThan(0);
  });
  it("refuse une version autre que v1", () => {
    const d = clone();
    d.version = "tableau-de-bord.v2";
    expect(erreurs(d).join(" ")).toMatch(/version/i);
  });
  it("refuse un courriel dans un libellé", () => {
    const d = clone();
    d.indicateurs[0].libelle = "Écrire à nom@exemple.fr";
    expect(erreurs(d).join(" ")).toMatch(/courriel/i);
  });
  it("refuse un numéro de téléphone dans un libellé", () => {
    const d = clone();
    d.titre = "Appeler le 06 12 34 56 78";
    expect(erreurs(d).join(" ")).toMatch(/téléphone/i);
  });
  it("refuse des caractères hors liste blanche", () => {
    const d = clone();
    d.titre = "Titre <script>";
    expect(erreurs(d).length).toBeGreaterThan(0);
  });
  it("refuse un id d'indicateur dupliqué, une alerte ou une formule vers un id inexistant", () => {
    const a = clone();
    a.indicateurs[1].id = "visites";
    expect(erreurs(a).join(" ")).toMatch(/deux fois/);
    const b = clone();
    b.alertes[0].indicateurId = "nulle-part";
    expect(erreurs(b).join(" ")).toMatch(/nulle-part/);
    const c = clone();
    c.calculs[0].formule = "visites ** fantome";
    expect(erreurs(c).length).toBeGreaterThan(0);
    const e = clone();
    e.calculs[0].formule = "visites + fantome";
    expect(erreurs(e).join(" ")).toMatch(/fantome/);
  });
  it("ne lève jamais, même sur une entrée absurde", () => {
    for (const x of [null, undefined, 3, "x", []]) expect(lireTableauDeBord(x).ok).toBe(false);
  });
});
