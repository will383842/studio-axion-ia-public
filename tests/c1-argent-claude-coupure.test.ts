/**
 * CORRECTEUR 1 (argent) — « Écriture Claude coupée après l'envoi » : une coupure réseau ou un délai dépassé APRÈS
 * l'envoi peut avoir été facturé par Claude. La réservation n'est plus rendue comme si rien n'avait été payé : elle
 * reste comptée (même règle que les textes de publication, `depense-claude-video.ts`). Un refus net (erreur 400), lui,
 * rend la réservation. Faux `fetch`, fausse clé, aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseErreur } from "./helpers/g0";
import type { GenerationScript } from "@/domaine/types";
import { roleSonde } from "@/generateur/roles/sonde";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");

const MDP = "c1-argent-claude-coupure";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await credits.declarerRecharge("anthropic", 500);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

let n = 0;
async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-c1-${++n}`, scriptMaitreId: `suj-c1-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };

async function reservationsDeLAppel() {
  return depots().reservations.lister((r) => (r.travailId ?? "").startsWith("appel"));
}

describe("Écriture Claude coupée après l'envoi", () => {
  it("coupure réseau après l'envoi : la réservation reste comptée (pas « libérée » comme si rien n'était payé)", async () => {
    const coupe = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: coupe, attenteMs: () => 0 });
    const g = await nouvelleGeneration();
    const err = await gc.executerRoleFacture(g.id, roleSonde, entree).catch((e) => e);
    expect(err).toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    const res = await reservationsDeLAppel();
    expect(res).toHaveLength(1);
    expect(res[0].statut).toBe("active");
  });

  it("refus net (erreur 400) : rien n'a été produit, la réservation est rendue", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => reponseErreur(400, "invalid_request_error", "demande mal formée")) as typeof fetch, attenteMs: () => 0 });
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    const res = await reservationsDeLAppel();
    expect(res).toHaveLength(1);
    expect(res[0].statut).toBe("liberee");
  });
});
