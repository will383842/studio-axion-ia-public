import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CLES_REGLAGE_PLAN_SCENES, GENERATEURS_PLAN, planScenesActif } from "@/briques/plan-scenes-generateurs/reglage";
import { cleReglagePlanScenesDe, planScenesActifDe } from "@/briques/plan-scenes-generateurs/registre-plan";

const camel = (id: string) => id.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const ABSENT = Symbol("absent");
const VALEURS: unknown[] = [ABSENT, true, false, "true", "false", 0, 1, null, {}, "ERREUR", "REJET"];

function lecteur(v: unknown) {
  const appels: Array<[string, unknown]> = [];
  const lire = async (id: string, defaut: unknown) => {
    appels.push([id, defaut]);
    if (v === "ERREUR") throw new Error("panne");
    if (v === "REJET") return Promise.reject(new Error("rejet"));
    return v === ABSENT ? defaut : v;
  };
  return { lire, appels };
}

describe("registre ouvert du plan de scènes", () => {
  it("(a) les 3 générateurs actuels : réponse et lectures identiques", async () => {
    for (const g of GENERATEURS_PLAN) {
      for (const v of VALEURS) {
        const a = lecteur(v);
        const b = lecteur(v);
        expect(await planScenesActifDe(g, a.lire)).toBe(await planScenesActif(g, b.lire));
        expect(a.appels).toEqual(b.appels);
      }
    }
  });

  it("(b) la clé suit l'existant", () => {
    for (const g of GENERATEURS_PLAN) {
      expect(cleReglagePlanScenesDe(g)).toBe(CLES_REGLAGE_PLAN_SCENES[g]);
      expect(cleReglagePlanScenesDe(g)).toBe("planScenes." + camel(g));
    }
  });

  it("(c) générateurs à venir : éteint par défaut, seul true allume", async () => {
    for (const [g, cle] of [["tutoriel-outil", "planScenes.tutorielOutil"], ["demo-facecam", "planScenes.demoFacecam"]]) {
      expect(cleReglagePlanScenesDe(g)).toBe(cle);
      expect(await planScenesActifDe(g, lecteur(ABSENT).lire)).toBe(false);
      expect(await planScenesActifDe(g, lecteur("true").lire)).toBe(false);
      expect(await planScenesActifDe(g, lecteur(1).lire)).toBe(false);
      expect(await planScenesActifDe(g, lecteur("ERREUR").lire)).toBe(false);
      expect(await planScenesActifDe(g, lecteur("REJET").lire)).toBe(false);
      const t = lecteur(true);
      expect(await planScenesActifDe(g, t.lire)).toBe(true);
      expect(t.appels).toEqual([[cle, false]]);
    }
  });

  it("(d) id mal formé : clé null, éteint, aucune lecture", async () => {
    for (const g of ["", "Tutoriel", "a--b", "x y", "../x", 42 as never]) {
      const lire = vi.fn(async () => true);
      expect(cleReglagePlanScenesDe(g)).toBeNull();
      expect(await planScenesActifDe(g, lire)).toBe(false);
      expect(lire).toHaveBeenCalledTimes(0);
    }
  });

  it("(e) garde de texte : pur et appelé par personne", () => {
    const src = readFileSync("src/briques/plan-scenes-generateurs/registre-plan.ts", "utf8");
    expect(src).not.toMatch(/lireParametre|_commun|@\/services|src\/generateurs|@\/generateurs|@\/formats|src\/formats/);
    expect(src).not.toMatch(/\[\s*"cas-concret"/);
    const visite = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? visite(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const intrus = visite("src").filter((f) => !f.endsWith("registre-plan.ts") && /registre-plan/.test(readFileSync(f, "utf8")));
    expect(intrus).toEqual([]);
    expect([...GENERATEURS_PLAN]).toEqual(["cas-concret", "facecam", "facecam-animee"]);
  });
});
