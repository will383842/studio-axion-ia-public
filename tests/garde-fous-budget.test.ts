/**
 * GARDE-FOUS BUDGET (audit du 15/10 : le crédit Claude s'est vidé, les écritures repartaient seules après une recharge,
 * la grande chaîne s'arrêtait au plafond de 1,50 $ au milieu). Faux `fetch`, aucune clé réelle, aucun réseau, 0 €.
 *  1. Plus aucune reprise automatique : la recharge remet les alertes à zéro ; l'écriture devient « prête à reprendre »
 *     et seul le geste de Will (« Reprendre ») la relance. Une panne arrête l'écriture au premier tour raté.
 *  2. Le pire cas de TOUTE la chaîne est réservé avant le premier appel : au-dessus du plafond du sujet, rien ne part.
 *  4. Réponse coupée (max_tokens) : arrêt, texte brut gardé, statut clair, aucun nouvel appel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre, ErreurStudio } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript } from "@/domaine/types";
import type { ExecuteurRoles } from "@/generateur/chaine";

const MDP = "essai-garde-fous-budget";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV</brief>" };
const lancer = (i: number, reseaux = SUJETS_BANC[i].reseaux) => bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...reseaux], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });

let n = 0;
async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-gf-${++n}`, scriptMaitreId: `suj-gf-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

/** Une écriture refusée par Claude (crédit épuisé chez lui, 402) : « en attente de crédit ». */
async function ecritureRefuseeParFacturation(): Promise<GenerationScript> {
  await credits.declarerRecharge("anthropic", 500);
  await ecrireParametre("fournisseur.script", "claude");
  const f = fauxFetch([() => reponseErreur(402, "billing_error", "Your credit balance is too low")]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
  const g = await nouvelleGeneration();
  expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
  return g;
}

describe("1 · plus aucune reprise automatique après une recharge", () => {
  it("recharge Claude déclarée : l'écriture reste en attente, devient « prête » ; la boucle ne la relance pas ; seul « Reprendre » le fait", async () => {
    const g = await ecritureRefuseeParFacturation();
    expect(await gc.declarerRechargeClaude(1000)).toEqual([]);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-attente-credit");
    expect(await gc.ecriturePreteAReprendre(g.id)).toBe(true);
    // La boucle d'écriture (tour après tour) ne la relance jamais.
    for (let i = 0; i < 3; i++) expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-attente-credit");
    // Will est prévenu UNE fois, avec un prix.
    const notes = await depots().notifications.lister((x) => x.titre === "Une écriture peut reprendre");
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/Reprendre.*\$/);
    // Le geste de Will (sur CE sujet) la relance.
    expect(await gc.relancerEcrituresEnAttente("autre-sujet")).toEqual([]);
    expect(await gc.relancerEcrituresEnAttente(g.scriptMaitreId)).toEqual([g.id]);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-cours");
  });

  it("limite du mois relevée dans Réglages : rien ne repart seul (prête seulement)", async () => {
    await credits.declarerRecharge("anthropic", 10_000);
    await ecrireParametre("fournisseur.script", "claude");
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(await gc.definirPlafondMensuelClaude(100)).toEqual([]);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-attente-credit");
    expect(await gc.ecriturePreteAReprendre(g.id)).toBe(true);
  });

  it("le message d'attente ne promet plus de reprise « toute seule »", async () => {
    await credits.declarerRecharge("anthropic", 1);
    await ecrireParametre("fournisseur.script", "claude");
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok ? "" : r.message).not.toMatch(/tout seul|toute seule/);
    expect(r.ok ? "" : r.message).toMatch(/Reprendre/);
  });

  it("recharge déclarée chez un fournisseur : alertes à zéro ; les VIDÉOS en attente repartent comme avant, les écritures Claude non", async () => {
    // Correctif après relecture (15/10) : la règle « pas de reprise seule » ne vise que les écritures Claude.
    const plus = new Date(Date.now() + 3600_000).toISOString();
    const le = new Date().toISOString();
    await depots().travaux.enregistrer({ id: "trv-gf", type: "fabrication", videoId: "vid-gf", statut: "en_cours", etapes: [], reprise: { motif: "credit", fournisseurCredit: "anthropic", prochainEssai: plus, essais: 1 }, creeLe: le, modifieLe: le } as never);
    const g = await ecritureRefuseeParFacturation();
    await ecrireParametre("credits.alertes.anthropic", [50, 25]);
    await credits.declarerRecharge("anthropic", 500);
    expect(await lireParametre<number[]>("credits.alertes.anthropic", [1])).toEqual([]);
    expect(Date.parse((await depots().travaux.obtenir("trv-gf"))!.reprise!.prochainEssai)).toBeLessThanOrEqual(Date.now());
    expect(JSON.stringify(await depots().evenements.lister())).toContain("vidéo reprise");
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-attente-credit");
  });

  it("panne passagère : l'écriture s'arrête au PREMIER tour raté (aucun nouvel essai seul), « Reprendre l'écriture » la relance", async () => {
    const r1 = await lancer(0);
    if (!r1.ok) throw new Error("lancement");
    let appels = 0;
    const enPanne = (id: string): ExecuteurRoles => ({
      executer: async (role, e) => {
        appels++;
        if (id === r1.generationId) throw new ErreurStudio("CLAUDE_INDISPONIBLE", "Claude ne répond pas.");
        return gc.executerRoleFacture(id, role, e);
      },
    });
    expect(await bg.tourBoucleGeneration(enPanne)).toBe(r1.generationId);
    const p = await bg.lirePanneEcriture(r1.generationId);
    expect(p).toMatchObject({ essais: 1, arretee: true });
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("echec");
    const avant = appels;
    await ecrireParametre(`generateur.panne.${r1.generationId}`, { ...p!, prochainEssai: new Date(0).toISOString() });
    expect(await bg.tourBoucleGeneration(enPanne)).toBeNull();
    expect(appels).toBe(avant);
    expect(await bg.reprendreEcritureArretee(r1.scriptMaitreId)).toBe(true);
    expect(await bg.tourBoucleGeneration()).toBe(r1.generationId);
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("terminee");
  }, 30_000);
});

describe("2 · le pire cas de toute la chaîne est réservé avant le premier appel", () => {
  it("pire cas au-dessus de 1,50 $ : AUCUN appel, statut « plafond-atteint », message avec le prix", async () => {
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    let appels = 0;
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => (appels++, reponseFlux(fluxReussi({ texte: "{}" })))) as typeof fetch, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    expect(await bg.tourBoucleGeneration()).toBe(r.generationId);
    expect(appels).toBe(0);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("plafond-atteint");
    const reserve = await gc.lireReserveChaine(r.generationId);
    expect(reserve).toMatchObject({ accepte: false, plafondUsd: 1.5 });
    expect(reserve!.pireCasUsd).toBeGreaterThan(1.5);
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.messagePlafond).toMatch(/jusqu'à \d+,\d\d \$ \(.*€\), plus que le plafond de 1,50 \$ par sujet : rien n'est parti/);
    expect(await depots().notifications.trouver((x) => x.titre === "Écriture non lancée")).toBeTruthy();
    // Les tours suivants n'appellent toujours rien.
    await bg.tourBoucleGeneration();
    expect(appels).toBe(0);
  });

  it("pire cas sous le plafond : réservé, puis RECALCULÉ à chaque tour (correctif après relecture)", async () => {
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await depots().generations.modifier(r.generationId, { plafondUsd: 100 });
    // Exécutant facturé, mais en simulation (aucun réseau) : seule la réservation est vérifiée ici.
    expect(await gc.reserverPireCasChaine(r.generationId, { pireCasRestantUsd: 4 })).toEqual({ ok: true });
    expect(await gc.lireReserveChaine(r.generationId)).toMatchObject({ accepte: true, pireCasUsd: 4 });
    // Recalculée à chaque appel : un pire cas plus haut que le plafond est refusé.
    expect((await gc.reserverPireCasChaine(r.generationId, { pireCasRestantUsd: 500 })).ok).toBe(false);
  });

  it("écriture d'essai (Claude pas branché) : rien n'est réservé ni refusé, elle va au bout", async () => {
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    expect(await gc.lireReserveChaine(r.generationId)).toBeNull();
  });
});

describe("4 · réponse coupée (max_tokens)", () => {
  it("l'écriture s'arrête au premier « coupé », garde le texte brut, dit pourquoi ; rien n'est relancé seul", async () => {
    const r1 = await lancer(0);
    if (!r1.ok) throw new Error("lancement");
    const roles: string[] = [];
    const coupe = (id: string): ExecuteurRoles => ({
      executer: async (role, e) => {
        roles.push(role.id);
        if (role.id === "fond") return { ok: true, texte: '{"appui":"coupé ici', invalide: "JSON illisible", coutUsd: 0.17, modele: "claude-opus-5-5", stopReason: "max_tokens" };
        return gc.executerRoleFacture(id, role, e);
      },
    });
    await bg.tourBoucleGeneration(coupe);
    expect(roles.filter((x) => x === "fond")).toHaveLength(1);
    expect((await depots().generations.obtenir(r1.generationId))?.statut).toBe("echec");
    expect((await bg.ecritureArretee(r1.scriptMaitreId))?.message).toMatch(/coupée avant la fin/);
    expect((await bg.lireEtatChaine(r1.generationId))?.reponseCoupee).toMatchObject({ role: "fond", texte: '{"appui":"coupé ici' });
    await bg.tourBoucleGeneration(coupe);
    expect(roles.filter((x) => x === "fond")).toHaveLength(1);
  }, 30_000);
});

describe("Revue A09 · dettes", () => {
  it("la réserve compte la dépense déjà faite (étapes rejouées comprises), à chaque calcul", async () => {
    // Correctif après relecture : le prix de « Reprendre » est testé dans garde-fous-budget-relecture.
    const g = await nouvelleGeneration();
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 0.4 })).toEqual({ ok: true });
    // Étapes rejouées : 0,9 $ déjà comptés ; 0,9 + 0,4 tient sous 1,50 $, 0,9 + 0,7 non.
    await depots().generations.modifier(g.id, { etapes: [{ role: "fond", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "a1", lanceLe: new Date().toISOString(), estimationPireCasUsd: 0.9 }] });
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 0.4 })).toEqual({ ok: true });
    expect(await gc.lireReserveChaine(g.id)).toMatchObject({ depenseUsd: 0.9 });
    expect((await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 0.7 })).ok).toBe(false);
  });

  it("la chaîne recule (étape plus basse) : le pire cas est recalculé depuis cette étape", async () => {
    const g = await nouvelleGeneration();
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 0.4, etape: 4 })).toEqual({ ok: true });
    // Retour à l'étape 3 (accroches rechoisies) : recalcul, refus au-dessus du plafond.
    const r = await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 9, etape: 3 });
    expect(r.ok).toBe(false);
    expect(await gc.lireReserveChaine(g.id)).toMatchObject({ accepte: false, etape: 3 });
  });

  it("plus aucune phrase « reprendra toute seule » dans l'écriture", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/services/generation-claude.ts", "src/services/boucle-generation.ts"]) expect(readFileSync(f, "utf8")).not.toMatch(/reprendra toute seule|reprendra tout seul/);
  });
});

describe("Écran : « Reprendre (≈ X €) »", () => {
  it("une écriture en attente expose « prête » et le prix estimé de la reprise", async () => {
    const g = await ecritureRefuseeParFacturation();
    await depots().scriptsMaitres.enregistrer({ id: g.scriptMaitreId, brief: { idee: "PV" }, generationId: g.id } as never);
    let e = await bg.etatEcriture(g.scriptMaitreId);
    expect(e).toMatchObject({ statut: "en-attente-credit", preteAReprendre: false });
    await gc.declarerRechargeClaude(1000);
    e = await bg.etatEcriture(g.scriptMaitreId);
    expect(e?.preteAReprendre).toBe(true);
    // Correctif après relecture : sans réglages ni sujet complet, la reprise dit pourquoi au lieu d'un prix.
    expect(e?.reprise).toMatchObject({ possible: false });
    expect(e?.reprise?.raison).toBeTruthy();
  });
});
