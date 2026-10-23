/**
 * Vérification E2E n° 2 (argent et pannes) — corrections du générateur. Faux `fetch`, aucune clé réelle, aucun réseau,
 * 0 € : essais B1 à B4 et F1 du vérificateur 2-B, plus le redémarrage pendant une retouche.
 *  - n° 1 (BLOQUANT) : une retouche ratée (coupure, Claude indisponible) ne reste jamais « en cours » ; la boucle ne
 *    retombe plus dessus ; une retouche orpheline (redémarrage) est close ; les sujets suivants sont écrits.
 *  - n° 2 : un refus net (400) arrête l'écriture au premier tour (message, notification, « Reprendre ») ; une panne
 *    passagère attend son prochain essai sans bloquer les autres, et s'arrête au 3e échec.
 *  - n° 10 (B1) : la limite Claude du mois tient avec des appels parallèles.
 *  - n° 11 (B3) : le plafond de 5 retouches tient avec des envois simultanés.
 *  - n° 12 (F1) : « + Je lis » touché deux fois = une seule écriture.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre, ErreurStudio } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
import { roleSonde } from "@/generateur/roles/sonde";
import { pireCasRole } from "@/generateur/roles/types";
import type { GenerationScript } from "@/domaine/types";
import type { ExecuteurRoles } from "@/generateur/chaine";

const MDP = "essai-e2e2-gen-argent";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  delete process.env.STUDIO_SIMULATION_LENTEUR_MS;
});

const lancer = (i: number) => bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });

async function sujetEcrit(): Promise<string> {
  const r = await lancer(0);
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  return r.scriptMaitreId;
}

describe("E2E-2 argent n° 1 · retouche ratée chez Claude", () => {
  it("coupure réseau : la retouche est close « échec », un message clair, puis le sujet suivant est écrit", async () => {
    const id = await sujetEcrit();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id))[0];
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch, attenteMs: () => 0 });
    const e = await bg.regenererVariante(v.id, "ameliorer").then(() => null, (x: InstanceType<typeof ErreurStudio>) => x);
    expect(e?.code).toBe("RETOUCHE_INTERROMPUE");
    expect(e?.message).toMatch(/version d'avant est gardée/);
    const retouches = await depots().generations.lister((g) => g.portee === "retouche");
    expect(retouches.map((g) => g.statut)).toEqual(["echec"]);
    // Un sujet suivant (simulé) : la boucle l'écrit.
    await ecrireParametre("fournisseur.script", "simulation");
    const r2 = await lancer(1);
    expect(r2.ok).toBe(true);
    const traite = await bg.tourBoucleGeneration();
    expect(traite).toBe(r2.ok ? r2.generationId : "");
    const g2 = r2.ok ? await depots().generations.obtenir(r2.generationId) : null;
    expect(g2?.statut).toBe("terminee");
    expect(g2?.etapes.length).toBeGreaterThan(0);
  });

  it("redémarrage pendant une retouche (retouche « en cours » sans vol) : close au tour suivant, la boucle avance", async () => {
    await sujetEcrit();
    const le = new Date(Date.now() - 60_000).toISOString();
    // L'état laissé par un redémarrage (ou par l'ancien code) : une retouche « en cours », sans réglages de chaîne.
    const orpheline: GenerationScript = { id: "gen-orpheline", scriptMaitreId: "suj-x", hachageContexte: "h", plafondUsd: 0.7, portee: "retouche", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
    await depots().generations.enregistrer(orpheline);
    // Et une écriture de sujet « en cours » dont les réglages ont disparu : close elle aussi.
    await depots().generations.enregistrer({ ...orpheline, id: "gen-sans-options", portee: "sujet" });
    const r2 = await lancer(1);
    const traites: (string | null)[] = [];
    for (let i = 0; i < 3; i++) traites.push(await bg.tourBoucleGeneration());
    expect((await depots().generations.obtenir("gen-orpheline"))?.statut).toBe("echec");
    expect((await depots().generations.obtenir("gen-sans-options"))?.statut).toBe("echec");
    expect(r2.ok && (await depots().generations.obtenir(r2.generationId))?.statut).toBe("terminee");
    expect(traites).not.toContain("gen-orpheline");
  });

  it("retouche qui attend du crédit : close, message « pas partie », rien n'est compté dans les 5", async () => {
    const id = await sujetEcrit();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id))[0];
    await ecrireParametre("fournisseur.script", "claude");
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const e = await bg.regenererVariante(v.id, "ameliorer").then(() => null, (x: InstanceType<typeof ErreurStudio>) => x);
    expect(e?.code).toBe("RETOUCHE_EN_ATTENTE");
    expect((await depots().generations.lister((g) => g.portee === "retouche")).map((g) => g.statut)).toEqual(["echec"]);
    expect(await lireParametre<number>(bg.cleRetouches(v.code), 0)).toBe(0);
    // Elle ne « reprend » jamais seule, même une fois la limite relevée.
    await gc.definirPlafondMensuelClaude(100);
    expect((await depots().generations.lister((g) => g.portee === "retouche")).map((g) => g.statut)).toEqual(["echec"]);
  });
});

describe("E2E-2 argent n° 2 · écriture refusée ou en panne", () => {
  it("refus net (400) à chaque appel : arrêtée au 1er tour, Will prévenu, plus aucun appel ; « Reprendre » la relance", async () => {
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    let appels = 0;
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      fetch: (async () => (appels++, new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "prompt is too long" } }), { status: 400, headers: { "content-type": "application/json" } }))) as typeof fetch,
      attenteMs: () => 0,
    });
    const r1 = await lancer(0);
    if (!r1.ok) throw new Error("lancement");
    expect(await bg.tourBoucleGeneration()).toBe(r1.generationId);
    const apres1 = appels;
    for (let i = 0; i < 4; i++) await bg.tourBoucleGeneration();
    expect(appels).toBe(apres1);
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("echec");
    expect((await depots().scriptsMaitres.obtenir(r1.scriptMaitreId))?.etat).toBe("echec");
    const arret = await bg.ecritureArretee(r1.scriptMaitreId);
    expect(arret?.message).toMatch(/refuse/);
    expect((await depots().notifications.lister((n) => n.titre === "Une écriture s'est arrêtée")).length).toBe(1);
    expect((await depots().evenements.lister((e) => /Tour de boucle interrompu/.test(e.message))).length).toBe(1);
    // « Reprendre l'écriture » : elle repart (ici en simulation) et se termine.
    await ecrireParametre("fournisseur.script", "simulation");
    expect(await bg.reprendreEcritureArretee(r1.scriptMaitreId)).toBe(true);
    expect(await bg.tourBoucleGeneration()).toBe(r1.generationId);
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("terminee");
    expect(await bg.ecritureArretee(r1.scriptMaitreId)).toBeNull();
  });

  it("une écriture en panne passagère s'arrête au 1er échec (garde-fous du 15/10) : le sujet suivant est écrit, elle n'est plus rejouée", async () => {
    const r1 = await lancer(0);
    const r2 = await lancer(1);
    if (!r1.ok || !r2.ok) throw new Error("lancement");
    const enPanne = (id: string): ExecuteurRoles => ({
      executer: async (role, entree) => {
        if (id === r1.generationId) throw new ErreurStudio("CLAUDE_INDISPONIBLE", "Claude ne répond pas.");
        return gc.executerRoleFacture(id, role, entree);
      },
    });
    expect(await bg.tourBoucleGeneration(enPanne)).toBe(r1.generationId);
    // Le tour suivant ne retombe pas sur l'écriture en panne : il écrit le sujet n° 2.
    expect(await bg.tourBoucleGeneration(enPanne)).toBe(r2.generationId);
    expect((await depots().generations.obtenir(r2.generationId))?.statut).toBe("terminee");
    const p = await bg.lirePanneEcriture(r1.generationId);
    expect(p?.essais).toBe(1);
    expect(p?.arretee).toBe(true);
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("echec");
    // Délai échu : toujours rien (seul « Reprendre l'écriture » la relance).
    await ecrireParametre(`generateur.panne.${r1.generationId}`, { ...p!, prochainEssai: new Date(0).toISOString() });
    expect(await bg.tourBoucleGeneration(enPanne)).toBeNull();
  });
});

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV</brief>" };

describe("E2E-2 argent n° 10 (B1) · limite Claude du mois et appels parallèles", () => {
  it("une limite qui ne permet qu'un appel : 4 appels lancés ensemble, 1 seul part", async () => {
    await credits.declarerRecharge("anthropic", 100_000);
    const appels: string[] = [];
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      fetch: (async (url: string | URL | Request) => {
        appels.push(String(url));
        await new Promise((r) => setTimeout(r, 30));
        return reponseFlux(fluxReussi({ texte: '{"phrase":"ok"}' }));
      }) as typeof fetch,
      attenteMs: () => 0,
    });
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, pireCasRole(roleSonde, entree) * 1.2 * 1.5);
    const le = new Date().toISOString();
    const g: GenerationScript = { id: "gen-b1", scriptMaitreId: "suj-b1", hachageContexte: "h", plafondUsd: 100, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
    await depots().generations.enregistrer(g);
    const res = await Promise.all([1, 2, 3, 4].map(() => gc.executerRoleFacture(g.id, roleSonde, entree)));
    expect(appels.length).toBe(1);
    expect(res.filter((x) => x.ok).length).toBe(1);
  });
});

describe("E2E-2 argent n° 11 (B3) · plafond de 5 retouches et envois simultanés", () => {
  it("8 retouches lancées ensemble sur une version à 4/5 : une seule passe", async () => {
    const id = await sujetEcrit();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id))[0];
    await ecrireParametre(bg.cleRetouches(v.code), 4);
    process.env.STUDIO_SIMULATION_LENTEUR_MS = "30";
    const r = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7, 8].map(() => bg.regenererVariante(v.id, "ameliorer")));
    expect(r.filter((x) => x.status === "fulfilled").length).toBe(1);
    expect(await lireParametre<number>(bg.cleRetouches(v.code), 0)).toBe(5);
    expect(await depots().generations.compter((g) => g.portee === "retouche")).toBe(1);
  });
});

describe("E2E-2 argent n° 12 (F1) · « + Je lis » touché deux fois", () => {
  it("une seule écriture supplémentaire", async () => {
    const id = await sujetEcrit();
    const res = await Promise.all([bg.ajouterDeclinaison(id, { mode: "teleprompteur" }), bg.ajouterDeclinaison(id, { mode: "teleprompteur" })]);
    const supp = await depots().generations.lister((g) => g.scriptMaitreId === id && g.portee !== "sujet");
    expect(supp.length).toBe(1);
    expect(res.every((x) => x.ok && x.generationId === supp[0].id)).toBe(true);
  });
});
