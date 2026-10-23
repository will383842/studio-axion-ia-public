/**
 * P2-04 : le suivi par publication (par vidéo et par réseau) : vues, visites, code de version. Jamais par personne. Base en mémoire, lecteur du site injecté : aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { LecteurVisites } from "../../../src/fournisseurs/mesures/plausible";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const suivi = await import("@/services/cas-concret-suivi");
const { suiviDesVideos, PAS_ENCORE_DE_MESURE } = suivi;

const MDP = "cas-concret-suivi";
const MAINTENANT = Date.parse("2026-10-12T12:00:00Z");
const JOUR = 86_400_000;
const il_y_a = (j: number) => new Date(MAINTENANT - j * JOUR).toISOString();

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Réglage `casConcret.releves` allumé DANS LE DOUBLE seulement (éteint par défaut dans le studio).
  await ecrireParametre("casConcret.releves", true);
});

/** Une vidéo du format dont la version choisie porte ce numéro (L2-07 : le lien de chaque réseau porte « 0042-CC-IG »). */
async function ajouterVideo(id: string, jours: number, entrees: Record<string, unknown>, formatId = "cas-concret", numero?: number, numeroSuivi?: number) {
  const base = (await depots().videos.obtenir("v-03"))!;
  const versionBase = (await depots().versions.obtenir(base.versionChoisieId!))!;
  const versionChoisieId = numero === undefined ? undefined : `ver-${id}`;
  if (versionChoisieId) await depots().versions.enregistrer({ ...versionBase, id: versionChoisieId, videoId: id, numero, ...(numeroSuivi === undefined ? {} : { numeroSuivi }) } as never);
  await depots().videos.enregistrer({ ...base, id, titre: `Vidéo ${id}`, formatId, statut: "terminee", creeLe: il_y_a(jours), modifieLe: il_y_a(jours), versionChoisieId, entrees: { casConcret: entrees } } as never);
}

const lecteur = (lignes: { campagne: string; source: string; visites: number; rendezVous: number }[]): LecteurVisites => ({ mode: "reel", lire: async () => lignes });

async function ajouterPublication(videoId: string, reseau: string, vues: number, statut = "publiee") {
  await depots().publications.enregistrer({
    id: `p-${videoId}-${reseau}`, creeLe: il_y_a(1), modifieLe: il_y_a(1), videoId, reseau, statut, via: "manuel", date: il_y_a(1), texte: "t", stats: { vues, likes: 0, commentaires: 0, partages: 0 },
  } as never);
}

describe("suiviDesVideos", () => {
  it("deux vidéos, deux réseaux : quatre lignes, vues et visites par code de version DU RÉSEAU (0042-CC-IG) et par réseau", async () => {
    await ajouterVideo("cc-1", 1, { codeSuivi: "cc-a-111111", mot: "IA", avecMot: true, reseaux: ["facebook", "instagram"], essai: false }, "cas-concret", 42);
    await ajouterVideo("cc-2", 2, { codeSuivi: "cc-a-222222", mot: "IA", avecMot: false, reseaux: ["facebook", "instagram"], essai: false }, "cas-concret", 7);
    await ajouterPublication("cc-1", "facebook", 400);
    await ajouterPublication("cc-2", "instagram", 90, "brouillon");
    const s = await suiviDesVideos({
      visites: lecteur([
        { campagne: "0042-CC-FB", source: "facebook", visites: 12, rendezVous: 2 },
        { campagne: "0042-CC-IG", source: "instagram", visites: 5, rendezVous: 0 },
        { campagne: "0007-CC-FB", source: "facebook", visites: 3, rendezVous: 1 },
        // L'ancienne clé (un code unique par vidéo) et un code d'un autre réseau ne comptent pas.
        { campagne: "cc-a-111111", source: "facebook", visites: 50, rendezVous: 0 },
        { campagne: "0042-CC-FB", source: "instagram", visites: 40, rendezVous: 0 },
        { campagne: "autre", source: "facebook", visites: 99, rendezVous: 9 },
      ]),
    });
    expect(s.lignes).toHaveLength(4);
    const l = (v: string, r: string) => s.lignes.find((x) => x.videoId === v && x.reseau === r)!;
    expect(l("cc-1", "facebook")).toMatchObject({ visites: 12, vues: 400, codeSuivi: "0042-CC-FB", mesure: true });
    expect(l("cc-1", "instagram")).toMatchObject({ visites: 5, codeSuivi: "0042-CC-IG", mesure: true });
    expect(l("cc-1", "instagram").vues).toBeUndefined();
    expect(l("cc-2", "facebook")).toMatchObject({ visites: 3, codeSuivi: "0007-CC-FB", mesure: true });
    expect(l("cc-2", "instagram")).toMatchObject({ visites: 0, codeSuivi: "0007-CC-IG", mesure: false });
    // Une publication non publiée n'a pas de vues à montrer.
    expect(l("cc-2", "instagram").vues).toBeUndefined();
    expect(l("cc-1", "facebook").date).toBe(il_y_a(1).slice(0, 10));
    expect(s.pasEncoreDeMesure).toBe(false);
  });

  it("sans numéro de version : « pas encore de mesure », jamais une erreur ; le code vide", async () => {
    await ajouterVideo("cc-1", 1, { codeSuivi: "cc-a-111111", reseaux: ["facebook"], essai: false });
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "cc-a-111111", source: "facebook", visites: 12, rendezVous: 0 }]) });
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]).toMatchObject({ codeSuivi: "", visites: 0, mesure: false });
  });

  it("une retouche (nouvelle version choisie) : le code affiché est celui de la version choisie, les visites des versions déjà publiées restent comptées", async () => {
    // La version 42 est publiée sur Instagram (30 visites sur 0042-CC-IG) ; une retouche fait de la 43 la version choisie.
    await ajouterVideo("cc-1", 1, { reseaux: ["instagram"], essai: false }, "cas-concret", 43);
    const choisie = (await depots().versions.obtenir("ver-cc-1"))!;
    await depots().versions.enregistrer({ ...choisie, id: "ver-cc-1-v42", numero: 42, choisie: false } as never);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-IG", source: "instagram", visites: 30, rendezVous: 0 }, { campagne: "0043-CC-IG", source: "instagram", visites: 8, rendezVous: 0 }, { campagne: "0042-CC-FB", source: "facebook", visites: 99, rendezVous: 0 }]) });
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]).toMatchObject({ codeSuivi: "0043-CC-IG", visites: 38, mesure: true });
  });

  it("une version qui n'a que les visites d'une ancienne version : mesurée, code de la version choisie", async () => {
    await ajouterVideo("cc-1", 1, { reseaux: ["instagram"], essai: false }, "cas-concret", 43);
    const choisie = (await depots().versions.obtenir("ver-cc-1"))!;
    await depots().versions.enregistrer({ ...choisie, id: "ver-cc-1-v42", numero: 42, choisie: false } as never);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-IG", source: "instagram", visites: 30, rendezVous: 0 }]) });
    expect(s.lignes[0]).toMatchObject({ codeSuivi: "0043-CC-IG", visites: 30, mesure: true });
  });

  it("deux versions de la même vidéo au même numéro (une version effacée puis recréée) : la même clé n'est comptée qu'une fois", async () => {
    await ajouterVideo("cc-1", 1, { reseaux: ["instagram"], essai: false }, "cas-concret", 42);
    const choisie = (await depots().versions.obtenir("ver-cc-1"))!;
    await depots().versions.enregistrer({ ...choisie, id: "ver-cc-1-bis", choisie: false } as never);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-IG", source: "instagram", visites: 30, rendezVous: 0 }]) });
    expect(s.lignes[0]).toMatchObject({ codeSuivi: "0042-CC-IG", visites: 30 });
  });

  it("republiée sur le même réseau : les vues de toutes les publications publiées sont additionnées", async () => {
    await ajouterVideo("cc-1", 1, { reseaux: ["instagram"], essai: false }, "cas-concret", 42);
    await ajouterPublication("cc-1", "instagram", 400);
    await depots().publications.enregistrer({ id: "p-cc-1-instagram-bis", creeLe: il_y_a(0), modifieLe: il_y_a(0), videoId: "cc-1", reseau: "instagram", statut: "publiee", via: "manuel", date: il_y_a(0), texte: "t", stats: { vues: 250, likes: 0, commentaires: 0, partages: 0 } } as never);
    await ajouterPublication("cc-1", "tiktok", 9999);
    const s = await suiviDesVideos({ visites: lecteur([]) });
    expect(s.lignes[0].vues).toBe(650);
  });

  it("jamais par personne : ni rendez-vous, ni mot, ni rappel du mot, ni prospect", async () => {
    await ajouterVideo("cc-1", 1, { mot: "IA", avecMot: true, reseaux: ["facebook"], essai: false }, "cas-concret", 42);
    await ajouterVideo("cc-2", 2, { mot: "IA", avecMot: true, reseaux: ["facebook"], essai: false }, "cas-concret", 7);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-FB", source: "facebook", visites: 12, rendezVous: 2 }]) });
    expect(Object.keys(s)).toEqual(["lignes", "pasEncoreDeMesure"]);
    for (const x of s.lignes) expect(Object.keys(x).sort()).toEqual(["codeSuivi", "date", "mesure", "reseau", "titre", "videoId", "visites"].concat("vues" in x ? ["vues"] : []).sort());
    expect(JSON.stringify(s)).not.toMatch(/rendezVous|"mot"|rappel|prospect/i);
    expect(suivi).not.toHaveProperty("rappelDuMot");
  });

  it("simulation : zéros et « pas encore de mesure »", async () => {
    await ajouterVideo("cc-1", 1, { codeSuivi: "cc-a-111111", reseaux: ["facebook", "tiktok"], essai: false });
    const s = await suiviDesVideos({ visites: { mode: "simulation", lire: async () => null } });
    expect(s.lignes).toHaveLength(2);
    expect(s.lignes.every((x) => x.visites === 0 && !x.mesure)).toBe(true);
    expect(s.pasEncoreDeMesure).toBe(true);
    expect(PAS_ENCORE_DE_MESURE).toBe("pas encore de mesure");
  });

  it("une lecture qui échoue donne les mêmes zéros, sans erreur", async () => {
    await ajouterVideo("cc-1", 1, { codeSuivi: "cc-a-111111", reseaux: ["facebook"], essai: false });
    const s = await suiviDesVideos({ visites: { mode: "reel", lire: async () => { throw new Error("hors ligne"); } } });
    expect(s.lignes[0]).toMatchObject({ visites: 0, mesure: false });
    expect(s.pasEncoreDeMesure).toBe(true);
  });

  it("ignore les essais, les autres formats et les vidéos archivées", async () => {
    await ajouterVideo("cc-essai", 1, { codeSuivi: "x", reseaux: ["facebook"], essai: true });
    await ajouterVideo("autre", 1, { codeSuivi: "y", reseaux: ["facebook"] }, "avocat");
    await ajouterVideo("cc-ok", 1, { codeSuivi: "z", reseaux: ["facebook"], essai: false });
    await ajouterVideo("cc-archive", 1, { codeSuivi: "w", reseaux: ["facebook"], essai: false });
    await depots().videos.modifier("cc-archive", { statut: "archivee" });
    const s = await suiviDesVideos({ visites: lecteur([]) });
    expect(s.lignes.map((x) => x.videoId)).toEqual(["cc-ok"]);
  });

  it("ne publie ni n'écrit rien : aucun module d'envoi, aucun fetch", () => {
    const src = readFileSync(join(__dirname, "../../../src/services/cas-concret-suivi.ts"), "utf8");
    for (const i of [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])) expect(i).not.toMatch(/publications|buffer|envoi/i);
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/\.(enregistrer|modifier|supprimer)\(/);
  });
});

describe("un lien, une vidéo", () => {
  const entrees = { reseaux: ["instagram"], essai: false };

  it("deux vidéos en version 1 : chacune ne compte que son propre lien", async () => {
    await ajouterVideo("cc-a", 1, entrees, "cas-concret", 1, 11);
    await ajouterVideo("cc-b", 2, entrees, "cas-concret", 1, 12);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0011-CC-IG", source: "instagram", visites: 5, rendezVous: 0 }]) });
    const a = s.lignes.find((l) => l.videoId === "cc-a")!;
    const b = s.lignes.find((l) => l.videoId === "cc-b")!;
    expect([a.visites, a.mesure]).toEqual([5, true]);
    expect([b.visites, b.mesure]).toEqual([0, false]);
  });

  it("ancien lien commun à plusieurs vidéos : visites non comptées, signalé", async () => {
    await ajouterVideo("cc-a", 1, entrees, "cas-concret", 1);
    await ajouterVideo("cc-b", 2, entrees, "cas-concret", 1);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0001-CC-IG", source: "instagram", visites: 9, rendezVous: 0 }]) });
    for (const l of s.lignes) expect([l.visites, l.mesure, l.liensPartages]).toEqual([0, false, 1]);
  });

  it("ancien lien unique : compté", async () => {
    await ajouterVideo("cc-a", 1, entrees, "cas-concret", 42);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-IG", source: "instagram", visites: 7, rendezVous: 0 }]) });
    expect([s.lignes[0].visites, s.lignes[0].mesure, s.lignes[0].liensPartages]).toEqual([7, true, undefined]);
  });

  it("le même numéro porté deux fois par une vidéo : compté une fois", async () => {
    await ajouterVideo("cc-a", 1, entrees, "cas-concret", 42);
    const base = (await depots().versions.obtenir("ver-cc-a"))!;
    await depots().versions.enregistrer({ ...base, id: "ver-cc-a-bis" } as never);
    const s = await suiviDesVideos({ visites: lecteur([{ campagne: "0042-CC-IG", source: "instagram", visites: 3, rendezVous: 0 }]) });
    expect(s.lignes[0].visites).toBe(3);
  });

  it("retouche : les visites des deux versions s'additionnent, le code est celui de la version choisie", async () => {
    await ajouterVideo("cc-a", 1, entrees, "cas-concret", 1, 30);
    const base = (await depots().versions.obtenir("ver-cc-a"))!;
    await depots().versions.enregistrer({ ...base, id: "ver-cc-a-2", numero: 2, numeroSuivi: 31 } as never);
    const v = (await depots().videos.obtenir("cc-a"))!;
    await depots().videos.enregistrer({ ...v, versionChoisieId: "ver-cc-a-2" } as never);
    const s = await suiviDesVideos({ visites: lecteur([
      { campagne: "0030-CC-IG", source: "instagram", visites: 2, rendezVous: 0 },
      { campagne: "0031-CC-IG", source: "instagram", visites: 4, rendezVous: 0 },
    ]) });
    expect([s.lignes[0].visites, s.lignes[0].codeSuivi]).toEqual([6, "0031-CC-IG"]);
  });
});
