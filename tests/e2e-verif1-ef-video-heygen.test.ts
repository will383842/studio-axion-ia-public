/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS F : « Ma vidéo HeyGen » (mode B : Will fait sa vidéo avec son double dans
 * l'application HeyGen, le studio la rapatrie et fait la finition).
 *
 * Configuration de production rejouée : clé HeyGen, stockage R2 (signé en local, doublé en HTTP), montage sur
 * studio-rendu (doublé en HTTP), Buffer (doublé). Interrupteurs « Votre avatar parle » et « Montage réel » ÉTEINTS.
 * Chemin : liste des vidéos du compte → choix → téléchargement (adresse vérifiée, taille plafonnée) → R2 → prise de la
 * version « Je lis » → « Monter ma prise » → vidéo prête (sous-titres, miniature) → kit → brouillon Buffer.
 *
 * Un seul `fetch` doublé ; toute adresse inattendue fait échouer le test. Aucune clé réelle, aucun DNS réel, 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";
import { executeurSimule } from "./helpers/g4";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DemandeRendu } from "@/fournisseurs/types";

process.env.HEYGEN_API_KEY = "cle-heygen-essai-verif1-f";
process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_MINIATURE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.BUFFER_API_KEY = "cle-buffer-essai-verif1-f";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/** Début d'un vrai MP4 (`ftyp` à l'octet 4). */
const MP4 = vi.hoisted(() => {
  const o = new Uint8Array(4096);
  o.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return o;
});

const H = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string; recherche: string }[],
  videos: [] as Record<string, unknown>[],
  /** Taille annoncée par HeyGen pour le téléchargement (défaut : la vraie). */
  tailleAnnoncee: undefined as number | undefined,
  contenu: MP4 as Uint8Array<ArrayBuffer>,
  /** Objets de R2 (chemin → octets). */
  r2: new Map<string, Uint8Array>(),
  supprimes: [] as string[],
  rendus: new Map<string, unknown>(),
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
}));

/** Adresses inattendues (même si le studio a avalé l'erreur) : doit rester vide. */
const INATTENDUES: string[] = [];
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  if (String(url) === URL_BUFFER) return H.buffer!.appeler(url, init);
  H.appels.push({ hote: u.hostname, methode, chemin: u.pathname, recherche: u.search });

  if (u.hostname === "api.heygen.com") {
    // Lecture du solde HeyGen (gratuite, surveillance des crédits).
    if (methode === "GET" && u.pathname === "/v3/users/me") return json({ data: { wallet: { currency: "USD", remaining_balance: 120 } } });
    if (methode === "GET" && u.pathname === "/v3/videos") return json({ data: H.videos, has_more: false, next_token: null });
    if (methode === "GET" && u.pathname.startsWith("/v3/videos/")) {
      const id = decodeURIComponent(u.pathname.split("/").at(-1)!);
      const v = H.videos.find((x) => x.id === id);
      return v ? json({ data: v }) : json({ error: { code: "not_found", message: "Video not found" } }, 404);
    }
  }
  if (u.hostname === "files2.heygen.ai") return new Response(H.contenu, { status: 200, headers: { "content-length": String(H.tailleAnnoncee ?? H.contenu.byteLength) } });

  if (u.hostname.endsWith("r2.cloudflarestorage.com")) {
    const chemin = decodeURIComponent(u.pathname);
    if (methode === "PUT") {
      H.r2.set(chemin, new Uint8Array(init?.body ? await new Response(init.body as BodyInit).arrayBuffer() : new ArrayBuffer(0)));
      return new Response("", { status: 200 });
    }
    if (methode === "DELETE") {
      H.supprimes.push(chemin);
      H.r2.delete(chemin);
      return new Response(null, { status: 204 });
    }
    const o = H.r2.get(chemin) ?? MP4;
    if (methode === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(o.byteLength) } });
    return new Response(o.slice(0, 64), { status: 200, headers: { "content-length": "64" } });
  }

  if (u.hostname === "studio-rendu.essai") {
    if (methode === "POST" && u.pathname === "/rendus") {
      const d = JSON.parse(String(init?.body)) as DemandeRendu;
      H.rendus.set(d.idRendu, d);
      return json({ idRendu: d.idRendu });
    }
    const id = decodeURIComponent(u.pathname.replace(/^\/rendus\//, ""));
    const d = H.rendus.get(id) as DemandeRendu | undefined;
    if (!d) return new Response("", { status: 404 });
    const mesures =
      d.operation === "composition"
        ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 40, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 }
        : d.operation === "miniature"
          ? { instant: 3, nettete: 80 }
          : d.operation === "mesure-son"
            ? { lufs: -14, creteVraieDbtp: -2 }
            : { dureeSec: 40 };
    return json({ statut: "termine", sortieCle: d.sortie.cle, mesures });
  }
  INATTENDUES.push(`${methode} ${u.hostname}${u.pathname}`);
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerVideosHeygen } = await import("@/fournisseurs/heygen/videos-compte");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { plafondVideoHeygen } = await import("@/fournisseurs/heygen/telechargement");
  const f = ((u: string, i?: RequestInit) => reseau(u, i)) as unknown as typeof fetch;
  // Comme `videosHeygen(env)` de production (clé, plafond lu dans HEYGEN_VIDEO_MAX_MO), DNS doublé (adresse publique).
  return {
    visagesHeygen: () => ({}),
    voixHeygen: () => ({}),
    videosHeygen: () => (process.env.HEYGEN_API_KEY ? creerVideosHeygen(creerClientHeygen({ cle: process.env.HEYGEN_API_KEY, fetch: f }), f, { resoudre: async () => ["203.0.113.10"], plafond: plafondVideoHeygen(process.env) }) : null),
  };
});

// Le `fetch` global est doublé AVANT d'importer le studio : le registre des fournisseurs crée le stockage R2 à
// l'import et garde le `fetch` de ce moment-là (sinon ses lectures et effacements partiraient sur le vrai réseau).
vi.stubGlobal("fetch", reseau);
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const reglages = await import("@/services/reglages");
const pub = await import("@/services/publications");
const service = await import("@/services/videos-heygen");
const renduDouble = await import("@/services/rendu-double");
const { ListeVideos } = await import("@/components/generateur/VideoHeygen");

const MDP = "essai-verif1-ef-heygen";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const TECHNIQUE = /undefined|null|\bError\b|[A-Z]{2,}_[A-Z]{2,}|https?:|[{}]|\bstatus\b|completed|processing|failed|not_found|token|\burl\b/i;

const terminee = { id: "vid_001", title: "Avocat — délais de prescription", status: "completed", created_at: 1759496400, duration: 38.2, thumbnail_url: "https://files2.heygen.ai/apercu/vid_001.jpg", video_url: "https://files2.heygen.ai/video/vid_001.mp4?signature=essai" };
const enCours = { id: "vid_002", title: "Brouillon", status: "processing", created_at: 1759500000, duration: null, thumbnail_url: null, video_url: null };
const ratee = { id: "vid_003", title: "Essai raté", status: "failed", created_at: 1759400000, duration: null, thumbnail_url: null, video_url: null };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  H.appels = [];
  H.videos = [terminee, enCours, ratee];
  H.tailleAnnoncee = undefined;
  H.contenu = MP4;
  H.r2 = new Map();
  H.supprimes = [];
  H.rendus = new Map();
  H.buffer = fauxBuffer();
  delete process.env.HEYGEN_VIDEO_MAX_MO;
  process.env.HEYGEN_API_KEY = "cle-heygen-essai-verif1-f";
  vi.stubGlobal("fetch", reseau);
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((x) => x.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((x) => x.preuves)) await depots().preuves.enregistrer(p);
  // Interrupteurs de production : « Votre avatar parle » et « Montage réel » éteints.
  await renduDouble.definirRenduDouble({ allume: false });
  await reglages.definirMontageReel("avocat", false);
});

afterEach(() => {
  expect(INATTENDUES.splice(0)).toEqual([]);
  vi.stubGlobal("fetch", reseau);
  vi.useRealTimers();
  bg.arreterBoucleGeneration();
});

/** Une version « Je lis » validée (écriture simulée, 0 €), de préférence pour Instagram. */
async function versionJeLis() {
  const sujet = SUJETS_BANC[0];
  const r = await bg.lancerGeneration({ idee: sujet.idee, reseaux: sujet.reseaux, formatId: "avocat", pilier: sujet.pilier.id, mode: "teleprompteur" });
  if (!r.ok) throw new Error(JSON.stringify(r));
  await bg.tourBoucleGeneration(() => executeurSimule().executeur);
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception && !m.exception.valideeParWill) await bg.validerException(r.scriptMaitreId, "c-est-juste");
  await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id));
  const toutes = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && !!x.prompteur)).sort((a, b) => a.code.localeCompare(b.code));
  const v = toutes.find((x) => x.reseau === "instagram") ?? toutes[0];
  expect(v).toMatchObject({ etat: "validee", prompteur: expect.any(String) });
  return { v, sujetId: r.scriptMaitreId };
}

const ecrituresHeygen = () => H.appels.filter((a) => a.hote === "api.heygen.com" && a.methode !== "GET");
const telechargements = () => H.appels.filter((a) => a.hote === "files2.heygen.ai");

async function jusquaPrete(videoId: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 300; i++) {
    const v = (await depots().videos.obtenir(videoId))!;
    if (v.statut === "prete" || v.statut === "echec") break;
    vi.setSystemTime(Date.now() + 15_000);
    await boucle.contenuDuTour({ delai: () => 5_000 });
  }
  vi.useRealTimers();
  return (await depots().videos.obtenir(videoId))!;
}

/** Le chemin complet jusqu'à la vidéo prête. */
async function rapatrierEtMonter() {
  const { v, sujetId } = await versionJeLis();
  const liste = await service.listerVideosHeygen();
  expect(liste.branche).toBe(true);
  const { videoId } = await service.rattacherVideoHeygen(v.id, "vid_001");
  const props = await fr.propositionsFabrication(sujetId);
  expect(props.aMonter).toContain(v.id);
  const r = await fr.monterJeLis(v.id, { confirme: true });
  expect(r.videoId).toBe(videoId);
  const video = await jusquaPrete(videoId);
  return { v, sujetId, videoId, video };
}

async function sortieDe(videoId: string) {
  const video = (await depots().videos.obtenir(videoId))!;
  const s = (await depots().sorties.lister((x) => x.videoId === videoId && x.versionId === video.versionChoisieId))[0];
  const f = s ? await depots().fichiers.obtenir(s.fichierId) : null;
  return { s, f };
}

describe("F — liste et téléchargement (interrupteurs éteints)", () => {
  it("liste des vidéos du compte : lectures seules, vidéos en cours et ratées non rattachables, phrases lisibles", async () => {
    await versionJeLis();
    const { branche, videos } = await service.listerVideosHeygen();
    expect(branche).toBe(true);
    expect(videos.map((x) => [x.idExterne, x.terminee])).toEqual([
      ["vid_002", false],
      ["vid_001", true],
      ["vid_003", false],
    ]);
    for (const x of videos) if (x.raison) expect(x.raison).not.toMatch(TECHNIQUE);
    // Aucune écriture chez HeyGen (rien de payant), interrupteurs éteints ou non.
    expect(ecrituresHeygen()).toEqual([]);
    const html = renderToStaticMarkup(createElement(ListeVideos, { liste: { branche, videos }, enCours: false, onRattacher: () => undefined }));
    expect(html).toMatch(/Rattacher/);
    expect(html).toMatch(/termine encore/);
    expect(html).toMatch(/pas réussi/);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(TECHNIQUE);
  });

  it("liste vide et clé absente : un état vide lisible, le dépôt manuel reste possible", async () => {
    H.videos = [];
    const vide = await service.listerVideosHeygen();
    expect(vide).toEqual({ branche: true, videos: [] });
    expect(renderToStaticMarkup(createElement(ListeVideos, { liste: vide, enCours: false, onRattacher: () => undefined }))).toMatch(/Aucune vidéo dans votre compte/);
    delete process.env.HEYGEN_API_KEY;
    const sansCle = await service.listerVideosHeygen();
    expect(sansCle.branche).toBe(false);
    expect(renderToStaticMarkup(createElement(ListeVideos, { liste: sansCle, enCours: false, onRattacher: () => undefined }))).toMatch(/pas encore relié/);
  });

  it("vidéo encore en cours chez HeyGen : refus lisible, rien n'est téléchargé", async () => {
    const { v } = await versionJeLis();
    const e = await service.rattacherVideoHeygen(v.id, "vid_002").catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "VIDEO_PAS_PRETE" });
    expect((e as Error).message).not.toMatch(TECHNIQUE);
    expect(telechargements()).toEqual([]);
    expect(H.r2.size).toBe(0);
  });

  it("vidéo trop lourde (HEYGEN_VIDEO_MAX_MO) : refus lisible AVANT de lire le corps, rien n'est rangé, la copie est effacée", async () => {
    process.env.HEYGEN_VIDEO_MAX_MO = "1";
    H.tailleAnnoncee = 3 * 1024 * 1024;
    const { v } = await versionJeLis();
    const e = await service.rattacherVideoHeygen(v.id, "vid_001").catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "TELECHARGEMENT" });
    expect((e as Error).message).toMatch(/trop lourde \(plus de 1 Mo\)/);
    expect((e as Error).message).not.toMatch(TECHNIQUE);
    expect([...H.r2.keys()]).toEqual([]);
    expect(await depots().rushs.compter((r) => r.motsCles.includes("heygen:vid_001"))).toBe(0);
  });

  it("adresse de téléchargement hors HeyGen : refus lisible, aucun appel vers cette adresse", async () => {
    H.videos = [{ ...terminee, video_url: "https://exemple-pirate.test/video.mp4" }];
    const { v } = await versionJeLis();
    const e = await service.rattacherVideoHeygen(v.id, "vid_001").catch((x: Error) => x);
    expect((e as Error).message).toMatch(/adresse inattendue/);
    expect(H.appels.some((a) => a.hote === "exemple-pirate.test")).toBe(false);
  });

  it("deux clics sur « Rattacher » : un seul téléchargement, une seule prise", async () => {
    const { v } = await versionJeLis();
    const [a, b] = await Promise.allSettled([service.rattacherVideoHeygen(v.id, "vid_001"), service.rattacherVideoHeygen(v.id, "vid_001")]);
    expect([a, b].filter((x) => x.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    for (const x of [a, b]) if (x.status === "rejected") expect((x.reason as Error).message).toMatch(/en train d'arriver/);
    expect(telechargements()).toHaveLength(1);
    expect(await depots().rushs.compter((r) => r.motsCles.includes("heygen:vid_001"))).toBe(1);
  });
});

describe("F — vidéo HeyGen rapatriée → vidéo prête → kit → brouillon Buffer", () => {
  it("interrupteur « Je lis » ALLUMÉ (montage réel des prises) : la vidéo de Will, sous-titrée, avec miniature, part en brouillon Buffer", async () => {
    await reglages.definirJeLisReel("avocat", true);
    const { v, videoId, video } = await rapatrierEtMonter();
    expect(video.statut).toBe("prete");
    const version = (await depots().versions.obtenir(video.versionChoisieId!))!;
    expect(version.commande.moteurId).toBe("montage-avocat");
    // La vidéo HeyGen téléchargée dans R2 est la source du montage (jamais une vidéo de démonstration).
    expect(version.commande.prises?.[0]?.cle).toMatch(/heygen|rush/);
    const { f } = await sortieDe(videoId);
    expect(f?.cleStockage).not.toMatch(/^\/?demo\//);
    // Sous-titres (depuis le texte validé) et miniature.
    expect(await depots().sousTitres.compter((s) => s.versionId === version.id)).toBeGreaterThan(0);
    expect(await depots().miniatures.compter((m) => m.videoId === videoId)).toBeGreaterThan(0);
    // Rien de payé chez HeyGen (ni voix ni double) : seules des lectures.
    expect(ecrituresHeygen()).toEqual([]);
    const lignes = (await depots().depenses.lister((d) => d.videoId === videoId)).flatMap((d) => d.lignes);
    expect(lignes.filter((l) => l.etape === "Voix" || l.etape.startsWith("Double"))).toEqual([]);
    // Kit et brouillon Buffer.
    const kit = (await pub.obtenirKit(videoId))!;
    expect(kit.reseaux.length).toBeGreaterThan(0);
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
    const reseauBuffer = v.reseau === "instagram" || v.reseau === "linkedin" ? v.reseau : "instagram";
    const options = { autreReseauConfirme: reseauBuffer !== v.reseau };
    let envoi = await pub.envoyerVersBuffer(videoId, [reseauBuffer], DEMAIN, options);
    if (envoi.publications[0].etatEnvoi === "a-verifier") envoi = await pub.envoyerVersBuffer(videoId, [reseauBuffer], DEMAIN, options);
    expect(envoi.simulation).toBe(false);
    expect(envoi.publications[0]).toMatchObject({ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" });
    expect(await depots().publications.compter((p) => p.videoId === videoId && p.via === "buffer")).toBe(1);
  });

  /*
   * DÉFAUT CONFIRMÉ (BLOQUANT si l'interrupteur « Je lis » est éteint en production) — services/fabrication-reseaux.ts:171,
   * moteurs/index.ts (deciderJeLis), services/reglages.ts:192 (défaut `false`) : « Monter ma prise » sur la vidéo HeyGen
   * rapatriée fige le moteur du FORMAT, c'est-à-dire le moteur d'ESSAI (« Montage réel » éteint). La vidéo « prête »
   * est alors une vidéo de DÉMONSTRATION du studio (`/demo/avocat-…`), pas celle de Will. L'écran ne dit pas « essai » :
   * le bouton n'a la pastille ESSAI que si rien n'est payé (`ecrire/sujets/[id]/page.tsx:83`, `partPayee().rienNestPaye`,
   * faux en production : voix HeyGen et Claude reliés), et la fiche vidéo se croit « reliée » dès que studio-rendu l'est
   * (`videos/[id]/page.tsx:89`). Attendu : la vidéo de Will montée, ou un refus clair (« allumez … ») AVANT le lancement.
   */
  // CORRECTEUR FINAL A : « Monter ma prise » avec « Je lis » éteint est REFUSÉ avant tout lancement (la prise de Will
  // n'est jamais remplacée par une démonstration), avec le geste qui débloque ; rien n'est créé ni payé.
  it("CORRIGÉ — interrupteur « Je lis » ÉTEINT (défaut) : la vidéo prête est celle de Will, jamais une démonstration (refus clair avant le lancement)", async () => {
    const { v, sujetId } = await versionJeLis();
    const { videoId } = await service.rattacherVideoHeygen(v.id, "vid_001");
    expect((await reglages.decisionJeLis("avocat")).moteurId).toBe("simulation");
    expect((await fr.propositionsFabrication(sujetId)).aMonter).toContain(v.id);
    const depensesAvant = await depots().depenses.compter();
    const e = await fr.monterJeLis(v.id, { confirme: true }).catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "JE_LIS_ETEINT" });
    expect((e as Error).message).toMatch(/je lis/i);
    expect((e as Error).message).toMatch(/Rien|rien n'a été payé/);
    expect(await depots().travaux.compter((t) => t.cibleId === videoId)).toBe(0);
    expect(await depots().depenses.compter()).toBe(depensesAvant);
    // Aucune sortie de démonstration sur la vidéo de Will.
    const { f } = await sortieDe(videoId);
    expect(f?.cleStockage ?? "").not.toMatch(/^\/?demo\//);
  });
});
