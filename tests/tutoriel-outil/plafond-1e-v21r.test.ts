/**
 * TUTO-PLAFOND-1E-v21r : le plafond Claude du tutoriel ramené à 1 € (1,11 $) par tutoriel (décision du pilote du
 * 21/11 07:20), refus propre au-delà pour l'Usine, Claude et son regard ALLUMÉS par défaut dans ce plafond.
 * Dépôts mémoire, vrai module de dépense, faux `fetch`, aucun appel réseau ni à Claude, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const tc = await import("@/services/tutoriel-claude");
const { PLAFOND_TUTORIEL_USD } = await import("@/services/plafond-tutoriel");
const { equipeTutorielActive, portsEquipeAvecPhrase } = await import("@/services/tutoriel-equipe");
const { lireReglagesTutoriel } = await import("@/services/tutoriel-console");
const { conditionsTirage } = await import("@/services/tutoriel-reserve-tirage");
const { REGLAGES_RESERVE_DEFAUT } = await import("@/domaine/tutoriel-reserve");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ErreurClaude } = await import("@/fournisseurs/claude/client");
const { ecrireParametre } = await import("@/services/_commun");
const { nouvelId } = await import("@/lib/ids");
const { moisParis } = await import("@/services/couts");
import type { PlafondPropre } from "@/services/depense-claude-video";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import type { CommandeFabrication, Video } from "@/domaine/types";
import type { ElementReserve } from "@/domaine/tutoriel-reserve";

const MDP = "essai-plafond-1e-tutoriel";
const ETAPE_PLAN = "Tutoriel · plan de scènes";
const REQ_PLAN: RequeteClaude = { modele: "claude-sonnet-5-5", maxTokens: 10, effort: "high", systeme: [{ texte: "consigne" }], messages: [{ role: "user", contenu: "demande" }], json: true };
const lecteur = (valeurs: Record<string, unknown>) => (async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut)) as <T>(id: string, defaut: T) => Promise<T>;
const enEchec = (async () => {
  throw new Error("lecture en échec");
}) as never;
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-tuto-1e", estDemo: false, formatId: "tutoriel-outil" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depense(videoId: string, etape: string, centimesEur: number) {
  const date = new Date().toISOString();
  const ligne = { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

/** Comptes, budgets du mois larges et faux réseau : seul le plafond de la vidéo peut arrêter. */
async function banc(reponse: "ok" | "interdit") {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  gc.injecterClaudePourEssai({
    cle: CLE_ESSAI_CLAUDE,
    fetch: (async () => {
      appels.push(1);
      if (reponse === "interdit") throw new Error("réseau interdit");
      return reponseFlux(fluxReussi({ texte: "{}", modele: "claude-sonnet-5-5" }));
    }) as typeof fetch,
    attenteMs: () => 0,
  });
  await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
  await ecrireParametre(`budget.usine.${moisParis()}`, { mois: moisParis(), budget_mensuel_cents: 1_000_000 });
  return appels;
}

describe("TUTO-PLAFOND-1E-v21r · plafond Claude du tutoriel à 1 € (1,11 $)", () => {
  it("a) plafond 1,11 $ (dossier) : le pire cas calculé est au-dessus, le plafond décidé l'emporte", () => {
    expect(tc.plafondTutorielParDefautUsd()).toBeGreaterThan(PLAFOND_TUTORIEL_USD);
    expect(tc.plafondPropreTutoriel().defautUsd).toBe(1.11);
  });

  it("a) plafond 1,11 $ (phrase) : l'équipe partie d'une phrase passe 1,11 $ au chemin de l'argent", async () => {
    expect(tc.plafondTutorielPhraseUsd()).toBeGreaterThan(PLAFOND_TUTORIEL_USD);
    const recus: number[] = [];
    const executer = (async (_v: string, _r: unknown, _e: unknown, opts: { plafondPropre: { defautUsd: number } }) => (recus.push(opts.plafondPropre.defautUsd), { ok: true, simule: false, donnees: {}, texte: "", modele: "test", coutUsd: 0 })) as never;
    const phrase = { origine: undefined, entrees: { tutorielOutil: { depot: { mode: "phrase", phrase: "un tableau de bord pour un atelier" }, fin: "aucune" } } } as unknown as Pick<CommandeFabrication, "origine" | "entrees">;
    const port = await portsEquipeAvecPhrase(phrase, "v1", { executer, lire: lecteur({}) });
    await port.appelerRole("chef-de-projet", { contexte: {}, variable: "{}" }).catch(() => undefined);
    expect(recus).toEqual([1.11]);
  });

  it("b) objet sans conversion : id « tuto », type `PlafondPropre` vérifié par tsc", () => {
    const p = tc.plafondPropreTutoriel() satisfies PlafondPropre;
    expect(p).toEqual({ id: "tuto", parametre: "tutoriel.plafondClaudeUsd", defautUsd: 1.11, prefixeEtape: "Tutoriel ·" });
    const src = readFileSync(join(process.cwd(), "src/services/tutoriel-claude.ts"), "utf8");
    const corps = src.slice(src.indexOf("export function plafondPropreTutoriel"), src.indexOf("const PHRASE_ARRET"));
    expect(corps).toContain("): PlafondPropre {");
    expect(corps).not.toMatch(/as unknown as/);
  });

  it("c) borne en euros : 1,11 $ × 0,90 ≤ 1 € et > 0,99 €", () => {
    expect(PLAFOND_TUTORIEL_USD * 0.9).toBeLessThanOrEqual(1);
    expect(PLAFOND_TUTORIEL_USD * 0.9).toBeGreaterThan(0.99);
  });

  it("d) refus propre au-delà (Usine) : ≈ 1 $ déjà engagé, l'appel est refusé avant l'envoi, phrase sans montant, 0 réservation, 0 réseau", async () => {
    const appels = await banc("interdit");
    const v = await video();
    await depense(v.id, ETAPE_PLAN, 100);
    const engage = await dcv.engagePlafondPropreCentimes(v.id, tc.plafondPropreTutoriel());
    // ≈ 1,11 $ engagés : sous l'ancien pire cas (≈ 1,65 $), au niveau du plafond décidé.
    expect(engage).toBeGreaterThanOrEqual(100);
    expect(engage).toBeLessThan(tc.plafondTutorielParDefautUsd() * 100 - 20);
    const avant = (await depots().reservations.lister((r) => r.videoId === v.id)).length;
    const erreur = await tc.appelClaudeTutoriel(v.id, "usine")(REQ_PLAN).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erreur).toBeInstanceOf(ErreurClaude);
    expect((erreur as Error).message).toBe("La limite de cette vidéo pour l'écriture est atteinte : rien n'a été payé.");
    expect((erreur as Error).message).not.toMatch(/\d|\$|€/);
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.lister((r) => r.videoId === v.id)).toHaveLength(avant);
  });

  it("d) témoin : sous le plafond (rien d'engagé), le même appel part (faux réseau)", async () => {
    const appels = await banc("ok");
    const v = await video();
    await tc.appelClaudeTutoriel(v.id, "usine")(REQ_PLAN).catch(() => undefined);
    expect(appels).toHaveLength(1);
  });

  it("e) Studio : signalé, pas arrêté (budget « indicatif » forcé, mode-budget.ts) — comportement figé, non changé ici", async () => {
    const appels = await banc("ok");
    const v = await video();
    await depense(v.id, ETAPE_PLAN, 100);
    await tc.appelClaudeTutoriel(v.id, "studio")(REQ_PLAN).catch(() => undefined);
    expect(appels).toHaveLength(1);
  });

  it("f) le réglage écrit l'emporte : 0,5 → 0,5 ; 3 → 3", async () => {
    await ecrireParametre("tutoriel.plafondClaudeUsd", 0.5);
    expect(await dcv.valeurPlafondPropre(tc.plafondPropreTutoriel())).toBe(0.5);
    await ecrireParametre("tutoriel.plafondClaudeUsd", 3);
    expect(await dcv.valeurPlafondPropre(tc.plafondPropreTutoriel())).toBe(3);
  });

  it("g) Claude allumé par défaut : absent → oui, `false` → non, \"true\" / 1 → oui, lecture en échec → non", async () => {
    expect(await tc.claudeTutorielActif(lecteur({}))).toBe(true);
    expect(await tc.claudeTutorielActif(lecteur({ "tutoriel.claude": false }))).toBe(false);
    expect(await tc.claudeTutorielActif(lecteur({ "tutoriel.claude": "true" }))).toBe(true);
    expect(await tc.claudeTutorielActif(lecteur({ "tutoriel.claude": 1 }))).toBe(true);
    expect(await tc.claudeTutorielActif(enEchec)).toBe(false);
  });

  it("h) regard allumé par défaut : absent, \"true\", 1 → oui, `false` sur l'une des deux clés → non, lecture en échec → non", async () => {
    expect(await tc.regardTutorielActif(lecteur({}))).toBe(true);
    expect(await tc.regardTutorielActif(lecteur({ "tutoriel.regardeur": "true" }))).toBe(true);
    expect(await tc.regardTutorielActif(lecteur({ "tutoriel.regardeur": 1 }))).toBe(true);
    expect(await tc.regardTutorielActif(lecteur({ "tutoriel.regardeur": false }))).toBe(false);
    expect(await tc.regardTutorielActif(lecteur({ "tutoriel.claude": false }))).toBe(false);
    expect(await tc.regardTutorielActif(enEchec)).toBe(false);
  });

  it("i) restent éteints : l'équipe et le lecteur de retouche", async () => {
    expect(await equipeTutorielActive(lecteur({}))).toBe(false);
    expect(await tc.lecteurClaudeTutorielActif(lecteur({}))).toBe(false);
  });

  it("j) panneau : mémoire vide → allumées exactement Claude, son regard et la cloche du suivi ; `tutoriel.claude: false` → Claude éteint", async () => {
    const vide = await lireReglagesTutoriel({ lire: lecteur({}) });
    expect(vide.filter((r) => r.allume).map((r) => r.cle)).toEqual(["tutoriel.claude", "tutoriel.regardeur", "tutoriel.suiviCloche"]);
    const coupe = await lireReglagesTutoriel({ lire: lecteur({ "tutoriel.claude": false }) });
    expect(coupe.find((r) => r.cle === "tutoriel.claude")?.allume).toBe(false);
    // Même règle que `claudeTutorielActif` : seul `false` éteint (la chaîne "true" n'éteint pas une ligne allumée par défaut).
    const chaine = await lireReglagesTutoriel({ lire: lecteur({ "tutoriel.claude": "true", "tutoriel.regardeur": 1 }) });
    expect(chaine.filter((r) => r.allume).map((r) => r.cle)).toEqual(["tutoriel.claude", "tutoriel.regardeur", "tutoriel.suiviCloche"]);
  });

  it("k) tirage au plafond réel : sans réglage, limite 100 c€, taux 0,9 → pas « plafond_video » ; réglage 2 $ → « plafond_video »", async () => {
    const reglages = { ...REGLAGES_RESERVE_DEFAUT, actif: true, plafondVideoCentimes: 100 };
    const dep = {
      interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
      equipe: async () => true,
      lister: async () => [],
      tauxUsdEur: async () => 0.9,
      plafondMoisAtteint: async () => false,
      accordSansClic: async () => true,
      sousPlafondUsine: async () => true,
    };
    const idee = { id: "res-idee", titre: "i", source: { type: "idee", phrase: "Un tableau de bord pour un atelier" }, fin: "aucune", ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur", etat: "en_attente" } as unknown as ElementReserve;
    const dossier = { ...idee, id: "res-dossier", source: { type: "dossier", fichierId: "f1", nomFichier: "a.zip", attestationImages: true } } as unknown as ElementReserve;
    expect(await conditionsTirage(idee, reglages, dep)).toBeNull();
    expect(await conditionsTirage(dossier, reglages, dep)).toBeNull();
    await ecrireParametre("tutoriel.plafondClaudeUsd", 2);
    expect(await conditionsTirage(idee, reglages, dep)).toMatchObject({ raison: "plafond_video" });
  });

  it("l) garde de texte : ni écriture de réglage, ni `lireParametre(` littéral, ni décimal hors 0,05 ; `plafond-tutoriel.ts` sans import", () => {
    const src = readFileSync(join(process.cwd(), "src/services/tutoriel-claude.ts"), "utf8");
    expect(src).not.toMatch(/ecrireParametre/);
    expect(src).not.toMatch(/lireParametre\(/);
    expect((src.match(/\b\d+\.\d+\b/g) ?? []).filter((n) => n !== "0.05")).toEqual([]);
    const montant = readFileSync(join(process.cwd(), "src/services/plafond-tutoriel.ts"), "utf8");
    expect(montant).not.toMatch(/^\s*import\b/m);
    expect(montant).toMatch(/export const PLAFOND_TUTORIEL_USD = 1\.11;/);
  });
});
