import { describe, expect, it } from "vitest";
import { GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { readFileSync } from "node:fs";
import { RUBRIQUE_MAX } from "../../src/domaine/visuels/continu/geometrie";

/** Table attendue (maquette v3, l. 305-325) : plaquette → fond sombre, orange fort. */
const ATTENDU: Record<string, { nom: string; sombre: boolean; orangeFort: boolean }> = {
  C01: { nom: "Orbite", sombre: false, orangeFort: false },
  C02: { nom: "Question sur fond sombre", sombre: true, orangeFort: false },
  C03: { nom: "Sommaire illustré", sombre: false, orangeFort: false },
  C04: { nom: "Cartes en éventail", sombre: false, orangeFort: false },
  C05: { nom: "Fenêtre d'application", sombre: false, orangeFort: false },
  C06: { nom: "Manifeste et plaques", sombre: false, orangeFort: false },
  C07: { nom: "Téléphone", sombre: false, orangeFort: false },
};
const TYPES = Object.keys(ATTENDU);
const gabarit = (t: string) => GABARITS_PRODUCTION.find((g) => g.type === t)!;

/** Budgets (caractères) de chaque texte visible : le budget passe, budget + 1 échoue. */
const BUDGETS: [string, (string | number)[], number][] = [
  ["C01", ["titre"], 12], ["C01", ["accent"], 12], ["C01", ["suite"], 12], ["C01", ["texte"], 48],
  ["C02", ["titre"], 20], ["C02", ["texte"], 80],
  ["C03", ["titre"], 26], ["C03", ["accent"], 20], ["C03", ["entrees", 0], 30], ["C03", ["entrees", 1], 30], ["C03", ["entrees", 2], 30],
  ["C04", ["titre"], 8], ["C04", ["accent"], 8], ["C04", ["suite"], 12], ["C04", ["texte"], 40], ["C04", ["cartes", 0], 8], ["C04", ["cartes", 2], 8],
  ["C05", ["titre"], 28], ["C05", ["accent"], 12], ["C05", ["suite"], 2], ["C05", ["badge"], 16], ["C05", ["etats", 0], 18], ["C05", ["etats", 1], 18],
  ["C05", ["lignes", 0, "sujet"], 18], ["C05", ["lignes", 1, "detail"], 14],
  ["C06", ["titre"], 30], ["C06", ["accent"], 20],
  ["C07", ["titre"], 16], ["C07", ["accent"], 18], ["C07", ["texte"], 56], ["C07", ["notifications", 0, "titre"], 16], ["C07", ["notifications", 3, "detail"], 22],
];

/** Texte d'exactement `n` caractères en mots de 7 lettres au plus (le plus long mot permis par les schémas est ≥ 7). */
function remplissage(n: number): string {
  const s = "abcdefg ".repeat(40).slice(0, n);
  return s.endsWith(" ") ? `${s.slice(0, -1)}a` : s;
}

function avec(objet: unknown, chemin: (string | number)[], valeur: unknown): unknown {
  const copie = structuredClone(objet) as Record<string | number, unknown>;
  let cur = copie;
  chemin.slice(0, -1).forEach((k) => (cur = cur[k] as Record<string | number, unknown>));
  cur[chemin[chemin.length - 1]] = valeur;
  return copie;
}

describe("continu P3a : couvertures", () => {
  it("les sept couvertures sont au registre, actives, en production", () => {
    for (const t of TYPES) {
      const g = gabarit(t);
      expect(g, t).toBeDefined();
      expect(g.famille).toBe("couverture");
      expect(g.nom).toBe(ATTENDU[t].nom);
      expect(g.actif).toBe(true);
    }
    expect(GABARITS_PRODUCTION.filter((g) => g.famille === "couverture").map((g) => g.type).sort()).toEqual(TYPES);
  });
  it("role « couverture » pour les sept", () => {
    for (const t of TYPES) expect(gabarit(t).role, t).toBe("couverture");
  });
  it("sombre et orangeFort conformes à la maquette", () => {
    for (const t of TYPES) {
      expect(gabarit(t).sombre, t).toBe(ATTENDU[t].sombre);
      expect(gabarit(t).orangeFort, t).toBe(ATTENDU[t].orangeFort);
    }
  });
  it("version >= 1", () => {
    for (const t of TYPES) expect(gabarit(t).version, t).toBeGreaterThanOrEqual(1);
  });
  it("chaque exemple passe son schéma, et l'exemple porte son type et un alt", () => {
    for (const t of TYPES) {
      const g = gabarit(t);
      expect(g.schema.safeParse(g.exemple).success, t).toBe(true);
      expect((g.exemple as { type: string; alt: string }).type).toBe(t);
      expect((g.exemple as { alt: string }).alt.length).toBeGreaterThan(0);
    }
  });
  it.each(BUDGETS)("%s %j : budget %i passe, budget + 1 échoue", (t, chemin, max) => {
    const g = gabarit(t);
    expect(g.schema.safeParse(avec(g.exemple, chemin, remplissage(max))).success).toBe(true);
    expect(g.schema.safeParse(avec(g.exemple, chemin, remplissage(max + 1))).success).toBe(false);
  });
  it("un champ « étiquette » (texte fixe posé par le code) ou inconnu est refusé", () => {
    for (const t of TYPES) {
      const g = gabarit(t);
      expect(g.schema.safeParse({ ...(g.exemple as object), etiquette: "Scénario type" }).success, t).toBe(false);
      expect(g.schema.safeParse({ ...(g.exemple as object), numero: "01" }).success, t).toBe(false);
    }
  });
  it("la rubrique est bornée à RUBRIQUE_MAX ; C06 porte « Axion-IA » en rubrique libre", () => {
    for (const t of TYPES) {
      const g = gabarit(t);
      expect(g.schema.safeParse(avec(g.exemple, ["rubrique"], "a".repeat(RUBRIQUE_MAX))).success, t).toBe(true);
      expect(g.schema.safeParse(avec(g.exemple, ["rubrique"], "a".repeat(RUBRIQUE_MAX + 1))).success, t).toBe(false);
    }
    expect((gabarit("C06").exemple as { rubrique?: string }).rubrique).toBe("Axion-IA");
  });
  it("le titre de page 1 compte 10 mots au plus (titre + accent + suite)", () => {
    for (const t of TYPES) {
      const e = gabarit(t).exemple as Record<string, string>;
      const mots = [e.titre, e.accent, e.suite].filter(Boolean).join(" ").split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
      expect(mots.length, t).toBeLessThanOrEqual(10);
    }
  });
  it("le titre, l'accent et la suite sont bornés en mots (10 au plus ensemble)", () => {
    for (const t of ["C01", "C04", "C05", "C06"]) {
      const g = gabarit(t);
      const e = g.exemple as Record<string, string>;
      expect(g.schema.safeParse({ ...e, titre: "un deux trois quatre cinq six sept huit" }).success, t).toBe(false);
    }
  });
  it("un mot plus long que le plus long mot permis est refusé (il sortirait de sa boîte)", () => {
    for (const t of TYPES) {
      const g = gabarit(t);
      const e = g.exemple as Record<string, unknown>;
      expect(g.schema.safeParse({ ...e, ...(typeof e.titre === "string" ? { titre: "professionnalisation" } : {}) }).success, t).toBe(false);
    }
  });
  it("bords libres : la droite offre un intervalle d'au moins 260 px (raccord de la couture 1/2)", () => {
    for (const t of TYPES) {
      const { droite, gauche } = gabarit(t).bordsLibres;
      expect(droite.some(([a, b]) => b - a >= 260), t).toBe(true);
      expect(gauche.length, t).toBeGreaterThan(0);
    }
  });
  it("chaque type du registre a son composant déclaré", () => {
    // Lecture du source : la CI des tests n'installe pas les dépendances de studio-rendu (remotion), on n'importe donc pas les composants.
    const dossier = "studio-rendu/compositions/visuels/continu/gabarits/couvertures";
    const index = readFileSync(`${dossier}/index.ts`, "utf8");
    const registre = readFileSync("studio-rendu/compositions/visuels/continu/registre-composants.ts", "utf8");
    expect(registre).toContain("...PLAQUETTES_COUVERTURES");
    for (const t of TYPES) {
      expect(index, t).toMatch(new RegExp(`import \\{ ${t} \\} from "./${t}"`));
      expect(index, t).toMatch(new RegExp(`PLAQUETTES_COUVERTURES[^=]*=\\s*\\{[^}]*\\b${t}\\b`));
      expect(readFileSync(`${dossier}/${t}.tsx`, "utf8"), t).toContain(`export function ${t}(`);
    }
  });
});
