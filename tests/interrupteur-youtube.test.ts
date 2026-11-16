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

const { verifierYoutubePret, youtubeEnvoiPermis, CLE_YOUTUBE_ACTIF } = await import("@/domaine/youtube-pret");
const { lireYoutubeActif, verifierYoutubePretDepuisBase, youtubeEnvoiPermisDepuisBase } = await import("@/services/interrupteur-youtube");

const COMPLET = { chaineRelieeChezDiffuseur: true, priseEnChargeParDiffuseur: true };

beforeEach(() => {
  base.parametres.clear();
  base.panne = false;
});

describe("réglage publication.youtube_actif", () => {
  it("porte la clé attendue", () => expect(CLE_YOUTUBE_ACTIF).toBe("publication.youtube_actif"));
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
    const r = verifierYoutubePret(COMPLET);
    expect(r.manques).toEqual([]);
    expect(r.pret).toBe(true);
  });
  it("dit en français que la chaîne n'est pas reliée", () => {
    const r = verifierYoutubePret({ ...COMPLET, chaineRelieeChezDiffuseur: false });
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/chaîne YouTube/);
  });
  it("dit en français que le diffuseur ne prend pas YouTube en charge", () => {
    const r = verifierYoutubePret({ ...COMPLET, priseEnChargeParDiffuseur: false });
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/diffuseur/);
  });
  it("signale des limites du réseau absentes ou invalides", () => {
    const sans = RESEAUX.filter((r) => r.id !== "youtube-shorts");
    const r = verifierYoutubePret(COMPLET, sans);
    expect(r.pret).toBe(false);
    expect(r.manques.join(" ")).toMatch(/limites/);
    const casse = RESEAUX.map((x) => (x.id === "youtube" ? { ...x, dureeMaxSec: 0 } : x));
    expect(verifierYoutubePret(COMPLET, casse).pret).toBe(false);
  });
  it("lit les vraies limites du registre", () => expect(verifierYoutubePret(COMPLET, RESEAUX).pret).toBe(true));
});

describe("youtubeEnvoiPermis", () => {
  const reseaux: IdReseau[] = ["youtube", "youtube-shorts"];
  it.each(reseaux)("%s : faux tant que le réglage est faux", (r) => expect(youtubeEnvoiPermis(r, false, verifierYoutubePret(COMPLET))).toBe(false));
  it.each(reseaux)("%s : faux tant que la liste n'est pas vide", (r) => expect(youtubeEnvoiPermis(r, true, verifierYoutubePret({ ...COMPLET, chaineRelieeChezDiffuseur: false }))).toBe(false));
  it.each(reseaux)("%s : vrai seulement réglage vrai ET liste vide", (r) => expect(youtubeEnvoiPermis(r, true, verifierYoutubePret(COMPLET))).toBe(true));
  it("ne dit rien pour les autres réseaux", () => expect(youtubeEnvoiPermis("tiktok", true, verifierYoutubePret(COMPLET))).toBe(false));
});

describe("service : éteint par défaut, sans appel réel", () => {
  it("rien n'est permis avec la base vide", async () => {
    for (const r of ["youtube", "youtube-shorts"] as const) expect(await youtubeEnvoiPermisDepuisBase(r)).toBe(false);
  });
  it("même réglé à vrai, YouTube n'est pas prêt (le diffuseur le refuse aujourd'hui)", async () => {
    base.parametres.set(CLE_YOUTUBE_ACTIF, true);
    base.parametres.set("zernio.canaux", { lusLe: "x", canaux: [{ id: "c", organisationId: "o", nom: "n", service: "youtube" }] });
    const etat = await verifierYoutubePretDepuisBase();
    expect(etat.pret).toBe(false);
    expect(etat.manques.join(" ")).toMatch(/diffuseur/);
    expect(await youtubeEnvoiPermisDepuisBase("youtube")).toBe(false);
  });
});
