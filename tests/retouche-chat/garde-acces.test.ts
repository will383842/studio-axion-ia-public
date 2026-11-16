/**
 * C7-02 : ferme l'entrée du chat de retouche. Sans `generateur` : 403 tant que `retoucheChat.sansGenerateur` n'est pas `true`.
 * `revenir` : refus (404) si la version n'est pas de la vidéo. Dépôts en mémoire réels, ports doublés.
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
const { choisirVersion } = await import("@/services/videos");
const { POST } = await import("@/app/api/retouche-chat/route");
const { CLE_REGLAGE_SANS_GENERATEUR, sansGenerateurActif, versionDeLaVideo } = await import("@/services/retouche-chat/garde-acces");

const MDP = "essai-c7-02-garde-acces";
const t0 = "2026-11-15T10:00:00.000Z";
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const version = (id: string, videoId: string, choisie: boolean) => ({ id, videoId, numero: 1, choisie, creeLe: t0, modifieLe: t0 }) as never;

async function etatVideoA() {
  const v = await depots().videos.obtenir("A");
  const vs = await depots().versions.lister((x) => x.videoId === "A");
  return { choisieId: (v as { versionChoisieId?: string }).versionChoisieId, drapeaux: vs.map((x) => [x.id, x.choisie]).sort() };
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  etat.actif = true;
  etat.appelsGenerateur = [];
  etat.appelsStudio = 0;
  etat.choix = [];
  await auth.seConnecter(MDP, false);
  await depots().videos.enregistrer({ id: "A", titre: "A", versionChoisieId: "a1", creeLe: t0, modifieLe: t0 } as never);
  await depots().videos.enregistrer({ id: "B", titre: "B", versionChoisieId: "b1", creeLe: t0, modifieLe: t0 } as never);
  await depots().versions.enregistrer(version("a1", "A", true));
  await depots().versions.enregistrer(version("a2", "A", false));
  await depots().versions.enregistrer(version("b1", "B", true));
});

describe("fonctions pures", () => {
  it("sansGenerateurActif : seul true allume", async () => {
    expect(CLE_REGLAGE_SANS_GENERATEUR).toBe("retoucheChat.sansGenerateur");
    expect(await sansGenerateurActif(async () => true)).toBe(true);
    for (const v of [false, "true", 1, undefined, null]) expect(await sansGenerateurActif(async () => v)).toBe(false);
    expect(await sansGenerateurActif(async () => { throw new Error("x"); })).toBe(false);
  });
  it("versionDeLaVideo : même vidéo seulement", async () => {
    expect(await versionDeLaVideo("A", "a1", async () => ({ videoId: "A" }))).toBe(true);
    expect(await versionDeLaVideo("A", "b1", async () => ({ videoId: "B" }))).toBe(false);
    expect(await versionDeLaVideo("A", "zz", async () => null)).toBe(false);
    expect(await versionDeLaVideo("A", "zz", async () => undefined)).toBe(false);
    expect(await versionDeLaVideo("A", "a1", async () => { throw new Error("x"); })).toBe(false);
  });
});

describe("choisirVersion réelle (N-15)", () => {
  it("version d'une autre vidéo ou inexistante : lève INTROUVABLE, rien n'est écrit", async () => {
    const avant = await etatVideoA();
    for (const id of ["b1", "zz"]) await expect(choisirVersion("A", id)).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect(await etatVideoA()).toEqual(avant);
  });
  it("version de la même vidéo : choisie", async () => {
    await choisirVersion("A", "a2");
    expect(await etatVideoA()).toEqual({ choisieId: "a2", drapeaux: [["a1", false], ["a2", true]] });
  });
});

describe("route : voie sans générateur fermée", () => {
  const actions = [
    { action: "apercu", videoId: "A", demande: "zoom" },
    { action: "appliquer", videoId: "A", demande: "zoom", operations: [] },
    { action: "revenir", videoId: "A", versionId: "a1" },
  ];
  it.each([["absent", undefined], ["false", false], ['"true"', "true"], ["1", 1]])("interrupteur %s : 403 sur les trois actions, aucun port", async (_n, valeur) => {
    if (valeur !== undefined) await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, valeur);
    for (const c of actions) expect((await POST(requete(c))).status).toBe(403);
    expect(etat.appelsStudio).toBe(0);
    expect(etat.appelsGenerateur).toEqual([]);
    expect(etat.choix).toEqual([]);
  });
  it("interrupteur true : comportement d'avant (200, portsStudio)", async () => {
    await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, true);
    for (const c of actions) expect((await POST(requete(c))).status).toBe(200);
    expect(etat.appelsStudio).toBe(3);
    expect(etat.choix).toEqual(["a1"]);
  });
  it("sans session : 401", async () => {
    await auth.seDeconnecter();
    expect((await POST(requete(actions[0]))).status).toBe(401);
  });
});

describe("route : revenir vers une version qui n'est pas de la vidéo", () => {
  it.each([["avec générateur", { generateur: "avocat" }], ["sans générateur", {}]])("%s : 404, choisirVersion jamais appelé", async (_n, extra) => {
    await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, true);
    for (const versionId of ["b1", "zz"]) {
      const r = await POST(requete({ action: "revenir", videoId: "A", versionId, ...extra }));
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ erreur: "Cette version n'appartient pas à cette vidéo." });
    }
    expect(etat.choix).toEqual([]);
  });
  it("même vidéo, avec générateur allumé : 200", async () => {
    const r = await POST(requete({ action: "revenir", videoId: "A", versionId: "a2", generateur: "avocat" }));
    expect(r.status).toBe(200);
    expect(etat.choix).toEqual(["a2"]);
  });
  it("générateur nommé éteint : 403 ; inconnu : 400", async () => {
    etat.actif = false;
    expect((await POST(requete({ action: "apercu", videoId: "A", demande: "z", generateur: "avocat" }))).status).toBe(403);
    expect((await POST(requete({ action: "apercu", videoId: "A", demande: "z", generateur: "nimporte" }))).status).toBe(400);
  });
});
