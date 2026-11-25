/**
 * FIX-SERIE-PARTI-v21s : une idée de la série qui s'arrête à 0 € (hors du domaine, matière manquante)
 * n'est plus « partie » ni dite « en écriture ». Aucun réseau (faux fetch qui interdit tout), 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");
const actions = await import("@/app/(studio)/ecrire/serie/actions");

const MDP = "serie-hors-domaine-v21s";
const appelsClaude: string[] = [];
const fetchInterdit = (async (url: string | URL | Request) => {
  appelsClaude.push(String(url));
  throw new Error("réseau interdit");
}) as typeof fetch;

const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const HORS = ["Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];
const IDEES = [...SUJETS_BANC.map((s) => s.idee), ...HORS];

beforeAll(async () => preparerMotDePasse(MDP));
async function preparer() {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsClaude.length = 0;
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
}
beforeEach(preparer);
afterEach(() => {
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
}
async function lignesSerie() {
  return (await depots().evenements.lister((e) => e.message.startsWith("Série : "))).map((e) => e.message);
}
const lire = (f: string) => readFileSync(f, "utf8");

describe("FIX-SERIE-PARTI-v21s", () => {
  it("(a) une idée hors domaine n'est pas partie", async () => {
    await brancherClaude();
    const { serie: s } = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-a");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti", "a-completer", "a-completer"]);
    for (const e of s.elements.slice(3)) expect(e).toMatchObject({ manque: "HORS_DOMAINE", scriptMaitreId: expect.any(String) });
    expect(await depots().generations.lister((g) => g.statut === "en-cours" && !g.estDemo)).toHaveLength(3);
    expect(appelsClaude).toHaveLength(0);
  });

  it("(b) le Journal dit vrai", async () => {
    await brancherClaude();
    await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-b");
    expect(await lignesSerie()).toEqual(["Série : 3 idée(s) sur 5 en écriture · 2 hors du domaine d'Axion-IA, non lancée(s)"]);
    gc.injecterClaudePourEssai(null);
    await preparer();
    await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-b2");
    const essai = (await lignesSerie()).filter((m) => m.endsWith("(essai)"));
    expect(essai).toEqual(["Série : 3 idée(s) sur 5 en écriture · 2 hors du domaine d'Axion-IA, non lancée(s) (essai)"]);
  });

  it("(c) un autre manque est « à compléter » (calcul de l'action)", async () => {
    // Aucun cas reproductible sans toucher src/generateur/** : le calcul aCompleter est vérifié dans l'action (source).
    const src = lire("src/app/(studio)/ecrire/serie/actions.ts");
    expect(src).toMatch(/aCompleter/);
    expect(src).toMatch(/manque !== "HORS_DOMAINE"/);
    expect(lire("src/services/serie-ecriture.ts")).toContain("à compléter, non lancée(s)");
  });

  it("(d) toutes du domaine : rien ne change", async () => {
    await brancherClaude();
    const { serie: s } = await serie.lancerSerie(IDEES.slice(0, 3).map((texte) => ({ texte })), REGLAGES, "serie-shd-d");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
    expect(await lignesSerie()).toEqual(["Série : 3 idée(s) sur 3 en écriture"]);
    await preparer();
    await brancherClaude();
    const r = await actions.lancerSerieAction(IDEES.slice(0, 3).map((texte) => ({ texte })), REGLAGES, "serie-shd-d2");
    expect(r).toEqual({ ok: true, donnees: { partis: 3, restes: 0, essai: false } });
  });

  it("(e) l'action et la notification", async () => {
    await brancherClaude();
    const r = await actions.lancerSerieAction(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-e");
    expect(r).toEqual({ ok: true, donnees: { partis: 3, restes: 0, horsDomaine: 2, essai: false } });
    const f = lire("src/components/generateur/FeuilleSerie.tsx");
    expect(f).toContain("hors du domaine d'Axion-IA");
    expect(f).toContain("à compléter");
    expect(f).toMatch(/horsDomaine/);
    expect(f).toMatch(/aCompleter/);
  });

  it("(f) le suivi est inchangé", async () => {
    await brancherClaude();
    await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-f");
    const suivi = (await serie.suiviSerie())!;
    expect(suivi.total).toBe(5);
    expect(suivi.aCompleter).toBe(2);
    expect(suivi.elements.slice(3).map((e) => e.etat)).toEqual(["a-completer", "a-completer"]);
  });

  it("(g) une idée de « Idées » hors domaine reste reliée à son sujet", async () => {
    await brancherClaude();
    const idee = await depots().idees.enregistrer({ id: "idee-shd-g", texte: HORS[0], etat: "nouvelle", creeLe: "2026-10-03T08:00:00.000Z", modifieLe: "2026-10-03T08:00:00.000Z" });
    const { serie: s } = await serie.lancerSerie([{ texte: HORS[0], ideeId: idee.id }], REGLAGES, "serie-shd-g");
    expect(s.elements[0].sort).toBe("a-completer");
    expect((await depots().idees.obtenir(idee.id))!.scriptMaitreId).toBe(s.elements[0].scriptMaitreId);
  });

  it("(h) même geste renvoyé : même série, aucun sujet de plus", async () => {
    await brancherClaude();
    const a = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-h");
    const n = (await depots().scriptsMaitres.lister()).length;
    const b = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-shd-h");
    expect(b.serie).toEqual(a.serie);
    expect((await depots().scriptsMaitres.lister()).length).toBe(n);
  });

  it("(i) l'argent n'a pas bougé : les lignes d'argent de serie-ecriture.ts sont celles de master", () => {
    const src = lire("src/services/serie-ecriture.ts");
    for (const m of ["export function calculerPlanSerie", "export async function planSerie", "async function exigerTotalConfirme", "await exigerTotalConfirme(plan, totalConfirme, partirontConfirme, origine);"]) expect(src).toContain(m);
  });
});
