/**
 * FIN-9 · ARGENT · la rédaction des guides reçoit l'origine de son appelant réel (jamais `undefined`, jamais écrite en dur
 * dans le fournisseur). Vraies dépendances (base en mémoire, brique Crédits, chemin gardé) ; Claude DOUBLÉ par un faux `fetch`
 * (fausse clé, aucun réseau, aucun appel payant) :
 *  (1) l'origine de la rédaction (« studio », seule entrée : l'action Studio) arrive à `verifierEtReserverSelonOrigine` (espion) ;
 *  (2) « usine » sans budget reçu : refus `BUDGET_USINE_ABSENT` (donc « credit_insuffisant »), Claude non appelé ;
 *  (3) limite du mois dépassée : refus AVANT la réservation (l'espion n'est pas appelé), Claude non appelé ;
 *  (4) le paramètre est obligatoire dans les trois maillons (garde de source).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { appelerClaudeRedaction, RefusArgentRedaction, PREFIXE_APPEL_REDACTION_GUIDE } = await import("@/fournisseurs/claude/appel-redaction");
const { redigerGuide } = await import("@/services/guides-fabrique");
const { redigerBrouillonGuide, ORIGINE_GUIDES } = await import("@/services/guides-redaction");

const contenuBon = { titre: "Réussir son premier essai", sections: [{ titre: "Préparer", paragraphes: ["Vous commencez par relire le sujet."], puces: ["Un point"] }] };
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

let appels = 0;
function brancherClaude() {
  appels = 0;
  const f = (async () => {
    appels += 1;
    return reponseFlux(fluxReussi({ texte: JSON.stringify(contenuBon), modele: "claude-sonnet-5-5", entree: 900, cacheEcrit: 0, sortie: 1200 }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}
const reservationsGuide = () => depots().reservations.lister((r) => !!r.travailId?.startsWith(`${PREFIXE_APPEL_REDACTION_GUIDE}-`));
const REQUETE = { modele: "claude-sonnet-5-5", maxTokens: 8000, effort: "medium" as const, systeme: [{ texte: "Consigne" }], messages: [{ role: "user" as const, contenu: "Mot du guide : essai" }], json: true as const };

const MDP = "essai-fin9-guides-origine";
beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
  await ecrireParametre("fournisseur.script", "claude");
  vi.stubEnv("GUIDES_REDACTION_ENABLED", "true");
  vi.stubEnv("GUIDES_FABRIQUE_ECRAN", "true");
  brancherClaude();
});
afterEach(() => {
  vi.restoreAllMocks();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllEnvs();
});

describe("FIN-9 · (1) l'origine de l'appelant arrive à la garde d'argent", () => {
  it("le geste « Rédiger » (point d'entrée de l'action Studio) passe « studio » : l'espion le voit, jamais `undefined`", async () => {
    const espion = vi.spyOn(credits, "verifierEtReserverSelonOrigine");
    const r = await redigerGuide("essai");
    expect(r).toMatchObject({ ok: true, version: 1 });
    expect(espion).toHaveBeenCalledTimes(1);
    expect(espion.mock.calls[0]![0]).toBe("studio");
  });

  it("appelerClaudeRedaction transmet l'origine reçue telle quelle (« usine » aussi)", async () => {
    const espion = vi.spyOn(credits, "verifierEtReserverSelonOrigine").mockRejectedValue(new (await import("@/services/_commun")).ErreurStudio("BUDGET_USINE_ABSENT", "x"));
    await expect(appelerClaudeRedaction(REQUETE, "cle", "usine")).rejects.toBeInstanceOf(RefusArgentRedaction);
    expect(espion.mock.calls[0]![0]).toBe("usine");
    expect(appels).toBe(0);
  });
});

describe("FIN-9 · (2) « usine » sans budget reçu : rien ne part", () => {
  it("BUDGET_USINE_ABSENT → refus « credit », Claude non appelé, aucune réservation", async () => {
    await expect(appelerClaudeRedaction(REQUETE, "cle", "usine")).rejects.toMatchObject({ refusArgent: true, motif: "credit" });
    expect(appels).toBe(0);
    expect(await reservationsGuide()).toEqual([]);
  });
});

describe("FIN-9 · (3) limite du mois dépassée : refus avant toute réservation", () => {
  it.each(["studio", "usine"] as const)("origine %s : refus « plafond-mois », la réservation n'est même pas tentée, Claude non appelé", async (origine) => {
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    const espion = vi.spyOn(credits, "verifierEtReserverSelonOrigine");
    await expect(appelerClaudeRedaction(REQUETE, "cle", origine)).rejects.toMatchObject({ refusArgent: true, motif: "plafond-mois" });
    expect(espion).not.toHaveBeenCalled();
    expect(appels).toBe(0);
    expect(await reservationsGuide()).toEqual([]);
  });

  it("par le geste « Rédiger » : « plafond_atteint », Claude non appelé", async () => {
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    expect(await redigerBrouillonGuide("essai")).toEqual({ ok: false, raison: "plafond_atteint" });
    expect(appels).toBe(0);
  });
});

describe("FIN-9 · (4) paramètre obligatoire du fournisseur, « studio » nommé une seule fois dans le service", () => {
  const lire = (f: string) => readFileSync(f, "utf8");
  it("appelerClaudeRedaction déclare l'origine sans `?` ni valeur par défaut", () => {
    expect(lire("src/fournisseurs/claude/appel-redaction.ts")).toMatch(/_cle: string, origine: OrigineLancement\)/);
  });
  it("aucun littéral d'origine dans le fournisseur ; une constante nommée dans guides-redaction", () => {
    const f = lire("src/fournisseurs/claude/appel-redaction.ts");
    expect(f).not.toMatch(/verifierEtReserverSelonOrigine\(\s*(undefined|["'])/);
    expect(f).not.toMatch(/OrigineLancement\s*=\s*["']/);
    expect(ORIGINE_GUIDES).toBe("studio");
    expect(lire("src/services/guides-redaction.ts")).toMatch(/ORIGINE_GUIDES: OrigineLancement = "studio"/);
  });
});
