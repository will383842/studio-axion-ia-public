/**
 * Porte v2, appel 2 : lire l'état d'une commande (POST /api/usine/commandes/<clé>, lecture seule). Dépôts en mémoire,
 * aucun réseau, secrets d'essai, données fictives. Contrat : jeton obligatoire (porte fermée par défaut), état et dates
 * seulement (ni texte de publication, ni donnée de personne), commande inconnue « introuvable », aucune écriture.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const commandes = await import("@/app/api/usine/commandes/route");
const lecture = await import("@/app/api/usine/commandes/[id]/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
function envoyer(corps: unknown): NextRequest {
  return new NextRequest("http://studio.test/api/usine/commandes", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` }, body: JSON.stringify(corps) });
}
function lire(id: string, secret: string | null = SECRET, corps: unknown = { contrat: 2 }): Promise<Response> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  const requete = new NextRequest(`http://studio.test/api/usine/commandes/${id}`, { method: "POST", headers: h, body: JSON.stringify(corps) });
  return lecture.POST(requete, { params: Promise.resolve({ id }) });
}
const commande = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "cmd-essai-0001", reseau: "linkedin", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive", ...extra,
});
async function instantane(): Promise<string> {
  const d = depots();
  return JSON.stringify([await d.creneauxEditoriaux.lister(), await d.parametres.lister(), await d.journalDecalages.lister()]);
}

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
});

describe("porte fermée par défaut", () => {
  it("sans secret du studio : 404 ; sans jeton : 401", async () => {
    await commandes.POST(envoyer(commande()));
    expect((await lire("cmd-essai-0001", null)).status).toBe(401);
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await lire("cmd-essai-0001")).status).toBe(404);
  });
  it("un mauvais jeton est refusé", async () => {
    expect((await lire("cmd-essai-0001", "x".repeat(40))).status).toBe(401);
  });
});

describe("lire l'état d'une commande", () => {
  it("commande reçue : état « recue » et ses dates, rien d'autre", async () => {
    await commandes.POST(envoyer(commande()));
    const r = await lire("cmd-essai-0001");
    expect(r.status).toBe(200);
    const corps = await r.json();
    expect(corps).toEqual({ etat: "recue", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z" });
    expect(JSON.stringify(corps)).not.toMatch(/compte-fictif|v-fictive|linkedin/);
  });

  it("commande mise de côté", async () => {
    await commandes.POST(envoyer(commande()));
    await commandes.POST(envoyer(commande({ cle: "cmd-essai-0002", instant: "2099-12-10T15:00:00.000Z" })));
    const r = await lire("cmd-essai-0002");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "mise_de_cote", jour: "2099-12-10", instant: "2099-12-10T15:00:00.000Z" });
  });

  it.each([
    ["a_valider", "a_valider"],
    ["programme", "programmee"],
    ["publie", "publiee"],
  ] as const)("créneau au statut %s : état %s", async (statut, etat) => {
    await commandes.POST(envoyer(commande()));
    const c = (await depots().creneauxEditoriaux.lister())[0];
    await depots().creneauxEditoriaux.enregistrer({ ...c, statut });
    const corps = await (await lire("cmd-essai-0001")).json();
    expect(corps.etat).toBe(etat);
  });

  it("commande refusée : état « refusee » et la date du refus, sans le motif", async () => {
    await commandes.POST(envoyer(commande()));
    const c = (await depots().creneauxEditoriaux.lister())[0];
    await depots().creneauxEditoriaux.enregistrer({ ...c, statut: "archive", refuseLe: "2099-12-01T10:00:00.000Z", motifRefus: "motif-secret-fictif" });
    const corps = await (await lire("cmd-essai-0001")).json();
    expect(corps).toEqual({ etat: "refusee", jour: "2099-12-10", instant: "2099-12-10T08:30:00.000Z", refuseLe: "2099-12-01T10:00:00.000Z" });
    expect(JSON.stringify(corps)).not.toContain("motif-secret-fictif");
  });

  it("commande inconnue : 404 « introuvable » ; identifiant mal formé : 404 aussi", async () => {
    const r = await lire("cmd-absente-0001");
    expect(r.status).toBe(404);
    expect((await r.json()).code).toBe("introuvable");
    expect((await lire("../secret")).status).toBe(404);
  });
});

describe("lecture seule", () => {
  it("les données sont identiques avant et après l'appel", async () => {
    await commandes.POST(envoyer(commande()));
    await commandes.POST(envoyer(commande({ cle: "cmd-essai-0002", instant: "2099-12-10T15:00:00.000Z" })));
    const avant = await instantane();
    for (const id of ["cmd-essai-0001", "cmd-essai-0002", "cmd-absente-0001"]) await lire(id);
    expect(await instantane()).toBe(avant);
  });
  it("refuse un champ inconnu dans le corps", async () => {
    expect((await lire("cmd-essai-0001", SECRET, { contrat: 2, surprise: 1 })).status).toBe(400);
  });
});
