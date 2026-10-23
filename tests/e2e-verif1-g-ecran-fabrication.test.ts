/**
 * VÉRIFICATION E2E n° 1 — AGENT g — CE QUE WILL LIT À L'ÉCRAN QUAND LA FABRICATION RÉELLE BUTE CHEZ HEYGEN.
 *
 * Chemin réel (interrupteurs « Votre avatar parle » et « Montage réel » ALLUMÉS, comme Will le fera) : script → voix
 * (HeyGen doublée) → double (HeyGen doublé en HTTP) → montage (studio-rendu doublé en HTTP). Harnais repris de
 * tests/r8-bout-en-bout.test.ts. Un seul `fetch` doublé ; toute autre adresse fait échouer le test. Aucune clé réelle.
 *
 * Deux constats (CORRIGÉS depuis : phrase fixe en français, texte de HeyGen en détail technique et console.warn ;
 * délai maximal `DELAI_MAX_RENDU_DOUBLE_MS` de 6 h pour un rendu suivi, puis échec réessayable et notification) :
 *  1. HeyGen répond « failed » avec son texte anglais (`failure_message`) : ce texte brut est recopié dans la phrase de
 *     l'étape (src/fournisseurs/heygen/rendus.ts:127 puis src/moteurs/montage-avocat/index.ts:1310), affichée par
 *     ProgressionEtapes (src/components/ui/ProgressionEtapes.tsx:148). La garde tests/garde-ecran.test.ts ne le voit pas :
 *     l'interpolation `${v.failure_message.slice(0, 120)}` et `${echec.erreur ?? …}` ne portent pas un nom qu'elle refuse.
 *  2. HeyGen répond « processing » sans fin : aucun délai maximal pour un rendu suivi (double.ts, phase « rendu ») ;
 *     le délai de 24 h (src/domaine/suivi.ts:111) ne vaut que pour une PANNE (exception). La vidéo reste « en cours »
 *     des jours, sans notification ; seul « Arrêter » en sort.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_V4 } from "@/briques/voix-maitre/reference";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";
import type { DemandeRendu } from "@/fournisseurs/types";

process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_MINIATURE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.FOURNISSEUR_TEXTE_RESEAUX = "claude";
process.env.BUFFER_API_KEY = "cle-buffer-essai-g";
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

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/** Texte anglais tel que HeyGen le renvoie dans `failure_message` (ne correspond à aucune famille connue). */
const TEXTE_HEYGEN = "Avatar rendering failed due to an internal server error";

const R = vi.hoisted(() => ({
  suivi: "termine" as "termine" | "echec-anglais" | "toujours-en-cours",
  suivisHeygen: 0,
  rendus: new Map<string, unknown>(),
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
}));

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  const entetes = new Headers(init?.headers);
  if (String(url) === URL_BUFFER) return R.buffer!.appeler(url, init);
  const corps = typeof init?.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return undefined; } })() : undefined;
  if (u.hostname === "studio-rendu.essai") {
    if (methode === "POST" && u.pathname === "/rendus") {
      const d = corps as DemandeRendu;
      R.rendus.set(d.idRendu, d);
      return json({ idRendu: d.idRendu });
    }
    const id = decodeURIComponent(u.pathname.replace(/^\/rendus\//, ""));
    const d = R.rendus.get(id) as DemandeRendu | undefined;
    if (!d) return new Response("", { status: 404 });
    const mesures = d.operation === "composition" ? MESURES_COMPOSITION : d.operation === "miniature" ? { instant: 3, nettete: 80 } : d.operation === "mesure-son" ? { lufs: -14, creteVraieDbtp: -2 } : d.parametres?.mode === "mesure-voix" ? MESURES_VOIX_V4 : undefined;
    return json({ statut: "termine", sortieCle: d.sortie.cle, ...(mesures ? { mesures } : {}) });
  }
  if (u.hostname === "api.heygen.com") {
    if (u.pathname === "/v3/avatars/looks") return json({ data: [F.lookTermine.data, { ...F.lookTermine.data, id: "look_essai_face_002", name: "Presque de face, chemise noire" }], has_more: false });
    if (methode === "POST" && u.pathname === "/v3/videos") return json({ data: { video_id: `video-${entetes.get("Idempotency-Key")}`, status: "waiting", output_format: "webm" } });
    if (u.pathname.startsWith("/v3/videos/")) {
      R.suivisHeygen++;
      if (R.suivi === "echec-anglais") return json({ data: { ...F.videoTerminee.data, status: "failed", video_url: null, failure_code: "internal_error", failure_message: TEXTE_HEYGEN } });
      if (R.suivi === "toujours-en-cours") return json({ data: { ...F.videoTerminee.data, status: "processing", video_url: null, completed_at: null } });
      return json(F.videoTerminee);
    }
    // Recherche d'un rendu déjà parti (titre) : rien.
    if (u.pathname === "/v3/videos" || u.pathname === "/v2/videos") return json({ data: { videos: [] } });
  }
  if (u.hostname === "files2.heygen.ai") return new Response(new Uint8Array(32), { status: 200, headers: { "content-length": "32" } });
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
  let lectures = 0;
  const voix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    nom: "Voix HeyGen",
    mode: "reel" as const,
    async lire(d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) {
      lectures++;
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-g-${lectures}.mp3`, cout: centimes(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-g", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const reglages = await import("@/services/reglages");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const doublesHeygen = await import("@/services/doubles-heygen");
const notifications = await import("@/services/notifications");
const { ecrireParametre } = await import("@/services/_commun");
const renduDouble = await import("@/services/rendu-double");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { DELAI_MAX_RENDU_DOUBLE_MS, MESSAGE_DELAI_RENDU_DOUBLE } = await import("@/moteurs/montage-avocat/double");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");

const MDP = "essai-g-ecran-fabrication";
const VIDEO = "v-03";

/** Mêmes motifs que l'explorateur d'écrans de l'agent g : rien de technique ni d'anglais. */
const TECHNIQUE = /\b(error|failed|failure|internal|server|timeout|undefined|null|HTTP)\b|\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/i;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  R.suivi = "termine";
  R.suivisHeygen = 0;
  R.rendus.clear();
  R.buffer = fauxBuffer();
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  void credits.declarerRecharge("anthropic", 500);
  const f = (async () => reponseFlux(fluxReussi({ texte: JSON.stringify({ premiereLigne: "Texte", texte: "Texte", motsDiese: ["#Droit"], justifications: [] }), modele: "claude-sonnet-5-5" }))) as unknown as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Préparation identique à r8 : double de Will choisi, voix HeyGen, interrupteurs allumés, vidéo réelle. */
async function lancer() {
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
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("reseaux.parDefaut", ["instagram"]);
  await reglages.definirMontageReel("avocat", true);
  return fabrication.lancerFabrication(VIDEO, { confirme: true });
}

/** Fait tourner la boucle de fond, l'horloge avançant de `pasMs` à chaque tour, jusqu'à un statut final ou `tours`. */
async function tourner(travailId: string, tours: number, pasMs: number) {
  const m = creerMoteurMontageAvocat();
  vi.useFakeTimers({ toFake: ["Date"] });
  const debut = Date.now();
  for (let i = 0; i < tours; i++) {
    const t = (await depots().travaux.obtenir(travailId))!;
    if (t.statut === "termine" || t.statut === "echec") break;
    vi.setSystemTime(Date.now() + pasMs);
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
  }
  const ecouleH = (Date.now() - debut) / 3600_000;
  vi.useRealTimers();
  return { travail: (await depots().travaux.obtenir(travailId))!, ecouleH };
}

/** Ce que Will lit : la phrase de l'étape en échec (ProgressionEtapes), la cloche, le Journal. */
async function textesAffiches(travailId: string): Promise<string[]> {
  const t = (await depots().travaux.obtenir(travailId))!;
  const etapes = t.etapes.filter((e) => e.statut === "echec").map((e) => e.erreur?.messagePourWill ?? "");
  // Seulement ce que CETTE fabrication a écrit (la démonstration a ses propres lignes).
  const cloche = (await notifications.listerNotifications(50)).filter((n) => !n.estDemo && n.lien === `/videos/${VIDEO}`).flatMap((n) => [n.titre, n.message ?? ""]);
  const journal = (await reglages.listerJournal(50)).filter((e) => e.entiteId === VIDEO).map((e) => e.message);
  return [...etapes, ...cloche, ...journal].filter(Boolean);
}

describe("agent g — rendu du double refusé par HeyGen : la phrase affichée", () => {
  // Ancien constat (le texte anglais de HeyGen était recopié dans la phrase pour Will) réécrit après la correction :
  // l'étape passe toujours en échec, mais le texte brut ne vit plus qu'en détail technique (et en console serveur).
  it("constat corrigé : l'étape du double passe en échec ; le texte anglais de HeyGen reste en détail technique", async () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { travailId } = await lancer();
    R.suivi = "echec-anglais";
    const { travail } = await tourner(travailId, 200, 15_000);
    expect(R.suivisHeygen).toBeGreaterThan(0);
    const echec = travail.etapes.find((e) => e.statut === "echec");
    expect(echec).toBeDefined();
    expect(echec!.erreur?.messagePourWill).not.toContain(TEXTE_HEYGEN);
    expect(echec!.erreur?.messagePourWill).toMatch(/HeyGen n'a pas réussi ce rendu/);
    expect(echec!.erreur?.detailTechnique).toContain(TEXTE_HEYGEN);
    expect(avertir.mock.calls.some((a) => String(a[0]).includes(TEXTE_HEYGEN))).toBe(true);
    avertir.mockRestore();
  });

  it("CORRIGÉ — aucun texte anglais ni technique de HeyGen dans ce que Will lit (étape, cloche, Journal)", async () => {
    // Défaut (corrigé) : src/fournisseurs/heygen/rendus.ts:127 met `failure_message` (anglais, brut) dans `message`, recopié par
    // src/moteurs/montage-avocat/index.ts:1310 dans `messagePourWill`. Correction faite : phrase fixe pour Will
    // (« HeyGen n'a pas réussi ce rendu. Réessayez ; si cela recommence, vérifiez votre double dans HeyGen. »),
    // `failure_code`/`failure_message` en console.warn et en détail technique seulement.
    const { travailId } = await lancer();
    R.suivi = "echec-anglais";
    await tourner(travailId, 200, 15_000);
    const textes = await textesAffiches(travailId);
    expect(textes.length).toBeGreaterThan(0);
    for (const t of textes) expect(t).not.toMatch(TECHNIQUE);
  });
});

describe("agent g — HeyGen dit « en cours » sans fin : état bloqué", () => {
  // Ancien constat (après 50 h de « processing », la vidéo restait « en cours » sans échec ni notification) réécrit
  // après la correction : la sortie arrive au bout du délai maximal de 6 h, pas avant, et Will lit une phrase simple.
  it("constat corrigé : un rendu « processing » sans fin sort en échec au bout de 6 h (pas avant), phrase simple et notification", async () => {
    const { travailId } = await lancer();
    R.suivi = "toujours-en-cours";
    const { travail, ecouleH } = await tourner(travailId, 120, 25 * 60_000);
    expect(ecouleH).toBeGreaterThanOrEqual(DELAI_MAX_RENDU_DOUBLE_MS / 3600_000);
    // 14/10 (voix de référence) : la mesure de la voix ajoute deux tours (25 min chacun) avant le double : marge + 3 h.
    expect(ecouleH).toBeLessThan(DELAI_MAX_RENDU_DOUBLE_MS / 3600_000 + 3);
    expect(R.suivisHeygen).toBeGreaterThan(10);
    expect(travail.statut).toBe("echec");
    const etape = travail.etapes.find((e) => e.statut === "echec")!;
    expect(etape.erreur?.reessayable).toBe(true);
    expect(etape.erreur?.messagePourWill).toBe(MESSAGE_DELAI_RENDU_DOUBLE);
    const echecs = (await notifications.listerNotifications(50)).filter((n) => !n.estDemo && n.type === "echec");
    expect(echecs).toHaveLength(1);
    expect(echecs[0].message).toBe(MESSAGE_DELAI_RENDU_DOUBLE);
    for (const t of await textesAffiches(travailId)) expect(t).not.toMatch(TECHNIQUE);
  });

  it("CORRIGÉ — un rendu suivi qui ne finit jamais sort au bout d'un délai maximal (échec lisible et notification)", async () => {
    // Défaut (corrigé) : src/moteurs/montage-avocat/double.ts (phase « rendu ») n'a aucun délai maximal ; ATTENTE_MAX_MS (24 h,
    // src/domaine/suivi.ts:111) ne s'applique qu'aux pannes levées. Correction : noter l'heure d'envoi de chaque pièce
    // (`decideLe` existe déjà) et, au-delà de N heures (ex. 6 h) sans « completed », passer la pièce en échec réessayable
    // avec une phrase pour Will + notification (le studio sait déjà rejouer une pièce avec une clé neuve).
    const { travailId } = await lancer();
    R.suivi = "toujours-en-cours";
    const { travail } = await tourner(travailId, 120, 25 * 60_000);
    expect(travail.statut).toBe("echec");
    expect((await notifications.listerNotifications(50)).some((n) => !n.estDemo && n.type === "echec")).toBe(true);
  });
});
