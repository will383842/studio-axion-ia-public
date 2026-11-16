/** G14-04 : actions `historique` et `retablir` de la route (dépôts en mémoire, ports doublés). */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

const etat = vi.hoisted(() => ({ actif: true, choix: [] as string[] }));
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
  portsGenerateurStudio: () => ports(),
}));
vi.mock("@/services/retouche-chat/studio", () => ({ portsStudio: () => ports() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { POST } = await import("@/app/api/retouche-chat/route");
const { CLE_REGLAGE_SANS_GENERATEUR } = await import("@/services/retouche-chat/garde-acces");

const MDP = "essai-g14-04-historique";
const t0 = "2026-11-16T10:00:00.000Z";
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const version = (id: string, videoId: string, numero: number, parent: string | undefined, choisie: boolean) =>
  ({ id, videoId, numero, parentVersionId: parent, choisie, statut: "prete", commande: { secret: 1 }, projetMontage: { prive: 1 }, creeLe: t0, modifieLe: t0 }) as never;

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  etat.actif = true;
  etat.choix = [];
  await auth.seConnecter(MDP, false);
  await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, true);
  for (const [id, etape] of [["a_relire", "a_relire"], ["programmee", "programmee"], ["publiee", "publiee"]] as const) {
    await depots().videos.enregistrer({ id, titre: id, etapeEditoriale: etape, versionChoisieId: id + "2", creeLe: t0, modifieLe: t0 } as never);
    await depots().versions.enregistrer(version(id + "1", id, 1, undefined, false));
    await depots().versions.enregistrer(version(id + "2", id, 2, id + "1", true));
    await depots().versions.enregistrer(version(id + "3", id, 3, id + "2", false));
  }
});

describe("historique et retablir", () => {
  it("sans session : 401", async () => {
    reinitialiserRequete();
    for (const action of ["historique", "retablir"]) expect((await POST(requete({ action, videoId: "a_relire" }))).status).toBe(401);
  });
  it("générateur éteint : 403 pour les deux actions", async () => {
    etat.actif = false;
    for (const action of ["historique", "retablir"]) expect((await POST(requete({ action, generateur: "avocat", videoId: "a_relire" }))).status).toBe(403);
    expect(etat.choix).toEqual([]);
  });
  it("voie sans générateur fermée : 403", async () => {
    await ecrireParametre(CLE_REGLAGE_SANS_GENERATEUR, false);
    for (const action of ["historique", "retablir"]) expect((await POST(requete({ action, videoId: "a_relire" }))).status).toBe(403);
  });
  it("historique d'une vidéo publiée : 200, lecture seule, sans commande ni projetMontage", async () => {
    const r = await POST(requete({ action: "historique", videoId: "publiee" }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.versions.map((x: { id: string }) => x.id)).toEqual(["publiee1", "publiee2", "publiee3"]);
    const s = JSON.stringify(j);
    expect(s).not.toContain("commande");
    expect(s).not.toContain("projetMontage");
    expect(etat.choix).toEqual([]);
  });
  it.each(["programmee", "publiee"])("retablir sur vidéo %s : 409 et choisirVersion jamais appelé", async (e) => {
    const r = await POST(requete({ action: "retablir", videoId: e }));
    expect(r.status).toBe(409);
    expect(etat.choix).toEqual([]);
  });
  it("retablir normal : bascule vers l'enfant le plus récent, aucune version écrite ni supprimée", async () => {
    const avant = (await depots().versions.lister(() => true)).length;
    const r = await POST(requete({ action: "retablir", videoId: "a_relire" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ statut: "retablie", versionId: "a_relire3" });
    expect(etat.choix).toEqual(["a_relire3"]);
    expect((await depots().versions.lister(() => true)).length).toBe(avant);
  });
  it("rien à rétablir : 409", async () => {
    await depots().videos.enregistrer({ id: "fin", titre: "fin", etapeEditoriale: "a_relire", versionChoisieId: "fin1", creeLe: t0, modifieLe: t0 } as never);
    await depots().versions.enregistrer(version("fin1", "fin", 1, undefined, true));
    const r = await POST(requete({ action: "retablir", videoId: "fin" }));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erreur: "Rien à rétablir." });
    expect(etat.choix).toEqual([]);
  });
  it("retablir ignore les versions d'une autre vidéo", async () => {
    await depots().versions.enregistrer(version("autre9", "programmee", 9, "a_relire2", false));
    const r = await POST(requete({ action: "retablir", videoId: "a_relire" }));
    expect(await r.json()).toEqual({ statut: "retablie", versionId: "a_relire3" });
  });
});
