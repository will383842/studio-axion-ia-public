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
async function preparer(avecMatieres = true) {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsClaude.length = 0;
  await auth.seConnecter(MDP, false);
  if (!avecMatieres) return;
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
}
beforeEach(() => preparer());
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

  it("(c) un autre manque est « à compléter » : exécuté, sans les matières enregistrées de l'idée du domaine", async () => {
    await preparer(false); // aucune matière ni preuve : l'idée du domaine manque d'ancrage, l'autre est hors domaine
    await brancherClaude();
    const deux = [{ texte: IDEES[0] }, { texte: HORS[0] }];
    const { serie: s } = await serie.lancerSerie(deux, REGLAGES, "serie-shd-c");
    expect(s.elements.map((e) => e.sort)).toEqual(["a-completer", "a-completer"]);
    expect(s.elements.map((e) => e.manque)).toEqual(["ANCRAGE_MANQUANT", "HORS_DOMAINE"]);
    expect(await lignesSerie()).toEqual(["Série : 0 idée(s) sur 2 en écriture · 1 hors du domaine d'Axion-IA, non lancée(s) · 1 à compléter, non lancée(s)"]);
    expect(appelsClaude).toHaveLength(0);
    // L'action sépare les deux compteurs (horsDomaine = HORS_DOMAINE seulement, aCompleter = les autres « à compléter »).
    await preparer(false);
    await brancherClaude();
    const r = await actions.lancerSerieAction(deux, REGLAGES, "serie-shd-c2");
    expect(r).toEqual({ ok: true, donnees: { partis: 0, restes: 0, horsDomaine: 1, aCompleter: 1, essai: false } });
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
    const { phraseLancementSerie } = await import("@/components/generateur/FeuilleSerie");
    // Comptes tous distincts : chaque nombre doit apparaître à sa place.
    expect(phraseLancementSerie({ partis: 3, restes: 1, horsDomaine: 2, aCompleter: 1 })).toBe("3 idées en écriture · 2 hors du domaine d'Axion-IA · 1 à compléter · 1 gardée en idée");
    expect(phraseLancementSerie({ partis: 1, restes: 4, horsDomaine: 3, aCompleter: 2 })).toBe("1 idée en écriture · 3 hors du domaine d'Axion-IA · 2 à compléter · 4 gardées en idée");
    expect(phraseLancementSerie({ partis: 2, restes: 0, horsDomaine: 0, aCompleter: 0 })).toBe("2 idées en écriture");
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

  it("(j) une idée REFUSÉE compte dans « restes » (gardée en idée), à côté d'une idée hors domaine", async () => {
    await brancherClaude();
    const idee = await depots().idees.enregistrer({ id: "idee-shd-j", texte: IDEES[0], etat: "nouvelle", creeLe: "2026-10-03T08:00:00.000Z", modifieLe: "2026-10-03T08:00:00.000Z" });
    await serie.lancerSerie([{ texte: IDEES[0], ideeId: idee.id }], REGLAGES, "serie-shd-j1");
    const n = (await depots().scriptsMaitres.lister()).length;
    // Écran périmé : la même idée, déjà écrite, est renvoyée avec une idée hors domaine → refusée, jamais relancée.
    const r = await actions.lancerSerieAction([{ texte: IDEES[0], ideeId: idee.id }, { texte: HORS[0] }], REGLAGES, "serie-shd-j2");
    expect(r).toEqual({ ok: true, donnees: { partis: 0, restes: 1, horsDomaine: 1, essai: false } });
    expect((await serie.suiviSerie("serie-shd-j2"))!.elements.map((e) => e.etat)).toEqual(["refuse", "a-completer"]);
    expect((await depots().scriptsMaitres.lister()).length).toBe(n + 1);
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
