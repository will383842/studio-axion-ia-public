/**
 * L0-13c — écrans sans Buffer : la feuille d'envoi lit les comptes ZERNIO en base ; Réglages n'a plus de bloc Buffer.
 * Rendu serveur / lecture de sources, données fictives, aucun appel réseau.
 */
import { readFileSync, existsSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CanalPublication } from "@/fournisseurs/types";

delete process.env.BUFFER_API_KEY;
vi.hoisted(() => {
  process.env.FOURNISSEUR_PUBLICATION = "zernio";
  process.env.ZERNIO_API_KEY = "cle-factice-essai";
});

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_CANAUX_ZERNIO, vueEnvoiZernio } = await import("@/services/comptes-envoi-zernio");

const MDP = "essai-l0-13c";
const canal = (id: string, nom: string, service: string): CanalPublication => ({ id, organisationId: "zernio", nom, service, deconnecte: false });
const lire = (p: string) => readFileSync(p, "utf8");

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("L0-13c · comptes de la feuille d'envoi : Zernio, jamais Buffer, aucun réseau", () => {
  it("lit zernio.canaux ; un réseau sans compte relié dit « Reliez ce compte dans Zernio »", async () => {
    const reseau = vi.fn(() => {
      throw new Error("aucun appel réseau attendu");
    });
    vi.stubGlobal("fetch", reseau);
    await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: "2026-11-01T08:00:00.000Z", canaux: [canal("zer-ig-1", "Compte Zernio exemple", "instagram")] });
    // Une copie Buffer différente existe : elle ne doit jamais apparaître.
    await ecrireParametre("buffer.canaux", { lusLe: "2026-11-01T08:00:00.000Z", canaux: [{ id: "buf-tt-1", nom: "Compte Buffer exemple", service: "tiktok", deconnecte: false, organisationId: "o" }] });
    const vue = await vueEnvoiZernio();
    expect(vue?.comptes.instagram).toEqual({ nom: "Compte Zernio exemple" });
    expect(vue?.comptes.tiktok).toEqual({ probleme: "Reliez ce compte dans Zernio" });
    expect(JSON.stringify(vue)).not.toMatch(/buf-tt-1|Compte Buffer exemple/);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("comptes Zernio jamais lus : chaque réseau dit « Reliez ce compte dans Zernio »", async () => {
    const vue = await vueEnvoiZernio();
    expect(vue?.mode).toBe("brouillon");
    expect(vue?.comptes.instagram?.probleme).toBe("Reliez ce compte dans Zernio");
  });
});

describe("L0-13c · sources des écrans", () => {
  const CINQ = [
    "src/components/publication/FeuilleEnvoyerBuffer.tsx",
    "src/components/publication/BarreActionsVideo.tsx",
    "src/components/publication/KitPublication.tsx",
    "src/components/generateur/FicheSujet.tsx",
    "src/components/publication/LignesAPublier.tsx",
  ];
  /** Sans commentaires ni identifiants : reste le texte et les chaînes. « Buffer » doit y être absent, sauf libellé historique (via « buffer »). */
  const visible = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/\w*Buffer\w*|\w*buffer\w*/g, (m) => (m === "Buffer" ? m : ""));

  it.each(CINQ)("%s : « Buffer » n'est pas un libellé visible", (f) => {
    const restes = visible(lire(f)).split("\n").filter((l) => /\bBuffer\b/.test(l));
    const hors = restes.filter((l) => !/historique|via\s*[=:]*\s*["']buffer["']/i.test(l));
    expect(hors).toEqual([]);
  });

  it.each(CINQ)("%s : les anciens libellés ont disparu", (f) => {
    expect(lire(f)).not.toMatch(/Buffer · Programmer|brouillon dans Buffer|Publier \(Buffer\)/);
  });

  it("la feuille garde son nom et sa fonction", () => {
    expect(lire(CINQ[0])).toContain("export function FeuilleEnvoyerBuffer");
  });

  it("la fiche vidéo lit les comptes Zernio, pas Buffer", () => {
    const page = lire("src/app/(studio)/videos/[id]/page.tsx");
    expect(page).toContain("vueEnvoiZernio");
    expect(page).not.toMatch(/vueEnvoiBuffer|@\/services\/buffer"/);
  });

  it("Réglages : plus de bloc Buffer, plus de vueBuffer ; fichiers retirés ; carte « L'Usine en automatique » et OUTILS_PLACEMENT intacts", () => {
    const page = lire("src/app/(studio)/reglages/page.tsx");
    expect(page).not.toMatch(/BlocBuffer|vueBuffer|actions-buffer/);
    expect(existsSync("src/components/reglages/BlocBuffer.tsx")).toBe(false);
    expect(existsSync("src/app/(studio)/reglages/actions-buffer.ts")).toBe(false);
    expect(page).toContain("OUTILS_PLACEMENT");
    expect(page).toContain('id: "buffer", nom: "Outil principal"');
    expect(page).toContain("L'Usine en automatique");
  });
});
