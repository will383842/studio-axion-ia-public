import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEUIL_MASQUAGE,
  VARIABLE_INTERRUPTEUR_AGREGATS_PERFORMANCE,
  agregatsPerformanceActifs,
  calculerAgregatsPerformance,
  type MesurePerformance,
} from "@/services/agregats-performance";

const ALLUME = { AGREGATS_PERFORMANCE_ENABLED: "1" };

function mesures(n: number, surcharge: Partial<MesurePerformance> = {}): MesurePerformance[] {
  return Array.from({ length: n }, (_, i) => ({
    type: "video",
    reseau: "reseau-a",
    trancheHoraire: "matin",
    vues: 100 + i * 10,
    partages: 2 + i,
    commentaires: 1 + i,
    ...surcharge,
  }));
}

describe("interrupteur", () => {
  it("nom de la variable", () => {
    expect(VARIABLE_INTERRUPTEUR_AGREGATS_PERFORMANCE).toBe("AGREGATS_PERFORMANCE_ENABLED");
  });
  it("éteint par défaut", () => {
    expect(agregatsPerformanceActifs({})).toBe(false);
    expect(agregatsPerformanceActifs(undefined)).toBe(false);
  });
  it("allumé seulement pour « 1 » ou « true » exactement", () => {
    expect(agregatsPerformanceActifs({ AGREGATS_PERFORMANCE_ENABLED: "1" })).toBe(true);
    expect(agregatsPerformanceActifs({ AGREGATS_PERFORMANCE_ENABLED: "true" })).toBe(true);
    for (const v of ["", "0", "false", "TRUE", "True", " 1", "1 ", "oui", "yes", "on"]) {
      expect(agregatsPerformanceActifs({ AGREGATS_PERFORMANCE_ENABLED: v })).toBe(false);
    }
  });
  it("éteint : rend { etat: \"eteint\" } sans rien calculer", () => {
    const piege = new Proxy([] as MesurePerformance[], {
      get() {
        throw new Error("lu alors que l'interrupteur est éteint");
      },
    });
    expect(calculerAgregatsPerformance(piege, { env: {} })).toEqual({ etat: "eteint" });
    expect(calculerAgregatsPerformance(piege)).toEqual({ etat: "eteint" });
  });
});

describe("masquage sous le seuil", () => {
  it("seuil proposé : 3", () => {
    expect(SEUIL_MASQUAGE).toBe(3);
  });
  it("effectif 2 : masqué, compté", () => {
    const r = calculerAgregatsPerformance(mesures(2), { env: ALLUME });
    expect(r).toEqual({ etat: "calcule", cases: [], masquees: 1 });
  });
  it("effectif 3 : publié", () => {
    const r = calculerAgregatsPerformance(mesures(3), { env: ALLUME });
    if (r.etat !== "calcule") throw new Error("attendu : calcule");
    expect(r.masquees).toBe(0);
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0]).toEqual({
      type: "video",
      reseau: "reseau-a",
      tranche: "matin",
      effectif: 3,
      moyennes: { vues: 110, partages: 3, commentaires: 2 },
    });
  });
  it("mélange : une case publiée, une masquée", () => {
    const liste = [...mesures(2, { reseau: "reseau-b" }), ...mesures(4)];
    const r = calculerAgregatsPerformance(liste, { env: ALLUME });
    if (r.etat !== "calcule") throw new Error("attendu : calcule");
    expect(r.cases.map((c) => c.reseau)).toEqual(["reseau-a"]);
    expect(r.masquees).toBe(1);
  });
  it("ordre de sortie stable : trié, quel que soit l'ordre d'entrée", () => {
    const liste = [...mesures(3, { reseau: "reseau-c" }), ...mesures(3, { reseau: "reseau-b" }), ...mesures(3, { reseau: "reseau-a" })];
    const r = calculerAgregatsPerformance(liste, { env: ALLUME });
    if (r.etat !== "calcule") throw new Error("attendu : calcule");
    expect(r.cases.map((c) => c.reseau)).toEqual(["reseau-a", "reseau-b", "reseau-c"]);
  });
  it("option seuil plus haut", () => {
    const r = calculerAgregatsPerformance(mesures(3), { env: ALLUME, seuil: 4 });
    expect(r).toEqual({ etat: "calcule", cases: [], masquees: 1 });
  });
  it("un seuil plus bas que 3 est ignoré (jamais de baisse du plancher)", () => {
    const r = calculerAgregatsPerformance(mesures(2), { env: ALLUME, seuil: 1 });
    expect(r).toEqual({ etat: "calcule", cases: [], masquees: 1 });
  });
  it("liste vide", () => {
    expect(calculerAgregatsPerformance([], { env: ALLUME })).toEqual({ etat: "calcule", cases: [], masquees: 0 });
  });
});

describe("aucune donnée d'identification", () => {
  it("le résultat ne contient que des clés de la liste blanche, même si l'entrée en porte d'autres", () => {
    const sale = mesures(3).map((m, i) => ({
      ...m,
      idPersonne: `p${i}`,
      compte: "compte-fictif",
      idPost: `post${i}`,
      adresse: "exemple@exemple.invalid",
    })) as MesurePerformance[];
    const r = calculerAgregatsPerformance(sale, { env: ALLUME });
    const cles = new Set<string>();
    JSON.parse(JSON.stringify(r), function (this: unknown, k: string, v: unknown) {
      if (k !== "" && !/^\d+$/.test(k)) cles.add(k);
      return v;
    });
    const blanche = new Set(["etat", "cases", "masquees", "type", "reseau", "tranche", "effectif", "moyennes", "vues", "partages", "commentaires"]);
    expect([...cles].filter((k) => !blanche.has(k))).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(/compte-fictif|post\d|exemple@/);
  });
  it("mesures invalides (négatives, non finies) écartées sans planter", () => {
    const liste = [...mesures(3), { ...mesures(1)[0], vues: Number.NaN }, { ...mesures(1)[0], vues: -5 }];
    const r = calculerAgregatsPerformance(liste, { env: ALLUME });
    if (r.etat !== "calcule") throw new Error("attendu : calcule");
    expect(r.cases[0].effectif).toBe(3);
  });
});

describe("tranches hors liste", () => {
  it("une tranche qui n'est pas dans la liste (horodatage exact) n'apparaît jamais", () => {
    const r = calculerAgregatsPerformance(mesures(3, { trancheHoraire: "2026-11-18T08:00" }), { env: ALLUME });
    expect(r).toEqual({ etat: "calcule", cases: [], masquees: 0 });
  });
});

describe("aucun appelant", () => {
  function sources(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      return statSync(chemin).isDirectory() ? sources(chemin) : /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(nom) ? [chemin] : [];
    });
  }
  it("aucun fichier de src/ n'importe agregats-performance, hors lui-même", () => {
    const intrus = sources("src").filter(
      (f) => f !== join("src", "services", "agregats-performance.ts") && /agregats-performance/.test(readFileSync(f, "utf8")),
    );
    expect(intrus).toEqual([]);
  });
  it("le module est pur : aucun import, aucun fetch, aucun process.env", () => {
    const texte = readFileSync("src/services/agregats-performance.ts", "utf8");
    const code = texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/^\s*import\s(?!type\b)/m);
    expect(code).not.toMatch(/\brequire\s*\(|\bimport\s*\(|^\s*export\s[^;]*\sfrom\s/m);
    expect(code).not.toMatch(/\bfetch\s*\(|process\.env|XMLHttpRequest|WebSocket/);
    expect(texte).toMatch(/proposition du pilotage, à valider par le fondateur/);
  });
});
