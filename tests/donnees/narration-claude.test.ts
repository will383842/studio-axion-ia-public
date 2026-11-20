import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSIGNE_NARRATION, CONSIGNE_NARRATION_MAX, lireNarrationClaude, MAX_JETONS_NARRATION, requeteNarrationClaude } from "@/briques/donnees-video/narration-claude";
import { lireTableauDeBord, type TableauDeBord } from "@/briques/donnees-video/types";

const SOURCE = join(process.cwd(), "src/briques/donnees-video/narration-claude.ts");

const donnee: TableauDeBord = {
  version: "tableau-de-bord.v1",
  titre: "Ventes du trimestre",
  periode: { debut: "2026-07-01", fin: "2026-09-30", libelle: "Troisième trimestre" },
  source: "Caisse",
  indicateurs: [
    { id: "ca", libelle: "Chiffre d'affaires", valeur: 12400, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "commandes", libelle: "Commandes", valeur: 310, unite: "commandes", precision: 0, sens: "hausse-bonne" },
  ],
  series: [{ id: "mois", libelle: "CA mensuel", unite: "€", points: [{ x: "Juillet", valeur: 4000 }, { x: "Août", valeur: 4100 }] }],
  comparaisons: [],
  alertes: [],
  calculs: [],
};

const MOT = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
const phrasesDe = (n: number): string[] => Array.from({ length: n / 10 }, () => `${MOT}.`);
const reponse = (phrases: string[]): string => JSON.stringify({ phrases });

describe("requête de la narration Claude", () => {
  it("la donnée de test est valide", () => {
    expect(lireTableauDeBord(donnee).ok).toBe(true);
  });
  it("maxTokens 4000, consigne bornée, aucune image, donnée telle quelle", () => {
    const r = requeteNarrationClaude(donnee, "modele-passe-en-argument");
    expect(MAX_JETONS_NARRATION).toBe(4000);
    expect(r.maxTokens).toBe(4000);
    expect(r.modele).toBe("modele-passe-en-argument");
    expect(CONSIGNE_NARRATION.length).toBeLessThanOrEqual(CONSIGNE_NARRATION_MAX);
    expect(r.systeme).toEqual([{ texte: CONSIGNE_NARRATION, cache: true }]);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].role).toBe("user");
    expect(r.messages[0].images).toBeUndefined();
    expect(JSON.parse(r.messages[0].contenu)).toEqual(donnee);
  });
  it("au maximum du schéma, la taille totale tient en 20 776 caractères", () => {
    const t = (n: number): string => "é".repeat(n);
    const indicateurs = Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, libelle: t(60), valeur: 123456.789, unite: t(20), precision: 4, sens: "hausse-bonne" as const }));
    const series = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, libelle: t(60), unite: t(20), points: Array.from({ length: 12 }, () => ({ x: t(30), valeur: 123456.789 })) }));
    const maxi: TableauDeBord = {
      version: "tableau-de-bord.v1",
      titre: t(80),
      periode: { debut: "2026-01-01", fin: "2026-12-31", libelle: t(60) },
      source: t(60),
      indicateurs,
      series,
      comparaisons: Array.from({ length: 12 }, () => ({ avant: "i0", apres: "i1" })),
      alertes: Array.from({ length: 12 }, () => ({ texte: t(120), indicateurId: "i0" })),
      calculs: Array.from({ length: 12 }, () => ({ id: "c".repeat(40), formule: "i0 + i1", resultat: 246913.578 })),
    };
    const r = requeteNarrationClaude(maxi, "m");
    const total = r.systeme.reduce((s, b) => s + b.texte.length, 0) + r.messages.reduce((s, m) => s + m.contenu.length, 0);
    expect(total).toBeLessThanOrEqual(20_776);
  });
});

describe("lecture de la narration Claude", () => {
  it("réponse correcte → narration de la même forme que narrationModele", () => {
    const n = lireNarrationClaude(reponse(phrasesDe(100)), donnee);
    expect(n).not.toBeNull();
    expect(n?.phrases).toHaveLength(10);
    expect(n?.texte).toBe(n?.phrases.join(" "));
    expect(n?.dureeEstimeeSec).toBe(38.5);
    expect(n?.remarques).toEqual([]);
  });
  it("accepte une clôture Markdown entière", () => {
    expect(lireNarrationClaude("```json\n" + reponse(phrasesDe(100)) + "\n```", donnee)).not.toBeNull();
  });
  it("nombres de la donnée acceptés, nombre absent de la donnée → null", () => {
    const ok = [...phrasesDe(90), "Le chiffre d'affaires atteint 12 400 euros avec 310 commandes ce trimestre pour les ventes."];
    expect(lireNarrationClaude(reponse(ok), donnee)).not.toBeNull();
    const faux = [...phrasesDe(90), "Le chiffre d'affaires atteint 99 999 euros avec 310 commandes ce trimestre pour les ventes."];
    expect(lireNarrationClaude(reponse(faux), donnee)).toBeNull();
  });
  it("JSON cassé, trop court, trop long, mal formé → null", () => {
    expect(lireNarrationClaude("{ pas du json", donnee)).toBeNull();
    expect(lireNarrationClaude("", donnee)).toBeNull();
    expect(lireNarrationClaude(reponse(phrasesDe(70)), donnee)).toBeNull();
    expect(lireNarrationClaude(reponse(phrasesDe(160)), donnee)).toBeNull();
    expect(lireNarrationClaude(reponse([]), donnee)).toBeNull();
    for (const mauvais of ["null", "[]", '"texte"', "{}", '{"phrases":"x"}', '{"phrases":[1,2]}', '{"phrases":["", " "]}']) {
      expect(lireNarrationClaude(mauvais, donnee), mauvais).toBeNull();
    }
  });
  it("ne lève jamais, même sur une entrée qui n'est pas du texte", () => {
    expect(() => lireNarrationClaude(undefined as unknown as string, donnee)).not.toThrow();
    expect(lireNarrationClaude(undefined as unknown as string, donnee)).toBeNull();
  });
});

describe("éteint = identique (gardes statiques)", () => {
  const source = readFileSync(SOURCE, "utf8");
  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((f) => {
      const p = join(dossier, f);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx|mjs)$/.test(f) ? [p] : [];
    });
  it("aucun fichier de src/ n'importe narration-claude", () => {
    const importeurs = fichiers(join(process.cwd(), "src")).filter((p) => p !== SOURCE && /narration-claude/.test(readFileSync(p, "utf8")));
    expect(importeurs).toEqual([join(process.cwd(), "src/services/narration-tableau-claude.ts")]);
  });
  it("n'importe de @/fournisseurs/ que des types", () => {
    const imports = source.split("\n").filter((l) => /^\s*(import|export)\b.*from\s+["'](@\/fournisseurs|\.\.?\/.*fournisseurs)/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).toMatch(/^import type /);
    expect(source).not.toMatch(/\bawait\s+import\(|\brequire\(/);
  });
  it("aucune clé de réglage, aucun plafond, aucun appel", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/reglages|plafond|AppelClaude|fetch\(|reserver|\bprocess\.env/i);
  });
});
