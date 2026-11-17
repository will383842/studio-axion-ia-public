/**
 * Garde des valeurs des pièces de données d'un plan de scènes (G4-12). DONNÉE ENTIÈREMENT FICTIVE.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { garderPlanScenes } from "@/briques/donnees-video/garde-plan-scenes";
import type { TableauDeBord } from "@/briques/donnees-video/types";

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
  series: [{ id: "s1", libelle: "Visites", unite: "visites", points: [{ x: "S1", valeur: 310 }, { x: "S2", valeur: 355 }] }],
  comparaisons: [],
  alertes: [],
  calculs: [],
};

const base = { id: "s1", version: 1, mots: { premier: 0, dernier: 3 }, debutMs: 0, finMs: 2000, niveau: 1, position: "plein" };
const plan = (...scenes: Record<string, unknown>[]) => ({ scenes: scenes.map((s, i) => ({ ...base, id: `s${i + 1}`, ...s })) }) as never;
const graphique = (valeurs: number[], titre = "Visites") =>
  ({ piece: "graphique", parametres: { type: "barres", titre, valeurs: valeurs.map((v, i) => ({ libelle: `L${i}`, valeur: v })), enAvant: -1 } });

describe("garderPlanScenes", () => {
  it("donnée absente : OK quel que soit le plan, sans rien lire", () => {
    const piege = { get scenes(): never { throw new Error("lu"); } } as never;
    expect(garderPlanScenes(piege)).toEqual({ ok: true, fautes: [] });
    expect(garderPlanScenes(plan(graphique([999, 1])), undefined)).toEqual({ ok: true, fautes: [] });
  });

  it("graphique : valeurs de la donnée OK, valeur hors donnée = faute", () => {
    expect(garderPlanScenes(plan(graphique([310, 355])), donnee).ok).toBe(true);
    const v = garderPlanScenes(plan(graphique([310, 777])), donnee);
    expect(v.ok).toBe(false);
    expect(v.fautes).toEqual([{ sceneId: "s1", piece: "graphique", valeur: 777 }]);
  });

  it("graphique : nombre écrit dans le titre contrôlé", () => {
    expect(garderPlanScenes(plan(graphique([310, 355], "Visites : +40 %")), donnee).ok).toBe(false);
  });

  it("tableau de bord : « 12,3 % » pour 12,345 OK ; valeur inventée = faute ; série contrôlée", () => {
    const tdb = (valeur: string, serie: number[]) => ({
      piece: "tableau-de-bord",
      parametres: { titre: "Bilan", kpis: [{ libelle: "Rebond", valeur }, { libelle: "Mars", valeur: "1240 €" }], serie },
    });
    expect(garderPlanScenes(plan(tdb("12,3 %", [310, 355, 1240])), donnee).ok).toBe(true);
    expect(garderPlanScenes(plan(tdb("15 %", [310, 355, 1240])), donnee).fautes.map((f) => f.valeur)).toEqual([15]);
    expect(garderPlanScenes(plan(tdb("12,3 %", [310, 355, 42])), donnee).fautes.map((f) => f.valeur)).toEqual([42]);
  });

  it("carte KPI : variation « +40 % » absente de la donnée = faute", () => {
    const kpi = (variation: string, valeur = 1240) => ({
      piece: "carte-kpi",
      parametres: { libelle: "Mars", valeur, prefixe: "", suffixe: " €", decimales: 0, tendance: "hausse", variation },
    });
    expect(garderPlanScenes(plan(kpi("")), donnee).ok).toBe(true);
    const v = garderPlanScenes(plan(kpi("+40 %")), donnee);
    expect(v.ok).toBe(false);
    expect(v.fautes[0]).toMatchObject({ sceneId: "s1", piece: "carte-kpi" });
    expect(garderPlanScenes(plan(kpi("", 5)), donnee).fautes[0]?.valeur).toBe(5);
  });

  it("compteur, jauge, barres, avant-après contrôlés", () => {
    const m = { surMot: 0, aMs: 400 };
    expect(garderPlanScenes(plan({ piece: "compteur", parametres: { valeur: 1240, ...m } }), donnee).ok).toBe(true);
    expect(garderPlanScenes(plan({ piece: "compteur", parametres: { valeur: 9, ...m } }), donnee).ok).toBe(false);
    expect(garderPlanScenes(plan({ piece: "jauge", parametres: { valeur: 72, ...m } }), donnee).ok).toBe(false);
    expect(garderPlanScenes(plan({ piece: "barres", parametres: { barres: [{ libelle: "a", valeur: 310, ...m }, { libelle: "b", valeur: 11, ...m }] } }), donnee).fautes.map((f) => f.valeur)).toEqual([11]);
    const aa = (a: number, b: number) => ({ piece: "avant-apres", parametres: { titre: "Mars", avant: { valeur: a, unite: "€", ...m }, apres: { valeur: b, unite: "€", ...m } } });
    expect(garderPlanScenes(plan(aa(1000, 1240)), donnee).ok).toBe(true);
    expect(garderPlanScenes(plan(aa(1000, 3)), donnee).fautes.map((f) => f.valeur)).toEqual([3]);
  });

  it("calques contrôlés ; pièces hors liste ignorées", () => {
    const s = { niveau: 2, piece: "legende", parametres: { texte: "Bonjour 99", sousTexte: "", style: "bandeau" }, calques: [{ piece: "compteur", parametres: { valeur: 8, surMot: 0, aMs: 0 }, debutMs: 0, zone: "plein" }] };
    const v = garderPlanScenes(plan(s), donnee);
    expect(v.fautes).toEqual([{ sceneId: "s1", piece: "compteur", valeur: 8 }]);
  });

  it("ne modifie pas le plan", () => {
    const p = plan(graphique([310, 777]));
    const avant = JSON.stringify(p);
    garderPlanScenes(p, donnee);
    expect(JSON.stringify(p)).toBe(avant);
  });

  it("garde statique : rien dans src/ (hors src/moteurs/montage-donnees/) n'importe garde-plan-scenes", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && n !== "garde-plan-scenes.ts" && !c.split(sep).join("/").includes("src/moteurs/montage-donnees/")) fichiers.push(c);
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(fichiers.filter((f) => readFileSync(f, "utf8").includes("garde-plan-scenes"))).toEqual([]);
  });
});
