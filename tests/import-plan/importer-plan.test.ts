/**
 * L4-10 — Import du plan LinkedIn (61 posts), à blanc. Données entièrement fictives, horloge injectée, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { lireCalendrierCsv } from "../../src/services/import-plan/csv-calendrier";
import { cleIdempotente, compterTu } from "../../src/services/import-plan/formats";
import { lirePostsMarkdown } from "../../src/services/import-plan/markdown-posts";
import { importerPlan, planifierImport } from "../../src/services/import-plan/importer-plan";

const HORLOGE = () => new Date("2026-11-15T10:00:00Z");
const NUMEROS_AVEC_TU = [3, 7, 11];

function dateDuPost(n: number): string {
  if (n <= 36) return new Date(Date.UTC(2026, 8, 20 + n)).toISOString().slice(0, 10); // 36 dates passées
  return new Date(Date.UTC(2026, 10, 16 + 2 * (n - 37))).toISOString().slice(0, 10); // 25 dates futures
}

function fabriquerCsv(): string {
  const lignes = ["numero;date;heure;version"];
  for (let n = 1; n <= 61; n++) lignes.push(`${n};${dateDuPost(n)};08:00;ORIGINAL`);
  lignes.push("5;2026-12-01;08:00;REFONDU"); // version refondue : à ignorer
  return lignes.join("\n");
}

function fabriquerMarkdown(): string {
  const blocs: string[] = [];
  for (let n = 1; n <= 61; n++) {
    const tu = NUMEROS_AVEC_TU.includes(n);
    blocs.push(
      `## Post ${n}\n\n### Texte\n\n${tu ? "Tu peux automatiser ton suivi." : "Vous pouvez automatiser votre suivi."} Exemple fictif ${n}.\n\n### Premier commentaire\n\nCommentaire fictif ${n}.\n`,
    );
  }
  return blocs.join("\n");
}

describe("lecture des formats", () => {
  it("lit 62 lignes de calendrier (dont une REFONDU) et 61 posts", () => {
    expect(lireCalendrierCsv(fabriquerCsv())).toHaveLength(62);
    const posts = lirePostsMarkdown(fabriquerMarkdown());
    expect(posts.size).toBe(61);
    expect(posts.get(2)?.premierCommentaire).toBe("Commentaire fictif 2.");
  });
  it("clé idempotente et détection du « tu »", () => {
    expect(cleIdempotente(7)).toBe("plan-linkedin:7");
    expect(compterTu("Tu peux le faire, ton choix.")).toBe(2);
    expect(compterTu("Vous pouvez, tutoriel, attitude, stuc.")).toBe(0);
  });
  it("refuse un CSV sans les colonnes attendues", () => {
    expect(() => lireCalendrierCsv("a;b\n1;2")).toThrow();
  });
});

describe("import à blanc", () => {
  const base = { csv: fabriquerCsv(), markdown: fabriquerMarkdown(), horloge: HORLOGE };

  it("61 entrées, 36 passe_inconnu, alertes « tu » comptées, REFONDU ignorée", () => {
    const r = planifierImport({ ...base, clesExistantes: new Set() });
    expect(r.entrees).toHaveLength(61);
    expect(r.passeInconnu).toBe(36);
    expect(r.alertesTu).toBe(NUMEROS_AVEC_TU.length);
    expect(r.refondusIgnores).toBe(1);
    expect(r.entrees.filter((e) => e.passeInconnu)).toHaveLength(36);
    expect(r.entrees.find((e) => e.numero === 5)?.date).toBe(dateDuPost(5));
  });

  it("la relance donne 0 doublon", () => {
    const premier = planifierImport({ ...base, clesExistantes: new Set() });
    const cles = new Set(premier.entrees.map((e) => e.cle));
    const second = planifierImport({ ...base, clesExistantes: cles });
    expect(second.entrees).toHaveLength(0);
    expect(second.doublonsIgnores).toBe(61);
  });

  it("posts importés « Publié », verrouillés, sans bouton principal", () => {
    for (const e of planifierImport({ ...base, clesExistantes: new Set() }).entrees) {
      expect(e.statut).toBe("Publié");
      expect(e.verrouille).toBe(true);
      expect(e.boutonPrincipal).toBeNull();
    }
  });

  it("n'écrit rien à blanc et refuse l'écriture sans le relevé RC-24", async () => {
    const ecrits: string[] = [];
    const depot = { cles: async () => new Set<string>(), ajouter: async (e: { cle: string }) => void ecrits.push(e.cle) };
    await importerPlan({ ...base, depot, aBlanc: true });
    expect(ecrits).toHaveLength(0);
    await expect(importerPlan({ ...base, depot, aBlanc: false })).rejects.toThrow(/RC-24/);
    expect(ecrits).toHaveLength(0);
    await importerPlan({ ...base, depot, aBlanc: false, releveRc24Fait: true });
    expect(ecrits).toHaveLength(61);
    await importerPlan({ ...base, depot: { ...depot, cles: async () => new Set(ecrits) }, aBlanc: false, releveRc24Fait: true });
    expect(ecrits).toHaveLength(61);
  });
});
