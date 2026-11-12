/**
 * L3-10 — UNE SEULE SOURCE DE TEXTE VIDÉO. Sans clé ni réseau : Claude répond par un faux `fetch` compté.
 * Critères : texte validé (celui de la version du sujet) = 0 appel au rôle ; une saisie manuelle n'est jamais écrasée.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const pub = await import("@/services/publications");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import type { Video } from "@/domaine/types";

const MDP = "essai-r3-source-unique";
const TEXTE_VERSION = "Texte validé de la version : un seul auteur, une seule source.";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

/** Claude factice : chaque requête au rôle est comptée. */
async function brancherClaude() {
  await credits.declarerRecharge("anthropic", 500);
  const appels: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string }[] };
    appels.push(/<reseau id="([^"]+)"/.exec(corps.messages?.[0]?.content ?? "")?.[1] ?? "?");
    const texte = "Texte de Claude, jamais celui de la version.\n\nLe point en une minute.";
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ premiereLigne: texte.split("\n")[0], texte, motsDiese: ["#PME", "#Teletravail"], justifications: [] }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

async function video(id: string, extra: Partial<Video> = {}): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id, estDemo: false, titre: "Télétravail : quels outils pour l'équipe ?", ...extra };
  await depots().videos.enregistrer(v);
  return v;
}

/** Vidéo dont le texte TikTok est déjà validé dans la version du sujet. */
async function videoDeVersion(id: string, version = 1): Promise<Video> {
  await depots().variantes.enregistrer({ id: "var-r3", code: "R3-TT", version, scriptMaitreId: "maitre-r3", reseau: "tiktok", publication: { texte: TEXTE_VERSION, motsDiese: ["#PME"] } } as never);
  return video(id, { varianteId: "var-r3" });
}

const suite = (v: Video) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes: true }]);

describe("L3-10 · texte validé : 0 appel au rôle", () => {
  it("fabrication d'une vidéo de version : aucun appel, l'affichage recopie le texte de la version", async () => {
    const appels = await brancherClaude();
    const v = await videoDeVersion("v-r3-version");
    await suite(v);
    await pub.obtenirKit(v.id);
    expect(appels).toHaveLength(0);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    expect(kit.textes.tiktok).toMatchObject({ texte: TEXTE_VERSION, source: "variante" });
  });

  it("« Réécrire » le réseau de la version : refusé, aucun appel", async () => {
    const appels = await brancherClaude();
    const v = await videoDeVersion("v-r3-reecrire");
    await pub.obtenirKit(v.id);
    await expect(pub.regenererTexteKit(v.id, "tiktok")).rejects.toMatchObject({ code: "TEXTE_DE_VERSION" });
    await expect(pub.regenererTexteKit(v.id, "tiktok", { remplacerRetouche: true })).rejects.toMatchObject({ code: "TEXTE_DE_VERSION" });
    expect(appels).toHaveLength(0);
    expect((await depots().kits.trouver((k) => k.videoId === v.id))!.textes.tiktok?.texte).toBe(TEXTE_VERSION);
  });
});

describe("L3-10 · une saisie manuelle n'est jamais écrasée", () => {
  it("fabrication : le réseau saisi à la main n'est pas réécrit, aucun appel pour lui", async () => {
    const appels = await brancherClaude();
    const v = await video("v-r3-main");
    await pub.modifierTexteKit(v.id, "linkedin", "Ma saisie à moi.", ["#MaSaisie"]);
    await suite(v);
    expect(appels).not.toContain("linkedin");
    expect(appels.length).toBe(3);
    expect((await depots().kits.trouver((k) => k.videoId === v.id))!.textes.linkedin).toMatchObject({ texte: "Ma saisie à moi.", modifieAMain: true });
  });

  it("« Réécrire » sans confirmation : refusé, aucun appel, saisie intacte", async () => {
    const appels = await brancherClaude();
    const v = await video("v-r3-confirmer");
    await pub.modifierTexteKit(v.id, "instagram", "Saisie manuelle.", []);
    await expect(pub.regenererTexteKit(v.id, "instagram")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(appels).toHaveLength(0);
    expect((await depots().kits.trouver((k) => k.videoId === v.id))!.textes.instagram?.texte).toBe("Saisie manuelle.");
  });

  it("la version change : la saisie manuelle sur son réseau n'est pas écrasée par la resynchronisation", async () => {
    await brancherClaude();
    const v = await videoDeVersion("v-r3-resync", 1);
    await pub.obtenirKit(v.id);
    await pub.modifierTexteKit(v.id, "tiktok", "Ma retouche TikTok.", []);
    await depots().variantes.enregistrer({ id: "var-r3", code: "R3-TT", version: 2, scriptMaitreId: "maitre-r3", reseau: "tiktok", publication: { texte: "Version 2 du texte validé.", motsDiese: [] } } as never);
    await pub.obtenirKit(v.id);
    expect((await depots().kits.trouver((k) => k.videoId === v.id))!.textes.tiktok).toMatchObject({ texte: "Ma retouche TikTok.", modifieAMain: true });
  });
});

describe("L3-10 · générateur : plus de branche morte", () => {
  it("chaine.ts ne contient plus le ternaire sans effet sur lienSuivi", () => {
    const src = readFileSync("src/generateur/chaine.ts", "utf8");
    expect(src).not.toMatch(/\?\s*undefined\s*:\s*undefined/);
    expect(src).not.toMatch(/lienSuivi:\s*objectif/);
  });
});
