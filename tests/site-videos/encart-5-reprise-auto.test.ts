/** Encart vidéo, PR 5 : marqueur « décochée par le fondateur » et garde pure de la reprise automatique (rien n'est branché). */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { gardeRepriseAuto } from "@/domaine/site-videos/reprise-auto";
import type { EtatSite } from "@/domaine/site-videos/types";
import { preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");

const etat = (s: Partial<EtatSite> = {}): EtatSite => ({ choisie: false, etat: "hors-ligne", fichiersPublics: [], modifieLe: "2026-11-27T10:00:00.000Z", ...s });

describe("encart PR 5 : garde de reprise automatique", () => {
  it("une vidéo validée, programmée ou publiée, jamais envoyée : reprise possible", () => {
    for (const etape of ["validee", "programmee", "publiee"] as const) expect(gardeRepriseAuto({ etape, site: undefined })).toEqual({ reprendre: true });
    expect(gardeRepriseAuto({ etape: "validee", site: etat() })).toEqual({ reprendre: true });
  });
  it("jamais une vidéo « à relire » (ni sans étape)", () => {
    expect(gardeRepriseAuto({ etape: "a_relire", site: undefined })).toMatchObject({ reprendre: false, raison: "a-relire" });
    expect(gardeRepriseAuto({ etape: undefined, site: undefined })).toMatchObject({ reprendre: false, raison: "a-relire" });
  });
  it("jamais une vidéo retirée (le retrait est définitif côté site)", () => {
    expect(gardeRepriseAuto({ etape: "validee", site: etat({ etat: "retiree" }) })).toMatchObject({ reprendre: false, raison: "retiree" });
  });
  it("jamais un échec avec une version en ligne (retrait raté) ; un échec sans version en ligne peut être repris", () => {
    expect(gardeRepriseAuto({ etape: "validee", site: etat({ etat: "echec", versionEnLigne: 2 }) })).toMatchObject({ reprendre: false, raison: "retrait-rate" });
    expect(gardeRepriseAuto({ etape: "validee", site: etat({ etat: "echec" }) })).toEqual({ reprendre: true });
  });
  it("jamais une vidéo décochée par le fondateur", () => {
    expect(gardeRepriseAuto({ etape: "publiee", site: etat({ decocheeParWill: true }) })).toMatchObject({ reprendre: false, raison: "decochee" });
  });
  it("rien à faire si elle est déjà en ligne ou en cours", () => {
    for (const e of ["en-ligne", "envoi-en-cours", "retrait-en-cours"] as const) expect(gardeRepriseAuto({ etape: "validee", site: etat({ etat: e }) })).toMatchObject({ reprendre: false, raison: "deja-en-ligne" });
  });
});

describe("encart PR 5 : le marqueur posé par la case « Sur le site »", () => {
  beforeAll(async () => {
    await preparerMotDePasse(MDP_SITE);
  });
  beforeEach(async () => {
    await preparerBase();
    await preparerVideoPublicable("v-01");
  });
  const lire = async () => (await depots().kits.trouver((k) => k.videoId === "v-01"))?.site;

  it("décocher pose le marqueur ; recocher l'efface", async () => {
    expect((await site.cocherSurLeSite("v-01", false)).decocheeParWill).toBe(true);
    expect((await lire())?.decocheeParWill).toBe(true);
    expect((await site.cocherSurLeSite("v-01", true)).decocheeParWill).toBeFalsy();
    expect((await lire())?.decocheeParWill).toBeFalsy();
  });
});
