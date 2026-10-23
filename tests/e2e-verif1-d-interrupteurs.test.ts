/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS D : Will ALLUME « Votre avatar parle dans le studio » et « Montage réel des vidéos
 * avocat » (Réglages › Connexions), avec la CONFIGURATION DE PRODUCTION :
 *  - variables : clés posées, FOURNISSEUR_MONTAGE=studio-rendu, VISAGE/VOIX=heygen, ILLUSTRATION=reel,
 *    ALIGNEMENT=studio-aligneur, STOCKAGE=r2, NODE_ENV=production (par test, `vi.stubEnv`) ;
 *  - EN BASE (pas en variable) : publication=buffer, texte-reseaux=claude, miniature/étalonnage/son=studio-rendu.
 * Parcours : listerConnexions → allumer (prix 45 s comparé à l'aperçu d'une vraie vidéo de ~45 s) → lancer sans
 * confirmer (refus) → confirmer → fabrication jusqu'au bout (fournisseurs doublés comme r8-bout-en-bout).
 * Un seul `fetch` doublé : studio-rendu, studio-aligneur, HeyGen, R2, Claude, Buffer. Toute autre adresse jette.
 * Défauts confirmés : `it.fails("ROUGE — …")` (le test passe tant que le défaut existe).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lecturesVoixMax, REFERENCE_V4, ressemblanceDeLaCommande } from "@/briques/voix-maitre/reference";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";
import type { DemandeRendu } from "@/fournisseurs/types";

/* ------------------------------------------------------------------ */
/* Configuration de PRODUCTION (variables) — valeurs factices           */
/* ------------------------------------------------------------------ */
process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.STUDIO_ALIGNEUR_URL = "http://studio-aligneur.essai";
process.env.FOURNISSEUR_ALIGNEMENT = "studio-aligneur";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.FOURNISSEUR_SCRIPT = "claude";
process.env.FOURNISSEUR_ILLUSTRATION = "reel";
process.env.FAL_KEY = "fal-essai-d";
process.env.PEXELS_API_KEY = "pexels-essai-d";
process.env.PIXABAY_API_KEY = "pixabay-essai-d";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.BUFFER_API_KEY = "cle-buffer-essai-d";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";
// En production, ces choix sont EN BASE, pas en variable (écart env/base à vérifier).
delete process.env.FOURNISSEUR_MINIATURE;
delete process.env.FOURNISSEUR_ETALONNAGE;
delete process.env.FOURNISSEUR_SON;
delete process.env.FOURNISSEUR_TEXTE_RESEAUX;
delete process.env.FOURNISSEUR_PUBLICATION;
delete process.env.MOTEUR_AVOCAT;

const REGLAGES_EN_BASE: Record<string, string> = {
  "fournisseur.publication": "buffer",
  "fournisseur.texte-reseaux": "claude",
  "fournisseur.miniature": "studio-rendu",
  "fournisseur.etalonnage": "studio-rendu",
  "fournisseur.son": "studio-rendu",
};

// 14/10 (voix de référence) : la voix lue ressemble à la v4 du premier coup (contrôle de ressemblance actif, 1 lecture).
const MESURES_VOIX_V4 = Object.fromEntries(Object.entries(REFERENCE_V4).map(([k, v]) => [`voix.${k}`, v]));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/* ------------------------------------------------------------------ */
/* Le réseau doublé (même principe que r8-bout-en-bout)                 */
/* ------------------------------------------------------------------ */
const R = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string; corps?: unknown; cle?: string }[],
  rendus: new Map<string, unknown>(),
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
  lecturesVoix: 0,
}));

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };
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
    if (u.pathname.startsWith("/v3/videos/")) return json(F.videoTerminee);
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
  const { usdVersEur } = await import("@/lib/montants");
  const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
  const f = ((u: string, i?: RequestInit) => reseau(u, i)) as unknown as typeof fetch;
  // Voix HeyGen doublée : payée au caractère, au MÊME tarif que la vraie (`heygen/voix.ts`).
  const voix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    nom: "Voix HeyGen",
    mode: "reel" as const,
    async lire(d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) {
      R.lecturesVoix++;
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-${R.lecturesVoix}.mp3`, cout: usdVersEur(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-d", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
  };
});

// Le stockage R2 garde le `fetch` du moment de sa création (src/fournisseurs/r2/stockage.ts:85) : doublé AVANT les
// imports, sinon ses lectures et effacements partiraient sur le vrai réseau.
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));

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
const { coutsDeLaVideo } = await import("@/services/cout-video");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { DOUBLE_PAS_CHOISI, DOUBLE_PARLE_DANS_HEYGEN } = await import("@/moteurs");
const { DUREE_PRIX_REFERENCE_SEC } = await import("@/moteurs/montage-avocat/prix-reel");
const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { formaterMontant, usdVersEur } = await import("@/lib/montants");
const { detailMontageReel } = await import("@/components/reglages/Connexions");
const { TEXTES_DOUBLE } = await import("@/components/reglages/Double");
const { decisionLancement } = await import("@/assistant/express/logique");
const { DEBIT_VOIX_HEYGEN_MESURE, debitLecture, estimerDureeTexte, obtenirFormat } = await import("@/formats");
const { texteScript } = await import("@/domaine/derivations");

const MDP = "essai-e2e-verif1-d";
const VIDEO = "v-03"; // vidéo avocat de 45 s annoncés (44 s calculées depuis son texte)
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const claude = { appels: [] as string[] };

function brancherClaude() {
  claude.appels = [];
  void credits.declarerRecharge("anthropic", 500);
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string }[] };
    const r = /<reseau id="([^"]+)"/.exec(corps.messages?.[0]?.content ?? "")?.[1] ?? "?";
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
  R.rendus.clear();
  R.lecturesVoix = 0;
  R.buffer = fauxBuffer();
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  for (const [k, v] of Object.entries(REGLAGES_EN_BASE)) await ecrireParametre(k, v);
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  brancherClaude();
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

const carteMontage = async () => (await reglages.listerConnexions()).find((c) => c.type === "montage")!;
const interrupteurAvocat = async () => (await carteMontage()).montageReel!.find((f) => f.formatId === "avocat")!;

/** Will choisit son double HeyGen (deux angles) dans Personnages et relie sa voix HeyGen. */
async function choisirDouble(): Promise<string> {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
  const tq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_face_002", angle: "face", tenue: "Chemise noire" });
  await d.personnages.modifier(moi.id, { visageParDefautId: tq });
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { fournisseur: "heygen" });
  return tq;
}

/** La vidéo de Will (pas un exemple), sur son double ; `sansIllustrations` comme r8-bout-en-bout. */
async function preparerVideo(tq: string, o: { sansIllustrations?: boolean } = {}) {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, {
    estDemo: false,
    ...(o.sansIllustrations ? { briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"] } : {}),
    distribution: video.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: moi.id, visageId: tq, visagesParAngle: undefined } : x)),
  });
  for (const k of await d.kits.lister((x) => x.videoId === VIDEO)) await d.kits.modifier(k.id, { videoId: "v-archive-d" });
  for (const m of await d.miniatures.lister((x) => x.videoId === VIDEO)) await d.miniatures.modifier(m.id, { videoId: "v-archive-d" });
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
}

async function jusquAuBout(travailId: string) {
  const m = creerMoteurMontageAvocat();
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 400; i++) {
    const t = (await depots().travaux.obtenir(travailId))!;
    if (t.statut === "termine" || t.statut === "echec") break;
    vi.setSystemTime(Date.now() + 15_000);
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
  }
  vi.useRealTimers();
  return (await depots().travaux.obtenir(travailId))!;
}

const demandesRendu = (op: string) => R.appels.filter((a) => a.hote === "studio-rendu.essai" && a.methode === "POST" && (a.corps as DemandeRendu | undefined)?.operation === op);

/* ================================================================== */
describe("D1 — Réglages › Connexions avec la configuration de production", () => {
  it("miniature, étalonnage, son, publication et textes des réseaux réglés EN BASE : « Relié » (source base) ; le reste par variable", async () => {
    const cx = await reglages.listerConnexions();
    const etat = Object.fromEntries(cx.map((c) => [c.type, `${c.etat}/${c.source}`]));
    expect(etat).toMatchObject({
      script: "relie/environnement",
      visage: "relie/environnement",
      voix: "relie/environnement",
      montage: "relie/environnement",
      illustration: "relie/environnement",
      alignement: "relie/environnement",
      stockage: "relie/environnement",
      miniature: "relie/base",
      etalonnage: "relie/base",
      son: "relie/base",
      publication: "relie/base",
      "texte-reseaux": "relie/base",
    });
    // La carte Montage : interrupteurs éteints, le type avocat n'est pas monté pour de vrai. Le face caméra (format actif,
    // chaîne réelle allumée par défaut, serveur d'alignement posé) l'est, et seul lui.
    expect((await carteMontage()).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Face caméra"]);
  });

  it("aucun double choisi : l'interrupteur « Montage réel » est grisé ET dit quoi faire ; le serveur refuse avec la même phrase", async () => {
    const f = await interrupteurAvocat();
    expect(f).toMatchObject({ allume: false, possible: false, raison: DOUBLE_PAS_CHOISI });
    // La ligne sous l'interrupteur grisé (Connexions.tsx `detailMontageReel`) : la consigne, en français simple.
    expect(detailMontageReel(f)).toBe(DOUBLE_PAS_CHOISI);
    expect(detailMontageReel(f)).not.toMatch(/[A-Z_]{4,}|undefined|heygen\b|studio-rendu/);
    await expect(reglages.definirMontageReel("avocat", true)).rejects.toMatchObject({ code: "MONTAGE_REEL_INDISPONIBLE", message: DOUBLE_PAS_CHOISI });
    expect((await reglages.decisionMontageReel("avocat")).allume).toBe(false);
  });

  it("double choisi mais avatar muet : grisé, « Allumez d'abord « Votre avatar parle » » ; une fois l'avatar allumé, proposé avec son prix", async () => {
    await choisirDouble();
    expect(await interrupteurAvocat()).toMatchObject({ possible: false, raison: DOUBLE_PARLE_DANS_HEYGEN });
    await renduDouble.definirRenduDouble({ allume: true });
    const f = await interrupteurAvocat();
    expect(f).toMatchObject({ possible: true, allume: false });
    expect(f.raison).toBeUndefined();
    expect(f.prix.dureeSec).toBe(DUREE_PRIX_REFERENCE_SEC);
    // INTÉGRATION FINALE : fal.ai branché (FOURNISSEUR_ILLUSTRATION=reel) : la ligne des illustrations « type » compte.
    expect(f.prix.lignes.map((l) => l.quoi)).toEqual(["Voix", "Votre avatar", "Votre avatar, second angle", "Illustrations fabriquées (jusqu'à 8)", "Textes des réseaux", "Montage, sous-titres, couleurs, son, miniature"]);
    expect(detailMontageReel(f)).toBe(`Environ ${formaterMontant(f.prix.total)} pour une vidéo de 45 s. Éteint : vos vidéos restent des essais.`);
  });

  it("écart env/base : « possible » ne dépend pas de miniature/étalonnage/son ; en base seulement, la miniature finale est bien faite sur studio-rendu (vérifié en D3)", async () => {
    await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    expect((await interrupteurAvocat()).possible).toBe(true);
    // Même si l'un d'eux repasse en essai EN BASE, l'interrupteur reste « possible » : la décision ne les lit pas (le moteur
    // monte couleurs et son directement sur studio-rendu ; seule la miniature de fin suit `fournisseur.miniature`).
    await ecrireParametre("fournisseur.miniature", "simulation");
    expect((await interrupteurAvocat()).possible).toBe(true);
  });

  it("« Votre avatar parle » : allumé puis éteint en UN geste chacun, consigné au journal ; prix à la minute cohérent avec la ligne « Votre avatar » de 45 s", async () => {
    const vue = await renduDouble.vueRenduDouble();
    expect(vue.allume).toBe(false);
    expect(vue.prixMinute.centimes).toBe(378);
    expect(TEXTES_DOUBLE.prix(vue.prixMinute)).toBe(`Environ ${formaterMontant(vue.prixMinute)} par minute de vidéo.`);
    await renduDouble.definirRenduDouble({ allume: true });
    expect(await renduDouble.renduDoubleAllume()).toBe(true);
    await renduDouble.definirRenduDouble({ allume: false });
    expect(await renduDouble.renduDoubleAllume()).toBe(false);
    const journal = (await reglages.listerJournal(5)).map((e) => e.message);
    expect(journal).toContain("Votre avatar parle dans le studio : allumé");
    expect(journal).toContain("Votre avatar parle dans le studio : éteint");
    // 45 s d'avatar au prix minute ≈ la ligne « Votre avatar » du prix 45 s (à l'arrondi près).
    await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    const ligne = (await interrupteurAvocat()).prix.lignes.find((l) => l.quoi === "Votre avatar")!;
    expect(Math.abs(ligne.montant.centimes - Math.round((vue.prixMinute.centimes * 45) / 60))).toBeLessThanOrEqual(1);
  });

  it("« Montage réel » s'éteint en un geste, même quand il n'est plus « possible » (avatar coupé entre-temps) : l'interrupteur coché reste actif", async () => {
    await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await reglages.definirMontageReel("avocat", true);
    await renduDouble.definirRenduDouble({ allume: false });
    const f = await interrupteurAvocat();
    // Coché, non possible : la ligne dit pourquoi (et l'écran ne le grise pas : `desactive={!f.possible && !coche}`).
    expect(f).toMatchObject({ allume: true, possible: false, raison: DOUBLE_PARLE_DANS_HEYGEN });
    expect(detailMontageReel(f)).toBe(DOUBLE_PARLE_DANS_HEYGEN);
    // La vidéo suivante n'est PAS montée pour de vrai (garde rouge), et Will coupe en un geste.
    expect((await reglages.decisionMontageReel("avocat")).effectif).toBe(false);
    await reglages.definirMontageReel("avocat", false);
    expect((await interrupteurAvocat()).allume).toBe(false);
    expect((await reglages.listerJournal(3)).map((e) => e.message)).toContain("Vidéos Type avocat : retour en essai");
  });
});

/* ================================================================== */
describe("D2 — le PRIX « pour une vidéo de 45 s » face à l'aperçu de fabrication d'une vraie vidéo de ~45 s", () => {
  async function allumerTout(o: { sansIllustrations?: boolean } = {}) {
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq, o);
    // CORRECTEUR FINAL A (TEST-UI-REEL U2) : la durée suit le débit RÉEL de la voix HeyGen (2,6 mots/s) : le texte de
    // référence est ramené à ~45 s À CE DÉBIT (il durait 44 s au débit d'écriture de 4,4 mots/s, soit 76 s lu pour de vrai).
    await texteDe45sLuParHeygen();
    const prix = (await interrupteurAvocat()).prix;
    await reglages.definirMontageReel("avocat", true);
    const apercu = await fabrication.apercuFabrication(VIDEO);
    const commande = await fabrication.construireCommande(VIDEO);
    return { prix, apercu, commande };
  }

  /** Garde le début du texte de VIDEO jusqu'à 45 s lues par la voix HeyGen (rien d'effacé : copie du script). */
  async function texteDe45sLuParHeygen() {
    const d = depots();
    const video = (await d.videos.obtenir(VIDEO))!;
    const script = (await d.scripts.obtenir(video.scriptId!))!;
    const avocat = obtenirFormat("avocat");
    const couper = (cible: number) => {
      let mots = 0;
      return script.blocs
        .map((b) => ({
          ...b,
          segments: b.segments
            .map((sg) => {
              const gardes = sg.texte.trim().split(/\s+/).filter(Boolean).slice(0, Math.max(0, cible - mots));
              mots += gardes.length;
              return { ...sg, texte: gardes.join(" ") };
            })
            .filter((sg) => sg.texte),
        }))
        .filter((b) => b.segments.length);
    };
    // Débit de la voix qui lira (sa vitesse comprise).
    const debit = debitLecture(avocat, await d.voix.obtenir((await fabrication.construireCommande(VIDEO)).distribution[0]!.voixId!));
    let cible = Math.round(45 * DEBIT_VOIX_HEYGEN_MESURE);
    while (estimerDureeTexte(avocat, texteScript(couper(cible)), debit) < 45) cible++;
    await d.scripts.enregistrer({ ...script, id: `${script.id}-45s`, blocs: couper(cible) });
    await d.videos.modifier(VIDEO, { scriptId: `${script.id}-45s` });
  }

  it("la vidéo de référence est bien de ~45 s, montée pour de vrai, confirmation exigée", async () => {
    const { apercu, commande } = await allumerTout();
    expect(commande.moteurId).toBe("montage-avocat");
    expect(Math.abs(commande.dureeCibleSec - 45)).toBeLessThanOrEqual(2);
    expect(apercu.budget).toMatchObject({ montageReel: true, confirmationRequise: true });
  });

  it("les lignes avatar et textes des réseaux concordent (à la durée près)", async () => {
    const { prix, apercu, commande } = await allumerTout();
    const avatar45 = prix.lignes.filter((l) => l.quoi.startsWith("Votre avatar")).reduce((t, l) => t + l.montant.centimes, 0);
    const avatarApercu = apercu.estimation.lignes.filter((l) => l.etape.startsWith("Double")).reduce((t, l) => t + l.total.centimes, 0);
    // L'aperçu compte la durée réelle (44 s) : écart proportionnel seulement.
    expect(Math.abs(avatarApercu - (avatar45 * commande.dureeCibleSec) / 45)).toBeLessThanOrEqual(avatar45 * 0.05 + 2);
    expect(apercu.textesReseaux?.centimes).toBe(prix.lignes.find((l) => l.quoi === "Textes des réseaux")!.montant.centimes);
  });

  // DÉFAUT : le prix de 45 s (prix-reel.ts:59-65) ignore les ILLUSTRATIONS fabriquées (fal.ai, FOURNISSEUR_ILLUSTRATION=reel),
  // présentes par défaut dans une vidéo avocat : l'aperçu de la même vidéo coûte ~25 % de plus (3,08 € annoncés,
  // 3,86 € à la confirmation, sans compter la voix annoncée 0 €). La ligne « Montage, sous-titres, couleurs, son,
  // miniature : Gratuit » laisse croire que tout le reste est gratuit.
  // INTÉGRATION FINALE : corrigé — le prix de 45 s compte le nombre « type » d'illustrations de la recette avocat
  // (`illustrationsTypes`, 8 pour 45 s) quand la fabrication fal.ai est branchée.
  it("CORRIGÉ — le prix de 45 s annoncé avant d'allumer est à moins de 10 % de l'aperçu d'une vraie vidéo de 45 s (illustrations comprises)", async () => {
    const { prix, apercu } = await allumerTout();
    expect(apercu.estimation.lignes.some((l) => l.etape === "Illustrations à fabriquer" && l.total.centimes > 0)).toBe(true);
    expect(Math.abs(apercu.estimation.total.centimes - prix.total.centimes)).toBeLessThanOrEqual(prix.total.centimes * 0.1);
  });

  // DÉFAUT : la brique « Voix » estime 0,02 CENTIME par caractère (briques/index.ts:191, `ligne(..., 0.02)`), arrondi à
  // 0 par `centimes()` : l'aperçu et la confirmation annoncent « Voix · HeyGen · 0 € », alors que la voix HeyGen est
  // payée 0,03 cent USD par caractère (heygen/voix.ts:26,187 ; ~0,19 € pour 45 s, et c'est ce que montre le prix 45 s).
  // Le crédit HeyGen de la voix n'est donc ni contrôlé ni réservé avant le lancement.
  // INTÉGRATION FINALE : corrigé — tarif HeyGen au caractère, arrondi au centime SUPÉRIEUR (jamais 0 €).
  it("CORRIGÉ — la voix HeyGen est annoncée à son vrai prix dans l'aperçu (et non 0 €)", async () => {
    const { apercu, commande } = await allumerTout();
    const voix = apercu.estimation.lignes.find((l) => l.etape === "Voix")!;
    expect(voix.fournisseur).toBe("heygen");
    // 14/10 (voix de référence) : contrôle de ressemblance actif par défaut, la voix de l'avocat est lue 2 fois au plus par
    // défaut (1 relance, décision de Will du 14/10) : l'aperçu annonce ce maximum (prix confirmé = prix affiché).
    const k = lecturesVoixMax(ressemblanceDeLaCommande(commande.entrees));
    expect(k).toBe(2);
    expect(voix.total.centimes).toBe(k * Math.ceil(commande.script.texteComplet.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * (commande.tauxUsdEur ?? 0.9) - 1e-9));
    expect(voix.total.centimes).toBeGreaterThan(0);
    // Le prix de 45 s et l'aperçu disent la même chose pour la voix (à la durée près).
    expect(Math.abs(voix.total.centimes - k * usdVersEur(commande.script.texteComplet.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN).centimes)).toBeLessThanOrEqual(k);
  });

  // INTÉGRATION FINALE : la voix est maintenant annoncée dans l'aperçu ; seules les illustrations (coupées ici) diffèrent.
  it("illustrations coupées : l'aperçu ≈ prix 45 s sans sa ligne d'illustrations (voix comprise)", async () => {
    const { prix, apercu } = await allumerTout({ sansIllustrations: true });
    const illus45 = prix.lignes.find((l) => l.quoi.startsWith("Illustrations fabriquées"))?.montant.centimes ?? 0;
    expect(apercu.estimation.lignes.find((l) => l.etape === "Voix")!.total.centimes).toBeGreaterThan(0);
    expect(Math.abs(apercu.estimation.total.centimes - (prix.total.centimes - illus45))).toBeLessThanOrEqual(10);
  });
});

/* ================================================================== */
describe("D3 — confirmer à chaque fabrication, puis fabrication de bout en bout (NODE_ENV=production)", () => {
  it("lancer sans confirmer → CONFIRMATION_REQUISE (phrase claire, bon montant) ; confirmer → voix, double, montage, miniature, kit, brouillon Buffer", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq, { sansIllustrations: true });
    await reglages.definirMontageReel("avocat", true);
    expect((await reglages.listerJournal(3)).map((e) => e.message).some((m) => /^Vidéos Type avocat : montage réel \(environ \d+,\d\d\s€ la vidéo de 45 s\)$/.test(m))).toBe(true);
    expect((await carteMontage()).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Type avocat", "Face caméra"]);

    const apercu = await fabrication.apercuFabrication(VIDEO);
    const total = apercu.estimation.total;
    // 1. Sans confirmer : refusé, rien n'est réservé ni lancé.
    await expect(fabrication.lancerFabrication(VIDEO)).rejects.toMatchObject({
      code: "CONFIRMATION_REQUISE",
      message: `Cette vidéo sera montée pour de vrai : ${formaterMontant(total)}. Confirmez pour continuer.`,
      montant: total.centimes,
    });
    expect(await depots().travaux.compter((t) => t.cibleId === VIDEO && t.statut === "en_file")).toBe(0);
    // 2. Un accord pour un montant PLUS BAS que le prix du jour ne suffit pas au-delà du seuil ; ici sous le seuil, le montant vu suffit.
    const { travailId, versionId } = await fabrication.lancerFabrication(VIDEO, { confirme: total.centimes });
    expect((await depots().versions.obtenir(versionId))!.commande.moteurId).toBe("montage-avocat");

    // 3. Jusqu'au bout.
    const travail = await jusquAuBout(travailId);
    expect(travail.statut).toBe("termine");
    await travaux.executerSuites([{ type: "finition", videoId: VIDEO, titre: "Essai D", ratio: "9:16", textes: true }]);
    expect(R.lecturesVoix).toBe(1);
    expect(R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos").length).toBeGreaterThanOrEqual(1);
    expect(demandesRendu("composition").length).toBeGreaterThanOrEqual(1);
    // Miniature réglée EN BASE seulement : faite sur studio-rendu (aucun écart env/base).
    expect(demandesRendu("miniature").length).toBeGreaterThanOrEqual(1);
    // Textes des réseaux réglés EN BASE seulement : écrits par Claude.
    expect([...claude.appels].sort()).toEqual(["instagram", "linkedin", "tiktok", "youtube-shorts"]);

    // 4. Brouillon Buffer (publication réglée EN BASE).
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
    let envoi = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    if (envoi.publications[0].etatEnvoi === "a-verifier") envoi = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(envoi.simulation).toBe(false);
    expect(envoi.publications[0]).toMatchObject({ via: "buffer", statut: "brouillon" });

    // 5. Payé : la voix et le double au nom de HeyGen ; le payé reste proche du montant confirmé.
    const couts = await coutsDeLaVideo(VIDEO);
    expect(couts.paye.centimes).toBeGreaterThan(0);
    const lignes = (await depots().depenses.lister((d) => d.videoId === VIDEO)).flatMap((d) => d.lignes);
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    // Le payé dépasse le confirmé de la seule voix (annoncée 0 €, voir D2 ROUGE) : écart ≤ 0,30 €.
    expect(couts.paye.centimes - total.centimes).toBeLessThanOrEqual(30);
  });

  // DÉFAUT : en mode Express (le mode du format avocat, formats/avocat/index.ts:127), `decisionLancement`
  // (assistant/express/logique.ts:246) ignore `budget.montageReel` et `budget.double` : sous le seuil (20 €), « Fabriquer »
  // part DIRECT, le serveur répond CONFIRMATION_REQUISE, et Express.tsx:202-204 ouvre la feuille « Avant de fabriquer »
  // avec la SEULE raison « Plus cher que d'habitude » (fausse : 3,86 € < 20 €) ; la phrase du serveur (« Cette vidéo
  // sera montée pour de vrai : … ») est jetée, et le bouton « Confirmer et fabriquer » porte la pastille « Essai »
  // (« rien n'est réellement envoyé », Express.tsx:377) alors que HeyGen va être payé.
  it("CORRIGÉ — Express : une vidéo montée pour de vrai est confirmée comme telle (raison « montée pour de vrai », jamais la pastille « Essai »)", async () => {
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq);
    await reglages.definirMontageReel("avocat", true);
    const a = await fabrication.apercuFabrication(VIDEO);
    const decision = decisionLancement({ coutCentimes: a.estimation.total.centimes, seuilCentimes: a.budget.seuil.centimes, resteCentimes: a.budget.restant.centimes, aVerifier: [], montageReel: a.budget.montageReel, double: !!a.budget.double });
    expect(decision.genre).toBe("confirmer");
    expect(decision.genre === "confirmer" && decision.raisons[0]).toMatch(/montée pour de vrai/);
    expect(decision.genre === "confirmer" && decision.raisons).not.toContain("Plus cher que d'habitude");
    const source = readFileSync("src/assistant/etapes/Express.tsx", "utf8");
    expect(source).toMatch(/budget\.montageReel/);
    expect(source).not.toMatch(/icone="clap" essai chargement=\{lancement\} onClick=\{\(\) => void lancer\(prixAConfirmer/);
  });

  it("couper « Montage réel » après le lancement : la vidéo lancée finit en réel, les suivantes ne sont plus montées pour de vrai", async () => {
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq, { sansIllustrations: true });
    await reglages.definirMontageReel("avocat", true);
    const total = (await fabrication.apercuFabrication(VIDEO)).estimation.total.centimes;
    const { travailId } = await fabrication.lancerFabrication(VIDEO, { confirme: total });
    await reglages.definirMontageReel("avocat", false);
    expect((await fabrication.construireCommande(VIDEO)).moteurId).toBe("simulation");
    expect((await jusquAuBout(travailId)).statut).toBe("termine");
  });
});

/* ================================================================== */
describe("D4 — une seule des deux allumée (production)", () => {
  it("avatar allumé, montage réel éteint : (CORRECTEUR FINAL A) l'aperçu n'annonce plus de prix d'avatar ; refusée en production avec le geste « Montage réel », rien n'est payé", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq);
    const commande = await fabrication.construireCommande(VIDEO);
    expect(commande.moteurId).toBe("simulation");
    const a = await fabrication.apercuFabrication(VIDEO);
    // Avant : « Votre avatar parle dans cette vidéo : environ 2,77 €, à confirmer » (prix jamais payé par le moteur d'essai).
    expect(a.budget.double).toBeNull();
    expect(a.budget.montageReel).toBe(false);
    // L'Aperçu dit le refus avant le toucher.
    expect(a.refus).toMatch(/Montage réel/);
    await expect(fabrication.lancerFabrication(VIDEO, { confirme: a.estimation.total.centimes })).rejects.toMatchObject({ code: "SIMULATION_EN_PRODUCTION" });
    expect(R.appels.filter((x) => x.hote === "api.heygen.com" && x.methode === "POST")).toHaveLength(0);
    expect((await coutsDeLaVideo(VIDEO)).paye.centimes).toBe(0);
  });

  // DÉFAUT : avatar allumé et « Montage réel » éteint (ordre naturel : l'interrupteur Montage est grisé tant que l'avatar
  // est muet), Will confirme « Votre avatar parle · 2,77 € », et le refus (services/fabrication.ts:586-605) dit :
  // « le montage de la vidéo et les illustrations sont encore en essai. Reliez ces outils dans Réglages > Connexions »,
  // alors que Montage et Illustrations y sont affichés « Relié ». Ce qui manque vraiment : l'interrupteur « Montage réel ».
  it("CORRIGÉ — le refus nomme l'interrupteur « Montage réel » à allumer (et non des outils déjà reliés)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq);
    const a = await fabrication.apercuFabrication(VIDEO);
    const e = await fabrication.lancerFabrication(VIDEO, { confirme: a.estimation.total.centimes }).catch((x: Error) => x);
    expect((e as Error).message).toMatch(/Montage réel/);
    expect((e as Error).message).not.toMatch(/Reliez ces outils/);
  });

  // DÉFAUT (même cause) : l'aperçu annonce un prix d'avatar HeyGen (briques/index.ts:251, seul `renduDouble.allume` est lu)
  // pour une commande dont le moteur est la simulation : un prix que la fabrication ne paiera jamais.
  it("CORRIGÉ — avatar allumé sans montage réel : l'aperçu n'annonce pas de prix d'avatar pour une vidéo d'essai", async () => {
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq);
    expect((await fabrication.construireCommande(VIDEO)).moteurId).toBe("simulation");
    expect((await fabrication.apercuFabrication(VIDEO)).budget.double).toBeNull();
  });

  it("montage réel allumé puis avatar coupé : la carte reste cohérente (cochée, raison affichée), la vidéo suivante n'est pas montée pour de vrai ni annoncée comme telle", async () => {
    const tq = await choisirDouble();
    await renduDouble.definirRenduDouble({ allume: true });
    await preparerVideo(tq);
    await reglages.definirMontageReel("avocat", true);
    await renduDouble.definirRenduDouble({ allume: false });
    const a = await fabrication.apercuFabrication(VIDEO);
    expect(a.budget.montageReel).toBe(false);
    expect(a.budget.double).toBeNull();
    expect((await fabrication.construireCommande(VIDEO)).moteurId).toBe("simulation");
    // Le type avocat n'est plus annoncé monté pour de vrai ; le face caméra (sans double) reste monté, lui.
    expect((await carteMontage()).montageReelPour?.filter((n) => n !== "Tableau animé" && n !== "Cas concret MD")).toEqual(["Face caméra"]);
  });
});
