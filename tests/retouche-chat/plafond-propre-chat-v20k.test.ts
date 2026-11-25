/**
 * S3-07-v20k : le chat de retouche a son PROPRE plafond par vidéo (« rtcht »). Ses lectures ne comptent jamais dans le
 * plafond des textes de publication, ni dans les plafonds propres voisins. Dépôts mémoire et vrai module de dépense,
 * aucun appel réseau, aucun appel à Claude.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const dcv = await import("@/services/depense-claude-video");
const { ecrireParametre } = await import("@/services/_commun");
const { nouvelId } = await import("@/lib/ids");
import type { DefinitionRole } from "@/generateur/roles/types";
import type { Video } from "@/domaine/types";

const MDP = "essai-plafond-propre-chat";
const ETAPE_LECTURE = "Retouche chat · lecture";
const PREFIXE = "Retouche chat ·";

/** Le plafond du chat tel que l'appelant le passera (fiche S2-07-v20k) ; la conversion ne sert qu'à compiler avant le code. */
function plafondChat(): import("@/services/depense-claude-video").PlafondPropre {
  const prefixeEtape = (dcv as unknown as { PREFIXE_ETAPE_RETOUCHE_CHAT?: string }).PREFIXE_ETAPE_RETOUCHE_CHAT ?? PREFIXE;
  return { id: "rtcht", parametre: "retoucheChat.plafondLectureUsd", defautUsd: 0.27, prefixeEtape } as import("@/services/depense-claude-video").PlafondPropre;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-chat-plafond", estDemo: false, formatId: "facecam-animee" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depense(videoId: string, etape: string, centimesEur: number) {
  const date = new Date().toISOString();
  const ligne = { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

async function reservation(videoId: string, travailId: string, centimes: number) {
  const date = new Date().toISOString();
  await depots().reservations.enregistrer({ id: `res-${travailId}`, fournisseur: "anthropic", videoId, travailId, centimes, devise: "USD", statut: "active", creeLe: date, modifieLe: date });
}

describe("S3-07-v20k · plafond propre du chat de retouche (« rtcht »)", () => {
  it("a) une lecture du chat ne compte PAS dans le plafond des textes de publication ; elle compte dans celui du chat", async () => {
    const v = await video();
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    await depense(v.id, ETAPE_LECTURE, 8);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondChat())).toBeGreaterThan(0);
  });

  it("b) une réservation active « txtpub-rtcht-… » n'entre pas dans le plafond des textes ; elle entre dans celui du chat", async () => {
    const v = await video();
    await reservation(v.id, "txtpub-rtcht-essai1", 9);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondChat())).toBe(9);
    // Témoin : une réservation d'un texte de publication, elle, compte bien dans le plafond des textes et pas dans celui du chat.
    await reservation(v.id, "txtpub-essai2", 5);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(5);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondChat())).toBe(9);
  });

  it("c) disjoints : la lecture du chat ne change ni le découpage du tableau, ni son script, ni les vidéos d'illustration ; et inversement", async () => {
    const v = await video();
    await depense(v.id, ETAPE_LECTURE, 8);
    await reservation(v.id, "txtpub-rtcht-essai3", 9);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.PLAFOND_DECOUPAGE_TABLEAU)).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondScriptTableau(1))).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa())).toBe(0);
    const chat = await dcv.engagePlafondPropreCentimes(v.id, plafondChat());
    await depense(v.id, "Tableau · découpage", 40);
    await reservation(v.id, "txtpub-tbdec-essai4", 30);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondChat())).toBe(chat);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.PLAFOND_DECOUPAGE_TABLEAU)).toBeGreaterThan(30);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });

  it("d) une étape qui ne commence pas par « Retouche chat · » est refusée avant tout appel (ETAPE_INVALIDE)", async () => {
    const v = await video();
    await ecrireParametre("fournisseur.texte-reseaux", "claude");
    const gc = await import("@/services/generation-claude");
    const appels: unknown[] = [];
    gc.injecterClaudePourEssai({ cle: "sk-ant-essai-s3-07", fetch: (async () => { appels.push(1); throw new Error("réseau interdit"); }) as typeof fetch, attenteMs: () => 0 });
    try {
      const role: DefinitionRole = { id: "retouche-chat-lecture", version: 1, consigne: "Consigne d'essai.", modele: "claude-sonnet-5-5", effort: "low", maxTokens: 100, sansPhrasesFixes: true, simuler: () => "" };
      await expect(dcv.executerRolePourVideo(v.id, role, { contexte: {}, variable: "demande" }, { etape: "Texte de publication · LinkedIn", plafondPropre: plafondChat(), origine: "studio" })).rejects.toMatchObject({ code: "ETAPE_INVALIDE" });
    } finally {
      gc.injecterClaudePourEssai(null);
    }
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.lister((r) => r.videoId === v.id)).toHaveLength(0);
    expect(await depots().depenses.lister((x) => x.videoId === v.id)).toHaveLength(0);
  });

  it("e) le fichier d'argent : les trois listes fermées portent le chat, et aucun plafond existant n'a bougé", () => {
    const source = readFileSync(resolve(process.cwd(), "src/services/depense-claude-video.ts"), "utf8");
    expect(dcv.PREFIXE_ETAPE_RETOUCHE_CHAT).toBe(PREFIXE);
    expect(source).toContain('id: "tbdec" | "tbscr" | "favid" | "rtcht" | "tbreg";');
    expect(source).toMatch(/const PREFIXES_PLAFONDS_PROPRES = \["Tableau · découpage", "Tableau · script", PREFIXE_ETAPE_VIDEOS_FA, PREFIXE_ETAPE_RETOUCHE_CHAT, PREFIXE_ETAPE_REGARD_TABLEAU\] as const;/);
    expect(source).toMatch(/const PREFIXES_APPELS_PROPRES = \["tbdec", "tbscr", "favid", "rtcht", "tbreg"\]\.map\(/);
    expect(dcv.PLAFOND_KIT_USD).toBe(0.3);
    expect(dcv.PLAFOND_FACECAM_VERSION_USD).toBe(1.5);
    expect(dcv.PLAFOND_VIDEOS_FA_USD).toBe(0.6);
    expect(dcv.PLAFOND_DECOUPAGE_TABLEAU_USD).toBe(0.6);
    // Aucune clé de réglage, aucun montant du chat dans ce fichier : ils sont portés par l'appelant.
    expect(source).not.toMatch(/plafondLectureUsd|0\.27/);
  });
});
