/**
 * SECONDE RELECTURE PAQUET 4 — restes R1 à R4 de la lentille EXACTITUDE (docs/controles/RERELECTURE-PAQUET4.md, § 1.3).
 * Chacun était ROUGE sur 36a80df.
 *  - R1 : `executerRoleFacture` refuse sans le verrou de la boucle (verrou perdu en plein tour : plus aucun appel).
 *  - R2 : au-delà du seuil, seul un MONTANT couvre un prix (`true` ne couvre plus un prix > seuil).
 *  - R3 : une écriture « en-cours » d'avant le champ `essai`, sans étape, passe en essai si Claude n'est pas branché à la
 *    reprise (elle ne partira jamais en réel sans prix ni accord).
 *  - R4 : la taille du plan de série (`partirontConfirme`) est exigée dès qu'il y a une confirmation.
 * Aucun réseau, aucune clé : Claude « branché » répond par un faux `fetch` (réponses enregistrées).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const couts = await import("@/services/couts");
const boucle = await import("@/services/boucle");
const credits = await import("@/services/credits");
const serie = await import("@/services/serie-ecriture");
const { ecrireParametre } = await import("@/services/_commun");
const { accordCouvre } = await import("@/domaine/accord");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { roleSonde } from "@/generateur/roles/sonde";
import { ROLES_ECRITURE } from "@/generateur/roles";
import type { GenerationScript } from "@/domaine/types";

const MDP = "paquet4-rerelecture-exactitude";
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail"];
const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  await ecrireParametre("generateur.chaine", "complete");
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  boucle.etatBoucle().verrouTenu = undefined;
});

/** Claude « branché » : un faux `fetch` qui répond (sans réseau) et compte les appels ; budget et plafonds larges. */
async function brancherClaude(reponse: () => Response = () => reponseFlux(fluxReussi({ texte: '{"phrase":"Vous recevez un PV."}' }))) {
  await ecrireParametre("fournisseur.script", "claude");
  const f = fauxFetch([reponse]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
  await credits.declarerRecharge("anthropic", 500);
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + 1_000_000, devise: "EUR" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
  return f;
}

let n = 0;
async function nouvelleGeneration(patch: Partial<GenerationScript> = {}): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-r-${++n}`, scriptMaitreId: `suj-r-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le, ...patch };
  await depots().generations.enregistrer(g);
  return g;
}

/* ------------------------------------------------------------------ */
describe("R1 · verrou de la boucle perdu en plein tour : plus aucun appel payé", () => {
  it("le 1er rôle part (verrou tenu), le verrou tombe, le rôle suivant ne part pas : rien n'est payé, l'écriture reste « en-cours »", async () => {
    const f = await brancherClaude();
    const g = await nouvelleGeneration({ essai: false });
    boucle.etatBoucle().verrouTenu = true;
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree)).ok).toBe(true);
    expect(f.appels).toHaveLength(1);
    // `perdu()` : coupure de la connexion du verrou pendant le tour.
    boucle.etatBoucle().verrouTenu = false;
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "verrou-perdu" });
    expect(f.appels).toHaveLength(1);
    const apres = await depots().generations.obtenir(g.id);
    expect(apres?.etapes).toHaveLength(1);
    // L'instance qui tient le verrou la reprendra : ni attente de crédit, ni échec.
    expect(apres?.statut).toBe("en-cours");
    expect(await depots().reservations.compter((x) => x.statut === "active")).toBe(0);
  });

  it("tour de boucle réel : le verrou tombe pendant le 1er appel, la chaîne s'arrête net (1 seul appel)", async () => {
    let appels = 0;
    await brancherClaude();
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      attenteMs: () => 0,
      fetch: (async (_url: unknown, init?: RequestInit) => {
        appels++;
        boucle.etatBoucle().verrouTenu = false;
        // Réponse valide du stratège : sans la garde, la chaîne passerait au rôle suivant (nouvel appel payé).
        // Garde-fous budget (15/10) : une réponse illisible n'est plus reprise par défaut, elle arrêterait la chaîne.
        const contenu = (JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string | { text?: string }[] }[] }).messages?.[0]?.content;
        const variable = typeof contenu === "string" ? contenu : (contenu ?? []).map((x) => x.text ?? "").join("\n");
        return reponseFlux(fluxReussi({ texte: JSON.stringify(ROLES_ECRITURE.stratege.simuler({ contexte: {}, variable })) }));
      }) as typeof fetch,
    });
    boucle.etatBoucle().verrouTenu = true;
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await bg.tourBoucleGeneration();
    expect(appels).toBe(1);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("en-cours");
  });

  it("une retouche (demandée par Will sur cette instance) n'est pas concernée : elle ne passe pas par la boucle", async () => {
    const f = await brancherClaude();
    const g = await nouvelleGeneration({ essai: false, portee: "retouche" });
    boucle.etatBoucle().verrouTenu = false;
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree)).ok).toBe(true);
    expect(f.appels).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
describe("R2 · au-delà du seuil, seul un MONTANT couvre un prix", () => {
  const total = { centimes: 250, devise: "EUR" as const };
  const lignes = [{ etape: "Essai", fournisseur: "simulation", unite: "appel" as const, quantite: 1, prixUnitaire: total, total, nature: "estime" as const }];

  it("accordCouvre : `true` ne couvre plus un prix au-dessus du seuil ; un montant suffisant, si", () => {
    expect(accordCouvre(true, 250, 100)).toBe(false);
    expect(accordCouvre(true, 80, 100)).toBe(true);
    expect(accordCouvre(250, 250, 100)).toBe(true);
    expect(accordCouvre(249, 250, 100)).toBe(false);
  });

  it("garde commune : `true` au-delà du seuil → CONFIRMATION_REQUISE avec le montant ; le montant passe", async () => {
    await ecrireParametre("budget.seuilConfirmation", { centimes: 100, devise: "EUR" });
    const err = await credits.verifierBudgetEtCredits({ lignes, total }, true, "Cette vidéo").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    await expect(credits.verifierBudgetEtCredits({ lignes, total }, 250, "Cette vidéo")).resolves.toBeUndefined();
  });

  it("sous le seuil, `true` reste accepté (question sans prix à confirmer)", async () => {
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000, devise: "EUR" });
    await expect(credits.verifierBudgetEtCredits({ lignes, total }, true, "Cette vidéo")).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · écriture d'avant le champ `essai`, sans étape : essai si Claude n'est pas branché à la reprise", () => {
  it("reprise sans Claude → marquée essai ; Claude relié ensuite → 0 appel, elle finit en essai", async () => {
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Écriture enregistrée AVANT le déploiement : ni `essai`, ni étape.
    await depots().generations.modifier(r.generationId, { essai: undefined });
    expect((await depots().generations.obtenir(r.generationId))?.essai).toBeUndefined();
    // Reprise (premier tour après le démarrage), Claude pas branché : rien n'avance (aucun rôle exécuté).
    await bg.tourBoucleGeneration(() => ({ executer: async () => ({ ok: false, arret: "en-attente-credit", message: "essai" }) }));
    const g = await depots().generations.obtenir(r.generationId);
    expect(g?.etapes).toHaveLength(0);
    expect(g?.essai).toBe(true);
    // Will relie Claude : l'écriture reste en essai jusqu'au bout.
    const f = await brancherClaude();
    for (let i = 0; i < 3; i++) await bg.tourBoucleGeneration();
    expect(f.appels).toHaveLength(0);
    expect(gc.ecritureEnEssai((await depots().generations.obtenir(r.generationId))!)).toBe(true);
  });

  it("une écriture lancée en réel (Claude branché) porte `essai: false` : débrancher Claude ne la change pas", async () => {
    await brancherClaude();
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await depots().generations.obtenir(r.generationId))?.essai).toBe(false);
    gc.injecterClaudePourEssai(null);
    await ecrireParametre("fournisseur.script", "simulation");
    await gc.marquerEcrituresAnciennesEnEssai();
    expect((await depots().generations.obtenir(r.generationId))?.essai).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe("R4 · série : la taille du plan est exigée dès qu'il y a une confirmation", () => {
  it("total suffisant SANS taille du plan → CONFIRMATION_REQUISE, rien n'est créé ; avec la bonne taille → la série part", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: prix, devise: "EUR" });
    const textes = IDEES.slice(0, 2);
    await expect(serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-rerelecture-r4", 100 * prix)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 2 * prix });
    expect(await depots().generations.compter((g) => !g.estDemo)).toBe(0);
    const { serie: s } = await serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-rerelecture-r4", 2 * prix, 2);
    expect(s.elements.some((e) => e.sort === "parti")).toBe(true);
  });
});
