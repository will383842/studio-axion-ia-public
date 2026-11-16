import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { J } from "../zernio/aides/faux-zernio";
import { PROPOSITION_YOUTUBE } from "@/fournisseurs/publication/zernio-youtube";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const yt = await import("@/services/youtube-zernio");
const { etatProduction } = await import("@/services/etat-production");

const ACTIF = "zernio.youtube_actif";
const REGLAGES = "zernio.youtube_reglages";
const lire = async (id: string) => (await depots().parametres.obtenir(id))?.valeur;

beforeAll(async () => {
  await preparerMotDePasse("essai-youtube-b3");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter("essai-youtube-b3", false);
});

describe("b3 · interrupteur YouTube Shorts", () => {
  it("youtubeZernioActif : absent faux, true vrai, autres valeurs fausses", async () => {
    expect(await yt.youtubeZernioActif()).toBe(false);
    await ecrireParametre(ACTIF, true);
    expect(await yt.youtubeZernioActif()).toBe(true);
    for (const v of ["true", 1, null, {}, [], "oui", false]) {
      await ecrireParametre(ACTIF, v);
      expect(await yt.youtubeZernioActif(), JSON.stringify(v)).toBe(false);
    }
  });

  it("lecture qui lève : faux (et réglages : null)", async () => {
    const d = depots();
    const espion = vi.spyOn(d.parametres, "obtenir").mockRejectedValue(new Error("panne de base"));
    expect(await yt.youtubeZernioActif()).toBe(false);
    expect(await yt.reglagesYoutubeEnBase()).toBeNull();
    await expect(yt.exigerYoutubeZernioPret()).rejects.toMatchObject({ code: "YOUTUBE_ETEINT" });
    espion.mockRestore();
  });

  it("exigerYoutubeZernioPret : éteint, puis sans réglages, puis prêt", async () => {
    await expect(yt.exigerYoutubeZernioPret()).rejects.toMatchObject({ code: "YOUTUBE_ETEINT" });
    await ecrireParametre(ACTIF, true);
    await expect(yt.exigerYoutubeZernioPret()).rejects.toMatchObject({ code: "YOUTUBE_REGLAGES" });
    await ecrireParametre(REGLAGES, { ...PROPOSITION_YOUTUBE, visibilite: "private" });
    await expect(yt.exigerYoutubeZernioPret()).resolves.toBeUndefined();
  });

  it("etatProduction : interrupteur présent, éteint par défaut, allumé seulement par true", async () => {
    const etat = await etatProduction({}, async (cle) => (await depots().parametres.obtenir(cle))?.valeur);
    expect(etat.interrupteurs.find((i) => i.cle === ACTIF)).toMatchObject({ allume: false });
    await ecrireParametre(ACTIF, true);
    const etat2 = await etatProduction({}, async (cle) => (await depots().parametres.obtenir(cle))?.valeur);
    expect(etat2.interrupteurs.find((i) => i.cle === ACTIF)).toMatchObject({ allume: true });
    await ecrireParametre(ACTIF, "true");
    const etat3 = await etatProduction({}, async (cle) => (await depots().parametres.obtenir(cle))?.valeur);
    expect(etat3.interrupteurs.find((i) => i.cle === ACTIF)).toMatchObject({ allume: false });
  });

  it("definirYoutubeActif(true) sans réglages : YOUTUBE_REGLAGES, réglage inchangé", async () => {
    await expect(yt.definirYoutubeActif(true)).rejects.toMatchObject({ code: "YOUTUBE_REGLAGES" });
    expect(await lire(ACTIF)).toBeUndefined();
    await ecrireParametre(ACTIF, false);
    await expect(yt.definirYoutubeActif(true)).rejects.toMatchObject({ code: "YOUTUBE_REGLAGES" });
    expect(await lire(ACTIF)).toBe(false);
  });

  it("definirReglagesYoutube valide puis definirYoutubeActif : true + journal sans prénom ni nom", async () => {
    await yt.definirReglagesYoutube({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    expect(await lire(REGLAGES)).toEqual({ ...PROPOSITION_YOUTUBE, visibilite: "private" });
    await ecrireParametre("zernio.comptes", { lusLe: "2026-11-15T10:00:00Z", comptes: [{ id: "exemple-compte-yt", reseau: "youtube", nom: "Ma chaîne" }] });
    await yt.definirYoutubeActif(true);
    expect(await lire(ACTIF)).toBe(true);
    await yt.definirYoutubeActif(false);
    expect(await lire(ACTIF)).toBe(false);
    const journal = JSON.stringify(await depots().evenements.lister());
    expect(journal).toMatch(/Réglages YouTube choisis par le fondateur/);
    expect(journal).toMatch(/YouTube Shorts : envoi allumé/);
    expect(journal).toMatch(/YouTube Shorts : envoi éteint/);
    expect(journal).not.toMatch(new RegExp(`${J("wil", "li")}|${J("abon", "n")}`, "i"));
  });

  it("definirReglagesYoutube invalide : refus, rien écrit", async () => {
    await expect(yt.definirReglagesYoutube({ ...PROPOSITION_YOUTUBE, visibilite: "PUBLIC" })).rejects.toMatchObject({ code: "REGLAGES_INVALIDES" });
    await expect(yt.definirReglagesYoutube(null)).rejects.toMatchObject({ code: "REGLAGES_INVALIDES" });
    expect(await lire(REGLAGES)).toBeUndefined();
  });

  it("sans session : rien n'est écrit", async () => {
    reinitialiserRequete();
    await expect(yt.definirReglagesYoutube({ ...PROPOSITION_YOUTUBE })).rejects.toBeDefined();
    expect(await lire(REGLAGES)).toBeUndefined();
  });
});
