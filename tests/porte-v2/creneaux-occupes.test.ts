/**
 * Porte v2 : lecture des créneaux déjà occupés (POST /api/usine/creneaux-occupes). Dépôts en mémoire, aucun réseau,
 * secrets d'essai, données fictives.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { POST } = await import("@/app/api/usine/creneaux-occupes/route");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const URL_OCC = "http://studio.test/api/usine/creneaux-occupes";

function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(URL_OCC, { method: "POST", headers: h, body: JSON.stringify(corps) });
}
const ok = (extra: Record<string, unknown> = {}) => ({ contrat: 2, du: "2026-12-01", au: "2026-12-31", ...extra });
const cre = (id: string, statut: string, jour: string, heures: Record<string, string>) => ({
  id, jourVise: jour, heuresParReseau: heures, compteCible: "compte-fictif-1", videoId: "v-fictive", statut, decalages: 0,
  titre: "TITRE-SECRET-FICTIF", texte: "TEXTE-SECRET-FICTIF",
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  const d = depots();
  for (const c of [
    cre("a", "programme", "2026-12-02", { linkedin: "2026-12-02T08:30:00.000Z" }),
    cre("b", "a_valider", "2026-12-02", { linkedin: "2026-12-02T15:00:00.000Z", tiktok: "2026-12-02T17:00:00.000Z" }),
    cre("c", "valide", "2026-12-10", { instagram: "2026-12-10T10:00:00.000Z" }),
    cre("d", "archive", "2026-12-03", { linkedin: "2026-12-03T08:00:00.000Z" }),
    cre("e", "programme", "2027-02-01", { linkedin: "2027-02-01T08:00:00.000Z" }),
  ]) await d.creneauxEditoriaux.enregistrer(c as never);
});

describe("créneaux occupés", () => {
  it("rend programmés, à valider et validés ; pas les archivés ni les autres périodes", async () => {
    const r = await POST(appel(ok()));
    expect(r.status).toBe(200);
    expect((await r.json()).creneaux).toEqual([
      { reseau: "linkedin", jour: "2026-12-02", heure: "09:30" },
      { reseau: "linkedin", jour: "2026-12-02", heure: "16:00" },
      { reseau: "tiktok", jour: "2026-12-02", heure: "18:00" },
      { reseau: "instagram", jour: "2026-12-10", heure: "11:00" },
    ]);
  });

  it("ne contient que réseau, jour et heure : aucun texte, titre, identifiant ni donnée de personne", async () => {
    const corps = await (await POST(appel(ok()))).json();
    expect(Object.keys(corps)).toEqual(["creneaux"]);
    for (const c of corps.creneaux) expect(Object.keys(c).sort()).toEqual(["heure", "jour", "reseau"]);
    const brut = JSON.stringify(corps);
    for (const interdit of ["SECRET-FICTIF", "compte-fictif", "v-fictive", "\"a\"", "instant"]) expect(brut).not.toContain(interdit);
  });

  it("filtre par réseau", async () => {
    const corps = await (await POST(appel(ok({ reseau: "tiktok" })))).json();
    expect(corps.creneaux).toEqual([{ reseau: "tiktok", jour: "2026-12-02", heure: "18:00" }]);
  });

  it("n'écrit rien", async () => {
    const avant = JSON.stringify(await depots().creneauxEditoriaux.lister());
    await POST(appel(ok()));
    expect(JSON.stringify(await depots().creneauxEditoriaux.lister())).toBe(avant);
  });
});

describe("jeton et validation", () => {
  it("sans jeton ou mauvais jeton → 401 ; porte éteinte → 404", async () => {
    expect((await POST(appel(ok(), null))).status).toBe(401);
    expect((await POST(appel(ok(), "x".repeat(40)))).status).toBe(401);
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await POST(appel(ok(), SECRET))).status).toBe(404);
  });

  it("contrat absent → 426 ; champ inconnu → 400", async () => {
    expect((await POST(appel({ du: "2026-12-01", au: "2026-12-02" }))).status).toBe(426);
    expect((await POST(appel(ok({ intrus: 1 })))).status).toBe(400);
  });

  it("période invalide → 400 champ_invalide", async () => {
    for (const mauvais of [
      ok({ du: "2026-13-01" }), ok({ au: "demain" }), ok({ du: "2026-12-31", au: "2026-12-01" }),
      ok({ au: "2028-12-31" }), ok({ reseau: "myspace" }), { contrat: 2 },
    ]) {
      const r = await POST(appel(mauvais));
      expect(r.status, JSON.stringify(mauvais)).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
  });
});
