/**
 * CORRECTEUR 4 — AVATAR PAR FORMAT, côté argent (réseau doublé repris de `r8-correctifs`, aucun appel réel, aucune clé) :
 *  - le prix de 45 s montré AVANT d'allumer suit l'avatar DU FORMAT (et son second angle, même tenue) ;
 *  - le prix de lancement (estimation de la vidéo) suit le même avatar : les deux prix restent égaux ;
 *  - garde B4 : un montage réel refuse une voix d'essai (« Reliez d'abord votre voix HeyGen dans Personnages. »).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";
import type { DemandeRendu } from "@/fournisseurs/types";

// Tout est « Relié » (réglages du serveur d'essai, valeurs factices) : voix, double, textes, rendu, stockage, Buffer.
process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_MINIATURE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.FOURNISSEUR_TEXTE_RESEAUX = "claude";
process.env.BUFFER_API_KEY = "cle-buffer-essai-c4";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/* ------------------------------------------------------------------ */
/* Le réseau doublé                                                     */
/* ------------------------------------------------------------------ */

const R = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string; corps?: unknown; cle?: string }[],
  /** Pannes à déclencher UNE fois (clé → nombre restant). */
  pannes: new Map<string, number>(),
  rendus: new Map<string, unknown>(),
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
  lecturesVoix: 0,
}));

function panne(cle: string): boolean {
  const n = R.pannes.get(cle) ?? 0;
  if (n <= 0) return false;
  R.pannes.set(cle, n - 1);
  return true;
}

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };

const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  const entetes = new Headers(init?.headers);
  if (String(url) === URL_BUFFER) return R.buffer!.appeler(url, init);
  const corps = typeof init?.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return undefined; } })() : undefined;
  R.appels.push({ hote: u.hostname, methode, chemin: u.pathname, corps, cle: entetes.get("Idempotency-Key") ?? undefined });

  // studio-rendu (HTTP doublé) : chaque opération répond « terminé » ; une panne passagère (503) ou un échec net.
  if (u.hostname === "studio-rendu.essai") {
    if (methode === "POST" && u.pathname === "/rendus") {
      const d = corps as DemandeRendu;
      if (panne(`rendu-indisponible:${d.operation}`)) return new Response("", { status: 503 });
      R.rendus.set(d.idRendu, d);
      return json({ idRendu: d.idRendu });
    }
    const id = decodeURIComponent(u.pathname.replace(/^\/rendus\//, ""));
    const d = R.rendus.get(id) as DemandeRendu | undefined;
    if (!d) return new Response("", { status: 404 });
    if (panne(`rendu-echec:${d.operation}`)) {
      R.rendus.delete(id);
      return json({ statut: "echec", erreur: { code: "inconnu", reessayable: false, message: "Le rendu a échoué." } });
    }
    const mesures = d.operation === "composition" ? MESURES_COMPOSITION : d.operation === "miniature" ? { instant: 3, nettete: 80 } : d.operation === "mesure-son" ? { lufs: -14, creteVraieDbtp: -2 } : undefined;
    return json({ statut: "termine", sortieCle: d.sortie.cle, ...(mesures ? { mesures } : {}) });
  }

  // HeyGen (double) : rendu Avatar V, suivi, téléchargement de la vidéo rendue.
  if (u.hostname === "api.heygen.com") {
    // Correcteur 4 : un troisième look (« Costume », trois quarts seul) pour l'avatar d'un autre format.
    if (u.pathname === "/v3/avatars/looks") return json({ data: [F.lookTermine.data, { ...F.lookTermine.data, id: "look_essai_face_002", name: "Presque de face, chemise noire" }, { ...F.lookTermine.data, id: "look_essai_costume_003", name: "Trois quarts, costume" }], has_more: false });
    if (methode === "POST" && u.pathname === "/v3/videos") {
      if (panne("heygen-rendu")) return json({ error: { message: "indisponible" } }, 503);
      return json({ data: { video_id: `video-${entetes.get("Idempotency-Key")}`, status: "waiting", output_format: "webm" } });
    }
    if (u.pathname.startsWith("/v3/videos/")) {
      if (panne("heygen-suivi")) throw new TypeError("coupure du réseau");
      return json(F.videoTerminee);
    }
  }
  if (u.hostname === "files2.heygen.ai") return new Response(new Uint8Array(32), { status: 200, headers: { "content-length": "32" } });

  // R2 (signé en local) : dépôts et relectures doublés.
  if (u.hostname.endsWith("r2.cloudflarestorage.com")) {
    if (methode === "PUT") {
      if (init?.body) await new Response(init.body as BodyInit).arrayBuffer();
      return new Response("", { status: 200 });
    }
    return new Response(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0]), { status: 200, headers: { "content-length": "16" } });
  }
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
  const { centimes } = await import("@/lib/montants");
  const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
  const f = ((u: string, i?: RequestInit) => reseau(u, i)) as unknown as typeof fetch;
  // Voix HeyGen doublée : réelle (payée au caractère), une lecture comptée ; une panne passagère AVANT paiement.
  const voix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    nom: "Voix HeyGen",
    mode: "reel" as const,
    async lire(d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) {
      if (panne("voix")) throw new TypeError("coupure du réseau");
      R.lecturesVoix++;
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-${R.lecturesVoix}.mp3`, cout: centimes(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-c4", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const reglages = await import("@/services/reglages");
const credits = await import("@/services/credits");
const doublesHeygen = await import("@/services/doubles-heygen");
const personnages = await import("@/services/personnages");
const videos = await import("@/services/videos");
const { ecrireParametre } = await import("@/services/_commun");
const renduDouble = await import("@/services/rendu-double");
const { secondesAnnonceesDouble } = await import("@/moteurs/montage-avocat/double");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");

const MDP = "essai-c4-avatar-prix";
const VIDEO = "v-03";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  R.appels = [];
  R.pannes.clear();
  R.rendus.clear();
  R.lecturesVoix = 0;
  R.buffer = fauxBuffer();
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.unstubAllGlobals();
});

/** Le double de Will (deux angles, ou l'angle principal seul), sa voix HeyGen, la vidéo en brouillon (pas un exemple). */
async function preparer(deuxAngles = true) {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
  const tq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
  if (deuxAngles) await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_face_002", angle: "face", tenue: "Chemise noire" });
  await d.personnages.modifier(moi.id, { visageParDefautId: tq });
  await renduDouble.definirRenduDouble({ allume: true });
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { fournisseur: "heygen" });
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { estDemo: false, statut: "brouillon", briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"], distribution: video.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: moi.id, visageId: tq, visagesParAngle: undefined } : x)) });
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
}

const travauxDeLaVideo = () => depots().travaux.compter((t) => t.cibleId === VIDEO);
const rienDePaye = () => R.lecturesVoix === 0 && !R.appels.some((a) => a.methode === "POST");
const carte = async () => (await reglages.listerConnexions()).find((c) => c.type === "montage")!.montageReel!.find((f) => f.formatId === "avocat")!;
const lignesDe = (p: { lignes: { quoi: string }[] }) => p.lignes.map((l) => l.quoi);

/** Will : avatar A (chemise noire, deux angles) par défaut ; avatar B (costume, trois quarts seul) pour le format avocat. */
async function avatarCostumePourAvocat() {
  await preparer(true);
  const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
  const costume = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_costume_003", angle: "trois-quarts", tenue: "Costume" });
  await personnages.choisirVisagePourFormat(moi.id, "avocat", costume);
  return { moi, costume };
}

describe("prix de 45 s : il suit l'avatar du format", () => {
  it("ROUGE — avatar du format sans second angle (costume seul) : pas de ligne de second angle, même si l'avatar habituel en a deux", async () => {
    await avatarCostumePourAvocat();
    // Avant : deux avatars prêts n'importe où → second angle compté, alors que la vidéo avocat partira sur un angle.
    expect(lignesDe((await carte()).prix)).toEqual(["Voix", "Votre avatar", "Textes des réseaux", "Montage, sous-titres, couleurs, son, miniature"]);
  });

  it("ROUGE — le prix de lancement d'une nouvelle vidéo avocat suit le même avatar (un angle, costume)", async () => {
    const { costume } = await avatarCostumePourAvocat();
    await reglages.definirMontageReel("avocat", true);
    const id = await videos.creerBrouillon("avocat", { scriptId: (await depots().videos.obtenir(VIDEO))!.scriptId });
    const video = (await depots().videos.obtenir(id))!;
    expect(video.distribution[0].visageId).toBe(costume);
    await depots().videos.modifier(id, { dureeCibleSec: 45 });
    const c = await fabrication.construireCommande(id);
    expect(c.distribution[0]).toMatchObject({ visageId: costume, modeAngles: "un-angle" });
    expect(secondesAnnonceesDouble({ ...c, dureeCibleSec: 45 })).toBe(45);
  });

  it("avatar habituel (deux angles) pour le format : le second angle reste compté, comme avant", async () => {
    await preparer(true);
    expect(lignesDe((await carte()).prix)).toContain("Votre avatar, second angle");
  });
});

describe("garde B4 : un montage réel refuse une voix d'essai", () => {
  it("ROUGE — voix d'essai : refus clair au lancement, rien n'est réservé ni payé", async () => {
    await preparer(true);
    await reglages.definirMontageReel("avocat", true);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "simulation" });
    await expect(fabrication.lancerFabricationConfirmee(VIDEO, { confirme: true })).rejects.toMatchObject({ code: "VOIX_ESSAI", message: "Reliez d'abord votre voix HeyGen dans Personnages." });
    expect(await travauxDeLaVideo()).toBe(0);
    expect(rienDePaye()).toBe(true);
  });

  it("voix HeyGen reliée : la garde laisse passer", async () => {
    await preparer(true);
    await reglages.definirMontageReel("avocat", true);
    const r = await fabrication.lancerFabricationConfirmee(VIDEO, { confirme: true });
    expect(r.travailId).toBeTruthy();
  });
});
