/**
 * Garde des chiffres (G4-03). DONNÉE ENTIÈREMENT FICTIVE : aucun chiffre réel.
 */
import { describe, expect, it } from "vitest";
import { evaluerCalculs, garderChiffres, nombresPermis } from "@/briques/donnees-video/garde-chiffres";
import type { TableauDeBord } from "@/briques/donnees-video/types";

const donnee = (calculs: TableauDeBord["calculs"] = []): TableauDeBord => ({
  version: "tableau-de-bord.v1",
  titre: "Exemple fictif",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Février", valeur: 1000, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Mars", valeur: 1240, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Rebond", valeur: 12.345, unite: "%", precision: 1, sens: "baisse-bonne" },
  ],
  series: [{ id: "s1", libelle: "Visites", unite: "visites", points: [{ x: "S1", valeur: 310 }, { x: "S2", valeur: 355 }] }],
  comparaisons: [],
  alertes: [],
  calculs,
});
const ecart = { id: "ecart", formule: "ca-mars - ca-fevrier", resultat: 240 };

describe("garderChiffres", () => {
  it("accepte une valeur d'indicateur, un point de série, un écart déclaré", () => {
    const d = donnee([ecart]);
    expect(garderChiffres(d, { textesEcran: ["1240 € en mars"], texteDit: "Les visites passent à 355, soit 240 euros de plus." }).ok).toBe(true);
    expect(garderChiffres(d, { textesEcran: ["310 visites"] }).ok).toBe(true);
  });
  it("refuse un nombre inventé", () => {
    const v = garderChiffres(donnee(), { textesEcran: ["Rebond à 42 %"] });
    expect(v.ok).toBe(false);
    expect(v.horsDonnee[0].valeur).toBe(42);
  });
  it("accepte « 1 240 » et « 1240 »", () => {
    expect(garderChiffres(donnee(), { textesEcran: ["1 240 €", "1240 €"] }).ok).toBe(true);
  });
  it("variante muette : nombre inventé à l'écran refusé sans texte dit", () => {
    expect(garderChiffres(donnee(), { textesEcran: ["Objectif 77 clients"] }).ok).toBe(false);
    expect(garderChiffres(donnee(), { textesEcran: ["Objectif 77 clients"], texteDit: "" }).ok).toBe(false);
  });
  it("contrôle aussi le texte dit", () => {
    const v = garderChiffres(donnee(), { textesEcran: [], texteDit: "On a gagné 99 clients." });
    expect(v.horsDonnee.map((h) => h.valeur)).toContain(99);
  });
  it("ignore la liste blanche", () => {
    expect(garderChiffres(donnee(), { textesEcran: ["Ouvert 7 jours sur 7"] }).ok).toBe(true);
  });
  it("accepte un pourcentage arrondi selon la précision", () => {
    expect(garderChiffres(donnee(), { textesEcran: ["Rebond à 12,3 %"] }).ok).toBe(true);
  });
  it("un calcul déclaré faux est une erreur", () => {
    const v = garderChiffres(donnee([{ ...ecart, resultat: 500 }]), { textesEcran: [] });
    expect(v.ok).toBe(false);
    expect(v.erreurs[0]).toContain("calcul ecart faux : déclaré 500, recalculé 240");
  });
  it("ne permet pas le résultat déclaré faux", () => {
    expect(nombresPermis(donnee([{ ...ecart, resultat: 500 }]))).not.toContain(500);
  });
});

describe("evaluerCalculs", () => {
  it("respecte la priorité * / puis + -", () => {
    const r = evaluerCalculs(donnee([{ id: "p", formule: "2 + ca-fevrier * 3 / 6", resultat: 502 }]));
    expect(r.erreurs).toEqual([]);
    expect(r.valeurs.get("p")).toBe(502);
  });
  it("division par zéro : erreur", () => {
    const r = evaluerCalculs(donnee([{ id: "z", formule: "ca-mars / 0", resultat: 0 }]));
    expect(r.erreurs[0]).toContain("division par zéro");
    expect(r.valeurs.has("z")).toBe(false);
  });
});

describe("garde statique", () => {
  it("aucun eval ni new Function", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/briques/donnees-video/garde-chiffres.ts", "utf8");
    expect(src).not.toContain("eval(");
    expect(src).not.toContain("new Function");
  });
});
