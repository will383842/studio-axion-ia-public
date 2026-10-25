/**
 * Socle « le prix ne bloque jamais » · montage réel : en mode indicatif, une vidéo montée pour de vrai part SANS confirmation
 * de prix (le prix du jour est journalisé « accepté sans confirmation ») ; en mode bloquant, la garde R8 refuse comme avant.
 * Harnais repris de `r8-bout-en-bout` (fournisseurs doublés, aucun appel réel, 0 €).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_V4 } from "@/briques/voix-maitre/reference";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "../helpers/g0";
import { fauxBuffer, URL_BUFFER } from "../helpers/r1-buffer";
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
process.env.BUFFER_API_KEY = "cle-buffer-essai-r8";
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
    const mesures = d.operation === "composition" ? MESURES_COMPOSITION : d.operation === "miniature" ? { instant: 3, nettete: 80 } : d.operation === "mesure-son" ? { lufs: -14, creteVraieDbtp: -2 } : d.parametres?.mode === "mesure-voix" ? MESURES_VOIX_V4 : undefined;
    return json({ statut: "termine", sortieCle: d.sortie.cle, ...(mesures ? { mesures } : {}) });
  }

  // HeyGen (double) : rendu Avatar V, suivi, téléchargement de la vidéo rendue.
  if (u.hostname === "api.heygen.com") {
    if (u.pathname === "/v3/avatars/looks") return json({ data: [F.lookTermine.data, { ...F.lookTermine.data, id: "look_essai_face_002", name: "Presque de face, chemise noire" }], has_more: false });
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
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-r8", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const reglages = await import("@/services/reglages");
const pub = await import("@/services/publications");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const doublesHeygen = await import("@/services/doubles-heygen");
const { ecrireParametre } = await import("@/services/_commun");
const renduDouble = await import("@/services/rendu-double");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { formaterMontant } = await import("@/lib/montants");
const { decisionLancement } = await import("@/assistant/express/logique");

const MDP = "essai-r8-bout-en-bout";
const VIDEO = "v-03";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();

/** Claude doublé : un texte valide par réseau ; une panne passagère (529) si demandée. */
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
  brancherClaude();
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Le double de Will choisi dans Personnages (deux angles), sa voix HeyGen, la vidéo prête à fabriquer (pas un exemple). */
async function preparer() {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
  const tq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_face_002", angle: "face", tenue: "Chemise noire" });
  await d.personnages.modifier(moi.id, { visageParDefautId: tq });
  // Lot R7e : Will allume « Votre avatar parle dans le studio » (Réglages › Connexions › Double).
  await renduDouble.definirRenduDouble({ allume: true });
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { fournisseur: "heygen" });
  // La vidéo prend le double choisi (angle principal ; le second angle suit, même tenue).
  const video = (await d.videos.obtenir(VIDEO))!;
  // Illustrations coupées : tous les plans sur le double (la démonstration porte une image à licence bloquante, exprès).
  await d.videos.modifier(VIDEO, { estDemo: false, briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"], distribution: video.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: moi.id, visageId: tq, visagesParAngle: undefined } : x)) });
  // La démonstration a déjà un kit et des miniatures : rangés sous une autre vidéo (rien n'est effacé), la vraie vidéo
  // reçoit les siens à la fin de sa fabrication.
  for (const k of await d.kits.lister((x) => x.videoId === VIDEO)) await d.kits.modifier(k.id, { videoId: "v-archive-r8" });
  for (const m of await d.miniatures.lister((x) => x.videoId === VIDEO)) await d.miniatures.modifier(m.id, { videoId: "v-archive-r8" });
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
}


describe("montage réel : le prix ne bloque pas en indicatif", () => {
  it("(4) indicatif, sans « confirme » : la vidéo part ; le journal dit « accepté sans confirmation »", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await ecrireParametre("budget.mode", "indicatif");
    const { versionId } = await fabrication.lancerFabrication(VIDEO);
    expect((await depots().versions.obtenir(versionId))!.commande.moteurId).toBe("montage-avocat");
    expect((await depots().evenements.lister()).some((e) => /accepté sans confirmation/.test(e.message))).toBe(true);
  });

  it("TÉMOIN — bloquant : sans « confirme », CONFIRMATION_REQUISE comme avant", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await ecrireParametre("budget.mode", "bloquant");
    await expect(fabrication.lancerFabrication(VIDEO)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
  });
});
