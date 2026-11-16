/**
 * UO-12 : YouTube prêt et éteint. Aucun appel réel : le réglage et les canaux sont simulés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdReseau } from "@/domaine/types";
import { RESEAUX } from "@/reseaux";

const base = vi.hoisted(() => ({ parametres: new Map<string, unknown>(), panne: false }));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (id: string, defaut: unknown) => {
    if (base.panne) throw new Error("base illisible");
    return base.parametres.has(id) ? base.parametres.get(id) : defaut;
  },
  ecrireParametre: async (id: string, v: unknown) => void base.parametres.set(id, v),
  maintenant: () => "2026-11-16T00:00:00.000Z",
}));

const { verifierYoutubePret, youtubeEnvoiPermis } = await import("@/domaine/youtube-pret");
const { CLE_YOUTUBE_ACTIF } = await import("@/fournisseurs/publication/zernio-youtube");
const { lireYoutubeActif, verifierYoutubePretDepuisBase, youtubeEnvoiPermisDepuisBase } = await import("@/services/interrupteur-youtube");

const COMPLET = { chaineRelieeChezDiffuseur: true, reseauxPrisEnCharge: ["youtube", "youtube-shorts"] as IdReseau[] };

beforeEach(() => {
  base.parametres.clear();
  base.panne = false;
});

describe("réglage existant zernio.youtube_actif", () => {
  it("porte la clé attendue", () => expect(CLE_YOUTUBE_ACTIF).toBe("zernio.youtube_actif"));
  it("vaut faux s'il est absent", async () => expect(await lireYoutubeActif()).toBe(false));
  it("vaut faux s'il est illisible (panne = éteint)", async () => {
    base.panne = true;
    expect(await lireYoutubeActif()).toBe(false);
  });
  it.each([["true"], [1], ["oui"], [null], [{}], [false]])("vaut faux pour %j (différent de true)", async (v) => {
    base.parametres.set(CLE_YOUTUBE_ACTIF, v);
    expect(await lireYoutubeActif()).toBe(false);
  });
  it("vaut vrai seulement pour true", async () => {
    base.parametres.set(CLE_YOUTUBE_ACTIF, true);
    expect(await lireYoutubeActif()).toBe(true);
  });
});

describe("verifierYoutubePret", () => {
  it("est prêt seulement si la liste est vide", () => {
    const r = verifierYoutubePret(COMPLET, "youtube-shorts");
    expect(r.manques).toEqual([]);
    expect(r.pret).toBe(true);
  });
  it("dit en français que la chaîne n'est pas reliée", () => {
    const r = verifierYoutubePret({ ...COMPLET, chaineRelieeChezDiffuseur: false }, "youtube-shorts");
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/chaîne YouTube/);
  });
  it("dit en français que le diffuseur ne prend pas YouTube en charge", () => {
    const r = verifierYoutubePret({ ...COMPLET, reseauxPrisEnCharge: [] }, "youtube-shorts");
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/diffuseur/);
  });
  it("signale des limites du réseau absentes ou invalides", () => {
    const sans = RESEAUX.filter((r) => r.id !== "youtube-shorts");
    const r = verifierYoutubePret(COMPLET, "youtube-shorts", sans);
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/limites/);
    const casse = RESEAUX.map((x) => (x.id === "youtube" ? { ...x, dureeMaxSec: 0 } : x));
    expect(verifierYoutubePret(COMPLET, "youtube", casse).pret).toBe(false);
  });
  it("prise en charge testée par réseau : Shorts oui, YouTube long non", () => {
    const etat = { ...COMPLET, reseauxPrisEnCharge: ["youtube-shorts"] as IdReseau[] };
    expect(verifierYoutubePret(etat, "youtube-shorts").pret).toBe(true);
    expect(verifierYoutubePret(etat, "youtube").pret).toBe(false);
  });
  it("lit les vraies limites du registre", () => expect(verifierYoutubePret(COMPLET, "youtube-shorts", RESEAUX).pret).toBe(true));
});

describe("youtubeEnvoiPermis", () => {
  const reseaux: IdReseau[] = ["youtube", "youtube-shorts"];
  it.each(reseaux)("%s : faux tant que le réglage est faux", (r) => expect(youtubeEnvoiPermis(r, false, verifierYoutubePret(COMPLET, "youtube-shorts"))).toBe(false));
  it.each(reseaux)("%s : faux tant que la liste n'est pas vide", (r) => expect(youtubeEnvoiPermis(r, true, verifierYoutubePret({ ...COMPLET, chaineRelieeChezDiffuseur: false }, "youtube-shorts"))).toBe(false));
  it.each(reseaux)("%s : vrai seulement réglage vrai ET liste vide", (r) => expect(youtubeEnvoiPermis(r, true, verifierYoutubePret(COMPLET, "youtube-shorts"))).toBe(true));
  it("ne dit rien pour les autres réseaux", () => expect(youtubeEnvoiPermis("tiktok", true, verifierYoutubePret(COMPLET, "youtube-shorts"))).toBe(false));
});

describe("service : éteint par défaut, sans appel réel", () => {
  it("rien n'est permis avec la base vide", async () => {
    for (const r of ["youtube", "youtube-shorts"] as const) expect(await youtubeEnvoiPermisDepuisBase(r)).toBe(false);
  });
  it("Shorts est pris en charge par le diffuseur, YouTube long non", async () => {
    base.parametres.set("zernio.canaux", { lusLe: "x", canaux: [{ id: "c", organisationId: "o", nom: "n", service: "youtube" }] });
    expect((await verifierYoutubePretDepuisBase("youtube-shorts")).pret).toBe(true);
    const long = await verifierYoutubePretDepuisBase("youtube");
    expect(long.pret).toBe(false);
    expect(long.manques.join(" ")).toMatch(/diffuseur/);
  });
  it("Shorts : permis seulement si zernio.youtube_actif vaut true et la chaîne est reliée", async () => {
    base.parametres.set("zernio.canaux", { lusLe: "x", canaux: [{ id: "c", organisationId: "o", nom: "n", service: "youtube" }] });
    expect(await youtubeEnvoiPermisDepuisBase("youtube-shorts")).toBe(false);
    base.parametres.set(CLE_YOUTUBE_ACTIF, true);
    expect(await youtubeEnvoiPermisDepuisBase("youtube-shorts")).toBe(true);
    expect(await youtubeEnvoiPermisDepuisBase("youtube")).toBe(false);
  });
  it("sans chaîne reliée, rien ne part même allumé", async () => {
    base.parametres.set(CLE_YOUTUBE_ACTIF, true);
    expect(await youtubeEnvoiPermisDepuisBase("youtube-shorts")).toBe(false);
  });
});
