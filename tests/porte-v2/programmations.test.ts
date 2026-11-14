/**
 * Porte v2, appel 4 : recevoir une programmation de l'usine (POST /api/usine/programmations). L'usine propose une date par
 * défaut ; l'entrée naît d'origine « usine », reste « a_valider », et RIEN ne part chez le diffuseur. La date choisie par le
 * fondateur l'emporte ; l'usine n'écrit jamais de statut. Dépôts en mémoire, aucun réseau, secrets d'essai, données fictives.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envoi = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal("fetch", envoi.fetch);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { POST } = await import("@/app/api/usine/programmations/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest("http://studio.test/api/usine/programmations", { method: "POST", headers: h, body: JSON.stringify(corps) });
}
const programmation = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "prog-essai-0001", reseau: "linkedin", jour: "2026-12-10", instant: "2026-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive", ...extra,
});
const creneaux = () => depots().creneauxEditoriaux.lister();

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  envoi.fetch.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
});

describe("porte fermée par défaut", () => {
  it("sans secret du studio : 404, rien n'est écrit", async () => {
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await POST(appel(programmation()))).status).toBe(404);
    expect(await creneaux()).toHaveLength(0);
  });
  it("sans jeton ou avec un mauvais jeton : 401, rien n'est écrit", async () => {
    expect((await POST(appel(programmation(), null))).status).toBe(401);
    expect((await POST(appel(programmation(), "x".repeat(40)))).status).toBe(401);
    expect(await creneaux()).toHaveLength(0);
  });
});

describe("critère 1 : une programmation crée une entrée « usine » à valider, sans envoi", () => {
  it("crée UNE entrée d'origine usine, à valider, avec la date par défaut", async () => {
    const r = await POST(appel(programmation({ repere: "rep-1" })));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ etat: "recue", deja: false });
    const l = await creneaux();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ statut: "a_valider", origine: "usine", jourVise: "2026-12-10", heuresParReseau: { linkedin: "2026-12-10T08:30:00.000Z" }, repereUsine: "rep-1" });
    expect(l[0].valideeLe).toBeUndefined();
    expect(l[0].valideePar).toBeUndefined();
  });
  it("rien ne part chez le diffuseur : aucun appel réseau, aucun envoi planifié", async () => {
    await POST(appel(programmation()));
    expect(envoi.fetch).not.toHaveBeenCalled();
    expect((await depots().envoisPlanifies.lister()).length).toBe(0);
  });
});

describe("critère 2 : la date du fondateur n'est pas écrasée", () => {
  async function entreeDuFondateur(extra: Record<string, unknown> = {}) {
    await depots().creneauxEditoriaux.enregistrer({
      id: "entree-fondateur-1", jourVise: "2026-12-20", heuresParReseau: { linkedin: "2026-12-20T09:00:00.000Z" }, compteCible: "compte-fictif-1",
      videoId: "v-fictive", statut: "a_valider", decalages: 0, origine: "vous", ...extra,
    });
  }
  it("une entrée choisie par le fondateur garde sa date", async () => {
    await entreeDuFondateur();
    const r = await POST(appel(programmation({ entreeId: "entree-fondateur-1" })));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "date_du_fondateur_conservee", deja: true });
    const l = await creneaux();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ jourVise: "2026-12-20", origine: "vous", heuresParReseau: { linkedin: "2026-12-20T09:00:00.000Z" } });
  });
  it("une entrée sans origine (d'avant) est celle du fondateur : protégée aussi", async () => {
    await entreeDuFondateur({ origine: undefined });
    await POST(appel(programmation({ entreeId: "entree-fondateur-1" })));
    const l = await creneaux();
    expect(l).toHaveLength(1);
    expect(l[0].jourVise).toBe("2026-12-20");
  });
});

describe("critère 3 : jamais de statut venant de l'usine, jeton exigé, rejeu sans doublon", () => {
  it("refuse tout champ de statut envoyé par l'usine (400), rien n'est écrit", async () => {
    for (const interdit of [{ statut: "valide" }, { statut: "a_valider" }, { valideeLe: "2026-12-01T00:00:00Z" }, { valideePar: "usine" }, { origine: "vous" }, { programme: true }]) {
      const r = await POST(appel(programmation(interdit)));
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
    expect(await creneaux()).toHaveLength(0);
  });
  it("un rejeu de la même clé ne crée aucun doublon", async () => {
    await POST(appel(programmation()));
    const r = await POST(appel(programmation()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "recue", deja: true });
    expect(await creneaux()).toHaveLength(1);
  });
  it("un rejeu ne ramène pas en arrière une entrée que le fondateur a déjà décalée ou validée", async () => {
    await POST(appel(programmation()));
    const [c] = await creneaux();
    await depots().creneauxEditoriaux.enregistrer({ ...c, statut: "valide", valideeLe: "2026-12-02T10:00:00.000Z", valideePar: "fondateur" });
    await POST(appel(programmation()));
    expect((await creneaux())[0]).toMatchObject({ statut: "valide", valideePar: "fondateur" });
  });
  it("refuse un champ invalide ou inconnu", async () => {
    expect((await POST(appel(programmation({ reseau: "inconnu" })))).status).toBe(400);
    expect((await POST(appel(programmation({ instant: "demain" })))).status).toBe(400);
    expect((await POST(appel(programmation({ cle: "x" })))).status).toBe(400);
    expect((await POST(appel(programmation({ videoId: "v", visuelId: "i" })))).status).toBe(400);
    expect((await POST(appel(programmation({ surprise: 1 })))).status).toBe(400);
    expect(await creneaux()).toHaveLength(0);
  });
});

describe("révision d'une date posée par l'usine", () => {
  it("une entrée d'origine usine encore à valider reçoit la nouvelle date par défaut, sans changer de statut", async () => {
    await POST(appel(programmation()));
    const r = await POST(appel(programmation({ cle: "prog-essai-0002", jour: "2026-12-11", instant: "2026-12-11T08:30:00.000Z", entreeId: "prog-prog-essai-0001" })));
    expect(r.status).toBe(200);
    const l = await creneaux();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ statut: "a_valider", origine: "usine", jourVise: "2026-12-11" });
  });
});
