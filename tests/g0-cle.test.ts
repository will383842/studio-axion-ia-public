/**
 * G0 — LA CLÉ CLAUDE NE SORT JAMAIS (plan v5 B.3.8) : recherche du motif `sk-ant-` dans les réponses, les erreurs, les
 * journaux, les générations, les paramètres, les notifications, TOUTES les collections et la sortie console, après des
 * appels dont l'API renvoie la clé dans ses messages d'erreur (pire cas). Plus le `beforeSend` prêt pour Sentry.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseErreur, reponseFlux, type EvenementSse } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, essayer } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { contientCle, masquerSecrets, nettoyerEvenementSentry } from "@/fournisseurs/claude/secret";
import { classerErreur } from "@/fournisseurs/claude/client";
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript } from "@/domaine/types";

const MDP = "essai-g0-cle";
/** Le motif cherché : toute clé Anthropic, pas seulement celle du studio. */
const MOTIF = /sk-ant-/;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const sorties: string[] = [];
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE })], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await credits.declarerRecharge("anthropic", 500);
  sorties.length = 0;
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      sorties.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
  }
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.restoreAllMocks();
});

async function nouvelleGeneration(id: string): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id, scriptMaitreId: `suj-${id}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

/** Tout ce que le studio a rangé, sérialisé : aucune collection n'échappe à la recherche. */
async function toutLeStockage(): Promise<string> {
  const d = depots() as unknown as Record<string, { lister?: () => Promise<unknown[]> }>;
  const morceaux: string[] = [];
  for (const [nom, depot] of Object.entries(d)) {
    if (typeof depot?.lister === "function") morceaux.push(`${nom}:${JSON.stringify(await depot.lister())}`);
  }
  expect(morceaux.length).toBeGreaterThan(20);
  return morceaux.join("\n");
}

describe("G0 · masquage de la clé (motif sk-ant-)", () => {
  it("l'API renvoie la clé dans ses erreurs (401, 400, flux) : ni réponse, ni erreur, ni stockage, ni console ne la contient", async () => {
    const fuite = `invalid x-api-key: ${CLE_ESSAI_CLAUDE}`;
    const fluxFuite: EvenementSse[] = [...fluxReussi({ texte: "x" }).slice(0, 2), ["error", { type: "error", error: { type: "api_error", message: fuite } }]];
    const { fetch, appels } = fauxFetch([
      () => reponseErreur(401, "authentication_error", fuite),
      () => reponseErreur(400, "invalid_request_error", fuite),
      () => reponseFlux(fluxFuite),
      () => reponseFlux(fluxFuite),
      () => reponseFlux(fluxFuite),
      () => reponseFlux(fluxReussi({ texte: `{"phrase":"rien"}` })),
    ]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch, attenteMs: () => 0 });

    const resultats: unknown[] = [];
    for (const id of ["gen-cle-1", "gen-cle-2", "gen-cle-3", "gen-cle-4"]) {
      await nouvelleGeneration(id);
      // `essayer` : la forme exacte de ce que reçoit l'écran (message, code).
      resultats.push(await essayer(() => gc.executerRoleFacture(id, roleSonde, { contexte: {}, variable: "x" })));
    }
    expect(appels.length).toBe(6);
    // La clé est bien partie dans l'en-tête (et seulement là).
    expect(appels.every((a) => a.entetes["x-api-key"] === CLE_ESSAI_CLAUDE && !MOTIF.test(JSON.stringify(a.corps)))).toBe(true);
    expect(resultats.filter((r) => (r as { ok: boolean }).ok === false).length).toBe(3);

    const texte = [JSON.stringify(resultats), await toutLeStockage(), ...sorties].join("\n");
    expect(MOTIF.test(texte)).toBe(false);
    expect(texte).not.toContain(CLE_ESSAI_CLAUDE.slice(10));
    // L'écran garde un message utile.
    expect(JSON.stringify(resultats[0])).toContain("Claude refuse la clé du studio");
  });

  it("masquerSecrets : la clé connue ET toute autre clé Anthropic (admin comprise)", () => {
    const t = masquerSecrets(`a ${CLE_ESSAI_CLAUDE} b sk-ant-admin01-AUTRE_cle-xyz c`, [CLE_ESSAI_CLAUDE]);
    expect(contientCle(t)).toBe(false);
    expect(t).toContain("a ");
    expect(classerErreur(400, "invalid_request_error", `bad ${CLE_ESSAI_CLAUDE}`).message).not.toMatch(MOTIF);
  });

  it("beforeSend Sentry (prêt pour le jour où Sentry entre) : sans en-têtes, corps, cookies ; textes masqués ; original intact", () => {
    const ev = {
      message: `échec ${CLE_ESSAI_CLAUDE}`,
      request: { url: "https://studio.axion-ia.com/x", headers: { "x-api-key": CLE_ESSAI_CLAUDE }, data: { cle: CLE_ESSAI_CLAUDE }, cookies: { s: "1" }, query_string: "k=1" },
      exception: { values: [{ value: `Claude : ${CLE_ESSAI_CLAUDE}` }] },
      breadcrumbs: [{ message: `fetch ${CLE_ESSAI_CLAUDE}` }],
    };
    const propre = nettoyerEvenementSentry(ev);
    expect(MOTIF.test(JSON.stringify(propre))).toBe(false);
    expect(propre.request).toEqual({ url: "https://studio.axion-ia.com/x" });
    expect(ev.request.headers["x-api-key"]).toBe(CLE_ESSAI_CLAUDE);
  });
});
