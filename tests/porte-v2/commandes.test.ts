/**
 * Porte v2, appel 1 : recevoir une commande de l'usine (POST /api/usine/commandes). Dépôts en mémoire, aucun réseau,
 * secrets d'essai, données fictives. Contrat écrit dans la fiche : rejeu sans doublon, excédent de quota mis de côté,
 * refus si « Tout arrêter » est actif ; porte fermée par défaut ; aucun envoi.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { POST } = await import("@/app/api/usine/commandes/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest("http://studio.test/api/usine/commandes", { method: "POST", headers: h, body: JSON.stringify(corps) });
}
const commande = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "cmd-essai-0001", reseau: "linkedin", jour: "2026-12-10", instant: "2026-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive", ...extra,
});

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
  it("sans secret du studio : 404, rien n'est écrit", async () => {
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    const r = await POST(appel(commande()));
    expect(r.status).toBe(404);
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("sans jeton : 401", async () => {
    expect((await POST(appel(commande(), null))).status).toBe(401);
  });
});

describe("recevoir une commande", () => {
  it("crée UN créneau « propose » (jamais programmé ni publié) et ne part nulle part", async () => {
    const r = await POST(appel(commande()));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ etat: "recue", deja: false });
    const l = await depots().creneauxEditoriaux.lister();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ statut: "propose", origine: "usine", jourVise: "2026-12-10" });
  });

  it("un rejeu de la même commande ne crée aucun doublon", async () => {
    await POST(appel(commande()));
    const r = await POST(appel(commande()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "recue", deja: true });
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(1);
  });

  it("refuse un champ invalide ou inconnu", async () => {
    expect((await POST(appel(commande({ reseau: "inconnu" })))).status).toBe(400);
    expect((await POST(appel(commande({ instant: "demain" })))).status).toBe(400);
    expect((await POST(appel(commande({ cle: "x" })))).status).toBe(400);
    expect((await POST(appel(commande({ videoId: "v", visuelId: "i" })))).status).toBe(400);
    expect((await POST(appel(commande({ surprise: 1 })))).status).toBe(400);
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(0);
  });
});

describe("excédent de quota", () => {
  it("la commande en trop est mise de côté (aucun créneau), et le rejeu ne la double pas", async () => {
    await POST(appel(commande()));
    const autre = commande({ cle: "cmd-essai-0002", instant: "2026-12-10T15:00:00.000Z" });
    const r = await POST(appel(autre));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ etat: "mise_de_cote", deja: false });
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(1);
    const rejeu = await POST(appel(autre));
    expect(await rejeu.json()).toEqual({ etat: "mise_de_cote", deja: true });
    const cotes = (await depots().parametres.lister()).filter((p) => p.id.startsWith("usine-commande-cote:"));
    expect(cotes).toHaveLength(1);
  });
});

describe("« Tout arrêter »", () => {
  it.each(["1", "true", "oui", "n'importe quoi"])("actif (%s) : commande refusée, rien n'est écrit", async (v) => {
    vi.stubEnv("USINE_TOUT_ARRETER", v);
    const r = await POST(appel(commande()));
    expect(r.status).toBe(423);
    expect((await r.json()).code).toBe("tout_arrete");
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(0);
    expect((await depots().parametres.lister()).filter((p) => p.id.startsWith("usine-commande-cote:"))).toHaveLength(0);
  });
  it.each(["", "0", "false", "non"])("éteint (%s) : la commande passe", async (v) => {
    vi.stubEnv("USINE_TOUT_ARRETER", v);
    expect((await POST(appel(commande()))).status).toBe(201);
  });
});
