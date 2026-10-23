/**
 * SCRIPT FACULTATIF (décision de Will, 18/10) — face caméra et face caméra animée seulement ; jamais l'avocat.
 * Une vidéo déjà filmée se monte sans texte et sans appel Claude ; le texte à lire n'est écrit que sur clic.
 * (en-tête d'origine : « J'AI DÉJÀ FILMÉ MA VIDÉO » (retour prod du 09/10). Will a filmé sa vidéo face caméra à l'iPhone et colle le texte
 * qu'il a dit : `creerVersionFacecamDepuisTexte` crée, sans aucun appel Claude, une version facecam « je lis » validée
 * dont le texte est EXACTEMENT le sien ; l'écran d'envoi la trouve, la réception range la prise et lance le montage.
 * Aucun réseau : `fetch` est interdit pendant tout le fichier.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { variablesDuCatalogue } from "@/fournisseurs/catalogue";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.setConfig({ testTimeout: 60_000 });

const MDP = "essai-facecam-deja-filme";
const environnementDepart = { ...process.env };
const fetchDepart = globalThis.fetch;

/** Serveur d'alignement face caméra « posé » (valeur d'essai : rien n'est appelé, la chaîne n'avance pas ici). */
const ALIGNEUR = { STUDIO_ALIGNEUR_URL: "http://aligneur.essai:4200" };

async function charger(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const n of Object.keys(process.env)) if (n.startsWith("FOURNISSEUR_") || n.startsWith("MOTEUR_")) delete process.env[n];
  delete process.env.STUDIO_ALIGNEUR_URL;
  for (const n of variablesDuCatalogue()) delete process.env[n];
  Object.assign(process.env, env);
  const memoire = await import("@/donnees/memoire");
  memoire.reinitialiserDepots();
  reinitialiserRequete();
  const auth = await import("@/services/auth");
  await auth.seConnecter(MDP, false);
  (await import("@/services/boucle-generation")).suspendreBoucleGeneration(true);
  return {
    depots: memoire.depots,
    envoi: await import("@/services/envoi-facecam"),
    derivations: await import("@/domaine/derivations-generateur"),
    chaine: await import("@/generateur/chaine"),
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
  globalThis.fetch = (() => {
    throw new Error("fetch interdit dans ce test");
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchDepart;
  process.env = { ...environnementDepart };
  vi.resetModules();
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

describe("script facultatif · règle pure", () => {
  it("facecam et facecam-animee seulement : jamais l'avocat, le tableau, le cas concret ni image→vidéo", async () => {
    const { scriptFacultatif } = await import("@/domaine/facecam-script");
    expect(scriptFacultatif("facecam")).toBe(true);
    expect(scriptFacultatif("facecam-animee")).toBe(true);
    for (const id of ["avocat", "tableau-anime", "cas-concret", "image-video", "podcast", "presentation"]) expect(scriptFacultatif(id)).toBe(false);
  });
});

describe("script facultatif · vidéo déjà filmée sans texte", () => {
  it("crée une version sans texte ni écriture, nommée sans inventer de texte", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte("", "Ma vidéo du jour");
    const v = (await r.depots().variantes.obtenir(varianteId))!;
    expect(v.formatId).toBe("facecam");
    expect(v.etat).toBe("validee");
    const script = (await r.depots().scripts.obtenir(v.scriptId))!;
    expect(r.derivations.texteDesBlocs(r.derivations.assemblerBlocs(script, v))).toBe("");
    expect(await r.depots().generations.lister()).toEqual([]);
  });

  it("sans titre ni texte : un titre simple, jamais de refus", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte(undefined);
    const vue = await r.envoi.vueEnvoiFacecam(varianteId);
    expect(vue?.titre).toBeTruthy();
  });

  it("la prise reçue part au montage sans script et sans aucune génération Claude", async () => {
    const r = await charger(ALIGNEUR);
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte("");
    const t = new Date().toISOString();
    await r.depots().fichiers.enregistrer({ id: "f-prise-sans-texte", cleStockage: "studio/prod/rushs/f-prise-sans-texte.mov", nom: "IMG_0100.MOV", mime: "video/quicktime", taille: 80_000_000, dureeSec: 31, origine: "envoi", statut: "pret", creeLe: t, modifieLe: t } as never);
    const recu = await r.envoi.recevoirVideoFacecam(varianteId, "f-prise-sans-texte", 31);
    expect(recu.enAttente).toBeUndefined();
    expect(recu.travailId).toBeTruthy();
    expect(await r.depots().generations.lister()).toEqual([]);
  });
});

describe("script facultatif · ouverture de l'assistant face caméra", () => {
  const express = lire("src/assistant/etapes/Express.tsx");
  const deja = lire("src/components/facecam/DejaFilme.tsx");

  it("le bouton « Je veux un texte à lire » existe et la zone d'écriture n'est plus offerte d'office", () => {
    expect(express).toContain("Je veux un texte à lire");
    expect(express).toMatch(/scriptFacultatif\(formatId\)/);
    expect(express).toMatch(/veutTexte/);
  });

  it("« Fabriquer » sans texte n'ouvre plus l'écriture pour ces formats", () => {
    expect(express).toMatch(/if \(!aTexte\) \{[\s\S]*scriptFacultatif/);
  });

  it("« J'ai déjà filmé » ne demande plus de texte pour continuer", () => {
    expect(deja).not.toMatch(/disabled=\{!texte\.trim\(\)\}/);
    expect(deja).toContain("facultatif");
  });
});
