/** Empreinte des personnes (HMAC) : module pur, secrets fictifs, aucun réseau. */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", async (importOriginal) => {
  const reel = await importOriginal<typeof import("node:crypto")>();
  return { ...reel, default: reel, timingSafeEqual: vi.fn((...args: unknown[]) => (args.length === 2 ? (reel.timingSafeEqual as (...a: unknown[]) => boolean)(...args) : false)) };
});
const crypto = await import("node:crypto");
const E = await import("@/domaine/guide-reseau/empreinte-personne");
const { RE_CLE_IDEMPOTENCE } = await import("@/domaine/guide-reseau/cle-idempotence");

const S1 = "secret-fictif-numero-un-0123456789abcdef";
const S2 = "secret-fictif-numero-deux-0123456789abcd";
const cles = (env: Record<string, string | undefined>) => {
  const r = E.lireClesEmpreinte(env);
  if (!r.ok) throw new Error("clés attendues");
  return r;
};

describe("lireClesEmpreinte", () => {
  it("accepte un secret de 32 caractères et calcule le kid", () => {
    const r = cles({ [E.VARIABLE_SECRET_EMPREINTE]: S1 });
    expect(r.courante.kid).toBe(createHmac("sha256", S1).update("studio/empreinte/kid").digest("hex").slice(0, 8));
    expect(r.courante.kid).toMatch(/^[0-9a-f]{8}$/);
    expect(r.anciennes).toEqual([]);
  });
  it("absent, trop court, identique à un autre secret => ok:false", () => {
    expect(E.lireClesEmpreinte({})).toEqual({ ok: false, raison: "absent" });
    expect(E.lireClesEmpreinte({ [E.VARIABLE_SECRET_EMPREINTE]: "   " })).toEqual({ ok: false, raison: "absent" });
    expect(E.lireClesEmpreinte({ [E.VARIABLE_SECRET_EMPREINTE]: "x".repeat(31) })).toEqual({ ok: false, raison: "trop_court" });
    for (const autre of ["SITE_GUIDES_RESEAU_SECRET", "SITE_VIDEOS_SECRET", "ZERNIO_WEBHOOK_SECRET"]) {
      expect(E.lireClesEmpreinte({ [E.VARIABLE_SECRET_EMPREINTE]: S1, [autre]: S1 })).toEqual({ ok: false, raison: "identique_autre_secret" });
    }
  });
  it("ignore les espaces de bord", () => {
    expect(cles({ [E.VARIABLE_SECRET_EMPREINTE]: `  ${S1}\n` }).courante.kid).toBe(cles({ [E.VARIABLE_SECRET_EMPREINTE]: S1 }).courante.kid);
  });
  it("lit jusqu'à 3 anciens secrets", () => {
    const r = cles({ [E.VARIABLE_SECRET_EMPREINTE]: S1, [E.VARIABLE_SECRETS_ANCIENS]: `${S2}, ${S2}a ,${S2}b,${S2}c` });
    expect(r.anciennes).toHaveLength(3);
  });
});

describe("empreintePersonne", () => {
  const c = cles({ [E.VARIABLE_SECRET_EMPREINTE]: S1 }).courante;
  it("valeur de référence et format p1.<kid>.<64 hex>", () => {
    const attendu = createHmac("sha256", S1).update("studio/personne/v1\0instagram\0abc123").digest("hex");
    expect(E.empreintePersonne(c, "instagram", "abc123")).toBe(`p1.${c.kid}.${attendu}`);
    expect(E.empreintePersonne(c, "instagram", "abc123")).toMatch(/^p1\.[0-9a-f]{8}\.[0-9a-f]{64}$/);
  });
  it("deux espaces donnent deux empreintes", () => {
    expect(E.empreintePersonne(c, "instagram", "abc")).not.toBe(E.empreintePersonne(c, "facebook", "abc"));
  });
  it("id vide, > 256 caractères ou non ASCII refusé, sans fuite de l'id", () => {
    for (const mauvais of ["", "a".repeat(257), "é-accent"]) {
      let erreur: unknown;
      try { E.empreintePersonne(c, "instagram", mauvais); } catch (e) { erreur = e; }
      expect(erreur).toBeInstanceOf(E.ErreurIdentifiantInvalide);
      expect(String((erreur as Error).message)).not.toContain("accent");
    }
    expect(() => E.empreintePersonne(c, "instagram", "a".repeat(256))).not.toThrow();
  });
});

describe("comparaisons en temps constant", () => {
  beforeEach(() => vi.mocked(crypto.timingSafeEqual).mockClear());
  it("longueurs différentes : false", () => {
    expect(E.egalEnTempsConstant("abc", "abcd")).toBe(false);
    expect(E.egalEnTempsConstant("abc", "abc")).toBe(true);
    expect(E.egalEnTempsConstant("abc", "abd")).toBe(false);
  });
  it("contientEnTempsConstant compare chaque paire, sans sortie anticipée", () => {
    const liste = ["aa", "bb", "cc", "dd"];
    expect(E.contientEnTempsConstant(liste, ["aa", "zz"])).toBe(true);
    expect(vi.mocked(crypto.timingSafeEqual)).toHaveBeenCalledTimes(8);
    expect(E.contientEnTempsConstant(liste, ["xx"])).toBe(false);
  });
});

describe("candidats et clé d'idempotence", () => {
  const k = cles({ [E.VARIABLE_SECRET_EMPREINTE]: S1, [E.VARIABLE_SECRETS_ANCIENS]: S2 });
  it("candidats : courante, anciennes, héritée", () => {
    const c = E.candidatsEmpreinte(k, "zernio-contact", "ct_1");
    expect(c).toHaveLength(3);
    expect(c[0]).toBe(E.empreintePersonne(k.courante, "zernio-contact", "ct_1"));
    expect(c[1]).toBe(E.empreintePersonne(k.anciennes[0], "zernio-contact", "ct_1"));
    expect(c[2]).toBe(E.empreinteHeritee("ct_1"));
    expect(c[2]).toMatch(/^[0-9a-f]{32}$/);
  });
  it("clé d'idempotence stable, 64 hex, acceptée par le site", () => {
    const a = E.cleIdempotenceOpaque(k.courante, "guide", "run", "1");
    expect(a).toBe(createHmac("sha256", S1).update("studio/idem/v1\0guide\0run\x001").digest("hex"));
    expect(a).toBe(E.cleIdempotenceOpaque(k.courante, "guide", "run", "1"));
    expect(a).not.toBe(E.cleIdempotenceOpaque(k.courante, "opposition", "run", "1"));
    expect(RE_CLE_IDEMPOTENCE.test(a)).toBe(true);
  });
});
