import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCROCHE_SCRIPT_ACTIVE,
  FENETRE_ACCROCHE_MS,
  accrocheDuScript,
} from "../../../src/briques/composition/accroche-script";
import type { Fait, MotFait } from "../../../src/briques/faits-script/types";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

/** Mots à 100 ms par mot : la phrase entière tient dans la première seconde. */
const rapide = (s: string) => motsHorodates(s, 100);
const suite = (mots: readonly MotFait[]) => mots.map((m) => m.texte).join(" ");

describe("accroche tirée du script (C10-01)", () => {
  it("est éteinte par défaut, fenêtre de 2 s", () => {
    expect(ACCROCHE_SCRIPT_ACTIVE).toBe(false);
    expect(FENETRE_ACCROCHE_MS).toBe(2000);
  });

  it("nombre dans la première seconde → nombre, texte exact", () => {
    const mots = rapide("30 % de temps gagné chaque semaine. Voilà comment.");
    const r = accrocheDuScript(mots);
    expect(r.type).toBe("nombre");
    if (r.type !== "rien") expect(suite(mots)).toContain(r.texte);
    expect(r.type === "nombre" && r.texte).toBe("30 %");
  });

  it("passage « de 3 h à 20 min » → passage", () => {
    const r = accrocheDuScript(rapide("On passe de 3 h à 20 min sur les mails."));
    expect(r.type).toBe("passage");
    expect(r.type === "passage" && r.texte).toBe("3 h à 20 min");
  });

  it("question → question, texte tel quel", () => {
    const mots = rapide("Vous perdez combien d'heures ? Voyons.");
    const r = accrocheDuScript(mots);
    expect(r.type).toBe("question");
    if (r.type !== "rien") expect(r.texte).toBe("Vous perdez combien d'heures ?");
  });

  it("fait à 2,5 s seulement → rien", () => {
    const mots: MotFait[] = [
      { texte: "Bonjour", debutMs: 0, finMs: 1000 },
      { texte: "à", debutMs: 1000, finMs: 2000 },
      { texte: "tous", debutMs: 2000, finMs: 2500 },
      { texte: "30", debutMs: 2500, finMs: 2800 },
      { texte: "%", debutMs: 2800, finMs: 3000 },
      { texte: "gagnés.", debutMs: 3000, finMs: 3400 },
    ];
    expect(accrocheDuScript(mots)).toEqual({ type: "rien" });
  });

  it("argent exclu : « 500 € par mois » → rien", () => {
    expect(accrocheDuScript(rapide("500 € par mois seulement."))).toEqual({ type: "rien" });
  });

  it("passage « de 100 € à 50 € » → rien", () => {
    expect(accrocheDuScript(rapide("De 100 € à 50 €."))).toEqual({ type: "rien" });
  });

  it("mots mentionnant prix/tarif/euro → rien", () => {
    expect(accrocheDuScript(rapide("Quel prix ?"))).toEqual({ type: "rien" });
    expect(accrocheDuScript(rapide("Quel tarif ?"))).toEqual({ type: "rien" });
  });

  it("mots proches d'argent (tarifaire, tarification) → rien", () => {
    const mots = rapide("Hausse tarifaire de 30 % cette année.");
    const fait: Fait = {
      mots: { premier: 0, dernier: 4 },
      texte: "Hausse tarifaire de 30 %",
      type: "nombre",
      valeur: 30,
      unite: "%",
      surMot: 3,
    };
    expect(accrocheDuScript(mots, [fait])).toEqual({ type: "rien" });
    const f2: Fait = { ...fait, texte: "tarification de 30 %" };
    expect(accrocheDuScript(mots, [f2])).toEqual({ type: "rien" });
  });

  it("à égalité de début : passage > nombre > question", () => {
    const mots = rapide("x y");
    const base = { mots: { premier: 0, dernier: 1 }, texte: "x y" };
    const nombre: Fait = { ...base, type: "nombre", valeur: 3, surMot: 0 };
    const question: Fait = { ...base, type: "question", surMot: 0 };
    const passage: Fait = {
      ...base,
      type: "passage",
      avant: { valeur: 3, unite: "h", surMot: 0 },
      apres: { valeur: 20, unite: "min", surMot: 1 },
    };
    expect(accrocheDuScript(mots, [question, nombre, passage]).type).toBe("passage");
    expect(accrocheDuScript(mots, [question, nombre]).type).toBe("nombre");
  });

  it("le plus tôt gagne", () => {
    const mots = rapide("a b c d");
    const tard: Fait = { mots: { premier: 2, dernier: 3 }, texte: "c d", type: "question", surMot: 2 };
    const tot: Fait = { mots: { premier: 0, dernier: 1 }, texte: "a b", type: "question", surMot: 0 };
    const r = accrocheDuScript(mots, [tard, tot]);
    expect(r.type === "question" && r.texte).toBe("a b");
  });

  it("jamais d'exception : mots vides, indices hors bornes", () => {
    expect(accrocheDuScript([])).toEqual({ type: "rien" });
    const hors: Fait = { mots: { premier: 99, dernier: 100 }, texte: "?", type: "question", surMot: 99 };
    expect(accrocheDuScript(rapide("a b"), [hors])).toEqual({ type: "rien" });
  });

  it("10 scripts : aucune exception, aucun montant, texte dans le script", () => {
    for (const s of DIX_SCRIPTS) {
      const mots = motsHorodates(s);
      const r = accrocheDuScript(mots);
      if (r.type !== "rien") {
        expect(suite(mots)).toContain(r.texte);
        expect(r.texte).not.toMatch(/€|euro|prix|tarif/i);
        expect(r.debutMs).toBeLessThan(FENETRE_ACCROCHE_MS);
      }
    }
  });

  it("garde statique : imports interdits, et non importé ailleurs que generateur.ts (C10-15-b1)", () => {
    const src = readFileSync("src/briques/composition/accroche-script.ts", "utf8");
    expect(src).not.toMatch(/@\/services|server-only|bibliotheque-video/);
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const c = join(d, n);
        return statSync(c).isDirectory() ? fichiers(c) : /\.(tsx?|mts|js|mjs)$/.test(n) ? [c] : [];
      });
    const importeurs = ["src", "studio-rendu/src"]
      .flatMap((d) => { try { return fichiers(d); } catch { return []; } })
      .filter((f) => !f.endsWith("composition/accroche-script.ts"))
      .filter((f) => readFileSync(f, "utf8").includes("composition/accroche-script"));
    expect(importeurs).toEqual(["src/briques/plan-scenes/generateur.ts"]);
  });
});
