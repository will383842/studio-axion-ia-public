import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerRelecture, chiffresARelire, type DecisionChiffre } from "../../../src/briques/donnees-video/relecture-chiffres";
import { lireTableauDeBord, type TableauDeBord } from "../../../src/briques/donnees-video/types";

function tableau(): TableauDeBord {
  const r = lireTableauDeBord({
    version: "tableau-de-bord.v1",
    titre: "Mois de mars",
    periode: { debut: "2026-03-01", fin: "2026-03-31", libelle: "Mars 2026" },
    source: "Export du cabinet",
    indicateurs: [
      { id: "visites", libelle: "Visites", valeur: 1200, unite: "visites", precision: 0, sens: "hausse-bonne" },
      { id: "avant", libelle: "Visites avant", valeur: 1000, unite: "visites", precision: 0, sens: "hausse-bonne" },
    ],
    series: [
      { id: "semaines", libelle: "Visites par semaine", unite: "visites", points: [{ x: "S1", valeur: 10 }, { x: "S2", valeur: 20 }, { x: "S3", valeur: 30 }] },
    ],
    comparaisons: [{ avant: "avant", apres: "visites" }],
    alertes: [{ texte: "Hausse nette", indicateurId: "visites" }],
    calculs: [{ id: "ecart", formule: "visites - avant", resultat: 200 }],
  });
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.donnee;
}

const toutValider = (d: TableauDeBord): Record<string, DecisionChiffre> =>
  Object.fromEntries(chiffresARelire(d).map((c) => [c.cle, { type: "valide" } as DecisionChiffre]));

describe("chiffresARelire", () => {
  it("liste 6 chiffres dans l'ordre du tableau, avec des clés stables", () => {
    const c = chiffresARelire(tableau());
    expect(c.map((x) => x.cle)).toEqual(["indicateur:visites", "indicateur:avant", "point:semaines:0", "point:semaines:1", "point:semaines:2", "calcul:ecart"]);
    expect(c[0]).toMatchObject({ libelle: "Visites", valeur: 1200, unite: "visites" });
    expect(c[3].valeur).toBe(20);
  });
});

describe("appliquerRelecture", () => {
  it("refuse tant qu'une décision manque, avec le compte", () => {
    const d = tableau();
    const dec = toutValider(d);
    delete dec["indicateur:avant"];
    delete dec["calcul:ecart"];
    const r = appliquerRelecture(d, dec);
    expect(r).toEqual({ ok: false, raisons: ["2 chiffres ne sont pas encore relus."] });
  });

  it("dit « 1 chiffre » au singulier", () => {
    const d = tableau();
    const dec = toutValider(d);
    delete dec["calcul:ecart"];
    const r = appliquerRelecture(d, dec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raisons[0]).toBe("1 chiffre n'est pas encore relu.");
  });

  it("tout validé : donnée profondément égale", () => {
    const d = tableau();
    const r = appliquerRelecture(d, toutValider(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnee).toEqual(d);
  });

  it("une correction remplace la valeur", () => {
    const d = tableau();
    const dec = { ...toutValider(d), "indicateur:visites": { type: "corrige", valeur: 1300 } as DecisionChiffre, "point:semaines:1": { type: "corrige", valeur: 25 } as DecisionChiffre };
    const r = appliquerRelecture(d, dec);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.donnee.indicateurs[0].valeur).toBe(1300);
      expect(r.donnee.series[0].points[1].valeur).toBe(25);
    }
  });

  it("refuser un indicateur cité retire aussi comparaison, alerte et calcul, et le résultat reste valide", () => {
    const d = tableau();
    const r = appliquerRelecture(d, { ...toutValider(d), "indicateur:visites": { type: "refuse" } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.donnee.indicateurs.map((i) => i.id)).toEqual(["avant"]);
      expect(r.donnee.comparaisons).toEqual([]);
      expect(r.donnee.alertes).toEqual([]);
      expect(r.donnee.calculs).toEqual([]);
      expect(lireTableauDeBord(r.donnee).ok).toBe(true);
    }
  });

  it("refuser un calcul le retire seul", () => {
    const d = tableau();
    const r = appliquerRelecture(d, { ...toutValider(d), "calcul:ecart": { type: "refuse" } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.donnee.calculs).toEqual([]);
      expect(r.donnee.indicateurs).toHaveLength(2);
    }
  });

  it("refuser un point retire le point ; deux sur trois retirent la série", () => {
    const d = tableau();
    const un = appliquerRelecture(d, { ...toutValider(d), "point:semaines:0": { type: "refuse" } });
    expect(un.ok).toBe(true);
    if (un.ok) expect(un.donnee.series[0].points.map((p) => p.x)).toEqual(["S2", "S3"]);
    const deux = appliquerRelecture(d, { ...toutValider(d), "point:semaines:0": { type: "refuse" }, "point:semaines:2": { type: "refuse" } });
    expect(deux.ok).toBe(true);
    if (deux.ok) expect(deux.donnee.series).toEqual([]);
  });

  it("tout refusé : « Plus aucun chiffre à montrer. »", () => {
    const d = tableau();
    const dec = Object.fromEntries(chiffresARelire(d).map((c) => [c.cle, { type: "refuse" } as DecisionChiffre]));
    expect(appliquerRelecture(d, dec)).toEqual({ ok: false, raisons: ["Plus aucun chiffre à montrer."] });
  });

  it("une correction NaN ou infinie est refusée", () => {
    const d = tableau();
    for (const valeur of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = appliquerRelecture(d, { ...toutValider(d), "indicateur:avant": { type: "corrige", valeur } });
      expect(r.ok).toBe(false);
    }
  });

  it("n'altère jamais l'entrée et ne lève jamais", () => {
    const d = tableau();
    const copie = structuredClone(d);
    appliquerRelecture(d, { ...toutValider(d), "indicateur:visites": { type: "refuse" }, "point:semaines:1": { type: "corrige", valeur: 99 } });
    expect(d).toEqual(copie);
    expect(() => appliquerRelecture(null as unknown as TableauDeBord, {})).not.toThrow();
    expect(appliquerRelecture(null as unknown as TableauDeBord, {}).ok).toBe(false);
  });
});

describe("garde statique", () => {
  const RACINE = join(__dirname, "..", "..", "..");
  const SRC = join(RACINE, "src");
  const source = readFileSync(join(SRC, "briques/donnees-video/relecture-chiffres.ts"), "utf8");

  it("n'importe ni alias, ni narration, ni plan, ni garde de plan", () => {
    const imports = [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) {
      expect(i.startsWith("@/")).toBe(false);
      expect(i).not.toMatch(/narration-modele|plan-depuis-donnees|garde-plan-scenes/);
      expect(i.startsWith(".")).toBe(true);
    }
  });

  it("rien dans src/ ne l'importe hors RelectureChiffres.tsx et services/tableau-de-bord-relecture.ts", () => {
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx?$/.test(nom) && /relecture-chiffres/.test(readFileSync(chemin, "utf8")) && !chemin.endsWith("relecture-chiffres.ts")) trouves.push(chemin.slice(SRC.length + 1));
      }
    };
    parcourir(SRC);
    // G4-08-b1-v20j : + le service de relecture du tableau de bord, liste blanche +1 exacte (triée).
    expect(trouves.sort()).toEqual(["components/formats/tableau-de-bord/RelectureChiffres.tsx", "services/tableau-de-bord-relecture.ts"]);
  });
});
