import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { etatBranchements, etatStockage, MESSAGE_STOCKAGE_SIMULE, statutSecret } from "@/services/etat-branchements";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const vitestOutils = { beforeAll, afterEach, vi };

const R2_COMPLET = { R2_ACCOUNT_ID: "compte-fictif", R2_ACCESS_KEY_ID: "acces-fictif-123", R2_SECRET_ACCESS_KEY: "secret-fictif-r2-0123456789", R2_BUCKET: "seau-fictif" };

describe("statutSecret : présent, absent ou trop court, jamais la valeur", () => {
  it("absent si vide ou espaces", () => {
    expect(statutSecret(undefined)).toBe("absent");
    expect(statutSecret("   ")).toBe("absent");
  });
  it("trop court sous le seuil, présent au-dessus", () => {
    expect(statutSecret("abc")).toBe("trop_court");
    expect(statutSecret("abcdefghij")).toBe("present");
  });
});

describe("etatStockage", () => {
  it("sans R2_BUCKET en production : simulé et refusé, message clair", () => {
    const { R2_BUCKET: _, ...sansSeau } = R2_COMPLET;
    const s = etatStockage({ ...sansSeau, NODE_ENV: "production" });
    expect(s.simule).toBe(true);
    expect(s.production).toBe(true);
    expect(s.manque).toContain("R2_BUCKET");
    expect(s.pretAPublier).toBe(false);
    expect(s.message).toBe(MESSAGE_STOCKAGE_SIMULE);
    expect(MESSAGE_STOCKAGE_SIMULE).toMatch(/simul/i);
  });
  it("simulé hors production : signalé mais pas bloquant", () => {
    const s = etatStockage({ NODE_ENV: "development" });
    expect(s.simule).toBe(true);
    expect(s.pretAPublier).toBe(true);
  });
  it("R2 complet en production : réel et prêt", () => {
    const s = etatStockage({ ...R2_COMPLET, NODE_ENV: "production", FOURNISSEUR_STOCKAGE: "r2" });
    expect(s).toMatchObject({ simule: false, manque: [], pretAPublier: true });
  });
});

describe("etatBranchements", () => {
  it("compose zernio, R2 et outils, sans aucune valeur de secret", () => {
    const env = { ...R2_COMPLET, NODE_ENV: "production", FOURNISSEUR_STOCKAGE: "r2", ZERNIO_API_KEY: "zk-abc", SITE_GUIDES_RESEAU_SECRET: "x".repeat(40) };
    const e = etatBranchements(env, { branche: true, cleZernio: true, secretSite: true, cleEmpreinte: false, comptesEnvoi: false, titreGuide: false, codes: ["cle_empreinte_absente"] });
    expect(e.secrets.ZERNIO_API_KEY).toBe("trop_court");
    expect(e.secrets.SITE_GUIDES_RESEAU_SECRET).toBe("present");
    expect(e.secrets.STUDIO_EMPREINTE_SECRET).toBe("absent");
    expect(e.zernio?.codes).toEqual(["cle_empreinte_absente"]);
    expect(e.pretAPublier).toBe(true);
    const sortie = JSON.stringify(e);
    for (const v of ["zk-abc", "x".repeat(40), R2_COMPLET.R2_SECRET_ACCESS_KEY, R2_COMPLET.R2_ACCESS_KEY_ID, R2_COMPLET.R2_ACCOUNT_ID]) expect(sortie).not.toContain(v);
  });
  it("pas prêt à publier si stockage simulé en production", () => {
    const e = etatBranchements({ NODE_ENV: "production" }, null);
    expect(e.pretAPublier).toBe(false);
    expect(e.zernio).toBeNull();
    expect(e.stockage.message).toBe(MESSAGE_STOCKAGE_SIMULE);
  });
});

describe("etatStockage : le choix réel du fournisseur de stockage (relecture v1-s2)", () => {
  it("4 variables R2 mais FOURNISSEUR_STOCKAGE absent, en production : simulé, refusé", () => {
    const s = etatStockage({ ...R2_COMPLET, NODE_ENV: "production" });
    expect(s).toMatchObject({ simule: true, pretAPublier: false, message: MESSAGE_STOCKAGE_SIMULE });
  });
  it("FOURNISSEUR_STOCKAGE=r2 ou réglage en base « r2 » : réel", () => {
    expect(etatStockage({ ...R2_COMPLET, NODE_ENV: "production", FOURNISSEUR_STOCKAGE: "r2" })).toMatchObject({ simule: false, pretAPublier: true });
    expect(etatStockage({ ...R2_COMPLET, NODE_ENV: "production" }, "r2")).toMatchObject({ simule: false, pretAPublier: true });
  });
  it("le réglage en base l'emporte sur l'environnement", () => {
    expect(etatStockage({ ...R2_COMPLET, NODE_ENV: "production", FOURNISSEUR_STOCKAGE: "r2" }, "simulation").simule).toBe(true);
  });
});

describe("envoi refusé en production avec stockage simulé (relecture v1-s2)", () => {
  const { beforeAll, afterEach, vi } = vitestOutils;
  beforeAll(async () => {
    process.env.SESSION_SECRET = "s".repeat(48);
    const { hash } = await import("@node-rs/argon2");
    const empreinte = await hash("essai-etat-123", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
  });
  afterEach(() => vi.unstubAllEnvs());

  async function seConnecter() {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    reinitialiserRequete();
    await (await import("@/services/auth")).seConnecter("essai-etat-123", false);
  }
  const sansSecret = (m: string) => { for (const v of Object.values(R2_COMPLET)) expect(m).not.toContain(v); };

  it("envoyerVersBuffer : STOCKAGE_SIMULE, sans valeur de secret", async () => {
    await seConnecter();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_BUCKET", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", R2_COMPLET.R2_ACCESS_KEY_ID);
    const { envoyerVersBuffer } = await import("@/services/publications");
    const e = await envoyerVersBuffer("v-01", ["tiktok"], "2099-01-01T10:00:00.000Z").catch((x) => x);
    expect(e).toMatchObject({ code: "STOCKAGE_SIMULE" });
    sansSecret(e.message);
  }, 30_000);
  it("envoyerReel (voie Zernio) : STOCKAGE_SIMULE aussi, avant toute autre vérification", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_BUCKET", "");
    const { envoyerReel } = await import("@/services/publications");
    const e = await envoyerReel("zernio", {} as never, { videoId: "v-01" } as never, ["tiktok"], "2099-01-01T10:00:00.000Z", {}, {}, true).catch((x) => x);
    expect(e).toMatchObject({ code: "STOCKAGE_SIMULE" });
  });
  it("R2 complet mais FOURNISSEUR_STOCKAGE absent, en production : refusé aussi", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const [k, v] of Object.entries(R2_COMPLET)) vi.stubEnv(k, v);
    vi.stubEnv("FOURNISSEUR_STOCKAGE", "");
    const { envoyerReel } = await import("@/services/publications");
    const e = await envoyerReel("zernio", {} as never, { videoId: "v-01" } as never, ["tiktok"], "2099-01-01T10:00:00.000Z", {}, {}, true).catch((x) => x);
    expect(e).toMatchObject({ code: "STOCKAGE_SIMULE" });
    sansSecret(e.message);
  });
});
