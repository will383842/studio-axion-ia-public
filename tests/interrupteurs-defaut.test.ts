/** L7-08 · interrupteurs sûrs par défaut : `publication.editoriale_active` (FAUX par défaut), séparé de `zernio.envoi_autorise`. */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-l708-defaut-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const Z = await import("@/services/zernio");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");
const { ecrireParametre } = await import("@/services/_commun");
const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { lireConnexionsZernioAction } = actions;

const EDITORIALE = "publication.editoriale_active";
const ANCIEN = "zernio.envoi_autorise";
const CALENDRIER = "zernio.envoi_calendrier_autorise";

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(() => Z.injecterClientZernio(null));

describe("L7-08 · publication.editoriale_active", () => {
  it("le nom et le sens coïncident avec la promotion des brouillons (src/services/promotion-envois.ts)", () => {
    expect(Z.PARAM_EDITORIALE_ACTIVE).toBe(EDITORIALE);
    expect(Z.PARAM_EDITORIALE_ACTIVE).toBe(REGLAGE_EDITORIALE_ACTIVE);
  });

  it("zernio.envoi_autorise N'EST PAS modifié : même nom, défaut toujours ouvert pour le parcours GUIDE", async () => {
    expect(Z.PARAM_ARRET_ZERNIO).toBe(ANCIEN);
    expect(await Z.envoiZernioAutorise()).toBe(true);
    await ecrireParametre(EDITORIALE, true);
    expect(await Z.envoiZernioAutorise()).toBe(true); // le nouveau réglage ne touche pas l'ancien
  });

  it.each([
    ["absent", undefined, false],
    ["faux", false, false],
    ["vrai", true, true],
    ["texte « true »", "true", false],
    ["nombre 1", 1, false],
    ["nul", null, false],
  ] as const)("réglage %s : seul le booléen vrai ouvre", async (_n, valeur, attendu) => {
    if (valeur !== undefined) await ecrireParametre(EDITORIALE, valeur);
    expect(await Z.editorialeActive()).toBe(attendu);
  });

  it("base vide : aucune publication éditoriale, même avec l'ancien réglage ouvert (défaut)", async () => {
    expect(await Z.publicationEditorialeAutorisee()).toBe(false);
  });

  it.each([
    ["éditorial seul", undefined, undefined, true, false],
    ["éditorial + ancien, calendrier absent", true, undefined, true, false],
    ["éditorial + calendrier + ancien fermé", false, true, true, false],
    ["les trois ouverts", true, true, true, true],
    ["les trois ouverts sauf éditorial", true, true, false, false],
    ["éditorial + ancien ouvert, calendrier fermé", true, false, true, false],
  ] as const)("porte de publication : %s", async (_n, ancien, calendrier, editoriale, attendu) => {
    if (ancien !== undefined) await ecrireParametre(ANCIEN, ancien);
    if (calendrier !== undefined) await ecrireParametre(CALENDRIER, calendrier);
    await ecrireParametre(EDITORIALE, editoriale);
    expect(await Z.publicationEditorialeAutorisee()).toBe(attendu);
  });

  it("une lecture qui échoue ferme la porte (jamais d'exception vers l'appelant)", async () => {
    const base = await import("@/services/_commun");
    const espion = vi.spyOn(base, "lireParametre").mockRejectedValue(new Error("base illisible"));
    try {
      expect(await Z.editorialeActive()).toBe(false);
      expect(await Z.publicationEditorialeAutorisee()).toBe(false);
    } finally {
      espion.mockRestore();
    }
  });

  it("l'écran Connexions lit le réglage en lecture seule : absent = éteint, vrai = allumé, aucune écriture", async () => {
    const avant = await lireConnexionsZernioAction();
    expect(avant.ok && avant.donnees.editorialeActive).toBe(false);
    await ecrireParametre(EDITORIALE, true);
    const apres = await lireConnexionsZernioAction();
    expect(apres.ok && apres.donnees.editorialeActive).toBe(true);
    expect(apres.ok && apres.donnees.arretActif).toBe(false);
  });

  it("geste : sans session, allumer et éteindre sont refusés et n'écrivent rien", async () => {
    await auth.seDeconnecter();
    await expect(actions.allumerEditorialeAction()).rejects.toThrow();
    await expect(actions.eteindreEditorialeAction()).rejects.toThrow();
    expect(await Z.editorialeActive()).toBe(false);
  });

  it("geste : éteint par défaut ; allumer pose vrai, éteindre repose faux, rien d'autre n'est touché", async () => {
    expect(await Z.editorialeActive()).toBe(false);
    const r = await actions.allumerEditorialeAction();
    expect(r.ok).toBe(true);
    expect(await Z.editorialeActive()).toBe(true);
    expect(await Z.envoiZernioAutorise()).toBe(true);
    expect(await Z.envoiCalendrierAutorise()).toBe(false); // ne touche pas aux autres réglages
    expect(await Z.publicationEditorialeAutorisee()).toBe(false); // l'éditorial seul n'ouvre pas la porte
    expect((await actions.eteindreEditorialeAction()).ok).toBe(true);
    expect(await Z.editorialeActive()).toBe(false);
  });

  it("geste : écrit le booléen seul, journalisé, avec une phrase claire", async () => {
    const base = await import("@/services/_commun");
    const ecrits: Array<[string, unknown]> = [];
    const e = vi.spyOn(base, "ecrireParametre").mockImplementation(async (c, v) => { ecrits.push([c, v]); });
    const j = vi.spyOn(base, "journaliser").mockResolvedValue(undefined);
    try {
      await actions.allumerEditorialeAction();
      expect(ecrits).toEqual([[EDITORIALE, true]]);
      expect(j).toHaveBeenCalledTimes(1);
      expect(String(j.mock.calls[0][1])).toMatch(/publication éditoriale/i);
      expect(String(j.mock.calls[0][1])).toMatch(/allumée/);
    } finally { e.mockRestore(); j.mockRestore(); }
  });

  it("phrase affichée : dit l'état en clair, éteint par défaut", () => {
    expect(Z.PHRASE_EDITORIALE.eteinte).toMatch(/éteinte/);
    expect(Z.PHRASE_EDITORIALE.allumee).toMatch(/allumée/);
  });
});
