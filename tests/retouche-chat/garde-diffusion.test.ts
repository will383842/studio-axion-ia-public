/**
 * N-22 : aucune retouche appliquée (ni retour en arrière) sur une vidéo programmée ou publiée.
 * Fonction pure + route avec dépôts en mémoire, ports doublés qui comptent les appels.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

const etat = vi.hoisted(() => ({ actif: true, appelsGenerateur: [] as string[], appelsStudio: 0, choix: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const ports = () => ({
  appeler: async () => ({ texte: '{"operations":[]}' }),
  lireVersionChoisie: async () => null,
  enregistrerVersion: async () => ({ versionId: "x" }),
  choisirVersion: async (_v: string, id: string) => void etat.choix.push(id),
});
vi.mock("@/services/retouche-chat/generateurs-studio", () => ({
  retoucheChatActifServeur: async () => etat.actif,
  portsGenerateurStudio: (g: string) => (etat.appelsGenerateur.push(g), ports()),
}));
vi.mock("@/services/retouche-chat/studio", () => ({ portsStudio: () => (etat.appelsStudio++, ports()) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { POST } = await import("@/app/api/retouche-chat/route");
const { CLE_REGLAGE_SANS_GENERATEUR, videoEnDiffusion } = await import("@/services/retouche-chat/garde-acces");

const MDP = "essai-n-22-garde-diffusion";
const t0 = "2026-11-15T10:00:00.000Z";
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const version = (id: string, videoId: string, choisie: boolean) => ({ id, videoId, numero: 1, choisie, creeLe: t0, modifieLe: t0 }) as never;
const ETAPES = ["a_relire", "validee", "programmee", "publiee"] as const;

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  etat.appelsGenerateur = [];
  etat.appelsStudio = 0;
  etat.choix = [];
  await auth.seConnecter(MDP, false);
  await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, true);
  for (const e of ETAPES) {
    await depots().videos.enregistrer({ id: e, titre: e, etapeEditoriale: e, versionChoisieId: e + "1", creeLe: t0, modifieLe: t0 } as never);
    await depots().versions.enregistrer(version(e + "1", e, true));
    await depots().versions.enregistrer(version(e + "2", e, false));
  }
});

describe("videoEnDiffusion (fonction pure)", () => {
  it("vrai seulement pour programmee et publiee", async () => {
    for (const e of ETAPES) expect(await videoEnDiffusion("V", async () => ({ etapeEditoriale: e }))).toBe(e === "programmee" || e === "publiee");
  });
  it("vidéo absente ou lecture qui lève : vrai (prudent)", async () => {
    expect(await videoEnDiffusion("V", async () => null)).toBe(true);
    expect(await videoEnDiffusion("V", async () => undefined)).toBe(true);
    expect(await videoEnDiffusion("V", async () => { throw new Error("x"); })).toBe(true);
  });
});

describe("route", () => {
  const corps = (e: string, action: string) =>
    action === "appliquer" ? { action, videoId: e, demande: "zoom", operations: [] } : action === "revenir" ? { action, videoId: e, versionId: e + "2" } : { action, videoId: e, demande: "zoom" };
  it.each(["programmee", "publiee"])("%s : appliquer et revenir refusés (409), aucun port", async (e) => {
    for (const action of ["appliquer", "revenir"]) {
      const r = await POST(requete(corps(e, action)));
      expect(r.status).toBe(409);
      expect(await r.json()).toEqual({ erreur: "Cette vidéo est programmée ou publiée : elle ne se retouche pas ici." });
    }
    expect(etat.appelsStudio).toBe(0);
    expect(etat.appelsGenerateur).toEqual([]);
    expect(etat.choix).toEqual([]);
  });
  it.each(["programmee", "publiee"])("%s : apercu reste permis (n'écrit rien)", async (e) => {
    expect((await POST(requete(corps(e, "apercu")))).status).toBe(200);
  });
  it.each(["a_relire", "validee"])("%s : comportement d'avant (200)", async (e) => {
    for (const action of ["apercu", "appliquer", "revenir"]) expect((await POST(requete(corps(e, action)))).status).toBe(200);
    expect(etat.appelsStudio).toBe(3);
    expect(etat.choix).toEqual([e + "2"]);
  });
});
