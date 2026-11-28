// Pinterest : une image déposée pour un lot d'épingles a son empreinte DÈS la fin du dépôt,
// car l'import du lot la retrouve par son nom et son empreinte (sous verrou, où l'on ne peut plus la calculer).
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");

const OCTETS = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

beforeEach(() => {
  reinitialiserDepots();
  vi.stubEnv("R2_ACCOUNT_ID", "compte-essai");
  vi.stubEnv("R2_ACCESS_KEY_ID", "ACCES-ESSAI");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-essai");
  vi.stubEnv("R2_BUCKET", "seau-essai");
  vi.stubEnv("FOURNISSEUR_STOCKAGE", "r2");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function fauxR2(echec = false) {
  vi.stubGlobal("fetch", (async (_u: string, init?: RequestInit) => {
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "10" } });
    if (echec) return new Response(null, { status: 403 });
    return new Response(OCTETS);
  }) as unknown as typeof fetch);
}

describe("dépôt d'une image d'épingle", () => {
  it("rend le fichier « prêt » AVEC son empreinte, enregistrée sur la fiche", async () => {
    fauxR2();
    vi.resetModules();
    const envois = await import("@/services/envois");
    const r = await envois.terminerEnvoi({ nom: "01-a.png", mime: "image/png", taille: 10, typeEntite: "epingle", entiteId: "lot-import", fichierId: "f-ep", cle: "studio/dev/epingle/lot-import/f-ep.png" });
    const attendu = createHash("sha256").update(OCTETS).digest("hex");
    expect(r.statut).toBe("pret");
    expect(r.sha256).toBe(attendu);
    expect((await depots().fichiers.obtenir("f-ep"))?.sha256).toBe(attendu);
  });

  it("lecture impossible : le dépôt aboutit quand même, sans empreinte (l'analyse dira « en attente d'image »)", async () => {
    fauxR2(true);
    vi.resetModules();
    const envois = await import("@/services/envois");
    const r = await envois.terminerEnvoi({ nom: "02-b.png", mime: "image/png", taille: 10, typeEntite: "epingle", entiteId: "lot-import", fichierId: "f-ep2", cle: "studio/dev/epingle/lot-import/f-ep2.png" });
    expect(r.statut).toBe("pret");
    expect(r.sha256).toBeUndefined();
  });
});
