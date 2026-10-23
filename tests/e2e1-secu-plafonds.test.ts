/**
 * VÉRIFICATION E2E-1 n° 6, 7 et 8 (03/10) — argent de Claude, sans clé ni réseau (faux `fetch`).
 *  - n° 6 : appels PARALLÈLES d'un même sujet : le plafond du sujet est contrôlé ET réservé d'un seul tenant ;
 *  - n° 7 : appel resté sans réponse (redémarrage) : son pire cas reste compté dans le sujet, sa réservation reste
 *    comptée dans son mois puis est soldée ;
 *  - n° 8 : nouveau mois : une écriture bloquée par la limite du mois ou le budget attend un geste de Will.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { roleSonde } from "@/generateur/roles/sonde";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import type { GenerationScript, LigneCout } from "@/domaine/types";
import { centimes } from "@/lib/montants";
import { cleMois } from "@/lib/dates";

const MDP = "essai-e2e1-secu-plafonds";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

let n = 0;
async function nouvelleGeneration(plafondUsd = 1.5, extra: Partial<GenerationScript> = {}): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-e2e1-${++n}`, scriptMaitreId: `suj-e2e1-${n}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le, ...extra };
  await depots().generations.enregistrer(g);
  return g;
}

/** Claude répond LENTEMENT (50 ms) : tous les appels parallèles passent leurs contrôles avant la première réponse. */
function brancherLent() {
  const appels: string[] = [];
  const f = (async (url: string | URL | Request) => {
    appels.push(String(url));
    await new Promise((r) => setTimeout(r, 50));
    return reponseFlux(fluxReussi({ texte: '{"phrase":"Vous recevez un PV."}' }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };

function moisPrecedent(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 15, 12).toISOString();
}

describe("E2E-1 n° 6 · plafond du sujet : les appels parallèles se voient", () => {
  it("4 appels lancés ensemble sous un plafond qui en permet 2 : 2 partent, 2 s'arrêtent, rien au-delà du plafond", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const appels = brancherLent();
    const r = estimationRealisteRole(roleSonde, entree);
    // L3-01 (audit) : le plafond se contrôle en centimes de dollar entiers, chaque appel au centime supérieur (r < 1 c$
    // compte 1 c$) : un plafond de 2 c$ en permet exactement 2.
    expect(Math.ceil(r * 100)).toBe(1);
    const g = await nouvelleGeneration(0.02);
    const res = await Promise.all([1, 2, 3, 4].map(() => gc.executerRoleFacture(g.id, roleSonde, entree)));
    expect(res.filter((x) => x.ok)).toHaveLength(2);
    expect(res.filter((x) => !x.ok && x.arret === "plafond-atteint")).toHaveLength(2);
    // Avant la correction, les 4 lisaient la même dépense (0) et partaient tous.
    expect(appels).toHaveLength(2);
  });

  it("aucune réservation oubliée : un appel arrêté par la limite du mois rend sa place dans le plafond du sujet", async () => {
    await credits.declarerRecharge("anthropic", 500);
    brancherLent();
    const r = estimationRealisteRole(roleSonde, entree);
    // L3-01 (audit) : plafond en centimes entiers ; un appel (r < 1 c$) y compte 1 c$, la place entière du sujet.
    const g = await nouvelleGeneration(0.01);
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const res = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(res).toMatchObject({ ok: false, arret: "en-attente-credit" });
    // Toute la place du sujet est encore libre.
    expect(await gc.reserverDansPlafondSujet(g.id, "sonde-test", r * 1.5)).toEqual({ ok: true });
  });
});

describe("E2E-1 n° 7 · appel resté sans réponse (redémarrage pendant l'appel)", () => {
  it("pire cas compté dans le sujet ; réservation gardée dans son mois, soldée au mois suivant ; une ligne au journal", async () => {
    const le = new Date().toISOString();
    const g = await nouvelleGeneration(1.5, {
      etapes: [
        { role: "fond", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "appel-ancien", lanceLe: moisPrecedent(), estimationPireCasUsd: 0.4 },
        { role: "plan", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "appel-recent", lanceLe: le, estimationPireCasUsd: 0.3 },
      ],
    });
    const base = { fournisseur: "anthropic", videoId: g.scriptMaitreId, devise: "USD" as const, statut: "active" as const };
    await depots().reservations.enregistrer({ id: "res-ancienne", travailId: "appel-ancien", centimes: 48, ...base, creeLe: moisPrecedent(), modifieLe: moisPrecedent() });
    await depots().reservations.enregistrer({ id: "res-recente", travailId: "appel-recent", centimes: 36, ...base, creeLe: le, modifieLe: le });

    expect(await gc.solderAppelsInterrompus()).toBe(1);
    expect((await depots().reservations.obtenir("res-ancienne"))!.statut).toBe("consommee");
    // Celle du mois en cours reste comptée dans la limite du mois (l'appel a pu être facturé).
    expect((await depots().reservations.obtenir("res-recente"))!.statut).toBe("active");
    // Le sujet garde le pire cas des deux appels : un rejeu ne peut pas dépasser son plafond.
    expect(gc.depenseGenerationUsd((await depots().generations.obtenir(g.id))!)).toBeCloseTo(0.7, 6);
    // Rejouable sans effet ; le journal ne le dit qu'une fois.
    expect(await gc.solderAppelsInterrompus()).toBe(0);
    const journal = (await depots().evenements.lister()).filter((j) => j.message.includes("resté sans réponse"));
    expect(journal).toHaveLength(2);
  });

  it("la boucle (reprise) solde aussi les appels interrompus à chaque tour", async () => {
    await nouvelleGeneration(1.5, { etapes: [{ role: "fond", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "appel-x", lanceLe: moisPrecedent(), estimationPireCasUsd: 0.4 }] });
    await depots().reservations.enregistrer({ id: "res-x", fournisseur: "anthropic", travailId: "appel-x", centimes: 48, devise: "USD", statut: "active", creeLe: moisPrecedent(), modifieLe: moisPrecedent() });
    await gc.reprendreGenerationsEnAttenteCredit();
    expect((await depots().reservations.obtenir("res-x"))!.statut).toBe("consommee");
  });
});

describe("E2E-1 n° 8 · nouveau mois : la reprise attend un geste de Will (garde-fous du 15/10 : toujours)", () => {
  const lignes: LigneCout[] = [{ etape: "Écriture · fond", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: centimes(1), total: centimes(1), nature: "estime" }];

  /** Écriture bloquée le mois dernier par la limite du mois ; crédit Claude déclaré AVANT le blocage. */
  async function bloqueeLeMoisDernier(motif: "plafond-mensuel" | "budget" | "credit" = "plafond-mensuel") {
    await credits.declarerRecharge("anthropic", 500);
    for (const r of await depots().recharges.lister()) await depots().recharges.modifier(r.id, { date: new Date(Date.now() - 62 * 86_400_000).toISOString() });
    const g = await nouvelleGeneration(1.5, { statut: "en-attente-credit" });
    await ecrireParametre(`generateur.attenteCredit.${g.id}`, { depuis: moisPrecedent(), motif, estimationUsd: 0.05, lignes, message: "Limite Claude du mois atteinte (100,00 $).", plafondUsd: 100, budgetCentimes: 15000 });
    return g;
  }

  async function notifications() {
    return (await depots().notifications.lister()).filter((x) => x.titre === "Une écriture peut reprendre");
  }

  it("la limite du mois n'a pas bougé : l'écriture NE repart PAS seule ; Will est prévenu une seule fois", async () => {
    const g = await bloqueeLeMoisDernier();
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
    const notes = await notifications();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "credit", lien: `/ecrire/sujets/${g.scriptMaitreId}` });
    expect((await lireParametre<{ prete?: string }>(`generateur.attenteCredit.${g.id}`, {})).prete?.slice(0, 7)).toBe(cleMois());
  });

  it("geste de Will (« relancer ») : l'écriture repart", async () => {
    const g = await bloqueeLeMoisDernier();
    expect(await gc.relancerEcrituresEnAttente()).toEqual([g.id]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-cours");
  });

  it("limite relevée depuis le blocage : « prête », elle ne repart pas sans le geste de Will (garde-fous du 15/10)", async () => {
    const g = await bloqueeLeMoisDernier();
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 150);
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect(await gc.ecriturePreteAReprendre(g.id)).toBe(true);
    expect(await gc.relancerEcrituresEnAttente()).toEqual([g.id]);
  });

  it("limite ré-enregistrée dans Réglages (même valeur) : « prête » seulement, rien ne repart (garde-fous du 15/10)", async () => {
    const g = await bloqueeLeMoisDernier();
    expect(await gc.definirPlafondMensuelClaude(100)).toEqual([]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
  });

  it("budget du studio et motif « crédit » : même règle, aucune reprise seule (garde-fous du 15/10)", async () => {
    const b = await bloqueeLeMoisDernier("budget");
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect((await depots().generations.obtenir(b.id))!.statut).toBe("en-attente-credit");
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    const c = await bloqueeLeMoisDernier("credit");
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect(await gc.ecriturePreteAReprendre(c.id)).toBe(true);
  });

  it("dans le même mois, une place qui se libère : « prête », rien ne repart seul (garde-fous du 15/10)", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const g = await nouvelleGeneration(1.5, { statut: "en-attente-credit" });
    await ecrireParametre(`generateur.attenteCredit.${g.id}`, { depuis: new Date().toISOString(), motif: "plafond-mensuel", estimationUsd: 0.05, lignes, message: "x", plafondUsd: 100, budgetCentimes: 15000 });
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect(await gc.relancerEcrituresEnAttente()).toEqual([g.id]);
  });
});
