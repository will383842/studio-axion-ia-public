/**
 * LOT R7 (décision de Will du 03/10) — « Ma vidéo HeyGen » : Will fait la vidéo avec son double dans l'application
 * HeyGen ; le studio lit les vidéos du compte (gratuit), télécharge celle qu'il choisit dans le stockage et la range
 * comme PRISE de la version (même chemin que « Filmer ici ») ; « Monter ma prise » fait la finition. Secours : dépôt
 * du fichier téléchargé. Tout sur réponses construites d'après la documentation, sans clé ni réseau.
 * ROUGES : uniquement des lectures chez HeyGen (aucune génération, aucun envoi) ; une vidéo jamais rattachée deux
 * fois ; une vidéo pas terminée refusée sans téléchargement ; un fichier d'une autre version refusé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { StockageFichiers } from "@/fournisseurs/types";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/** Début d'un vrai MP4 (`ftyp` à l'octet 4), complété à 64 octets. */
const MP4 = vi.hoisted(() => { const o = new Uint8Array(64); o.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]); return o; });
const h = vi.hoisted(() => ({
  requetes: [] as { methode: string; url: string }[],
  videos: [] as Record<string, unknown>[],
  cle: true,
  /** Contenu servi par HeyGen pour le téléchargement. */
  contenu: MP4 as Uint8Array<ArrayBuffer>,
  /** Objets du stockage doublé (clé → octets réellement déposés) et objets effacés. */
  objets: new Map<string, Uint8Array>(),
  supprimes: [] as string[],
  /** Taille que le stockage confirme (défaut : celle réellement déposée). */
  tailleConfirmee: undefined as number | undefined,
  /** Appelé pendant le téléchargement (avant que le dépôt ne commence). */
  pendantCopie: undefined as undefined | (() => Promise<void>),
  /** Appelé pendant la relecture du début d'un objet stocké. */
  pendantLecture: undefined as undefined | (() => Promise<void>),
}));

/** HeyGen et le stockage doublés : chaque requête est notée. */
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  h.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}` });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (u.hostname === "api.heygen.com" && methode === "GET" && u.pathname === "/v3/videos") return json({ data: h.videos, has_more: false, next_token: null });
  if (u.hostname === "api.heygen.com" && methode === "GET" && u.pathname.startsWith("/v3/videos/")) {
    const id = decodeURIComponent(u.pathname.split("/").at(-1)!);
    const v = h.videos.find((x) => x.id === id);
    return v ? json({ data: v }) : new Response(JSON.stringify({ error: { code: "not_found", message: "Video not found" } }), { status: 404 });
  }
  if (u.hostname === "files2.heygen.ai") {
    await h.pendantCopie?.();
    return new Response(h.contenu, { status: 200, headers: { "content-length": String(h.contenu.byteLength) } });
  }
  if (u.hostname === "r2.exemple" && methode === "PUT") {
    h.objets.set(decodeURIComponent(u.pathname.slice(1)), new Uint8Array(await new Response(init?.body).arrayBuffer()));
    return new Response("", { status: 200 });
  }
  return new Response("{}", { status: 404 });
};

vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerVideosHeygen } = await import("@/fournisseurs/heygen/videos-compte");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const f = reseau as unknown as typeof fetch;
  return { visagesHeygen: () => ({}), voixHeygen: () => ({}), videosHeygen: () => (h.cle ? creerVideosHeygen(creerClientHeygen({ cle: "cle-essai-r7", fetch: f }), f, { resoudre: async () => ["203.0.113.10"] }) : null) };
});
vi.mock("@/fournisseurs/r2/stockage", async () => {
  const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
  const r2: StockageFichiers = {
    ...stockageSimulation,
    id: "r2",
    mode: "reel",
    preparerDepot: async (d) => ({ cleStockage: `studio/dev/${d.typeEntite}/${d.entiteId}/${d.fichierId}.mp4`, urlDepot: "" }),
    urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?depot`,
    urlLectureDuree: async (cle) => `https://r2.exemple/${cle}?lecture`,
    confirmerDepot: async (cle) => ({ ok: true, ...(h.objets.has(cle) ? { taille: h.tailleConfirmee ?? h.objets.get(cle)!.byteLength } : {}) }),
    lireDebut: async (cle, n) => (await h.pendantLecture?.(), h.objets.get(cle) ?? new Uint8Array(0)).subarray(0, n),
    supprimer: async (cle) => {
      h.supprimes.push(cle);
      h.objets.delete(cle);
    },
  };
  return { stockageR2DepuisEnv: () => r2 };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const bg = await import("@/services/boucle-generation");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const service = await import("@/services/videos-heygen");
const { videoDepuisBrute, instantIso } = await import("@/fournisseurs/heygen/videos-compte");
const { ListeVideos, legendeVideo } = await import("@/components/generateur/VideoHeygen");

const MDP = "essai-r7-videos";
const TECHNIQUE = /avatar|api|webm|digital|twin|engine|idempotence|token|status|completed|processing|url/i;
const terminee = { id: "vid_001", title: "Avocat — délais de prescription", status: "completed", created_at: 1759496400, duration: 72.4, thumbnail_url: "https://files2.heygen.ai/apercu/vid_001.jpg", video_url: "https://files2.heygen.ai/video/vid_001.mp4?signature=essai" };
const enCours = { id: "vid_002", title: "Brouillon", status: "processing", created_at: 1759500000, duration: null, thumbnail_url: null, video_url: null };

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  h.requetes = [];
  h.videos = [terminee, enCours];
  h.cle = true;
  h.contenu = MP4;
  h.objets = new Map();
  h.supprimes = [];
  h.tailleConfirmee = undefined;
  h.pendantCopie = undefined;
  h.pendantLecture = undefined;
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((x) => x.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((x) => x.preuves)) await depots().preuves.enregistrer(p);
  await ecrireParametre("fournisseur.stockage", "r2");
  // Lot L5 : ces tests écrivent plusieurs fois le même sujet de banc ; le contrôle « déjà traité » n'est pas leur objet.
  await ecrireParametre("sujets.garde", "eteint");
});

/** Une version « je lis » validée, écrite en simulation (0 €), comme le test de la séance de tournage. */
async function versionLibre() {
  const sujet = SUJETS_BANC[0];
  const r = await bg.lancerGeneration({ idee: sujet.idee, reseaux: sujet.reseaux, formatId: "avocat", pilier: sujet.pilier.id, mode: "teleprompteur" });
  if (!r.ok) throw new Error(JSON.stringify(r));
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception && !m.exception.valideeParWill) await bg.validerException(r.scriptMaitreId, "c-est-juste");
  await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id));
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId)).sort((a, b) => a.code.localeCompare(b.code))[0];
  expect(v).toMatchObject({ etat: "validee", prompteur: expect.any(String) });
  return v;
}

const ecritures = () => h.requetes.filter((r) => r.url.startsWith("api.heygen.com") && r.methode !== "GET");

describe("vidéos du compte HeyGen (pures)", () => {
  it("terminée : rattachable ; en cours, ratée : montrées, en clair ; dates et durées lisibles", () => {
    expect(videoDepuisBrute(terminee)).toEqual({ idExterne: "vid_001", titre: "Avocat — délais de prescription", creeLe: "2025-10-03T13:00:00.000Z", dureeSec: 72.4, vignette: terminee.thumbnail_url, terminee: true });
    expect(videoDepuisBrute(enCours)).toMatchObject({ terminee: false, raison: expect.stringMatching(/termine encore/) });
    expect(videoDepuisBrute({ id: "x", status: "failed" })).toMatchObject({ terminee: false, raison: expect.stringMatching(/pas réussi/), titre: "Vidéo sans titre" });
    expect(instantIso(1759496400000)).toBe(instantIso(1759496400));
    expect(instantIso("2026-10-03T09:00:00Z")).toBe("2026-10-03T09:00:00.000Z");
    expect(instantIso(null)).toBeUndefined();
    expect(legendeVideo({ creeLe: "2026-10-03T12:05:00Z", dureeSec: 72.4 })).toBe("3 oct., 14:05 · 1 min 12 s");
    expect(legendeVideo({ dureeSec: 40 })).toBe("40 s");
  });
});

describe("Ma vidéo HeyGen (service)", () => {
  it("liste : une seule LECTURE gratuite des vidéos du compte ; sans clé : non relié, aucun appel", async () => {
    const { branche, videos } = await service.listerVideosHeygen();
    expect(branche).toBe(true);
    expect(videos.map((v) => [v.idExterne, v.terminee])).toEqual([
      ["vid_002", false],
      ["vid_001", true],
    ]);
    expect(h.requetes).toEqual([{ methode: "GET", url: "api.heygen.com/v3/videos?limit=30" }]);
    h.cle = false;
    h.requetes = [];
    expect(await service.listerVideosHeygen()).toEqual({ branche: false, videos: [] });
    expect(h.requetes).toEqual([]);
  });

  it("ROUGE — rattacher : relue, copiée dans le stockage, rangée comme prise de la version ; une seule fois ; rien que des lectures", async () => {
    const v = await versionLibre();
    const r = await service.rattacherVideoHeygen(v.id, "vid_001");
    // Lecture fraîche du détail, téléchargement, dépôt dans le stockage du studio.
    expect(h.requetes.map((x) => `${x.methode} ${x.url.split("?")[0]}`)).toEqual(["GET api.heygen.com/v3/videos/vid_001", "GET files2.heygen.ai/video/vid_001.mp4", `PUT r2.exemple/studio/dev/rush/${v.id}/${(await depots().rushs.lister()).at(-1)!.fichierId}.mp4`]);
    const video = (await depots().videos.obtenir(r.videoId))!;
    const prises = (video.entrees as { origine: string; prises: { fichierId: string; dureeSec: number }[] }).prises;
    expect((video.entrees as { origine: string }).origine).toBe("tournage");
    expect(prises).toHaveLength(1);
    expect(prises[0].dureeSec).toBe(72.4);
    const fichier = (await depots().fichiers.obtenir(prises[0].fichierId))!;
    expect(fichier).toMatchObject({ mime: "video/mp4", taille: 64, statut: "pret", origine: "fournisseur", dureeSec: 72.4 });
    expect((await depots().variantes.obtenir(v.id))!.videoId).toBe(r.videoId);
    // Second clic : rien de plus (aucune lecture, aucun téléchargement, aucune prise).
    h.requetes = [];
    expect((await service.rattacherVideoHeygen(v.id, "vid_001")).videoId).toBe(r.videoId);
    expect(h.requetes).toEqual([]);
    expect(((await depots().videos.obtenir(r.videoId))!.entrees as { prises: unknown[] }).prises).toHaveLength(1);
    // La liste la montre rattachée.
    expect((await service.listerVideosHeygen()).videos.find((x) => x.idExterne === "vid_001")?.rattacheeA).toBe(v.code);
    expect(ecritures()).toEqual([]);
  });

  it("ROUGE — vidéo pas terminée : refus clair, aucun téléchargement ; stockage non relié : refus, rien rangé", async () => {
    const v = await versionLibre();
    await expect(service.rattacherVideoHeygen(v.id, "vid_002")).rejects.toMatchObject({ code: "VIDEO_PAS_PRETE", message: expect.stringMatching(/termine encore/) });
    expect(h.requetes.some((r) => r.url.startsWith("files2.heygen.ai"))).toBe(false);
    await ecrireParametre("fournisseur.stockage", "simulation");
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "STOCKAGE_NON_RELIE" });
    expect(await depots().rushs.trouver((r) => r.motsCles.includes("heygen:vid_001"))).toBeNull();
    expect(ecritures()).toEqual([]);
  });

  it("secours : le fichier déposé pour CETTE version est rangé ; celui d'une autre version est refusé", async () => {
    const v = await versionLibre();
    const f = { id: "f_depose", cleStockage: `studio/dev/rush/${v.id}/f_depose.mp4`, nom: "heygen.mp4", mime: "video/mp4", taille: 10, origine: "depot" as const, statut: "pret" as const, creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" };
    await depots().fichiers.enregistrer(f);
    h.objets.set(f.cleStockage, MP4);
    await depots().fichiers.enregistrer({ ...f, id: "f_autre", cleStockage: "studio/dev/rush/autre-version/f_autre.mp4" });
    await expect(service.rattacherFichierHeygen(v.id, "f_autre")).rejects.toMatchObject({ code: "FICHIER" });
    const r = await service.rattacherFichierHeygen(v.id, "f_depose");
    expect(((await depots().videos.obtenir(r.videoId))!.entrees as { prises: { fichierId: string }[] }).prises.map((p) => p.fichierId)).toEqual(["f_depose"]);
    expect(h.requetes).toEqual([]);
  });
});

describe("Ma vidéo HeyGen — corrections sécurité (relecture 3042b94)", () => {
  const prises = async (videoId?: string) => (videoId ? (((await depots().videos.obtenir(videoId))?.entrees as { prises?: unknown[] } | undefined)?.prises ?? []) : []);
  const rushsHeygen = () => depots().rushs.lister((r) => r.motsCles.includes("heygen:vid_001"));
  const telechargements = () => h.requetes.filter((r) => r.url.startsWith("files2.heygen.ai"));
  const depotsR2 = () => h.requetes.filter((r) => r.methode === "PUT");

  it("ROUGE n° 1 — adresse HeyGen sur un hôte hors liste : refus clair, AUCUN appel vers cet hôte, rien déposé ni rangé", async () => {
    const v = await versionLibre();
    h.videos = [{ ...terminee, video_url: "https://interne.exemple/video.mp4" }];
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "TELECHARGEMENT", message: expect.stringMatching(/adresse inattendue/) });
    expect(h.requetes.some((r) => r.url.startsWith("interne.exemple"))).toBe(false);
    expect(depotsR2()).toEqual([]);
    expect(await rushsHeygen()).toEqual([]);
  });

  it("ROUGE n° 3 — contenu « #EXTM3U » annoncé comme vidéo : refusé APRÈS relecture du début stocké, rien rangé, copie effacée", async () => {
    const v = await versionLibre();
    h.contenu = new TextEncoder().encode("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:1,\nhttp://169.254.169.254/x.ts\n#EXT-X-ENDLIST\n");
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "PAS_UNE_VIDEO", message: expect.stringMatching(/pas une vidéo lisible/) });
    expect(await rushsHeygen()).toEqual([]);
    expect(depotsR2()).toHaveLength(1);
    expect(h.supprimes).toHaveLength(1);
    expect(h.objets.size).toBe(0);
    expect((await depots().fichiers.lister()).some((f) => f.origine === "fournisseur")).toBe(false);
    // Une vraie vidéo WebM (1A 45 DF A3) passe.
    h.contenu = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Uint8Array(28)]);
    expect((await service.rattacherVideoHeygen(v.id, "vid_001")).videoId).toBeTruthy();
  });

  it("ROUGE n° 3 et 4 — secours : « #EXTM3U » déposé comme vidéo refusé ; fichier pas encore « prêt » refusé ; rien rangé", async () => {
    const v = await versionLibre();
    const base = { nom: "heygen.mp4", mime: "video/mp4", taille: 10, origine: "depot" as const, creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" };
    await depots().fichiers.enregistrer({ ...base, id: "f_liste", cleStockage: `studio/dev/rush/${v.id}/f_liste.mp4`, statut: "pret" });
    h.objets.set(`studio/dev/rush/${v.id}/f_liste.mp4`, new TextEncoder().encode("#EXTM3U\nhttp://10.0.0.1/a.ts\n"));
    await expect(service.rattacherFichierHeygen(v.id, "f_liste")).rejects.toMatchObject({ code: "PAS_UNE_VIDEO" });
    await depots().fichiers.enregistrer({ ...base, id: "f_attente", cleStockage: `studio/dev/rush/${v.id}/f_attente.mp4`, statut: "en_attente" });
    h.objets.set(`studio/dev/rush/${v.id}/f_attente.mp4`, MP4);
    await expect(service.rattacherFichierHeygen(v.id, "f_attente")).rejects.toMatchObject({ code: "FICHIER_PAS_PRET", message: expect.stringMatching(/pas encore bien arrivée/) });
    expect(await depots().rushs.lister((r) => r.motsCles.includes("heygen"))).toEqual([]);
  });

  it("ROUGE n° 5 — taille confirmée par le stockage différente de celle relayée : refus, rien rangé, copie effacée", async () => {
    const v = await versionLibre();
    h.tailleConfirmee = 63;
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "TELECHARGEMENT", message: expect.stringMatching(/incomplète/) });
    expect(await rushsHeygen()).toEqual([]);
    expect(h.supprimes).toHaveLength(1);
  });

  it("ROUGE n° 5 — envoi par morceaux : taille réelle confirmée par le stockage ≠ taille annoncée : refusé, rien enregistré", async () => {
    const envois = await import("@/services/envois");
    const descriptif = { nom: "heygen.mp4", mime: "video/mp4", taille: 1234, typeEntite: "rush", entiteId: "v-1" };
    const r = await envois.commencerEnvoi(descriptif);
    h.objets.set(r.cle, new Uint8Array(10));
    await expect(envois.terminerEnvoi({ ...descriptif, fichierId: r.fichierId, cle: r.cle })).rejects.toMatchObject({ code: "ENVOI_INCOMPLET", message: expect.stringMatching(/ne correspond pas/) });
    expect(await depots().fichiers.obtenir(r.fichierId)).toBeNull();
    h.objets.set(r.cle, new Uint8Array(1234));
    expect((await envois.terminerEnvoi({ ...descriptif, fichierId: r.fichierId, cle: r.cle })).statut).toBe("pret");
  });

  it("ROUGE n° 6 — double clic (second clic PENDANT le téléchargement) : UN téléchargement, UNE prise", async () => {
    const v = await versionLibre();
    let second: Promise<unknown> | undefined;
    h.pendantCopie = async () => {
      h.pendantCopie = undefined;
      second = service.rattacherVideoHeygen(v.id, "vid_001").then((x) => x, (e: unknown) => e);
      await second;
    };
    const premier = await service.rattacherVideoHeygen(v.id, "vid_001");
    expect(await second).toMatchObject({ code: "EN_COURS", message: expect.stringMatching(/en train d'arriver/) });
    expect(telechargements()).toHaveLength(1);
    expect(depotsR2()).toHaveLength(1);
    expect(await rushsHeygen()).toHaveLength(1);
    expect(await prises(premier.videoId)).toHaveLength(1);
    // Deux demandes lancées ensemble : jamais deux prises.
    const v2 = await versionLibre();
    h.videos = [...h.videos, { ...terminee, id: "vid_009" }];
    const [a, b] = await Promise.all([service.rattacherVideoHeygen(v2.id, "vid_009"), service.rattacherVideoHeygen(v2.id, "vid_009")].map((p) => p.then((x) => x, (e: Error & { code?: string }) => e)));
    const reussies = [a, b].filter((x): x is { videoId: string; nom: string } => !(x instanceof Error));
    expect(new Set(reussies.map((x) => x.videoId)).size).toBe(1);
    for (const x of [a, b].filter((y) => y instanceof Error)) expect(x).toMatchObject({ code: "EN_COURS" });
    expect(await depots().rushs.lister((r) => r.motsCles.includes("heygen:vid_009"))).toHaveLength(1);
    // La réservation est levée : un clic plus tard ne retélécharge rien (déjà rattachée).
    h.requetes = [];
    expect((await service.rattacherVideoHeygen(v.id, "vid_001")).videoId).toBe(premier.videoId);
    expect(h.requetes).toEqual([]);
  });

  it("ROUGE n° 6 — rattachée ailleurs PENDANT le téléchargement : revérifiée sous le verrou, refus, ni fiche ni objet orphelins", async () => {
    const v = await versionLibre();
    h.pendantCopie = async () => {
      await depots().rushs.enregistrer({ id: "rush_ailleurs", nom: "Prise ailleurs", fichierId: "f_ailleurs", dureeSec: 10, motsCles: ["0099-AV-TT-L", "heygen:vid_001"], creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" });
    };
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "DEJA_RATTACHEE" });
    expect((await depots().variantes.obtenir(v.id))!.videoId).toBeUndefined();
    expect(h.supprimes).toHaveLength(1);
    expect(h.objets.size).toBe(0);
    expect((await depots().fichiers.lister()).some((f) => f.origine === "fournisseur")).toBe(false);
  });
});

describe("écran « Ma vidéo HeyGen »", () => {
  const rendre = (liste: Parameters<typeof ListeVideos>[0]["liste"]) => renderToStaticMarkup(createElement(ListeVideos, { liste, enCours: false, onRattacher: () => undefined }));
  it("terminée : « Rattacher » ; pas prête : sa raison ; déjà rattachée ; aucun nom technique", () => {
    const html = rendre({ branche: true, videos: [{ ...videoDepuisBrute(terminee) }, videoDepuisBrute(enCours), { ...videoDepuisBrute(terminee), idExterne: "vid_003", rattacheeA: "0042-AV-TT-L" }] });
    expect(html.match(/>Rattacher</g)).toHaveLength(1);
    expect(html).toContain("Pas encore prête");
    expect(html).toContain("Rattachée à 0042-AV-TT-L");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(TECHNIQUE);
    // Relecture sécurité n° 7 : aperçu NEUTRE, aucune image chargée depuis HeyGen.
    expect(html).not.toContain("<img");
    expect(html).not.toContain("heygen.ai");
  });
  it("HeyGen pas relié, ou aucune vidéo : phrase claire (le dépôt manuel reste proposé)", () => {
    expect(rendre({ branche: false, videos: [] })).toContain("Déposez ci-dessous la vidéo téléchargée depuis HeyGen");
    expect(rendre({ branche: true, videos: [] })).toContain("Faites votre vidéo dans l&#x27;application HeyGen");
  });
});

describe("Ma vidéo HeyGen — double rattachement, téléchargement lent (relecture exactitude 3042b94, n° 1)", () => {
  const lent = () => { h.pendantCopie = () => new Promise((r) => setTimeout(r, 60)); };
  const ensemble = <T,>(ps: Promise<T>[]) => Promise.all(ps.map((p) => p.then((x) => x, (e: Error & { code?: string }) => e)));
  const prisesDe = async (videoId: string) => (((await depots().videos.obtenir(videoId))?.entrees as { prises?: unknown[] } | undefined)?.prises ?? []);

  it("ROUGE — même version, deux appels simultanés, téléchargement lent : UN téléchargement, UNE prise brute, UNE prise", async () => {
    const v = await versionLibre();
    lent();
    const res = await ensemble([service.rattacherVideoHeygen(v.id, "vid_001"), service.rattacherVideoHeygen(v.id, "vid_001")]);
    const ok = res.filter((x): x is { videoId: string; nom: string } => !(x instanceof Error));
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const e of res.filter((x) => x instanceof Error)) expect(e).toMatchObject({ code: "EN_COURS" });
    expect(h.requetes.filter((r) => r.url.startsWith("files2.heygen.ai"))).toHaveLength(1);
    expect(await depots().rushs.lister((r) => r.motsCles.includes("heygen:vid_001"))).toHaveLength(1);
    expect(await prisesDe(ok[0].videoId)).toHaveLength(1);
  });

  it("ROUGE — même vidéo sur DEUX versions en même temps, téléchargement lent : rangée sous une seule version", async () => {
    const v1 = await versionLibre();
    const v2 = await versionLibre();
    lent();
    const res = await ensemble([service.rattacherVideoHeygen(v1.id, "vid_001"), service.rattacherVideoHeygen(v2.id, "vid_001")]);
    expect(res.filter((x) => !(x instanceof Error))).toHaveLength(1);
    for (const e of res.filter((x) => x instanceof Error)) expect(e).toMatchObject({ code: expect.stringMatching(/^(EN_COURS|DEJA_RATTACHEE)$/) });
    const rushs = await depots().rushs.lister((r) => r.motsCles.includes("heygen:vid_001"));
    expect(rushs).toHaveLength(1);
    const avecVideo = [await depots().variantes.obtenir(v1.id), await depots().variantes.obtenir(v2.id)].filter((x) => x?.videoId);
    expect(avecVideo).toHaveLength(1);
    expect(h.requetes.filter((r) => r.url.startsWith("files2.heygen.ai"))).toHaveLength(1);
  });

  it("ROUGE — secours : deux appels simultanés pour le même fichier (relecture lente) : UNE prise brute, UNE prise", async () => {
    const v = await versionLibre();
    const f = { id: "f_double", cleStockage: `studio/dev/rush/${v.id}/f_double.mp4`, nom: "heygen.mp4", mime: "video/mp4", taille: 64, origine: "depot" as const, statut: "pret" as const, creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" };
    await depots().fichiers.enregistrer(f);
    h.objets.set(f.cleStockage, MP4);
    h.pendantLecture = () => new Promise((r) => setTimeout(r, 60));
    const res = await ensemble([service.rattacherFichierHeygen(v.id, f.id), service.rattacherFichierHeygen(v.id, f.id)]);
    const ok = res.filter((x): x is { videoId: string; nom: string } => !(x instanceof Error));
    expect(ok).toHaveLength(2);
    expect(new Set(ok.map((x) => x.videoId)).size).toBe(1);
    expect(await depots().rushs.lister((r) => r.fichierId === f.id)).toHaveLength(1);
    expect(await prisesDe(ok[0].videoId)).toHaveLength(1);
  });
});

describe("Ma vidéo HeyGen — petits défauts (relecture exactitude 3042b94)", () => {
  const prisesDe = async (videoId?: string) => (videoId ? (((await depots().videos.obtenir(videoId))?.entrees as { prises?: { rushId: string }[] } | undefined)?.prises ?? []) : []);
  /** Arrêt du serveur entre la prise brute et la prise de la vidéo : la prise brute existe seule. */
  async function priseBruteSeule(v: { id: string; code: string }, motsCles: string[], fichierId = "f_panne") {
    await depots().fichiers.enregistrer({ id: fichierId, cleStockage: `studio/dev/rush/${v.id}/${fichierId}.mp4`, nom: "heygen.mp4", mime: "video/mp4", taille: 64, dureeSec: 30, origine: "fournisseur", statut: "pret", creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" });
    h.objets.set(`studio/dev/rush/${v.id}/${fichierId}.mp4`, MP4);
    await depots().rushs.enregistrer({ id: "rush_panne", nom: `${v.code} · prise 1`, fichierId, dureeSec: 30, motsCles: [v.code, "je lis", ...motsCles], creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" });
  }

  it("ROUGE n° 4 — reprise après panne (prise brute sans prise dans la vidéo) : le rangement est complété, sans retélécharger ni doubler", async () => {
    const v = await versionLibre();
    await priseBruteSeule(v, ["heygen:vid_001", "heygen"]);
    const r = await service.rattacherVideoHeygen(v.id, "vid_001");
    expect((await prisesDe(r.videoId)).map((p) => p.rushId)).toEqual(["rush_panne"]);
    expect((await depots().variantes.obtenir(v.id))!.videoId).toBe(r.videoId);
    expect(await depots().rushs.lister((x) => x.motsCles.includes("heygen:vid_001"))).toHaveLength(1);
    expect(h.requetes).toEqual([]);
  });

  it("ROUGE n° 4 — secours : même reprise après panne, la prise est ajoutée une seule fois", async () => {
    const v = await versionLibre();
    await priseBruteSeule(v, ["heygen"], "f_secours");
    const r = await service.rattacherFichierHeygen(v.id, "f_secours");
    expect((await prisesDe(r.videoId)).map((p) => p.rushId)).toEqual(["rush_panne"]);
    expect((await service.rattacherFichierHeygen(v.id, "f_secours")).videoId).toBe(r.videoId);
    expect(await prisesDe(r.videoId)).toHaveLength(1);
  });

  it("ROUGE n° 5 — vidéo bien plus longue que le texte de la version : refus clair AVANT tout téléchargement", async () => {
    const v = await versionLibre();
    h.videos = [{ ...terminee, duration: 600 }];
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "VIDEO_TROP_LONGUE", message: "Cette vidéo est bien plus longue que le texte de cette version. Vérifiez que c'est la bonne." });
    expect(h.requetes.some((r) => r.url.startsWith("files2.heygen.ai"))).toBe(false);
    expect(await depots().rushs.lister((x) => x.motsCles.includes("heygen:vid_001"))).toEqual([]);
  });

  it("ROUGE n° 8 — version qui n'est pas « je lis » : refus clair côté serveur, aucun appel", async () => {
    const v = await versionLibre();
    await depots().variantes.modifier(v.id, { prompteur: undefined });
    await expect(service.rattacherVideoHeygen(v.id, "vid_001")).rejects.toMatchObject({ code: "PAS_JE_LIS", message: "Une vidéo HeyGen se rattache seulement à une version « Je lis »." });
    await depots().fichiers.enregistrer({ id: "f_x", cleStockage: `studio/dev/rush/${v.id}/f_x.mp4`, nom: "heygen.mp4", mime: "video/mp4", taille: 64, origine: "depot", statut: "pret", creeLe: "2026-10-03T10:00:00Z", modifieLe: "2026-10-03T10:00:00Z" });
    await expect(service.rattacherFichierHeygen(v.id, "f_x")).rejects.toMatchObject({ code: "PAS_JE_LIS" });
    expect(h.requetes).toEqual([]);
  });
});
