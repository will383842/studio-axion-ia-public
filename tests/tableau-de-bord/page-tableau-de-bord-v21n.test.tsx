/**
 * G4-08-b3-a-v21n : la page `/tableau-de-bord` (format masqué, hors navigation) et l'action « créer le brouillon », FERMÉES par constante.
 * Aucun appel réel : brouillon en mémoire, aucune dépense, aucun lancement.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { listerFormats, listerFormatsNavigation, trouverFormat } = await import("@/formats");
const fermee = await import("@/app/(studio)/tableau-de-bord/actions");

const MDP = "essai-page-tableau-de-bord";
const RACINE = process.cwd();
const FICHIER_ACTIONS = "src/app/(studio)/tableau-de-bord/actions.ts";
const COPIE = join(RACINE, "tests/tableau-de-bord/_actions-ouverte.tmp.ts");
const distribution = [{ role: "voix", personnageId: "p-1", source: "double" as const }];

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterAll(() => rmSync(COPIE, { force: true }));

const videos = async () => ((await depots().videos.lister()) as { id?: string; formatId: string; titre: string; distribution: unknown[]; entrees: Record<string, unknown> }[]).filter((v) => v.formatId === "tableau-de-bord");

describe("action : porte fermée par constante", () => {
  it("la constante vaut false dans la source (seul un changement écrit l'ouvre)", () => {
    expect(readFileSync(join(RACINE, FICHIER_ACTIONS), "utf8")).toMatch(/const PAGE_TABLEAU_DE_BORD_OUVERTE: boolean = false;/);
  });
  it("fermée : TDB_FERME, aucun brouillon écrit", async () => {
    expect(await fermee.tableauDeBordOuvert()).toBe(false);
    const r = await fermee.creerTableauDeBord({ titre: "Mon mois", distribution });
    expect(r).toMatchObject({ ok: false, code: "TDB_FERME" });
    expect(await videos()).toEqual([]);
  });
  it("le fichier d'actions n'exporte que des fonctions asynchrones (règle des fichiers « use server ») et ne cite pas montage-donnees", () => {
    const s = readFileSync(join(RACINE, FICHIER_ACTIONS), "utf8");
    expect(s.startsWith('"use server";')).toBe(true);
    expect(s.match(/^export (?!async function|type |interface )/gm)).toBeNull();
    expect(s).not.toMatch(/montage-donnees/);
  });
});

describe("action : porte ouverte (copie de la source avec la constante à true, double en mémoire)", () => {
  it("crée un brouillon tableau-de-bord avec la distribution, sans entrées, sans lancement", async () => {
    const source = readFileSync(join(RACINE, FICHIER_ACTIONS), "utf8").replace("const PAGE_TABLEAU_DE_BORD_OUVERTE: boolean = false;", "const PAGE_TABLEAU_DE_BORD_OUVERTE: boolean = true;");
    expect(source).toContain("PAGE_TABLEAU_DE_BORD_OUVERTE: boolean = true;");
    writeFileSync(COPIE, source);
    const ouverte = (await import(/* @vite-ignore */ COPIE)) as typeof fermee;
    expect(await ouverte.tableauDeBordOuvert()).toBe(true);
    const r = await ouverte.creerTableauDeBord({ titre: "Mon mois", distribution });
    expect(r.ok).toBe(true);
    const liste = await videos();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ formatId: "tableau-de-bord", titre: "Mon mois", distribution, entrees: {} });
    const neuf = (await depots().travaux.lister()) as { cibleId?: string }[];
    expect(neuf.filter((t) => liste.some((v) => (v as { id?: string }).id === t.cibleId))).toEqual([]);
  });
});

describe("format : une adresse, mais toujours masqué et hors navigation", () => {
  it("adresseCreation = /tableau-de-bord, statut masque, jamais ouvert dans la navigation", () => {
    const f = trouverFormat("tableau-de-bord")!;
    expect(f.adresseCreation).toBe("/tableau-de-bord");
    expect(f.statut).toBe("masque");
    expect(f.ouvertDansLaNavigation).toBeUndefined();
    expect(listerFormats().some((x) => x.id === "tableau-de-bord")).toBe(false);
    expect(listerFormatsNavigation().some((x) => x.id === "tableau-de-bord")).toBe(false);
  });
  it("la page existe et l'adresse allume « Vidéos »", async () => {
    expect(readFileSync(join(RACINE, "src/app/(studio)/tableau-de-bord/page.tsx"), "utf8")).toContain("GabaritCreation");
    const { ACTIF_SUR_VIDEOS } = await import("@/components/coquille/navigation");
    expect(ACTIF_SUR_VIDEOS).toContain("/tableau-de-bord");
  });
  it("fermée, la page ne charge pas le formulaire ; elle dit la phrase", () => {
    const s = readFileSync(join(RACINE, "src/app/(studio)/tableau-de-bord/page.tsx"), "utf8");
    expect(s).toContain("Cette page n&rsquo;est pas encore ouverte.");
    expect(s).toMatch(/ouverte \? <FormulaireTableauDeBord/);
  });
});
