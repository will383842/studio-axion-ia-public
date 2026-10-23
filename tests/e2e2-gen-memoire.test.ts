/**
 * Vérification E2E n° 2, données n° 3 : en mode mémoire (sans base, essais à l'écran), le générateur écrivait SANS ses
 * garde-fous : la migration 19 n'était jouée qu'au démarrage avec une base (ou à l'ouverture de « Ma voix »). Les 93
 * tournures bloquantes, les règles datées et les interdits de marque manquaient. Après correction : avant toute écriture,
 * les règles de la production sont chargées, quel que soit le mode. Simulation, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { TOURNURES_CALIBREES } = await import("@/donnees/generateur/tournures-calibrees");
const { REGLES_DATEES_SEMEES } = await import("@/donnees/generateur/regles-datees");

const MDP = "essai-e2e2-gen-memoire";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => bg.arreterBoucleGeneration());

describe("E2E-2 données n° 3 · le mode mémoire écrit avec les règles de la production", () => {
  it("sans migration au démarrage : la 1re écriture charge tournures, règles datées et interdits de marque", async () => {
    const d = depots();
    expect(await d.tournesInterdites.compter()).toBe(0);
    expect(await d.contexteAxion.compter()).toBe(0);
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
    expect(r.ok).toBe(true);
    const bloquantes = TOURNURES_CALIBREES.filter((t) => t.niveau === "bloquant").length;
    expect(await d.tournesInterdites.compter((t) => t.niveau === "bloquant")).toBeGreaterThanOrEqual(bloquantes);
    expect(await d.reglesDatees.compter()).toBe(REGLES_DATEES_SEMEES.length);
    const ctx = (await d.contexteAxion.lister())[0];
    expect(ctx?.interdits.length).toBeGreaterThanOrEqual(5);
    // L'écriture va au bout avec ces garde-fous.
    await bg.tourBoucleGeneration();
    if (r.ok) expect((await d.generations.obtenir(r.generationId))?.statut).toBe("terminee");
  });

  it("une seule fois par jeu de données : rien n'est recréé ni écrasé", async () => {
    const d = depots();
    await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
    const t = (await d.tournesInterdites.lister())[0];
    await d.tournesInterdites.modifier(t.id, { archiveLe: new Date().toISOString() });
    const n = await d.tournesInterdites.compter();
    await bg.lancerGeneration({ idee: SUJETS_BANC[1].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[1].pilier.id, mode: "avatar" as const });
    expect(await d.tournesInterdites.compter()).toBe(n);
    expect((await d.tournesInterdites.obtenir(t.id))?.archiveLe).toBeTruthy();
  });
});
