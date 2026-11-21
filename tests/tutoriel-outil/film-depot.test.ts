/** AUD-4 · dépôt manuel du film de navigation. Dépôts en mémoire, aucun appel réel, 0 €. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));

import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const f = await import("@/services/tutoriel-film");
const a = await import("@/app/(studio)/tutoriel-outil/[videoId]/actions-film");
const { surDepotFilm } = await import("@/components/formats/tutoriel-outil/DeposerFilm");

const LE = "2026-11-21T08:00:00.000Z";
const CLE = "studio/dev/entree/v1/f-film1.mp4";
const FICHIER = { id: "f-film1", nom: "film.mp4", mime: "video/mp4", taille: 5_000_000, cleStockage: CLE };
const NAV = JSON.stringify({
  version: "navigation-filmee.v1", videoCle: "autre.mp4", maquette: "maquette.html", largeur: 1280, hauteur: 800, debutFilmMs: 0, dureeVoixMs: 10000,
  cibles: [{ etapeId: "e1", instantMs: 1000, finMs: 3000 }],
});
const dep = (fichier: Partial<typeof FICHIER> = {}) => ({ fichier: async () => ({ ...FICHIER, ...fichier }) });

async function installer(pause: string | null = "TO_FILM_A_CAPTURER") {
  await depots().videos.enregistrer({ id: "v1", titre: "T", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: { tutorielOutil: { fin: "aucune" } }, creeLe: LE, modifieLe: LE } as never);
  await depots().versions.enregistrer({ id: "ver1", videoId: "v1", numero: 1, statut: "en_fabrication", commande: { entrees: { tutorielOutil: { fin: "aucune" } } }, creeLe: LE, modifieLe: LE } as never);
  await depots().travaux.enregistrer({
    id: "t1", type: "fabrication", cibleId: "v1", versionId: "ver1", titre: "T", statut: "en_file", progression: 10, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio",
    etapes: [], parametres: { ...(pause ? { pause: { code: pause, message: "x" } } : {}), tutoriel: { ratios: ["4:5"] } }, creeLe: LE, modifieLe: LE,
  } as never);
}
const instantane = async () => JSON.stringify([await depots().travaux.lister(), await depots().videos.lister(), await depots().versions.lister()]);

beforeEach(() => {
  reinitialiserDepots();
  session.ouverte = true;
});

describe("dépôt du film", () => {
  it("écrit navigationFilmee dans la vidéo ET la version, et sort de la pause du film", async () => {
    await installer();
    expect(await f.filmAttendu("v1")).toBe(true);
    const r = await f.deposerFilmNavigation("v1", { fichierId: "f-film1", navigation: NAV }, dep());
    expect(r.statut).toBe("ok");
    const video = (await depots().videos.obtenir("v1"))!;
    const version = (await depots().versions.obtenir("ver1"))!;
    for (const entrees of [video.entrees, version.commande.entrees]) {
      const nav = lireEntreesTutoriel(entrees as Record<string, unknown>).navigationFilmee;
      expect(nav?.videoCle).toBe(CLE);
      expect(nav?.cibles).toHaveLength(1);
      expect((entrees as { tutorielOutil: { fin?: string } }).tutorielOutil.fin).toBe("aucune");
    }
    const t = (await depots().travaux.obtenir("t1"))!;
    expect(t.parametres?.pause).toBeUndefined();
    expect(await f.filmAttendu("v1")).toBe(false);
  });

  it("refuse les formats, la taille, le JSON et rien n'est écrit", async () => {
    await installer();
    const avant = await instantane();
    const cas: [Partial<typeof FICHIER>, string | undefined, RegExp][] = [
      [{ mime: "video/x-msvideo" }, NAV, /mp4 ou webm/],
      [{ nom: "film.exe" }, NAV, /mp4 ou webm/],
      [{ cleStockage: "studio/dev/entree/v1/f-film1.html" }, NAV, /mp4 ou webm/],
      [{ taille: 0 }, NAV, /vide ou dépasse/],
      [{ taille: 5 * 1024 ** 3 }, NAV, /vide ou dépasse/],
      [{}, undefined, /navigation\.json/],
      [{}, "pas du json", /pas lisible/],
      [{}, "x".repeat(f.TAILLE_NAVIGATION_MAX + 1), /trop gros/],
      [{}, JSON.stringify({ version: "x" }), /pas valable/],
    ];
    for (const [fichier, nav, motif] of cas) {
      const r = await f.deposerFilmNavigation("v1", { fichierId: "f-film1", navigation: nav }, dep(fichier));
      expect(r.statut).toBe("refusee");
      expect(r.phrase).toMatch(motif);
    }
    expect(await instantane()).toBe(avant);
  });

  it("vidéo inconnue, pas de pause du film, fichier non arrivé", async () => {
    expect((await f.deposerFilmNavigation("nulle", { fichierId: "f-film1", navigation: NAV }, dep())).statut).toBe("refusee");
    await installer(null);
    const r = await f.deposerFilmNavigation("v1", { fichierId: "f-film1", navigation: NAV }, dep());
    expect(r).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/n'attend pas/) });
    expect(await f.filmAttendu("nulle")).toBe(false);
    reinitialiserDepots();
    await installer();
    const absent = await f.deposerFilmNavigation("v1", { fichierId: "f-inconnu", navigation: NAV });
    expect(absent.statut).toBe("refusee");
    expect((await f.deposerFilmNavigation("v1", { fichierId: 5, navigation: NAV }, dep())).statut).toBe("refusee");
  });

  it("sans session : refus", async () => {
    await installer();
    session.ouverte = false;
    await expect(f.deposerFilmNavigation("v1", { fichierId: "f-film1", navigation: NAV }, dep())).rejects.toThrow();
  });
});

describe("action et écran", () => {
  it("éteint : l'action refuse et rien n'est écrit", async () => {
    await installer();
    const avant = await instantane();
    expect(await a.deposerFilmAction("v1", { fichierId: "f-film1", navigation: NAV })).toMatchObject({ ok: false });
    expect(await instantane()).toBe(avant);
    await ecrireParametre("tutoriel.formulaire", true);
    const r = await a.deposerFilmAction("v1", { fichierId: "f-film1", navigation: NAV });
    expect(r).toMatchObject({ ok: true, donnees: { statut: "refusee" } }); // fichier jamais envoyé
  });
  it("le geste de l'écran rend la phrase de l'action", async () => {
    const ok = await surDepotFilm("v1", "f", "{}", async () => ({ ok: true, donnees: { statut: "ok", phrase: "Fait" } }));
    expect(ok).toEqual({ reussi: true, phrase: "Fait" });
    expect(await surDepotFilm("v1", "f", "{}", async () => ({ ok: false, message: "Non" }))).toEqual({ reussi: false, phrase: "Non" });
  });
});
