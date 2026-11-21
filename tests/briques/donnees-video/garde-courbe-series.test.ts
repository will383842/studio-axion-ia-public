/**
 * La garde des chiffres contrôle aussi la courbe à plusieurs séries (G4-11-GARDE-v19c). DONNÉE ENTIÈREMENT FICTIVE.
 */
import { describe, expect, it } from "vitest";
import { garderPlanScenes } from "@/briques/donnees-video/garde-plan-scenes";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { estGardee } from "@/briques/plan-scenes/pieces-gardees";

const donnee: TableauDeBord = {
  version: "tableau-de-bord.v1",
  titre: "Exemple fictif",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Février", valeur: 1000, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Mars", valeur: 1240, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Rebond", valeur: 12.345, unite: "%", precision: 1, sens: "baisse-bonne" },
  ],
  series: [
    { id: "s1", libelle: "Visites", unite: "visites", points: [{ x: "S1", valeur: 310 }, { x: "S2", valeur: 355 }] },
    { id: "s2", libelle: "Demandes", unite: "visites", points: [{ x: "S1", valeur: 20 }, { x: "S2", valeur: 25 }] },
  ],
  comparaisons: [],
  alertes: [],
  calculs: [],
};

const base = { id: "s1", version: 1, mots: { premier: 0, dernier: 3 }, debutMs: 0, finMs: 2000, niveau: 1, position: "plein" };
const plan = (...scenes: Record<string, unknown>[]) => ({ scenes: scenes.map((s, i) => ({ ...base, id: `s${i + 1}`, ...s })) }) as never;
const courbe = (valeurs: number[][], titre = "Visites et demandes", noms = ["Visites", "Demandes"]) => ({
  piece: "courbe-series",
  parametres: { titre, abscisses: ["S1", "S2"], series: valeurs.map((v, i) => ({ nom: noms[i] ?? `n${i}`, valeurs: v })) },
});

describe("garderPlanScenes : courbe-series", () => {
  it("valeur hors donnée = faute", () => {
    const v = garderPlanScenes(plan(courbe([[310, 777], [20, 25]])), donnee);
    expect(v.ok).toBe(false);
    expect(v.fautes).toEqual([{ sceneId: "s1", piece: "courbe-series", valeur: 777 }]);
  });

  it("toutes les valeurs de la donnée = ok", () => {
    expect(garderPlanScenes(plan(courbe([[310, 355], [20, 25]])), donnee)).toEqual({ ok: true, fautes: [] });
  });

  it("nombre dans le titre ou dans un nom de série, absent de la donnée = faute", () => {
    expect(garderPlanScenes(plan(courbe([[310, 355], [20, 25]], "Visites : +40 %")), donnee).ok).toBe(false);
    const v = garderPlanScenes(plan(courbe([[310, 355], [20, 25]], "Visites", ["Visites", "Demandes +50 %"])), donnee);
    expect(v.ok).toBe(false);
    expect(v.fautes[0]).toMatchObject({ piece: "courbe-series", valeur: 50 });
  });

  it("idem en calque", () => {
    const s = { piece: "legende", parametres: { texte: "Bonjour", sousTexte: "", style: "bandeau" }, calques: [{ ...courbe([[310, 888], [20, 25]]), debutMs: 0, zone: "plein" }] };
    expect(garderPlanScenes(plan(s), donnee).fautes).toEqual([{ sceneId: "s1", piece: "courbe-series", valeur: 888 }]);
  });

  it("paramètres illisibles : ne lève pas, aucune faute inventée", () => {
    for (const parametres of [{}, { series: [{ nom: "a", valeurs: "x" }] }, { series: "x", abscisses: 3 }, { series: [null, 4, { nom: 5 }] }, null]) {
      const v = garderPlanScenes(plan({ piece: "courbe-series", parametres }), donnee);
      expect(v).toEqual({ ok: true, fautes: [] });
    }
  });

  it("éteint = identique : donnée absente sans rien lire ; verdicts d'avant inchangés ; courbe non inscrite", () => {
    const piege = { get scenes(): never { throw new Error("lu"); } } as never;
    expect(garderPlanScenes(piege)).toEqual({ ok: true, fautes: [] });
    expect(garderPlanScenes(plan(courbe([[999, 1]])), undefined)).toEqual({ ok: true, fautes: [] });

    const graphique = (v: number[]) => ({ piece: "graphique", parametres: { type: "barres", titre: "Visites", valeurs: v.map((x, i) => ({ libelle: `L${i}`, valeur: x })), enAvant: -1 } });
    expect(garderPlanScenes(plan(graphique([310, 355])), donnee).ok).toBe(true);
    expect(garderPlanScenes(plan(graphique([310, 777])), donnee).fautes).toEqual([{ sceneId: "s1", piece: "graphique", valeur: 777 }]);
    const m = { surMot: 0, aMs: 400 };
    expect(garderPlanScenes(plan({ piece: "compteur", parametres: { valeur: 1240, ...m } }), donnee).ok).toBe(true);
    expect(garderPlanScenes(plan({ piece: "compteur", parametres: { valeur: 9, ...m } }), donnee).ok).toBe(false);
    expect(garderPlanScenes(plan({ piece: "barres", parametres: { barres: [{ libelle: "a", valeur: 310, ...m }, { libelle: "b", valeur: 11, ...m }] } }), donnee).fautes.map((f) => f.valeur)).toEqual([11]);
    const s = { niveau: 2, piece: "legende", parametres: { texte: "Bonjour 99", sousTexte: "", style: "bandeau" }, calques: [{ piece: "compteur", parametres: { valeur: 8, surMot: 0, aMs: 0 }, debutMs: 0, zone: "plein" }] };
    expect(garderPlanScenes(plan(s), donnee).fautes).toEqual([{ sceneId: "s1", piece: "compteur", valeur: 8 }]);

    expect(Object.keys(CATALOGUE_BRIQUES)).toContain("courbe-series");
    expect(estGardee(CATALOGUE_BRIQUES["courbe-series"])).toBe(true);
  });

  it("ne modifie pas le plan", () => {
    const p = plan(courbe([[310, 777], [20, 25]]));
    const avant = JSON.stringify(p);
    garderPlanScenes(p, donnee);
    expect(JSON.stringify(p)).toBe(avant);
  });
});
