/**
 * Lot G4c · CORRECTIONS DÉCIDÉES SUR G4 (03/10/2026), sans appel payant :
 *  1. correctifs posés : la boucle d'écriture démarre avec le serveur (`instrumentation.ts`, coupée par
 *     STUDIO_BOUCLE_GENERATION=0) ; Claude est inscrit parmi les fournisseurs de script quand la clé existe ;
 *  2. délais du client Claude (150 s / 300 s) : voir `g0-client.test.ts` ;
 *  3. le plafond d'un sujet ou d'un « + Je lis » (0,70 $) se vérifie sur une estimation RÉALISTE (médiane du banc G4),
 *     le pire cas reste la règle du plafond MENSUEL ;
 *  4. cadrage hypothétique : « Prenons un dirigeant qui… », jamais « Imaginez » (qui reste dans la liste anti-texte IA).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseFlux } from "./helpers/g0";
import { estimationRealisteRole, MEDIANES_BANC_G4_USD } from "@/generateur/roles/estimation";
import { pireCasRole, type DefinitionRole } from "@/generateur/roles/types";
import { ROLES_ECRITURE } from "@/generateur/roles";
import { roleSonde } from "@/generateur/roles/sonde";
import { TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";
import type { GenerationScript } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

describe("G4c · correctif 1 : boucle d'écriture au démarrage, Claude inscrit", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.doUnmock("@/services/boucle-generation");
    vi.doUnmock("@/services/veille");
    vi.doUnmock("@/services/boucle");
    vi.resetModules();
  });

  async function demarrerServeur(variables: Record<string, string>) {
    vi.resetModules();
    const assurer = vi.fn();
    vi.doMock("@/services/boucle-generation", () => ({ assurerBoucleGeneration: assurer }));
    vi.doMock("@/services/veille", () => ({ demarrerVeille: () => false }));
    // Audit D (un seul réplica) : la boucle d'écriture part une fois le verrou de la boucle pris (`avecLeVerrou`).
    vi.doMock("@/services/boucle", () => ({ demarrerBoucle: () => false, demarrerBoucleUnique: async (o?: { avecLeVerrou?: () => unknown }) => (await o?.avecLeVerrou?.(), false) }));
    Object.assign(process.env, { NEXT_RUNTIME: "nodejs", STUDIO_VEILLE: "0", STUDIO_BOUCLE: "0", ...variables });
    delete process.env.DATABASE_URL;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { register } = await import("@/instrumentation");
    await register();
    log.mockRestore();
    return assurer;
  }

  it("le démarrage du serveur lance la boucle d'écriture ; STUDIO_BOUCLE_GENERATION=0 la coupe", async () => {
    expect(await demarrerServeur({})).toHaveBeenCalledTimes(1);
    expect(await demarrerServeur({ STUDIO_BOUCLE_GENERATION: "0" })).not.toHaveBeenCalled();
  });

  it("Claude est un fournisseur de script « relié » quand la clé existe, « à relier » sinon", async () => {
    process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
    vi.resetModules();
    expect((await import("@/fournisseurs")).etatConnexion("script", "claude")).toBe("relie");
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
    expect((await import("@/fournisseurs")).etatConnexion("script", "claude")).toBe("a-relier");
  });
});

describe("G4c · correction 3 : plafond du sujet sur une estimation réaliste", () => {
  const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les fichiers Excel</brief>" };

  it("estimation réaliste = médiane mesurée au banc G4, bien sous le pire cas ; rôle non mesuré : entrée + ¼ de la sortie maximale", () => {
    const prose = ROLES_ECRITURE.prose as DefinitionRole;
    expect(estimationRealisteRole(prose, entree)).toBeCloseTo(MEDIANES_BANC_G4_USD.prose, 6);
    expect(pireCasRole(prose, entree)).toBeGreaterThan(2 * MEDIANES_BANC_G4_USD.prose);
    const pref = ROLES_ECRITURE.preference as DefinitionRole;
    expect(MEDIANES_BANC_G4_USD.preference).toBeUndefined();
    expect(estimationRealisteRole(pref, entree)).toBeLessThan(pireCasRole(pref, entree));
    expect(estimationRealisteRole(pref, entree)).toBeGreaterThan(0);
    // Jamais plus que le pire cas.
    for (const r of Object.values(ROLES_ECRITURE) as DefinitionRole[]) expect(estimationRealisteRole(r, entree)).toBeLessThanOrEqual(pireCasRole(r, entree) + 1e-12);
  });

  describe("avec un faux Claude (aucun réseau)", () => {
    const MDP = "essai-g4c-corrections";
    beforeAll(async () => {
      await preparerMotDePasse(MDP);
    });
    let gc: typeof import("@/services/generation-claude");
    let depots: typeof import("@/donnees/memoire").depots;
    let credits: typeof import("@/services/credits");
    beforeEach(async () => {
      vi.resetModules();
      const mem = await import("@/donnees/memoire");
      mem.reinitialiserDepots();
      depots = mem.depots;
      reinitialiserRequete();
      await (await import("@/services/auth")).seConnecter(MDP, false);
      gc = await import("@/services/generation-claude");
      credits = await import("@/services/credits");
      const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
      credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
      await (await import("@/services/_commun")).ecrireParametre("fournisseur.script", "claude");
      await credits.declarerRecharge("anthropic", 1000);
    });
    afterEach(() => {
      gc.injecterClaudePourEssai(null);
      credits.injecterLecteursPourEssai(null);
    });

    /** « + Je lis » : plafond 0,70 $, 0,55 $ déjà dépensés (coût réel). */
    async function jeLisDejaEntame(): Promise<GenerationScript> {
      const le = new Date().toISOString();
      const g: GenerationScript = {
        id: "gen-g4c-jelis",
        scriptMaitreId: "suj-g4c",
        hachageContexte: "h",
        plafondUsd: 0.7,
        portee: "corps-supplementaire",
        etapes: [{ role: "plan", versionConsigne: 1, modeleDemande: "claude-opus-5-5", modeleEffectif: "claude-opus-5-5", effort: "high", appelId: "a1", lanceLe: le, termineLe: le, estimationPireCasUsd: 0.3, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 27_500 }, resultat: "ok" }],
        statut: "en-cours",
        creeLe: le,
        modifieLe: le,
      };
      await depots().generations.enregistrer(g);
      expect(gc.depenseGenerationUsd(g)).toBeCloseTo(0.55, 6);
      return g;
    }

    it("« + Je lis » : 0,55 $ dépensés + prose (pire cas ≈ 0,18 $ > reste, médiane 0,08 $) → le corps va jusqu'au bout", async () => {
      const prose = ROLES_ECRITURE.prose as DefinitionRole;
      expect(0.55 + pireCasRole(prose, entree)).toBeGreaterThan(0.7); // l'ancienne règle aurait arrêté ici
      const g = await jeLisDejaEntame();
      const f = fauxFetch([() => reponseFlux(fluxReussi({ texte: '{"x":1}', entree: 2500, cacheEcrit: 1000, sortie: 2000 }))]);
      gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
      const r = await gc.executerRoleFacture(g.id, prose, entree);
      expect(r.ok).toBe(true);
      expect(f.appels).toHaveLength(1);
      expect((await depots().generations.obtenir(g.id))!.statut).not.toBe("plafond-atteint");
    });

    it("le plafond du sujet arrête toujours quand même la médiane ne tient plus", async () => {
      const g = await jeLisDejaEntame();
      const lourd = { ...roleSonde, id: "accroches", maxTokens: 10_000 } as DefinitionRole; // médiane 0,199 $
      const f = fauxFetch([() => reponseFlux(fluxReussi({ texte: '{"phrase":"x"}' }))]);
      gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
      expect(await gc.executerRoleFacture(g.id, lourd, entree)).toMatchObject({ ok: false, arret: "plafond-atteint" });
      expect(f.appels).toHaveLength(0);
    });

    it("le plafond MENSUEL garde le pire cas : la médiane tiendrait, le pire cas non → en attente, aucun appel", async () => {
      const prose = ROLES_ECRITURE.prose as DefinitionRole;
      const pire = pireCasRole(prose, entree);
      // Plafond mensuel entre médiane × 1,2 et pire cas × 1,2.
      await gc.definirPlafondMensuelClaude(Math.round(pire * 100) / 100);
      const le = new Date().toISOString();
      const g: GenerationScript = { id: "gen-g4c-mois", scriptMaitreId: "suj-g4c-mois", hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
      await depots().generations.enregistrer(g);
      const f = fauxFetch([() => reponseFlux(fluxReussi({ texte: '{"x":1}' }))]);
      gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
      expect(await gc.executerRoleFacture(g.id, prose, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
      expect(f.appels).toHaveLength(0);
    });
  });
});

describe("G4c · correction 4 : cadrage hypothétique « Prenons un dirigeant qui… »", () => {
  it("les consignes qui écrivent le texte donnent « Prenons un dirigeant qui… » et écartent « Imaginez »", () => {
    for (const r of [ROLES_ECRITURE.stratege, ROLES_ECRITURE.plan, ROLES_ECRITURE.prose]) {
      expect(r.consigne).toContain("« Prenons un dirigeant qui… »");
      expect(r.consigne).toMatch(/N'écris jamais « Imaginez… »/);
    }
  });

  it("« Imaginez » reste dans la liste anti-texte IA ; « Prenons » n'y est pas", () => {
    const imaginez = TOURNURES_CALIBREES.find((t) => t.motif === "imaginez");
    expect(imaginez).toBeTruthy();
    const re = new RegExp(imaginez!.regex, "iu");
    expect(re.test("Imaginez un dirigeant qui recopie ses fichiers.")).toBe(true);
    expect(TOURNURES_CALIBREES.some((t) => new RegExp(t.regex, "iu").test("Prenons un dirigeant qui recopie ses fichiers chaque semaine."))).toBe(false);
  });
});
