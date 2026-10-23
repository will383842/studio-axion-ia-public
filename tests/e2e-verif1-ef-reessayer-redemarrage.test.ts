/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS E : « Réessayer » après un échec, et REDÉMARRAGE du serveur en plein travail.
 *
 * Configuration de production rejouée : voix HeyGen, double HeyGen, montage sur studio-rendu, stockage R2, textes des
 * réseaux par Claude, Buffer. Les interrupteurs « Votre avatar parle » et « Montage réel » sont ALLUMÉS ici (c'est le
 * chemin où il y a de l'argent en jeu au redémarrage) ; le chemin d'aujourd'hui (interrupteurs éteints, moteur d'essai)
 * est rejoué à part.
 *
 * Un seul `fetch` doublé : studio-rendu, HeyGen (rendu, suivi, liste, téléchargement), R2 signé en local, Claude et
 * Buffer. Toute autre adresse fait échouer le test. Aucune clé réelle, aucun appel réel, 0 €.
 *
 * « Redémarrage » simulé : la mémoire vive du processus est vidée (état de la boucle, avancements en vol, tâches
 * annexes, premier tour du processus), les travaux sont relus « depuis la base » (copie JSON), et un NOUVEAU moteur est
 * construit. Les dépôts en mémoire jouent la base.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_V4 } from "@/briques/voix-maitre/reference";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";
import { fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";
import { executeurSimule } from "./helpers/g4";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DemandeRendu } from "@/fournisseurs/types";
import type { ExecuteurRoles } from "@/generateur/chaine";

process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_MINIATURE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.FOURNISSEUR_TEXTE_RESEAUX = "claude";
process.env.BUFFER_API_KEY = "cle-buffer-essai-verif1-ef";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

// 14/10 (voix de référence) : la voix lue ressemble à la v4 du premier coup (contrôle de ressemblance actif, 1 lecture).
const MESURES_VOIX_V4 = Object.fromEntries(Object.entries(REFERENCE_V4).map(([k, v]) => [`voix.${k}`, v]));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/* ------------------------------------------------------------------ */
/* Le réseau doublé                                                     */
/* ------------------------------------------------------------------ */

interface RenduHeygen {
  id: string;
  cle: string;
  titre: string;
  creeLe: number;
  suivis: number;
}

const R = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string; corps?: unknown; cle?: string }[],
  pannes: new Map<string, number>(),
  rendus: new Map<string, unknown>(),
  /** Rendus du double ACCEPTÉS par HeyGen (clé d'idempotence → rendu) : ce que HeyGen facture. */
  heygen: new Map<string, RenduHeygen>(),
  /** Nombre de suivis « en cours » avant « terminé » pour chaque rendu HeyGen. */
  suivisAvantFin: 2,
  /** HeyGen ne termine JAMAIS (rendu bloqué « processing »). */
  heygenBloque: false,
  /** HeyGen répond « échec » avec ce message brut (anglais technique). */
  heygenEchec: null as null | { failure_code: string; failure_message: string },
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
  lecturesVoix: 0,
  /** Erreur jetée par la voix (refus définitif, lisible). */
  voixRefus: null as null | Error,
  /** Correcteur D1 : code HTTP renvoyé par HeyGen au suivi `GET /v3/videos/{id}` (clé révoquée…). */
  suiviRefus: null as null | number,
  /** Correcteur D1 : téléchargements HeyGen refusés (taille non annoncée), après la fin du rendu. */
  telechargementsRefuses: 0,
  /** Correcteur D1 : rendus que HeyGen déclare échoués (son illisible), par identifiant. */
  echecsCibles: new Set<string>(),
}));

function panne(cle: string): boolean {
  const n = R.pannes.get(cle) ?? 0;
  if (n <= 0) return false;
  R.pannes.set(cle, n - 1);
  return true;
}

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };
/** Adresses inattendues (même si le studio a avalé l'erreur) : doit rester vide. */
const INATTENDUES: string[] = [];
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  const entetes = new Headers(init?.headers);
  if (String(url) === URL_BUFFER) return R.buffer!.appeler(url, init);
  const corps = typeof init?.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return undefined; } })() : undefined;
  R.appels.push({ hote: u.hostname, methode, chemin: u.pathname, corps, cle: entetes.get("Idempotency-Key") ?? undefined });

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
    const mesures = d.operation === "composition" ? MESURES_COMPOSITION : d.operation === "miniature" ? { instant: 3, nettete: 80 } : d.operation === "mesure-son" ? { lufs: -14, creteVraieDbtp: -2 } : d.parametres?.mode === "mesure-voix" ? MESURES_VOIX_V4 : undefined;
    return json({ statut: "termine", sortieCle: d.sortie.cle, ...(mesures ? { mesures } : {}) });
  }

  if (u.hostname === "api.heygen.com") {
    if (u.pathname === "/v3/avatars/looks") return json({ data: [F.lookTermine.data, { ...F.lookTermine.data, id: "look_essai_face_002", name: "Presque de face, chemise noire" }], has_more: false });
    // Recherche d'un rendu par son titre (gratuite) : les rendus acceptés.
    if (methode === "GET" && u.pathname === "/v3/videos") {
      const titre = u.searchParams.get("title");
      const liste = [...R.heygen.values()].filter((v) => !titre || v.titre === titre).map((v) => ({ id: v.id, title: v.titre, status: "processing", created_at: Math.floor(v.creeLe / 1000) }));
      return json({ data: liste, has_more: false, next_token: null });
    }
    if (methode === "POST" && u.pathname === "/v3/videos") {
      if (panne("heygen-rendu")) return json({ error: { message: "indisponible" } }, 503);
      const cle = entetes.get("Idempotency-Key") ?? "";
      // HeyGen honore la clé d'idempotence : la même clé rejouée ne crée (ni ne facture) rien de plus.
      const existant = R.heygen.get(cle);
      const rendu = existant ?? { id: `video-${cle}`, cle, titre: String((corps as { title?: string }).title ?? ""), creeLe: Date.now(), suivis: 0 };
      R.heygen.set(cle, rendu);
      // Coupure APRÈS acceptation : HeyGen a reçu (et facture), la réponse est perdue.
      if (panne("heygen-coupure-apres")) throw new TypeError("coupure du réseau");
      return json({ data: { video_id: rendu.id, status: "waiting", output_format: "webm" } });
    }
    if (u.pathname.startsWith("/v3/videos/")) {
      const id = decodeURIComponent(u.pathname.split("/").at(-1)!);
      const rendu = [...R.heygen.values()].find((v) => v.id === id);
      if (R.suiviRefus) return json({ error: { code: "unauthorized", message: "Invalid API key" } }, R.suiviRefus);
      if (R.echecsCibles.has(id)) return json({ data: { id, status: "failed", video_url: null, duration: null, failure_code: "AUDIO_DOWNLOAD_FAILED", failure_message: "Could not download audio" } });
      if (R.heygenEchec) return json({ data: { id, status: "failed", video_url: null, duration: null, ...R.heygenEchec } });
      if (rendu && (R.heygenBloque || rendu.suivis++ < R.suivisAvantFin)) return json({ data: { id, status: "processing", video_url: null, duration: null, failure_code: null, failure_message: null } });
      return json({ data: { ...F.videoTerminee.data, id } });
    }
  }
  if (u.hostname === "files2.heygen.ai" && R.telechargementsRefuses > 0) {
    R.telechargementsRefuses--;
    return new Response(new Uint8Array(32), { status: 200 });
  }
  if (u.hostname === "files2.heygen.ai") return new Response(new Uint8Array(32), { status: 200, headers: { "content-length": "32" } });

  if (u.hostname.endsWith("r2.cloudflarestorage.com")) {
    if (methode === "PUT") {
      if (init?.body) await new Response(init.body as BodyInit).arrayBuffer();
      return new Response("", { status: 200 });
    }
    return new Response(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0]), { status: 200, headers: { "content-length": "16" } });
  }
  INATTENDUES.push(`${methode} ${u.hostname}${u.pathname}`);
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
  const { centimes } = await import("@/lib/montants");
  const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
  const f = ((u: string, i?: RequestInit) => reseau(u, i)) as unknown as typeof fetch;
  const voix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    nom: "Voix HeyGen",
    mode: "reel" as const,
    async lire(d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) {
      if (R.voixRefus) throw R.voixRefus;
      if (panne("voix")) throw new TypeError("coupure du réseau");
      R.lecturesVoix++;
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-${R.lecturesVoix}.mp3`, cout: centimes(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-ef", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
    videosHeygen: () => null,
  };
});

// Le `fetch` global est doublé AVANT d'importer le studio : le registre des fournisseurs crée le stockage R2 à
// l'import et garde le `fetch` de ce moment-là (sinon ses lectures et effacements partiraient sur le vrai réseau).
vi.stubGlobal("fetch", reseau);
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const reglages = await import("@/services/reglages");
const pub = await import("@/services/publications");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const doublesHeygen = await import("@/services/doubles-heygen");
const { ecrireParametre, ErreurStudio, sousVerrou } = await import("@/services/_commun");
const renduDouble = await import("@/services/rendu-double");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { MESSAGE_DELAI_RENDU_DOUBLE, MESSAGE_DOUBLE_SUIVI_REFUSE, MESSAGE_DOUBLE_TOUJOURS_EN_COURS, lignesDouble } = await import("@/moteurs/montage-avocat/double");
type EtatDoubleMoteur = import("@/moteurs/montage-avocat/double").EtatDoubleMoteur;
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "essai-verif1-ef-reprise";
const VIDEO = "v-03";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
/** Texte technique interdit à l'écran (code, nom interne, anglais technique, JSON, « undefined »). */
const TECHNIQUE = /undefined|null|\bError\b|[A-Z]{2,}_[A-Z]{2,}|https?:|[{}]|\bstatus\b|\bfailed\b|internal|server|render|avatar_|exception|stack/i;

const claude = { appels: [] as string[] };
function brancherClaude() {
  claude.appels = [];
  void credits.declarerRecharge("anthropic", 500);
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string }[] };
    const r = /<reseau id="([^"]+)"/.exec(corps.messages?.[0]?.content ?? "")?.[1] ?? "?";
    if (panne("claude")) return reponseErreur(529, "overloaded_error", "Surchargé");
    claude.appels.push(r);
    const texte = "Votre question juridique, expliquée simplement.\n\nLe point en moins d'une minute.";
    const sortie = { premiereLigne: texte.split("\n")[0], texte, motsDiese: ["#Droit", "#Avocat"], ...(r.startsWith("youtube") ? { titres: ["Votre question juridique en une minute"] } : {}), justifications: [] };
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  R.appels = [];
  R.pannes.clear();
  R.rendus.clear();
  R.heygen.clear();
  R.suivisAvantFin = 2;
  R.heygenBloque = false;
  R.heygenEchec = null;
  R.lecturesVoix = 0;
  R.voixRefus = null;
  R.suiviRefus = null;
  R.telechargementsRefuses = 0;
  R.echecsCibles.clear();
  R.buffer = fauxBuffer();
  vi.stubGlobal("fetch", reseau);
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  brancherClaude();
});

afterEach(() => {
  expect(INATTENDUES.splice(0)).toEqual([]);
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  vi.stubGlobal("fetch", reseau);
  vi.useRealTimers();
});

/** Will a choisi son double (deux angles), sa voix HeyGen ; « Votre avatar parle » et « Montage réel » allumés. */
async function preparer(options: { montageReel?: boolean } = {}) {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
  const tq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_face_002", angle: "face", tenue: "Chemise noire" });
  await d.personnages.modifier(moi.id, { visageParDefautId: tq });
  await renduDouble.definirRenduDouble({ allume: true });
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { fournisseur: "heygen" });
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { estDemo: false, briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"], distribution: video.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: moi.id, visageId: tq, visagesParAngle: undefined } : x)) });
  for (const k of await d.kits.lister((x) => x.videoId === VIDEO)) await d.kits.modifier(k.id, { videoId: "v-archive-ef" });
  for (const m of await d.miniatures.lister((x) => x.videoId === VIDEO)) await d.miniatures.modifier(m.id, { videoId: "v-archive-ef" });
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
  if (options.montageReel !== false) await reglages.definirMontageReel("avocat", true);
}

/**
 * Redémarrage du serveur : plus rien en mémoire vive (boucle, avancements en vol, tâches annexes, premier tour du
 * processus) ; les travaux sont relus depuis la base (copie JSON : aucune référence partagée avec l'ancien processus).
 */
async function redemarrer() {
  boucle.avancementsEnVol().clear();
  boucle.annexesEnVol().clear();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.boucle")];
  boucle.simulerRedemarragePourEssai();
  for (const t of await depots().travaux.lister()) await depots().travaux.enregistrer(JSON.parse(JSON.stringify(t)));
}

/** Un tour de boucle, horloge avancée de `pasMs`. `redemarrageAChaqueTour` : un nouveau processus à chaque tour. */
async function tours(travailId: string, o: { max?: number; pasMs?: number; redemarrageAChaqueTour?: boolean; reessayer?: boolean; jusqua?: (t: Awaited<ReturnType<typeof lire>>) => boolean } = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  let m = creerMoteurMontageAvocat();
  let reprises = 0;
  for (let i = 0; i < (o.max ?? 400); i++) {
    const t = await lire(travailId);
    if (t.statut === "termine" || o.jusqua?.(t)) break;
    if (t.statut === "echec") {
      if (!o.reessayer) break;
      reprises++;
      await travaux.reessayerTravail(travailId);
    }
    if (o.redemarrageAChaqueTour) {
      await redemarrer();
      m = creerMoteurMontageAvocat();
    }
    vi.setSystemTime(Date.now() + (o.pasMs ?? 15_000));
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
  }
  vi.useRealTimers();
  return { travail: await lire(travailId), reprises };
}

const lire = async (id: string) => (await depots().travaux.obtenir(id))!;
const rendusHeygenAcceptes = () => R.heygen.size;
const postsComposition = () => R.appels.filter((a) => a.hote === "studio-rendu.essai" && a.methode === "POST" && (a.corps as DemandeRendu | undefined)?.operation === "composition").map((a) => (a.corps as DemandeRendu).idRendu);
const lignesDeLaVideo = async () => (await depots().depenses.lister((d) => d.videoId === VIDEO)).flatMap((d) => d.lignes);

async function lancer() {
  return fabrication.lancerFabrication(VIDEO, { confirme: true });
}

async function finirEtPublier() {
  const kit = (await pub.obtenirKit(VIDEO))!;
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
  let envoi = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
  if (envoi.publications[0].etatEnvoi === "a-verifier") envoi = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
  return { kit, envoi };
}

/* ------------------------------------------------------------------ */
/* E1 — Réessayer                                                       */
/* ------------------------------------------------------------------ */

describe("E1 — panne puis « Réessayer » (montage réel allumé)", () => {
  it("composition en échec net : message lisible, « Réessayer » ne relance que l'étape en échec, rien n'est repayé ; double clic = une seule relance", async () => {
    await preparer();
    R.pannes.set("rendu-echec:composition", 1);
    const { travailId } = await lancer();
    const avant = await depots().travaux.compter();
    const { travail: enEchec } = await tours(travailId);
    expect(enEchec.statut).toBe("echec");
    // Le message pour Will est une phrase simple ; « Réessayer » est proposé (étape réessayable).
    const etapeEchec = enEchec.etapes.find((e) => e.statut === "echec")!;
    expect(etapeEchec).toBeDefined();
    expect(etapeEchec.erreur?.reessayable).not.toBe(false);
    expect(enEchec.erreur?.messagePourWill).toBeTruthy();
    expect(enEchec.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    // La notification aussi.
    const notif = (await depots().notifications.lister((n) => n.type === "echec")).at(-1)!;
    expect(`${notif.titre} ${notif.message ?? ""}`).not.toMatch(TECHNIQUE);
    const terminees = enEchec.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);
    expect(terminees).toEqual(expect.arrayContaining(["voix", "visage"]));
    const rendusAvant = rendusHeygenAcceptes();

    // Double clic sur « Réessayer » (deux requêtes simultanées) : une seule relance, aucun second travail.
    const [a, b] = await Promise.allSettled([travaux.reessayerTravail(travailId), travaux.reessayerTravail(travailId)]);
    const ok = [a, b].filter((x) => x.status === "fulfilled");
    const refus = [a, b].filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(refus).toHaveLength(1);
    expect(refus[0].reason).toBeInstanceOf(ErreurStudio);
    expect((refus[0].reason as Error).message).not.toMatch(TECHNIQUE);
    expect(await depots().travaux.compter()).toBe(avant);
    const relance = await lire(travailId);
    expect(relance.tentatives).toBe(enEchec.tentatives + 1);
    // Seule l'étape en échec (et ce qui en dépend) repart : les étapes terminées le restent.
    for (const cle of terminees) expect(relance.etapes.find((e) => e.cle === cle)?.statut).toBe("terminee");

    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    // Rien de repayé : une lecture de voix, aucun nouveau rendu du double.
    expect(R.lecturesVoix).toBe(1);
    expect(rendusHeygenAcceptes()).toBe(rendusAvant);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(rendusAvant);
  });

  it("« Réessayer » sur un travail qui n'est pas en échec : refus en phrase simple, rien ne change", async () => {
    await preparer();
    const { travailId } = await lancer();
    const t = await lire(travailId);
    await expect(travaux.reessayerTravail(travailId)).rejects.toMatchObject({ code: "PAS_EN_ECHEC" });
    expect(await lire(travailId)).toEqual(t);
  });

  it("moteur d'essai (interrupteurs éteints, la configuration d'aujourd'hui) : échec simulé, « Réessayer », seule l'étape repart", async () => {
    await preparer({ montageReel: false });
    const { travailId, versionId } = await fabrication.lancerFabrication(VIDEO, { confirme: true, simulerEchecEtape: "montage" });
    expect((await depots().versions.obtenir(versionId))!.commande.moteurId).toBe("simulation");
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 100 && (await lire(travailId)).statut !== "echec"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.contenuDuTour();
    }
    vi.useRealTimers();
    const e = await lire(travailId);
    expect(e.statut).toBe("echec");
    expect(e.erreur?.messagePourWill).toMatch(/n'a pas abouti/);
    expect(e.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    const faites = e.etapes.filter((x) => x.statut === "terminee").map((x) => x.cle);
    await travaux.reessayerTravail(travailId);
    const r = await lire(travailId);
    for (const cle of faites) expect(r.etapes.find((x) => x.cle === cle)?.statut).toBe("terminee");
    expect(r.etapes.find((x) => x.cle === "montage")?.statut).toBe("en_attente");
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 100 && (await lire(travailId)).statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.contenuDuTour();
    }
    vi.useRealTimers();
    expect((await lire(travailId)).statut).toBe("termine");
    // Aucun appel au réseau payant : le moteur d'essai ne lit pas la voix HeyGen et ne rend aucun double.
    expect(R.lecturesVoix).toBe(0);
    expect(rendusHeygenAcceptes()).toBe(0);
  });

  /*
   * DÉFAUT CORRIGÉ (était : gêne) — services/travaux.ts, `ecrirePanne` : un refus DÉFINITIF d'un fournisseur (erreur `reessayable:
   * false`, ici la voix HeyGen qui refuse la clé, avec une phrase déjà lisible) devient toujours le texte fixe « Un outil
   * a refusé cette étape. Vous pouvez réessayer. » : la vraie raison (lisible) part dans `detailTechnique`, Will ne sait
   * pas quoi faire, et « Réessayer » redonne le même refus. Attendu : la phrase du fournisseur quand elle est lisible
   * (`ErreurLisible`/`ErreurFournisseur.message`), et « Réessayer » seulement si cela peut changer quelque chose.
   * Correction : la raison est gardée quand c'est déjà une phrase simple (`phraseLisible`), sinon la phrase fixe.
   */
  it("CORRIGÉ — refus définitif d'un outil (clé HeyGen refusée) : Will lit la vraie raison, pas « Un outil a refusé cette étape »", async () => {
    await preparer();
    R.voixRefus = Object.assign(new Error("HeyGen refuse la clé du studio : remplacez-la dans Réglages > Connexions."), { reessayable: false });
    const { travailId } = await lancer();
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.messagePourWill).toMatch(/clé/);
    expect(travail.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    // La cloche dit la même vraie raison.
    const notif = (await depots().notifications.lister((n) => n.type === "echec")).at(-1)!;
    expect(notif.message).toMatch(/clé/);
  });

  /*
   * DÉFAUT CORRIGÉ (était : gêne) — fournisseurs/heygen/rendus.ts:127 + moteurs/montage-avocat/index.ts:1310 : un rendu du
   * double refusé par HeyGen pour une raison inconnue affiche son `failure_message` BRUT (anglais technique) dans le
   * message de l'étape : « Votre double n'a pas pu être rendu : HeyGen n'a pas réussi ce rendu (Internal server error
   * while rendering avatar). ». Attendu : une phrase en français, le détail brut en console seulement.
   * Correction : phrase fixe (`MESSAGE_RENDU_ECHOUE`), texte de HeyGen en console.warn et `detailTechnique`.
   */
  it("CORRIGÉ — échec d'un rendu HeyGen : aucun anglais technique dans le message montré à Will", async () => {
    await preparer();
    R.heygenEchec = { failure_code: "internal_error", failure_message: "Internal server error while rendering avatar" };
    const { travailId } = await lancer();
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("echec");
    const message = travail.etapes.find((e) => e.statut === "echec")?.erreur?.messagePourWill ?? "";
    expect(message).not.toMatch(/internal|server|error|rendering|avatar/i);
    expect(message).not.toMatch(TECHNIQUE);
  });
});

/* ------------------------------------------------------------------ */
/* E2 — Redémarrage en plein travail                                    */
/* ------------------------------------------------------------------ */

describe("E2 — redémarrage du serveur en plein travail (montage réel allumé)", () => {
  it("redémarrage pendant le rendu du double (accepté par HeyGen, pas encore relu) : reprise sans rien repayer, jusqu'au brouillon Buffer", async () => {
    await preparer();
    R.suivisAvantFin = 3;
    const { travailId } = await lancer();
    // Jusqu'à ce que HeyGen ait accepté le rendu principal (étape « double » en cours) et que la voix soit payée.
    const { travail: milieu } = await tours(travailId, { jusqua: (t) => t.etapes.find((e) => e.cle === "visage")?.statut === "en_cours" && R.heygen.size > 0 });
    expect(milieu.statut).toBe("en_cours");
    expect(R.lecturesVoix).toBe(1);
    const acceptes = rendusHeygenAcceptes();
    expect(acceptes).toBeGreaterThan(0);
    await redemarrer();
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    // Voix : jamais relue ; double : aucune nouvelle clé pour les pièces déjà acceptées.
    expect(R.lecturesVoix).toBe(1);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(rendusHeygenAcceptes());
    // Composition : chaque demande à studio-rendu n'est envoyée qu'une fois.
    const compo = postsComposition();
    expect(new Set(compo).size).toBe(compo.length);
    const { kit, envoi } = await finirEtPublier();
    expect([...claude.appels].sort()).toEqual(["instagram", "linkedin", "tiktok", "youtube-shorts"]);
    expect(kit.reseaux.find((r) => r.reseau === "instagram")!.texte).toMatch(/question juridique/);
    expect(envoi.publications[0]).toMatchObject({ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" });
  });

  it("redémarrage à CHAQUE tour (pire cas) : la vidéo va au bout, voix lue une fois, chaque pièce du double rendue une fois", async () => {
    await preparer();
    const { travailId } = await lancer();
    const { travail } = await tours(travailId, { redemarrageAChaqueTour: true });
    expect(travail.statut).toBe("termine");
    expect(R.lecturesVoix).toBe(1);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(rendusHeygenAcceptes());
    const compo = postsComposition();
    expect(new Set(compo).size).toBe(compo.length);
  });

  it("coupure pendant l'envoi au double (HeyGen a reçu, réponse perdue) puis redémarrage : retrouvé, jamais payé deux fois", async () => {
    await preparer();
    R.pannes.set("heygen-coupure-apres", 1);
    const { travailId } = await lancer();
    await tours(travailId, { jusqua: () => R.pannes.get("heygen-coupure-apres") === 0, max: 200 });
    expect(R.pannes.get("heygen-coupure-apres")).toBe(0);
    await redemarrer();
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    // Chaque pièce acceptée une seule fois (une clé = un rendu facturé), et autant de lignes de dépense que de rendus.
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(rendusHeygenAcceptes());
    const doublons = R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").map((a) => a.cle);
    // La clé coupée a pu être rejouée (même clé) : HeyGen ne facture pas deux fois.
    expect(new Set(doublons).size).toBe(rendusHeygenAcceptes());
  });

  it("redémarrage pendant une lecture de voix (payée, jamais revenue) : comptée comme dépense probable, une fois", async () => {
    await preparer();
    const { travailId } = await lancer();
    // La lecture part (et est payée chez HeyGen) mais le processus meurt avant son retour : simulée par un délai
    // dépassé dont la réponse n'arrive jamais avant le redémarrage.
    vi.useFakeTimers({ toFake: ["Date"] });
    const m = creerMoteurMontageAvocat();
    const bloquee = { ...m, avancer: () => new Promise<never>(() => undefined) };
    await boucle.contenuDuTour({ choisirMoteur: () => bloquee, delai: () => 1 });
    vi.useRealTimers();
    await redemarrer();
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    const probables = (await lignesDeLaVideo()).filter((l) => /redémarrage/.test(l.etape));
    expect(probables).toHaveLength(1);
    expect(probables[0].fournisseur).toBe("heygen");
  });

  /*
   * DÉFAUT CONFIRMÉ (gêne, argent non perdu mais finition manquante) — services/boucle.ts:248-270 et
   * services/travaux.ts:190-192 : les miniatures et les textes des réseaux écrits par Claude sont des « suites » lancées
   * en mémoire APRÈS l'écriture « terminé ». Un redémarrage entre les deux (mise à jour du studio pendant la fin d'une
   * vidéo) : le travail est « terminé », plus rien ne relance la finition (aucun rattrapage au démarrage) ; la vidéo
   * reste sans miniature tirée de la vidéo et avec les textes d'ESSAI. Attendu : au premier tour du nouveau processus,
   * les vidéos prêtes sans miniatures ni écriture automatique reçoivent leur finition (une fois).
   */
  // INTÉGRATION FINALE : corrigé — les suites sont notées en base avec « terminé » et reprises au premier tour.
  it("CORRIGÉ — redémarrage entre « terminé » et la finition : miniatures et textes Claude sont rattrapés", async () => {
    await preparer();
    const { travailId } = await lancer();
    const m = creerMoteurMontageAvocat();
    vi.useFakeTimers({ toFake: ["Date"] });
    // Tours SANS les suites (le processus meurt juste après l'écriture de l'avancement).
    for (let i = 0; i < 400 && (await lire(travailId)).statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 15_000);
      const lus = await sousVerrou(() => travaux.lireTravauxAAvancer(Date.now(), () => m));
      for (const lu of lus) {
        try {
          const sortie = await lu.moteur.avancer(lu.travail, lu.commande);
          await sousVerrou(() => travaux.ecrireAvancement(lu, sortie));
        } catch (e) {
          await sousVerrou(() => travaux.ecrirePanne(lu, e, Date.now()));
        }
      }
    }
    vi.useRealTimers();
    expect((await lire(travailId)).statut).toBe("termine");
    await redemarrer();
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 15_000);
      await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
    }
    vi.useRealTimers();
    expect(await depots().miniatures.compter((x) => x.videoId === VIDEO)).toBeGreaterThan(0);
    expect(claude.appels.length).toBe(4);
    // Un second redémarrage ne refait (ni ne repaie) rien : la note en base est levée une fois la finition faite.
    const miniatures = await depots().miniatures.compter((x) => x.videoId === VIDEO);
    await redemarrer();
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
    expect(claude.appels.length).toBe(4);
    expect(await depots().miniatures.compter((x) => x.videoId === VIDEO)).toBe(miniatures);
    expect(await depots().parametres.compter((p) => p.id.startsWith("fabrication.finitionAFaire.") && p.valeur !== null)).toBe(0);
  });

  /*
   * RELECTURE FINALE (petit) : la note de finition était écrite par un `ecrireParametre` SÉPARÉ, après « terminé » :
   * un arrêt entre les deux perdait la finition. Elle est maintenant portée par le travail, dans la MÊME écriture.
   * Ici, le processus meurt juste avant toute écriture de paramètre de finition.
   */
  it("CORRIGÉ — arrêt juste après « terminé » : la finition, notée dans la même écriture, est rattrapée", async () => {
    await preparer();
    const { travailId } = await lancer();
    const m = creerMoteurMontageAvocat();
    const parametres = depots().parametres;
    const original = parametres.enregistrer.bind(parametres);
    // Le processus « meurt » à toute écriture séparée d'une note de finition.
    vi.spyOn(parametres, "enregistrer").mockImplementation(async (p) => {
      if (p.id.startsWith("fabrication.finitionAFaire.")) throw new Error("arrêt brutal");
      return original(p);
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 400 && (await lire(travailId)).statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 15_000);
      const lus = await sousVerrou(() => travaux.lireTravauxAAvancer(Date.now(), () => m));
      for (const lu of lus) {
        try {
          const sortie = await lu.moteur.avancer(lu.travail, lu.commande);
          await sousVerrou(() => travaux.ecrireAvancement(lu, sortie));
        } catch (e) {
          await sousVerrou(() => travaux.ecrirePanne(lu, e, Date.now()));
        }
      }
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    expect((await lire(travailId)).statut).toBe("termine");
    await redemarrer();
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 15_000);
      await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
    }
    vi.useRealTimers();
    expect(await depots().miniatures.compter((x) => x.videoId === VIDEO)).toBeGreaterThan(0);
    expect(claude.appels.length).toBe(4);
    expect((await lire(travailId)).finitionAFaire ?? []).toEqual([]);
  });

  it("CORRIGÉ — une seule suite en échec : seule elle est rejouée (la finition faite ne l'est pas deux fois)", async () => {
    const miniatures = await import("@/services/miniatures");
    const fr = await import("@/services/fabrication-reseaux");
    const espionMini = vi.spyOn(miniatures, "creerMiniaturesSiAbsentes").mockResolvedValue(undefined as never);
    let pannes = 1;
    const espionGen = vi.spyOn(fr, "apresFabricationGenerateur").mockImplementation(async () => {
      if (pannes-- > 0) throw new Error("panne passagère");
    });
    const t = (await depots().travaux.lister())[0];
    const suites: import("@/domaine/types").SuiteFabrication[] = [
      { type: "finition", videoId: VIDEO, titre: "x", ratio: "9:16", textes: false, travailId: t.id },
      { type: "generateur", videoId: VIDEO, travailId: t.id },
    ];
    await depots().travaux.enregistrer({ ...t, statut: "termine", finitionAFaire: suites });
    await travaux.executerSuites(suites);
    expect((await lire(t.id)).finitionAFaire).toEqual([suites[1]]);
    await travaux.rattraperFinitions();
    expect(espionMini).toHaveBeenCalledTimes(1);
    expect(espionGen).toHaveBeenCalledTimes(2);
    expect((await lire(t.id)).finitionAFaire ?? []).toEqual([]);
    vi.restoreAllMocks();
  });

  /*
   * DÉFAUT CORRIGÉ (était : gêne, écran « en cours » sans fin) — moteurs/montage-avocat/double.ts, phase « rendu » : un rendu HeyGen qui
   * reste « processing » n'a AUCUNE limite de temps (la limite de 24 h de `services/travaux.ts:460` ne joue que sur des
   * pannes levées). Le travail reste « en cours » indéfiniment, sans bandeau « outil ralenti » ni échec : Will ne voit
   * qu'un pourcentage figé (seul « Arrêter » l'en sort). Attendu : au-delà d'une durée (ex. 24 h), « en attente du
   * fournisseur » puis échec lisible avec « Réessayer ».
   * Correction (décision du propriétaire) : délai maximal `DELAI_MAX_RENDU_DOUBLE_MS` (6 h depuis la décision d'envoi),
   * puis échec réessayable, phrase simple et notification.
   */
  it("CORRIGÉ — rendu HeyGen bloqué « en cours » 48 h : le travail n'est pas « en cours » pour toujours", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    await tours(travailId, { max: 60, pasMs: 3600_000 });
    const vue = (await travaux.obtenirTravail(travailId))!;
    expect(vue.statut === "echec" || vue.enAttenteFournisseur).toBe(true);
    expect(vue.statut).toBe("echec");
    expect(vue.erreur?.messagePourWill).toBe(MESSAGE_DELAI_RENDU_DOUBLE);
    expect(vue.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    expect(vue.erreur?.reessayable).toBe(true);
    const notif = (await depots().notifications.lister((n) => n.type === "echec")).at(-1)!;
    expect(notif.message).toBe(MESSAGE_DELAI_RENDU_DOUBLE);
  });

  it("Réessayer après délai : l'ancien rendu fini entre-temps est repris, aucune nouvelle soumission ; la voix n'est pas relue", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    const { travail: enEchec } = await tours(travailId, { max: 60, pasMs: 3600_000 });
    expect(enEchec.statut).toBe("echec");
    expect(enEchec.erreur?.messagePourWill).toBe(MESSAGE_DELAI_RENDU_DOUBLE);
    expect(R.lecturesVoix).toBe(1);
    const envoisAvant = R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").length;
    const acceptesAvant = rendusHeygenAcceptes();
    expect(acceptesAvant).toBeGreaterThan(0);
    // Le rendu bloqué finit chez HeyGen pendant que Will lit le message ; il touche « Réessayer ».
    R.heygenBloque = false;
    R.suivisAvantFin = 0;
    await travaux.reessayerTravail(travailId);
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    // Aucune nouvelle soumission payante : l'ancien rendu est repris.
    expect(R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos")).toHaveLength(envoisAvant);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
    // La voix n'est pas relue ni repayée ; chaque rendu du double compté une fois.
    expect(R.lecturesVoix).toBe(1);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(acceptesAvant);
  });

  /*
   * RELECTURE FINALE E1 : « Réessayer » alors que l'ancien rendu est TOUJOURS « en cours » chez HeyGen. Avant : la
   * pièce repartait en envoi (clé neuve), l'identifiant de l'ancien rendu était perdu et il n'était plus compté
   * (payé deux fois, compté une fois). Attendu : rien n'est renvoyé tant que HeyGen n'a ni fini ni échoué ; l'ancien
   * rendu reste compté, avec son identifiant ; Will lit la vérité.
   */
  it("CORRIGÉ E1 — Réessayer pendant que l'ancien rendu est toujours « en cours » : rien n'est renvoyé, il reste compté, Will lit la vérité", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    const { travail: enEchec } = await tours(travailId, { max: 60, pasMs: 3600_000 });
    expect(enEchec.statut).toBe("echec");
    const envoisAvant = R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").length;
    const acceptesAvant = rendusHeygenAcceptes();
    const idsAvant = (enEchec.parametres!.double as EtatDoubleMoteur).pieces.flatMap((p) => (p.idExterne ? [p.idExterne] : []));
    expect(idsAvant.length).toBeGreaterThan(0);
    // HeyGen n'a toujours pas fini : Will touche « Réessayer » deux fois, à une heure d'écart.
    for (let n = 0; n < 2; n++) {
      await travaux.reessayerTravail(travailId);
      const { travail } = await tours(travailId, { max: 20, pasMs: 3600_000 });
      expect(travail.statut).toBe("echec");
      expect(travail.erreur?.messagePourWill).toBe(MESSAGE_DOUBLE_TOUJOURS_EN_COURS);
      expect(travail.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
      // Aucun nouvel envoi payant, aucun nouveau rendu accepté.
      expect(R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos")).toHaveLength(envoisAvant);
      expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
      // L'identifiant de chaque ancien rendu est gardé, et chacun reste compté dans la dépense.
      const etat = travail.parametres!.double as EtatDoubleMoteur;
      for (const id of idsAvant) expect(etat.pieces.some((p) => p.idExterne === id)).toBe(true);
      expect(lignesDouble(etat).length).toBeGreaterThanOrEqual(idsAvant.length);
      const lignes = await lignesDeLaVideo();
      expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(acceptesAvant);
    }
    // HeyGen finit enfin : « Réessayer » reprend les anciens rendus, sans rien renvoyer ni recompter.
    R.heygenBloque = false;
    R.suivisAvantFin = 0;
    await travaux.reessayerTravail(travailId);
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    expect(R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos")).toHaveLength(envoisAvant);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(acceptesAvant);
  });

  /*
   * CORRECTEUR D1 (relecture finale 2) : HeyGen refuse net de répondre sur un rendu déjà accepté (clé révoquée pendant
   * le rendu, téléchargement refusé après la fin). Avant : la pièce passait en échec SANS rester comptée, son
   * identifiant était perdu et « Réessayer » la renvoyait (payée deux fois, comptée une fois ou pas du tout).
   * Attendu : elle reste comptée avec son identifiant ; « Réessayer » la RELIT, jamais renvoyée tant que HeyGen y
   * travaille ; seul un échec réel chez HeyGen la fait repartir (clé neuve, sous le plafond).
   */
  const postsHeygen = () => R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").length;
  const etatDouble = (t: Awaited<ReturnType<typeof lire>>) => t.parametres?.double as EtatDoubleMoteur | undefined;
  /** Toutes les pièces du double acceptées par HeyGen (en rendu). */
  const toutEnRendu = (t: Awaited<ReturnType<typeof lire>>) => !!etatDouble(t)?.pieces.length && etatDouble(t)!.pieces.every((p) => p.phase === "rendu");

  it("CORRIGÉ D1 (a) — clé refusée au suivi pendant le rendu, puis « Réessayer » avec une clé valide : aucun renvoi tant que HeyGen y travaille, compté une fois", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    await tours(travailId, { max: 60, jusqua: toutEnRendu });
    const idsAvant = etatDouble(await lire(travailId))!.pieces.map((p) => p.idExterne!);
    expect(idsAvant.length).toBeGreaterThan(1);
    const envoisAvant = postsHeygen();
    const acceptesAvant = rendusHeygenAcceptes();
    // La clé est révoquée en plein rendu : HeyGen refuse le suivi.
    R.suiviRefus = 401;
    const { travail: enEchec } = await tours(travailId, { max: 20 });
    expect(enEchec.statut).toBe("echec");
    expect(enEchec.erreur?.messagePourWill).toContain(MESSAGE_DOUBLE_SUIVI_REFUSE);
    expect(enEchec.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    expect(enEchec.erreur!.messagePourWill).not.toMatch(/\b40\d\b|invalid|key\b/i);
    // Chaque rendu accepté reste compté, avec son identifiant.
    const etat = etatDouble(enEchec)!;
    expect(lignesDouble(etat)).toHaveLength(idsAvant.length);
    for (const id of idsAvant) expect(etat.pieces.some((p) => p.idExterne === id)).toBe(true);
    // Will remet une clé valide ; HeyGen travaille toujours : « Réessayer » relit, rien n'est renvoyé.
    R.suiviRefus = null;
    await travaux.reessayerTravail(travailId);
    const { travail: encore } = await tours(travailId, { max: 20, pasMs: 3600_000 });
    expect(encore.statut).toBe("echec");
    expect(encore.erreur?.messagePourWill).toBe(MESSAGE_DOUBLE_TOUJOURS_EN_COURS);
    expect(postsHeygen()).toBe(envoisAvant);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
    // HeyGen finit : « Réessayer » reprend les anciens rendus, sans renvoi ; chacun compté une fois.
    R.heygenBloque = false;
    R.suivisAvantFin = 0;
    await travaux.reessayerTravail(travailId);
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    expect(postsHeygen()).toBe(envoisAvant);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(acceptesAvant);
  });

  it("CORRIGÉ D1 (b) — téléchargement refusé après la fin chez HeyGen : « Réessayer » récupère l'ancien rendu sans renvoi, compté une fois", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    await tours(travailId, { max: 60, jusqua: toutEnRendu });
    const envoisAvant = postsHeygen();
    const acceptesAvant = rendusHeygenAcceptes();
    // HeyGen finit et facture, mais n'annonce pas la taille du fichier : le studio refuse de le télécharger.
    R.heygenBloque = false;
    R.suivisAvantFin = 0;
    R.telechargementsRefuses = 1000;
    const { travail: enEchec } = await tours(travailId, { max: 20 });
    expect(enEchec.statut).toBe("echec");
    expect(enEchec.erreur?.messagePourWill).toContain(MESSAGE_DOUBLE_SUIVI_REFUSE);
    expect(enEchec.erreur!.messagePourWill).not.toMatch(TECHNIQUE);
    expect(lignesDouble(etatDouble(enEchec)!)).toHaveLength(acceptesAvant);
    // Le téléchargement redevient possible : « Réessayer » relit et récupère, rien n'est renvoyé.
    R.telechargementsRefuses = 0;
    await travaux.reessayerTravail(travailId);
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    expect(postsHeygen()).toBe(envoisAvant);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant);
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(acceptesAvant);
  });

  it("CORRIGÉ D1 (c) — après un refus, HeyGen déclare un passage échoué : seul ce passage repart, une fois, clé neuve, sous le plafond", async () => {
    await preparer();
    R.heygenBloque = true;
    const { travailId } = await lancer();
    await tours(travailId, { max: 60, jusqua: toutEnRendu });
    const { pieces, secondesEnvoyees: envoyeesAvant } = etatDouble(await lire(travailId))!;
    const passage = pieces.find((p) => p.tranche)!;
    expect(passage).toBeDefined();
    const envoisAvant = postsHeygen();
    const acceptesAvant = rendusHeygenAcceptes();
    R.suiviRefus = 403;
    const { travail: enEchec } = await tours(travailId, { max: 20 });
    expect(enEchec.statut).toBe("echec");
    // Clé valide ; HeyGen a fini les autres rendus mais déclare ce passage échoué (son illisible).
    R.suiviRefus = null;
    R.heygenBloque = false;
    R.suivisAvantFin = 0;
    R.echecsCibles.add(passage.idExterne!);
    await travaux.reessayerTravail(travailId);
    const { travail } = await tours(travailId);
    expect(travail.statut).toBe("termine");
    // Un seul renvoi (ce passage, clé neuve), sous le plafond de 1,5× ; les autres anciens rendus sont repris.
    expect(postsHeygen()).toBe(envoisAvant + 1);
    expect(rendusHeygenAcceptes()).toBe(acceptesAvant + 1);
    const renvoi = R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").at(-1)!;
    expect(renvoi.cle).toMatch(new RegExp(`:${passage.angle}:${passage.index}:e${passage.essai + 1}$`));
    // Le plafond est contrôlé avant le renvoi (au-delà, rien ne part et le travail ne finit pas) : seules les secondes
    // de ce passage s'ajoutent.
    const fin = etatDouble(travail)!;
    expect(fin.secondesEnvoyees).toBeCloseTo(envoyeesAvant! + (passage.finSec - passage.debutSec), 3);
    for (const p of pieces.filter((x) => x !== passage)) expect(fin.pieces.find((x) => x.angle === p.angle && x.index === p.index && x.tranche === p.tranche)!.essai).toBe(p.essai);
    // Chaque pièce comptée une fois (l'ancien rendu échoué n'est pas facturé ; le nouveau prend sa ligne).
    const lignes = await lignesDeLaVideo();
    expect(lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toHaveLength(pieces.length);
  });
});

/* ------------------------------------------------------------------ */
/* E3 — Écriture Claude : échec puis reprise, redémarrage               */
/* ------------------------------------------------------------------ */

describe("E3 — écriture d'un sujet par Claude : panne, arrêt, « Reprendre l'écriture », redémarrage", () => {
  beforeEach(async () => {
    for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
    for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  });

  const lancerSujet = () => bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });

  it("Claude tombe en panne au 3e rôle : arrêt lisible dès le 1er tour raté (garde-fous du 15/10), « Reprendre » repart de la dernière étape (rien n'est refait), un redémarrage entre les deux ne change rien", async () => {
    const r = await lancerSujet();
    if (!r.ok) throw new Error("lancement");
    const { executeur, appels } = executeurSimule();
    let enPanne = true;
    let n = 0;
    const panneApres = 2;
    const fabriquer = (): ExecuteurRoles => ({
      executer: async (role, entree) => {
        n++;
        if (enPanne && n > panneApres) throw new ErreurStudio("CLAUDE_INDISPONIBLE", "Claude ne répond pas.");
        return executeur.executer(role, entree);
      },
    });
    for (let i = 0; i < 3; i++) {
      const p = await bg.lirePanneEcriture(r.generationId);
      if (p) await ecrireParametre(`generateur.panne.${r.generationId}`, { ...p, prochainEssai: new Date(0).toISOString() });
      await bg.tourBoucleGeneration(() => fabriquer());
    }
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("echec");
    const arret = await bg.ecritureArretee(r.scriptMaitreId);
    expect(arret?.message).toMatch(/^Claude n'a pas répondu/);
    // Garde-fous budget (15/10) : un seul tour raté, les deux suivants ne rejouent rien.
    expect(await bg.lirePanneEcriture(r.generationId)).toMatchObject({ essais: 1, arretee: true });
    expect(arret!.message).not.toMatch(TECHNIQUE);
    const notif = (await depots().notifications.lister((x) => x.titre === "Une écriture s'est arrêtée"))[0];
    expect(notif.message).not.toMatch(TECHNIQUE);
    const faitsAvant = appels.map((a) => a.role);
    expect(faitsAvant).toHaveLength(panneApres);

    // Redémarrage : la boucle d'écriture repart de zéro en mémoire ; l'état de la chaîne est en base.
    bg.arreterBoucleGeneration();
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.boucle-generation")];
    bg.suspendreBoucleGeneration(true);

    enPanne = false;
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId)).toBe(true);
    // Double toucher sur « Reprendre » : rien de plus.
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId)).toBe(false);
    expect(await bg.tourBoucleGeneration(() => fabriquer())).toBe(r.generationId);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    // Les rôles faits avant la panne ne sont pas rejoués (aucun rôle payé deux fois).
    const apres = appels.slice(panneApres).map((a) => a.role);
    for (const role of faitsAvant) expect(apres).not.toContain(role);
    expect(await bg.ecritureArretee(r.scriptMaitreId)).toBeNull();
  });
});
