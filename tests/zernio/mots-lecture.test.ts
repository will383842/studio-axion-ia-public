/** Lecture seule des mots actifs par réseau. Valeurs fictives, aucune donnée de personne. */
import { beforeEach, describe, expect, it } from "vitest";
import type { LigneMot } from "@/services/mots-service";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PARAM_REGISTRE_MOTS } = await import("@/services/mots-service");
const { PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { motsActifsPourReseau } = await import("@/services/mots-lecture");

const ligne = (
  mot: string,
  compte: string,
  etat: LigneMot["etat"],
): LigneMot => ({
  mot,
  compte,
  etat,
  idWorkflow: null,
  raison: null,
  modifieLe: "2026-01-01T00:00:00.000Z",
});
const poser = async (lignes: LigneMot[]) =>
  ecrireParametre(
    PARAM_REGISTRE_MOTS,
    Object.fromEntries(lignes.map((l) => [`${l.mot}|${l.compte}`, l])),
  );
const comptes = async (liste: [string, string][]) =>
  ecrireParametre(PARAM_COMPTES_ZERNIO, {
    lusLe: "2026-01-01T00:00:00.000Z",
    comptes: liste.map(([id, reseau]) => ({ id, reseau, nom: id })),
  });

beforeEach(async () => {
  reinitialiserDepots();
  await comptes([
    ["fb_1", "facebook"],
    ["fb_2", "facebook"],
    ["ig_1", "instagram"],
    ["li_1", "linkedin"],
    ["tt_1", "tiktok"],
  ]);
});

describe("motsActifsPourReseau", () => {
  it("registre vide : aucun mot", async () => {
    expect(await motsActifsPourReseau("facebook")).toEqual([]);
  });

  it("un mot actif : réponse automatique et guide connu", async () => {
    await poser([ligne("GUIDE", "fb_1", "actif")]);
    expect(await motsActifsPourReseau("facebook")).toEqual([
      { mot: "GUIDE", guide: "guide-ia", etat: "actif", reponse: "auto" },
    ]);
  });

  it("un mot en pause (ou en pause automatique) est renvoyé « pause »", async () => {
    await poser([
      ligne("GUIDE", "fb_1", "pause"),
      ligne("AUTRE", "fb_1", "pause_auto"),
    ]);
    const r = await motsActifsPourReseau("facebook");
    expect(r).toEqual([
      { mot: "GUIDE", guide: "guide-ia", etat: "pause", reponse: "auto" },
      { mot: "AUTRE", guide: null, etat: "pause", reponse: "auto" },
    ]);
  });

  it("un mot non posé est exclu", async () => {
    await poser([ligne("GUIDE", "fb_1", "non_pose")]);
    expect(await motsActifsPourReseau("facebook")).toEqual([]);
  });

  it("deux comptes du même réseau : un seul résultat par mot (l'actif l'emporte)", async () => {
    await poser([
      ligne("GUIDE", "fb_1", "pause"),
      ligne("GUIDE", "fb_2", "actif"),
    ]);
    expect(await motsActifsPourReseau("facebook")).toEqual([
      { mot: "GUIDE", guide: "guide-ia", etat: "actif", reponse: "auto" },
    ]);
  });

  it("ne mélange pas les réseaux", async () => {
    await poser([ligne("GUIDE", "ig_1", "actif")]);
    expect(await motsActifsPourReseau("facebook")).toEqual([]);
    expect(await motsActifsPourReseau("instagram")).toHaveLength(1);
  });

  it("réseau manuel (LinkedIn, TikTok) : réponse « manuel » (RC-43)", async () => {
    await poser([
      ligne("GUIDE", "li_1", "actif"),
      ligne("GUIDE", "tt_1", "pause"),
    ]);
    expect(await motsActifsPourReseau("linkedin")).toEqual([
      { mot: "GUIDE", guide: "guide-ia", etat: "actif", reponse: "manuel" },
    ]);
    expect(await motsActifsPourReseau("tiktok")).toEqual([
      { mot: "GUIDE", guide: "guide-ia", etat: "pause", reponse: "manuel" },
    ]);
  });

  it("lecture seule : le registre n'est pas modifié", async () => {
    await poser([ligne("GUIDE", "fb_1", "actif")]);
    const avant = JSON.stringify(await lireParametre(PARAM_REGISTRE_MOTS, {}));
    await motsActifsPourReseau("facebook");
    expect(JSON.stringify(await lireParametre(PARAM_REGISTRE_MOTS, {}))).toBe(
      avant,
    );
  });
});
