/**
 * L6-06 : porte de l'usine pour commander des visuels sous quota de QUANTITÉS (POST /api/usine/visuels).
 * Dépôts en mémoire, secrets d'essai, données fictives, AUCUN appel réseau ni fournisseur (fetch espionné).
 * CORRECTIF du 11/11 : quota par jour ou par semaine, par réseau et par type ; l'excédent est MIS DE CÔTÉ
 * (débloquable d'un clic), jamais refusé ; aucun montant, jamais de 402.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const { CLE_QUOTAS_USINE } = await import("@/services/plafond-fournisseur");
const { POST } = await import("@/app/api/usine/visuels/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest("http://studio.test/api/usine/visuels", { method: "POST", headers: h, body: JSON.stringify(corps) });
}
const commande = (extra: Record<string, unknown> = {}) => ({ contrat: 2, cle: "visuel-essai-0001", reseau: "instagram", type: "image", ...extra });
const MONTANT = /€|eur\b|euro|cent|prix|\$|\d\s?(?:€|usd)/i;

let fetchEspion: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
  fetchEspion = vi.fn(async () => {
    throw new Error("aucun appel réseau attendu");
  });
  vi.stubGlobal("fetch", fetchEspion);
  await ecrireParametre(CLE_QUOTAS_USINE, [{ periode: "jour", reseau: "instagram", type: "image", limite: 1 }]);
});

describe("garde de la porte", () => {
  it("sans jeton : 401", async () => {
    expect((await POST(appel(commande(), null))).status).toBe(401);
  });
  it("mauvais jeton : 401 ; sans secret du studio : 404", async () => {
    expect((await POST(appel(commande(), "x".repeat(40)))).status).toBe(401);
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await POST(appel(commande()))).status).toBe(404);
  });
  it("« Tout arrêter » actif : 423, rien n'est écrit", async () => {
    vi.stubEnv("USINE_TOUT_ARRETER", "1");
    expect((await POST(appel(commande()))).status).toBe(423);
    expect(await lireParametre("usine-visuel-commande:visuel-essai-0001", null)).toBeNull();
  });
  it("refuse un champ invalide ou inconnu", async () => {
    expect((await POST(appel(commande({ cle: "x" })))).status).toBe(400);
    expect((await POST(appel(commande({ reseau: "" })))).status).toBe(400);
    expect((await POST(appel(commande({ type: 12 })))).status).toBe(400);
    expect((await POST(appel(commande({ montant: 5 })))).status).toBe(400);
  });
});

describe("quota de quantités", () => {
  it("sous le quota : commande reçue, sans appel au fournisseur", async () => {
    const r = await POST(appel(commande()));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ etat: "recue", deja: false });
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("quota atteint : « quota_atteint », excédent MIS DE CÔTÉ (202, jamais 402), sans appel au fournisseur", async () => {
    await POST(appel(commande()));
    const r = await POST(appel(commande({ cle: "visuel-essai-0002" })));
    expect(r.status).toBe(202);
    const corps = await r.json();
    expect(corps).toEqual({ etat: "mise_de_cote", code: "quota_atteint", deja: false });
    expect(await lireParametre("usine-visuel-cote:visuel-essai-0002", null)).toMatchObject({ cle: "visuel-essai-0002", reseau: "instagram", type: "image" });
    expect(await lireParametre("usine-visuel-commande:visuel-essai-0002", null)).toBeNull();
    expect(fetchEspion).not.toHaveBeenCalled();
    expect(JSON.stringify(corps)).not.toMatch(MONTANT);
  });

  it("un rejeu ne consomme pas une seconde unité et ne crée aucun doublon", async () => {
    await POST(appel(commande()));
    const r = await POST(appel(commande()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "recue", deja: true });
    const cote = await POST(appel(commande({ cle: "visuel-essai-0002" })));
    const rejeu = await POST(appel(commande({ cle: "visuel-essai-0002" })));
    expect(cote.status).toBe(202);
    expect(rejeu.status).toBe(200);
    expect(await rejeu.json()).toEqual({ etat: "mise_de_cote", code: "quota_atteint", deja: true });
  });

  it("le quota est par réseau et par type : un autre type n'est pas touché", async () => {
    await ecrireParametre(CLE_QUOTAS_USINE, [
      { periode: "jour", reseau: "instagram", type: "image", limite: 1 },
      { periode: "semaine", reseau: "instagram", type: "carrousel", limite: 2 },
    ]);
    await POST(appel(commande()));
    const autre = await POST(appel(commande({ cle: "visuel-essai-0003", type: "carrousel" })));
    expect(autre.status).toBe(201);
  });

  it("jamais de montant dans une réponse, jamais de 402", async () => {
    for (const cle of ["visuel-essai-0001", "visuel-essai-0002", "visuel-essai-0003"]) {
      const r = await POST(appel(commande({ cle })));
      expect(r.status).not.toBe(402);
      expect(JSON.stringify(await r.json())).not.toMatch(MONTANT);
    }
  });
});
