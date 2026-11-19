/** S-13-AFFICHAGE-v19c : page à part, en lecture seule, qui dit ce que sont devenus les échecs des 30 derniers jours. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./site-videos/helpers";
import type { LigneEchec } from "@/domaine/journal-echecs";
import type { Travail } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const { lireIssuesDesEchecs } = await import("@/services/issue-des-echecs");
const { default: PageIssues } = await import("@/app/(studio)/reglages/echecs/issues/page");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
});

const html = async () => renderToStaticMarkup(createElement("div", null, await PageIssues()));

function ligne(i: number, famille: LigneEchec["famille"], code: string, joursAvant = 1): LigneEchec {
  const date = new Date(Date.now() - joursAvant * 86_400_000 - i * 1000).toISOString();
  return { date, videoId: `v-${i}`, travailId: `tr-${i}`, generateur: "avocat", moteur: "m", etape: "montage", code, famille, phrase: `Phrase ${i}`, detail: "détail", essai: 1 };
}
async function poserLigne(l: LigneEchec, demo = false) {
  await depots().evenements.enregistrer({ id: `ev-echec-${l.travailId}-1`, type: "echec-detail", message: "x", entite: "video", entiteId: l.videoId, estDemo: demo, date: l.date, creeLe: l.date, modifieLe: l.date, echec: l } as never);
}
async function poserTravail(id: string, statut: Travail["statut"]) {
  const t = new Date().toISOString();
  await depots().travaux.enregistrer({ id, type: "fabrication", cibleId: `v-${id}`, statut, tentatives: 1, creeLe: t, modifieLe: t } as never);
}
async function quatre() {
  await poserLigne(ligne(1, "panne", "FACECAM_NON_RELIE"));
  await poserLigne(ligne(2, "controle", "BUDGET_X"));
  await poserLigne(ligne(3, "fournisseur", "FOURNISSEUR_REFUS"));
  await poserLigne(ligne(4, "fournisseur", "FOURNISSEUR_REFUS"));
  await poserTravail("tr-1", "termine");
  await poserTravail("tr-2", "termine");
  await poserTravail("tr-3", "en_cours");
  await poserTravail("tr-4", "echec");
}

describe("lireIssuesDesEchecs", () => {
  it("4 échecs : 1 reparti seul, 1 repris, 1 en cours, 1 resté à Williams", async () => {
    await quatre();
    expect(await lireIssuesDesEchecs()).toEqual({ issues: { "reparti-seul": 1, repris: 1, "en-cours": 1, "reste-a-williams": 1 }, total: 4 });
  });

  it("travail disparu : resté à Williams ; attente de validation et exemple : non comptés", async () => {
    await poserLigne(ligne(1, "controle", "BUDGET_X"));
    await poserLigne(ligne(2, "attente-validation", "IV_CARTE_A_VALIDER"));
    await poserLigne(ligne(3, "controle", "BUDGET_X"), true);
    const r = await lireIssuesDesEchecs();
    expect(r.issues).toEqual({ "reparti-seul": 0, repris: 0, "en-cours": 0, "reste-a-williams": 1 });
    expect(r.total).toBe(1);
  });

  it("panne de lecture des travaux : les 4 à 0, sans lever", async () => {
    await quatre();
    const espion = vi.spyOn(depots().travaux, "lister").mockRejectedValue(new Error("panne"));
    expect(await lireIssuesDesEchecs()).toEqual({ issues: { "reparti-seul": 0, repris: 0, "en-cours": 0, "reste-a-williams": 0 }, total: 0 });
    espion.mockRestore();
  });
});

describe("page « Ce que sont devenus les échecs »", () => {
  it("les 4 phrases et leurs nombres", async () => {
    await quatre();
    const h = await html();
    expect(h).toContain("Ce que sont devenus les échecs");
    for (const p of ["Repartis seuls : 1", "Repris ensuite : 1", "Encore en cours : 1", "Restés à vous : 1"]) expect(h).toContain(p);
    expect(h).toContain('href="/reglages/echecs"');
    expect(h).not.toMatch(/€|\$/);
    expect(h).not.toContain("<button");
  });
  it("zéro ligne : « Aucun échec sur 30 jours. »", async () => {
    expect(await html()).toContain("Aucun échec sur 30 jours.");
  });
});

describe("éteint = identique", () => {
  const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : /\.tsx?$/.test(n) ? [join(d, n)] : []));
  const PAGE = join("src", "app", "(studio)", "reglages", "echecs", "issues", "page.tsx");
  it("seule la page neuve importe le service ; aucun lien vers la page dans src/**", () => {
    const tous = fichiers("src");
    const importeurs = tous.filter((f) => !f.endsWith("services/issue-des-echecs.ts") && /services\/issue-des-echecs/.test(readFileSync(f, "utf8")));
    expect(importeurs).toEqual([PAGE]);
    const liens = tous.filter((f) => f !== PAGE && /reglages\/echecs\/issues/.test(readFileSync(f, "utf8")));
    expect(liens).toEqual([]);
  });
  it("la page appelle exigerSession() avant lireIssuesDesEchecs()", () => {
    const t = readFileSync(PAGE, "utf8");
    expect(t.indexOf("await exigerSession()")).toBeGreaterThan(-1);
    expect(t.indexOf("await exigerSession()")).toBeLessThan(t.indexOf("await lireIssuesDesEchecs"));
  });
});
