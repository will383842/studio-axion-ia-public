import { describe, expect, it } from "vitest";
import { etatBranchements, etatStockage, MESSAGE_STOCKAGE_SIMULE, statutSecret } from "@/services/etat-branchements";

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
    const s = etatStockage({ ...R2_COMPLET, NODE_ENV: "production" });
    expect(s).toMatchObject({ simule: false, manque: [], pretAPublier: true });
  });
});

describe("etatBranchements", () => {
  it("compose zernio, R2 et outils, sans aucune valeur de secret", () => {
    const env = { ...R2_COMPLET, NODE_ENV: "production", ZERNIO_API_KEY: "zk-abc", SITE_GUIDES_RESEAU_SECRET: "x".repeat(40) };
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
