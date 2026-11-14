/** Suite de la 491 : état incohérent (Instagram allumé, « plusieurs mots » éteint) et bascules simultanées, avec la vraie couche de réglages. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const G = await import("@/services/mots-gestes");
const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

beforeEach(() => reinitialiserDepots());

describe("réglages du parcours : suite de la relecture", () => {
  it("état incohérent (Instagram allumé, plusieurs mots éteint) : éteindre plusieurs mots écrit instagram_suivre=false", async () => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    expect(await IG.instagramSuivreActif()).toBe(true);
    const r = await G.gesteReglerParcours("mots_multiples", false);
    expect(r).toEqual({ ok: true, etat: { motsMultiples: false, instagramSuivre: false } });
    expect(await Com.lireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true)).toBe(false);
    expect(await IG.instagramSuivreActif()).toBe(false);
  });

  it("deux bascules simultanées (éteindre plusieurs mots, allumer Instagram) : sérialisées, jamais Instagram allumé sans plusieurs mots", async () => {
    await G.gesteReglerParcours("mots_multiples", true);
    const [a, b] = await Promise.all([G.gesteReglerParcours("mots_multiples", false), G.gesteReglerParcours("instagram_suivre", true)]);
    expect(a.ok).toBe(true);
    // Sérialisées dans l'ordre d'appel : plusieurs mots s'éteint d'abord, donc l'allumage d'Instagram est refusé.
    expect(b).toMatchObject({ ok: false, raison: "plusieurs_mots_eteint" });
    expect(await MM.motsMultiplesActifs()).toBe(false);
    expect(await Com.lireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true)).toBe(false);
    expect(await G.gesteLireReglagesParcours()).toEqual({ motsMultiples: false, instagramSuivre: false });
  });

  it("deux bascules simultanées dans l'ordre inverse (allumer Instagram, éteindre plusieurs mots) : état final cohérent", async () => {
    await G.gesteReglerParcours("mots_multiples", true);
    const [a, b] = await Promise.all([G.gesteReglerParcours("instagram_suivre", true), G.gesteReglerParcours("mots_multiples", false)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(await G.gesteLireReglagesParcours()).toEqual({ motsMultiples: false, instagramSuivre: false });
  });
});
