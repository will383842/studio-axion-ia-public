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
  const V = E.VARIABLE_SECRET_EMPREINTE;
  const A = E.VARIABLE_SECRETS_ANCIENS;
  it("accepte un secret et calcule le kid", () => {
    const r = cles({ [V]: S1 });
    expect(r.courante.kid).toBe(createHmac("sha256", S1).update("studio/empreinte/kid").digest("hex").slice(0, 8));
    expect(r.courante.kid).toMatch(/^[0-9a-f]{8}$/);
    expect(r.anciennes).toEqual([]);
  });
  it("borne exacte : 31 caractères refusé, 32 accepté (courant comme ancien)", () => {
    expect(E.lireClesEmpreinte({ [V]: "x".repeat(31) })).toEqual({ ok: false, raison: "trop_court" });
    expect(E.lireClesEmpreinte({ [V]: "x".repeat(32) }).ok).toBe(true);
    expect(E.lireClesEmpreinte({ [V]: S1, [A]: "y".repeat(31) })).toEqual({ ok: false, raison: "trop_court" });
    expect(E.lireClesEmpreinte({ [V]: S1, [A]: "y".repeat(32) }).ok).toBe(true);
  });
  it("absent, trop court, identique à un autre secret => ok:false", () => {
    expect(E.lireClesEmpreinte({})).toEqual({ ok: false, raison: "absent" });
    expect(E.lireClesEmpreinte({ [V]: "   " })).toEqual({ ok: false, raison: "absent" });
    for (const autre of ["SITE_GUIDES_RESEAU_SECRET", "SITE_VIDEOS_SECRET", "ZERNIO_WEBHOOK_SECRET"]) {
      expect(E.lireClesEmpreinte({ [V]: S1, [autre]: S1 })).toEqual({ ok: false, raison: "identique_autre_secret" });
      // un ANCIEN secret égal à un autre secret du studio est refusé aussi
      expect(E.lireClesEmpreinte({ [V]: S1, [A]: S2, [autre]: S2 })).toEqual({ ok: false, raison: "identique_autre_secret" });
    }
  });
  it("secret courant égal à un ancien : refusé", () => {
    expect(E.lireClesEmpreinte({ [V]: S1, [A]: S1 })).toEqual({ ok: false, raison: "identique_autre_secret" });
    expect(E.lireClesEmpreinte({ [V]: S1, [A]: `${S2},${S2}` })).toEqual({ ok: false, raison: "identique_autre_secret" });
  });
  it("secret courant contenant une virgule : refusé (les anciens sont séparés par des virgules)", () => {
    expect(E.lireClesEmpreinte({ [V]: `${S1},x` })).toEqual({ ok: false, raison: "virgule" });
  });
  it("deux secrets distincts de même kid : refusé", () => {
    const vus = new Map<string, string>();
    let paire: [string, string] | null = null;
    for (let i = 0; !paire; i++) {
      const s = `secret-collision-${i}-`.padEnd(40, "z");
      const kid = createHmac("sha256", s).update("studio/empreinte/kid").digest("hex").slice(0, 8);
      const autre = vus.get(kid);
      if (autre) paire = [autre, s];
      else vus.set(kid, s);
    }
    expect(E.lireClesEmpreinte({ [V]: paire[0], [A]: paire[1] })).toEqual({ ok: false, raison: "kid_en_double" });
  });
  it("ignore les espaces de bord", () => {
    expect(cles({ [V]: `  ${S1}\n` }).courante.kid).toBe(cles({ [V]: S1 }).courante.kid);
  });
  it("3 anciens acceptés, 4 refusés (jamais tronqué en silence)", () => {
    const r = cles({ [V]: S1, [A]: `${S2}, ${S2}a ,${S2}b` });
    expect(r.anciennes).toHaveLength(3);
    expect(E.lireClesEmpreinte({ [V]: S1, [A]: `${S2}, ${S2}a ,${S2}b,${S2}c` })).toEqual({ ok: false, raison: "trop_d_anciens" });
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
  it("id vide refusé, sans fuite de l'id", () => {
    let erreur: unknown;
    try { E.empreintePersonne(c, "instagram", ""); } catch (e) { erreur = e; }
    expect(erreur).toBeInstanceOf(E.ErreurIdentifiantInvalide);
  });
  it("identifiant non ASCII accepté (UTF-8, normalisé NFC) : jamais d'erreur, donc jamais de STOP perdu", () => {
    const compose = "caf\u00e9-\u00e0";
    const decompose = "cafe\u0301-a\u0300";
    expect(E.empreintePersonne(c, "instagram", compose)).toBe(E.empreintePersonne(c, "instagram", decompose));
    const attendu = createHmac("sha256", S1).update(`studio/personne/v1\0instagram\0${compose}`).digest("hex");
    expect(E.empreintePersonne(c, "instagram", decompose)).toBe(`p1.${c.kid}.${attendu}`);
    expect(E.empreintePersonne(c, "instagram", "日本語🙂")).toMatch(/^p1\.[0-9a-f]{8}\.[0-9a-f]{64}$/);
    expect(E.empreintePersonne(c, "instagram", "é")).not.toBe(E.empreintePersonne(c, "instagram", "e"));
  });
  it("identifiant trop long : condensé sûr, déterministe, sans collision avec un préfixe ni avec un id de 256", () => {
    const long = "a".repeat(5000);
    const e1 = E.empreintePersonne(c, "instagram", long);
    expect(e1).toMatch(/^p1\.[0-9a-f]{8}\.[0-9a-f]{64}$/);
    expect(e1).toBe(E.empreintePersonne(c, "instagram", long));
    expect(e1).not.toBe(E.empreintePersonne(c, "instagram", "a".repeat(5001)));
    expect(E.empreintePersonne(c, "instagram", "a".repeat(257))).not.toBe(E.empreintePersonne(c, "instagram", "a".repeat(256)));
    expect(E.empreintePersonne(c, "instagram", `${"a".repeat(300)}x`)).not.toBe(E.empreintePersonne(c, "instagram", `${"a".repeat(300)}y`));
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
  it("timingSafeEqual est appelé même quand les longueurs diffèrent", () => {
    expect(E.egalEnTempsConstant("abc", "abcdef")).toBe(false);
    expect(vi.mocked(crypto.timingSafeEqual)).toHaveBeenCalledTimes(1);
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
  it("clé d'idempotence stable, 64 hex, acceptée par le site, morceaux préfixés par leur longueur", () => {
    const a = E.cleIdempotenceOpaque(k.courante, "guide", "run", "1");
    expect(a).toBe(createHmac("sha256", S1).update("studio/idem/v2\x005:guide3:run1:1").digest("hex"));
    expect(a).toBe(E.cleIdempotenceOpaque(k.courante, "guide", "run", "1"));
    expect(a).not.toBe(E.cleIdempotenceOpaque(k.courante, "opposition", "run", "1"));
    expect(RE_CLE_IDEMPOTENCE.test(a)).toBe(true);
  });
  it("aucune ambiguïté de découpage, même avec \\0 dans les morceaux", () => {
    const f = (...p: string[]) => E.cleIdempotenceOpaque(k.courante, "guide", ...p);
    expect(f("a\0b")).not.toBe(f("a", "b"));
    expect(f("ab", "c")).not.toBe(f("a", "bc"));
    expect(f("a", "")).not.toBe(f("a"));
    expect(f("1:a")).not.toBe(f("1", "a"));
  });
});
