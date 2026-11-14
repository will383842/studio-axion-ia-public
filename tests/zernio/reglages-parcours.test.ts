/** Interrupteurs « plusieurs mots » et « Instagram » de /mots : écriture puis relecture, règle de dépendance, accès, journal sans donnée personnelle. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const Auth = await import("@/services/auth");
const G = await import("@/services/mots-gestes");
const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

beforeEach(() => reinitialiserDepots());
const journal = async () => (await Com.depots().evenements.lister()).map((e) => e.message).filter((m) => m.startsWith("Réglage"));

describe("réglages du parcours sur /mots", () => {
  it("éteints par défaut", async () => expect(await G.gesteLireReglagesParcours()).toEqual({ motsMultiples: false, instagramSuivre: false }));

  it("l'action écrit puis relit la valeur (réglage lu par les lecteurs de production)", async () => {
    const r = await G.gesteReglerParcours("mots_multiples", true);
    expect(r).toEqual({ ok: true, etat: { motsMultiples: true, instagramSuivre: false } });
    expect(await Com.lireParametre(MM.PARAM_MOTS_MULTIPLES, false)).toBe(true);
    expect(await MM.motsMultiplesActifs()).toBe(true);
    expect((await G.gesteReglerParcours("instagram_suivre", true)).ok).toBe(true);
    expect(await IG.instagramSuivreActif()).toBe(true);
    expect((await G.gesteReglerParcours("instagram_suivre", false)).ok).toBe(true);
    expect(await IG.instagramSuivreActif()).toBe(false);
  });

  it("Instagram refusé si plusieurs mots est éteint ; rien n'est écrit ni journalisé", async () => {
    const r = await G.gesteReglerParcours("instagram_suivre", true);
    expect(r).toMatchObject({ ok: false, raison: "plusieurs_mots_eteint" });
    expect(await IG.instagramSuivreActif()).toBe(false);
    expect(await journal()).toHaveLength(0);
  });

  it("éteindre est toujours possible ; éteindre plusieurs mots éteint aussi Instagram", async () => {
    await G.gesteReglerParcours("mots_multiples", true);
    await G.gesteReglerParcours("instagram_suivre", true);
    const r = await G.gesteReglerParcours("mots_multiples", false);
    expect(r).toEqual({ ok: true, etat: { motsMultiples: false, instagramSuivre: false } });
    expect(await IG.instagramSuivreActif()).toBe(false);
  });

  it("nom ou valeur invalides : refusés, rien n'est écrit", async () => {
    // @ts-expect-error nom hors liste
    expect(await G.gesteReglerParcours("autre", true)).toMatchObject({ ok: false, raison: "reglage_inconnu" });
    // @ts-expect-error valeur non booléenne
    expect(await G.gesteReglerParcours("mots_multiples", "true")).toMatchObject({ ok: false, raison: "reglage_inconnu" });
    expect(await MM.motsMultiplesActifs()).toBe(false);
  });

  it("accès refusé sans droit : rien n'est lu ni écrit", async () => {
    vi.mocked(Auth.exigerSession).mockRejectedValueOnce(new Error("session"));
    await expect(G.gesteReglerParcours("mots_multiples", true)).rejects.toThrow();
    expect(await MM.motsMultiplesActifs()).toBe(false);
    vi.mocked(Auth.exigerSession).mockRejectedValueOnce(new Error("session"));
    await expect(G.gesteLireReglagesParcours()).rejects.toThrow();
  });

  it("chaque bascule est journalisée sans donnée personnelle", async () => {
    await G.gesteReglerParcours("mots_multiples", true);
    await G.gesteReglerParcours("instagram_suivre", true);
    await G.gesteReglerParcours("instagram_suivre", false);
    const m = await journal();
    expect(m).toHaveLength(3);
    expect(m.join("\n")).toContain("« Mode plusieurs mots » allumé");
    expect(m.join("\n")).toContain("« Instagram : suivre le compte puis OK » éteint");
    for (const l of m) expect(l).not.toMatch(/@|https?:|\d{6,}/);
  });
});
