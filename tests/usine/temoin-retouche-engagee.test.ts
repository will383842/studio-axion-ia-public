/**
 * Témoin D2-A : fige l'AVANT. C7-02 + N-15 (porte du chat, version d'une autre vidéo) et N-22 (refus sur vidéo programmée
 * ou publiée) changeront les attentes marquées `// CHANGERA` ; ils les modifient, jamais ne les suppriment.
 *
 * Constat, pas de correction : sur une vidéo ENGAGÉE (étape « validée » puis « programmée », créneau validé, publication
 * programmée), que font aujourd'hui la retouche, le choix de version et le chat « revenir » ?
 * Dépôts en mémoire, session d'essai, moteur d'essai (vidéo de démonstration), aucun réseau, aucun appel payant.
 */
import { hash } from "@node-rs/argon2";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Publication, VersionVideo } from "@/domaine/types";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const videos = await import("@/services/videos");
const boucle = await import("@/services/boucle");
const { POST } = await import("@/app/api/retouche-chat/route");

const MDP = "temoin-d2-a";
const VIDEO = "v-03";
const MAINT = "2026-11-20T10:00:00.000Z";
const base = { creeLe: MAINT, modifieLe: MAINT };

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
});

const creneau = (extra: Partial<CreneauEditorial> = {}): CreneauEditorial => ({
  id: "cre-temoin", jourVise: "2026-12-10", heuresParReseau: { linkedin: "2026-12-10T08:30:00.000Z" }, compteCible: "compte-fictif-1",
  videoId: VIDEO, statut: "valide", decalages: 0, valideeLe: MAINT, valideePar: "studio", ...extra,
});
const publication = (): Publication =>
  ({ id: "pub-temoin", videoId: VIDEO, reseau: "linkedin", statut: "programmee", via: "simulation", date: "2026-12-10T08:30:00.000Z", texte: "texte fictif", ...base }) as Publication;

/** Vidéo engagée : étape donnée, créneau validé, publication programmée sur la version choisie. */
async function engager(etape: "validee" | "programmee") {
  const d = depots();
  const v = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { etapeEditoriale: etape });
  await d.creneauxEditoriaux.enregistrer(creneau());
  await d.publications.enregistrer(publication());
  return { versionId: v.versionChoisieId! };
}
const instantane = async () => ({
  creneau: await depots().creneauxEditoriaux.obtenir("cre-temoin"),
  publication: await depots().publications.obtenir("pub-temoin"),
});
/** Deuxième version de la même vidéo (pour le choix de version). */
async function autreVersion(videoId: string, id: string, versionDeBase: string): Promise<VersionVideo> {
  const ver = (await depots().versions.obtenir(versionDeBase))!;
  return depots().versions.enregistrer({ ...ver, id, videoId, numero: 90, choisie: false, parentVersionId: ver.id });
}

describe("témoin D2-A · 1. retouche sur une vidéo engagée", () => {
  for (const etape of ["validee", "programmee"] as const) {
    it(`vidéo « ${etape} » : la retouche est ACCEPTÉE aujourd'hui ; créneau et publication ne bougent pas`, async () => {
      const { versionId } = await engager(etape);
      const avant = await instantane();
      const plan = (await depots().plans.lister((p) => p.versionId === versionId))[0];
      const r = await fabrication.lancerRetouche(VIDEO, [plan.id], "plus net", { confirme: true }); // CHANGERA : N-22 (refus sur vidéo programmée ou publiée)
      expect(r.retoucheId).toBeTruthy();
      const v = (await depots().videos.obtenir(VIDEO))!;
      // Ce qu'elle écrit : une retouche, une nouvelle version non choisie, un travail ; la vidéo repasse « en fabrication ».
      expect(await depots().retouches.compter((x) => x.videoId === VIDEO && x.statut === "en_cours")).toBe(1);
      const nouvelle = (await depots().versions.lister((x) => x.videoId === VIDEO && x.parentVersionId === versionId))[0];
      expect(nouvelle).toMatchObject({ statut: "en_fabrication", choisie: false, noteRetouche: "plus net" });
      expect(v.statut).toBe("en_fabrication");
      // La version choisie et l'étape éditoriale restent celles d'avant : rien n'oblige à revalider (décision O1 : non prise ici).
      expect(v.versionChoisieId).toBe(versionId);
      expect(v.etapeEditoriale).toBe(etape); // CHANGERA : N-22
      // Le créneau et la publication ne changent pas.
      expect(await instantane()).toEqual(avant);
      expect(avant.creneau?.statut).toBe("valide");
      expect(avant.publication?.statut).toBe("programmee");
    });
  }
});

describe("témoin D2-A · 2. choix de version sur une vidéo programmée", () => {
  it("change `versionChoisieId` même sur une vidéo programmée ; la publication garde son ancien média", async () => {
    const { versionId } = await engager("programmee");
    await autreVersion(VIDEO, "ver-temoin-2", versionId);
    const avant = await instantane();
    await videos.choisirVersion(VIDEO, "ver-temoin-2"); // CHANGERA : N-22 (refus sur vidéo programmée ou publiée)
    expect((await depots().videos.obtenir(VIDEO))!.versionChoisieId).toBe("ver-temoin-2");
    expect((await depots().versions.obtenir("ver-temoin-2"))!.choisie).toBe(true);
    expect((await depots().versions.obtenir(versionId))!.choisie).toBe(false);
    expect(await instantane()).toEqual(avant);
    // La publication n'a pas de champ « version » : son média reste celui d'avant, l'enregistrement est identique (testé ci-dessus).
    expect((await depots().publications.obtenir("pub-temoin"))!.statut).toBe("programmee");
  });

  it("accepte même une version d'une AUTRE vidéo (trou)", async () => {
    const { versionId } = await engager("programmee");
    const autre = (await depots().videos.lister((x) => x.id !== VIDEO))[0];
    const etrangere = await autreVersion(autre.id, "ver-etrangere", versionId);
    await videos.choisirVersion(VIDEO, etrangere.id); // CHANGERA : N-15 (version d'une autre vidéo refusée)
    expect((await depots().videos.obtenir(VIDEO))!.versionChoisieId).toBe("ver-etrangere"); // CHANGERA : N-15
    expect((await depots().versions.obtenir("ver-etrangere"))!.videoId).toBe(autre.id);
  });
});

describe("témoin D2-A · 3. chat « revenir » sur une vidéo engagée", () => {
  const requete = (corps: unknown) => new NextRequest("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) });

  it("sans session : 401", async () => {
    await auth.seDeconnecter();
    const r = await POST(requete({ action: "revenir", videoId: VIDEO, versionId: "x" }));
    expect(r.status).toBe(401);
  });

  it("répond « revenue » et change la version choisie d'une vidéo programmée", async () => {
    const { versionId } = await engager("programmee");
    await autreVersion(VIDEO, "ver-temoin-2", versionId);
    const avant = await instantane();
    const r = await POST(requete({ action: "revenir", videoId: VIDEO, versionId: "ver-temoin-2" }));
    expect(r.status).toBe(200); // CHANGERA : C7-02 (porte du chat) et N-22 (refus sur vidéo programmée)
    expect(await r.json()).toEqual({ statut: "revenue", versionId: "ver-temoin-2" });
    expect((await depots().videos.obtenir(VIDEO))!.versionChoisieId).toBe("ver-temoin-2"); // CHANGERA : N-22
    expect(await instantane()).toEqual(avant);
  });

  it("accepte aussi une version d'une autre vidéo (trou)", async () => {
    const { versionId } = await engager("programmee");
    const autre = (await depots().videos.lister((x) => x.id !== VIDEO))[0];
    await autreVersion(autre.id, "ver-etrangere", versionId);
    const r = await POST(requete({ action: "revenir", videoId: VIDEO, versionId: "ver-etrangere" }));
    expect(r.status).toBe(200); // CHANGERA : N-15
    expect((await depots().videos.obtenir(VIDEO))!.versionChoisieId).toBe("ver-etrangere"); // CHANGERA : N-15
  });
});
