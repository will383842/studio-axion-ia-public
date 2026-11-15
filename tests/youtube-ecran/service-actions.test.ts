/** Écran YouTube Shorts : vue lue en base (aucun réseau), actions serveur avec session, rien d'envoyé. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { vueYoutubeZernio } = await import("@/services/youtube-zernio");
const { enregistrerReglagesYoutubeAction, definirYoutubeActifAction } = await import("@/app/(studio)/reglages/actions-youtube");
const { PROPOSITION_YOUTUBE } = await import("@/fournisseurs/publication/zernio-youtube");

const MDP = "essai-ecran-youtube";
const appelsReseau: string[] = [];
const COMPTES_YT = (...c: { id?: string; nom?: string; actif?: boolean }[]) => ({ lusLe: "2026-11-15T10:00:00Z", comptes: c.map((x, i) => ({ id: x.id ?? `exemple-yt-${i}`, reseau: "youtube", nom: x.nom ?? "Ma chaîne", ...(x.actif === undefined ? {} : { actif: x.actif }) })) });
const relierChaine = () => ecrireParametre("zernio.comptes", COMPTES_YT({}));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appelsReseau.length = 0;
  vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
    appelsReseau.push(String(u));
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(appelsReseau).toEqual([]);
});

describe("vueYoutubeZernio", () => {
  it("base vide : éteint, aucun réglage, chaîne inconnue", async () => {
    expect(await vueYoutubeZernio()).toEqual({ actif: false, reglages: null, chaine: { etat: "inconnu" } });
  });
  it("seul `true` exact s'affiche allumé", async () => {
    await ecrireParametre("zernio.youtube_actif", "true");
    expect((await vueYoutubeZernio()).actif).toBe(false);
    await ecrireParametre("zernio.youtube_actif", true);
    expect((await vueYoutubeZernio()).actif).toBe(true);
  });
  it("la proposition n'est jamais rendue comme réglage enregistré", async () => {
    expect((await vueYoutubeZernio()).reglages).toBeNull();
  });
  it("chaîne lue dans les comptes enregistrés", async () => {
    await ecrireParametre("zernio.comptes", { lusLe: "2026-11-15T10:00:00Z", comptes: [{ id: "exemple-compte-yt", reseau: "youtube", nom: "Ma chaîne" }] });
    expect((await vueYoutubeZernio()).chaine).toEqual({ etat: "relie", nom: "Ma chaîne" });
  });
});

describe("actions serveur", () => {
  it("enregistrer des réglages valides : écrits tels quels, interrupteur inchangé", async () => {
    const r = await enregistrerReglagesYoutubeAction({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    expect(r.ok).toBe(true);
    expect((await vueYoutubeZernio()).reglages).toEqual({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    expect(await lireParametre("zernio.youtube_actif", "absent")).toBe("absent");
  });
  it("réglages incomplets : refus, rien d'écrit", async () => {
    const r = await enregistrerReglagesYoutubeAction({ visibilite: "private" });
    expect(r.ok).toBe(false);
    expect(await lireParametre("zernio.youtube_reglages", null)).toBeNull();
  });
  it("allumer sans réglages : refus, interrupteur inchangé", async () => {
    const r = await definirYoutubeActifAction(true);
    expect(r.ok).toBe(false);
    expect(await lireParametre("zernio.youtube_actif", "absent")).toBe("absent");
  });
  it.each(["true", 1, null, undefined, {}])("valeur %j refusée : rien d'écrit", async (v) => {
    await enregistrerReglagesYoutubeAction({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    const r = await definirYoutubeActifAction(v);
    expect(r.ok).toBe(false);
    expect(await lireParametre("zernio.youtube_actif", "absent")).toBe("absent");
  });
  it("allumer puis éteindre avec réglages", async () => {
    await enregistrerReglagesYoutubeAction({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    await relierChaine();
    expect((await definirYoutubeActifAction(true)).ok).toBe(true);
    expect((await vueYoutubeZernio()).actif).toBe(true);
    expect((await definirYoutubeActifAction(false)).ok).toBe(true);
    expect((await vueYoutubeZernio()).actif).toBe(false);
  });
  it("sans session : refus, rien d'écrit", async () => {
    await auth.seDeconnecter();
    reinitialiserRequete();
    await expect(enregistrerReglagesYoutubeAction({ ...PROPOSITION_YOUTUBE })).rejects.toBeTruthy();
    expect(await lireParametre("zernio.youtube_reglages", null)).toBeNull();
  });
});

describe("allumer : garde côté serveur (chaîne et confirmation « public »)", () => {
  const prive = { ...PROPOSITION_YOUTUBE, visibilite: "private" as const };
  const publique = { ...PROPOSITION_YOUTUBE, visibilite: "public" as const };
  const actifEnBase = () => lireParametre("zernio.youtube_actif", "absent");

  it.each([
    ["comptes jamais lus (inconnu)", null],
    ["aucune chaîne YouTube (absent)", { lusLe: "x", comptes: [{ id: "a", reseau: "instagram", nom: "I" }] }],
    ["chaîne déconnectée", COMPTES_YT({ actif: false })],
  ])("%s : allumer refusé avec un message clair, rien d'écrit", async (_n, comptes) => {
    await enregistrerReglagesYoutubeAction(prive);
    if (comptes) await ecrireParametre("zernio.comptes", comptes);
    const r = await definirYoutubeActifAction(true);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/YouTube : impossible d'allumer/);
    expect(await actifEnBase()).toBe("absent");
  });
  it("éteindre reste possible même sans chaîne reliée", async () => {
    await ecrireParametre("zernio.youtube_actif", true);
    expect((await definirYoutubeActifAction(false)).ok).toBe(true);
    expect(await actifEnBase()).toBe(false);
  });
  it("plusieurs chaînes : une chaîne déconnectée n'empêche pas d'allumer si une autre est active", async () => {
    await enregistrerReglagesYoutubeAction(prive);
    await ecrireParametre("zernio.comptes", COMPTES_YT({ actif: false, nom: "Ancienne" }, { nom: "Nouvelle" }));
    expect((await vueYoutubeZernio()).chaine).toEqual({ etat: "relie", nom: "Nouvelle" });
    expect((await definirYoutubeActifAction(true)).ok).toBe(true);
  });
  it("plusieurs chaînes toutes déconnectées : refus", async () => {
    await enregistrerReglagesYoutubeAction(prive);
    await ecrireParametre("zernio.comptes", COMPTES_YT({ actif: false }, { actif: false }));
    expect((await definirYoutubeActifAction(true)).ok).toBe(false);
  });
  it("visibilité « public » : allumer sans confirmation refusé", async () => {
    await enregistrerReglagesYoutubeAction(publique);
    await relierChaine();
    const r = await definirYoutubeActifAction(true);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/public/);
    expect(await actifEnBase()).toBe("absent");
  });
  it.each(["true", 1, false, null])("visibilité « public » : confirmation %j n'est pas `true` : refus", async (c) => {
    await enregistrerReglagesYoutubeAction(publique);
    await relierChaine();
    expect((await definirYoutubeActifAction(true, c)).ok).toBe(false);
    expect(await actifEnBase()).toBe("absent");
  });
  it("visibilité « public » : confirmation `true` exacte : allumé", async () => {
    await enregistrerReglagesYoutubeAction(publique);
    await relierChaine();
    expect((await definirYoutubeActifAction(true, true)).ok).toBe(true);
    expect(await actifEnBase()).toBe(true);
  });
  it("visibilité « privé » : aucune confirmation exigée", async () => {
    await enregistrerReglagesYoutubeAction(prive);
    await relierChaine();
    expect((await definirYoutubeActifAction(true)).ok).toBe(true);
  });
  it("éteindre en « public » ne demande aucune confirmation", async () => {
    await enregistrerReglagesYoutubeAction(publique);
    await ecrireParametre("zernio.youtube_actif", true);
    expect((await definirYoutubeActifAction(false)).ok).toBe(true);
  });
});
