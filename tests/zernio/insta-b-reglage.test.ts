/** INSTA-B · réglage « Instagram : suivre le compte » : éteint par défaut, fermé en cas d'erreur. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const M = await import("@/services/parcours-instagram");

beforeEach(() => reinitialiserDepots());

describe("instagramSuivreActif", () => {
  it("la clé est parcours.instagram_suivre", () =>
    expect(M.PARAM_INSTAGRAM_SUIVRE).toBe("parcours.instagram_suivre"));
  it("absent => éteint", async () => expect(await M.instagramSuivreActif()).toBe(false));
  it("true enregistré => allumé", async () => {
    await Com.ecrireParametre(M.PARAM_INSTAGRAM_SUIVRE, true);
    expect(await M.instagramSuivreActif()).toBe(true);
  });
  it.each([false, "true", 1, "1", "oui", 0, "", null, {}, [], [true]])("valeur %j => éteint", async (v) => {
    await Com.ecrireParametre(M.PARAM_INSTAGRAM_SUIVRE, v);
    expect(await M.instagramSuivreActif()).toBe(false);
  });
  it("lecture en panne => éteint", async () =>
    expect(await M.instagramSuivreActif({ lire: async () => { throw new Error("panne"); } })).toBe(false));
  it("lecture injectée : true allume, le reste éteint", async () => {
    expect(await M.instagramSuivreActif({ lire: async () => true })).toBe(true);
    for (const v of [false, "true", 1, undefined, null])
      expect(await M.instagramSuivreActif({ lire: async () => v })).toBe(false);
  });
});

describe("garde : seuls les lecteurs prévus lisent le réglage", () => {
  const MODULE = "src/services/parcours-instagram.ts";
  const parcourir = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p.replace(/\\/g, "/")] : [];
    });
  // INSTA-C : le seul lecteur de production autorisé (tout autre fichier qui cite la clé ou le module doit rougir).
  const LECTEURS_PREVUS = ["src/services/parcours-conversation.ts"];
  const fichiers = parcourir("src").filter((f) => f !== MODULE);
  it("seuls les lecteurs prévus lisent le réglage", () =>
    expect(fichiers.filter((f) => /parcours\.instagram_suivre|parcours-instagram|instagramSuivreActif|PARAM_INSTAGRAM_SUIVRE/.test(readFileSync(f, "utf8")))).toEqual(LECTEURS_PREVUS));
  it("le module annonce son état éteint", () =>
    expect(readFileSync(MODULE, "utf8")).toContain("ÉTEINT PAR DÉFAUT ; seul lecteur de production : parcours-conversation (INSTA-C)"));
});
