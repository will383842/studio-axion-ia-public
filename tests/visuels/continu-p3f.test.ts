import { describe, expect, it } from "vitest";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { readFileSync } from "node:fs";

/** Table attendue (maquette : A01 `dk:1`, A03 `or:1`) et budgets de texte mesurés au rendu (P3f). */
const ATTENDU = {
  A01: { nom: "Message privé", role: "appel", sombre: true, orangeFort: false },
  A02: { nom: "À retenir", role: "relance", sombre: false, orangeFort: false },
  A03: { nom: "Enregistrer et partager", role: "appel", sombre: false, orangeFort: true },
} as const;
const TYPES = Object.keys(ATTENDU) as (keyof typeof ATTENDU)[];
const appels = GABARITS.filter((g) => g.famille === "appel");
const def = (t: string) => appels.find((g) => g.type === t)!;

/** Champ texte (chaîne) de l'exemple → budget attendu. */
const BUDGETS: Record<string, Record<string, number>> = {
  A01: { titre: 20, accent: 22, recu: 40, envoye: 36, bouton: 30 },
  A02: { titre: 6, accent: 12, suite: 12 },
  A03: { titre: 16, accent: 24, texte: 80 },
};

describe("continu P3f : appels à l'action", () => {
  it("la famille compte A01, A02 et A03", () => {
    expect(appels.map((g) => g.type).sort()).toEqual(TYPES);
  });
  it("noms, rôles, sombre et orangeFort suivent la maquette", () => {
    for (const t of TYPES) {
      const g = def(t);
      expect({ nom: g.nom, role: g.role, sombre: g.sombre, orangeFort: g.orangeFort }, t).toEqual(ATTENDU[t]);
      expect(g.version, t).toBeGreaterThanOrEqual(1);
      expect(g.actif, t).toBe(true);
    }
  });
  it("chaque exemple passe son schéma strict", () => {
    for (const t of TYPES) {
      const g = def(t);
      expect(g.schema.safeParse(g.exemple).success, t).toBe(true);
      expect(g.schema.safeParse({ ...g.exemple, etiquette: "x" }).success, `${t} étiquette`).toBe(false);
      expect(g.schema.safeParse({ ...g.exemple, inconnue: 1 }).success, `${t} clé inconnue`).toBe(false);
      expect(String(g.exemple.alt).length, `${t} alt`).toBeLessThanOrEqual(125);
    }
  });
  it("un texte au budget passe, au budget + 1 échoue", () => {
    for (const [t, champs] of Object.entries(BUDGETS)) {
      const g = def(t);
      for (const [champ, max] of Object.entries(champs)) {
        expect(g.schema.safeParse({ ...g.exemple, [champ]: "a".repeat(max) }).success, `${t}.${champ} = ${max}`).toBe(true);
        expect(g.schema.safeParse({ ...g.exemple, [champ]: "a".repeat(max + 1) }).success, `${t}.${champ} = ${max + 1}`).toBe(false);
      }
    }
  });
  it("A02 : exactement trois idées", () => {
    const g = def("A02");
    const idees = g.exemple.idees as string[];
    expect(idees).toHaveLength(3);
    expect(g.schema.safeParse({ ...g.exemple, idees: idees.slice(0, 2) }).success).toBe(false);
    expect(g.schema.safeParse({ ...g.exemple, idees: [...idees, "de trop"] }).success).toBe(false);
    expect(g.schema.safeParse({ ...g.exemple, idees: [idees[0], idees[1], "a".repeat(35)] }).success).toBe(false);
  });
  it("aucun texte d'exemple ne dit « commentez » ni ne contient un domaine ou un lien", () => {
    const textes = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(textes) : v && typeof v === "object" ? Object.values(v).flatMap(textes) : []);
    for (const t of TYPES) {
      for (const s of textes(def(t).exemple)) {
        expect(s, `${t} : ${s}`).not.toMatch(/comment(ez|er)\b/i);
        expect(s, `${t} : ${s}`).not.toMatch(/axion-ia\.com|https?:|www\.|\.(com|fr|net|io)\b/i);
      }
    }
  });
  it("un lien ou un domaine dans un texte est refusé", () => {
    for (const t of TYPES) {
      const g = def(t);
      expect(g.schema.safeParse({ ...g.exemple, titre: "axion-ia.com" }).success, t).toBe(false);
    }
  });
  it("les bords libres sont des intervalles ordonnés dans la page", () => {
    for (const t of TYPES) {
      for (const cote of ["gauche", "droite"] as const) {
        for (const [a, b] of def(t).bordsLibres[cote]) {
          expect(a, t).toBeGreaterThanOrEqual(0);
          expect(b, t).toBeGreaterThan(a);
          expect(b, t).toBeLessThanOrEqual(1440);
        }
      }
    }
  });
  it("chaque type a son composant dans registre-composants", () => {
    // Le registre importe Remotion (absent de la racine) : on lit les sources, comme les autres tests de structure.
    const registre = readFileSync("studio-rendu/compositions/visuels/continu/registre-composants.ts", "utf8");
    const index = readFileSync("studio-rendu/compositions/visuels/continu/gabarits/appels/index.ts", "utf8");
    expect(registre).toMatch(/\.\.\.PLAQUETTES_APPELS/);
    for (const t of TYPES) expect(index, t).toMatch(new RegExp(`\\b${t}\\b`));
  });
});
