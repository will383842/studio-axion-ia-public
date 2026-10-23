/**
 * VÉRIFICATEUR E2E n° 1 (parcours A, première moitié) — lettre a1 — CONFIG DE PRODUCTION, INTERRUPTEURS ALLUMÉS.
 *
 * Idée → générateur (Claude doublé) → version avocat validée → « Fabriquer » → montage réel (moteur avocat) :
 * voix HeyGen, double HeyGen (Avatar V), illustrations « reel » (Pexels, Pixabay, fal.ai), calage studio-aligneur,
 * montage, sous-titres et miniature studio-rendu → vidéo « prête ».
 * Will a DEUX avatars HeyGen : A (habituel, « Chemise noire ») et B (« Costume ») choisi POUR LE FORMAT AVOCAT
 * (lot C4). On vérifie que c'est B qui est envoyé à HeyGen (et son second angle, même tenue), jamais A.
 *
 * Toutes les variables de production sont posées (valeurs factices) AVANT le chargement des modules ; un seul `fetch`
 * global doublé (studio-rendu, studio-aligneur, HeyGen, R2, Pexels, Pixabay, fal.ai) ; toute autre adresse fait
 * échouer le test. Claude passe par son injection d'essai. AUCUN appel réel, AUCUNE vraie clé.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_V4 } from "@/briques/voix-maitre/reference";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DemandeRendu, LecteurCredit } from "@/fournisseurs/types";
import type { DefinitionRole } from "@/generateur/roles/types";

Object.assign(process.env, {
  HEYGEN_API_KEY: "cle-heygen-essai-a1",
  ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE,
  FAL_KEY: "cle-fal-essai-a1",
  PEXELS_API_KEY: "cle-pexels-essai-a1",
  PIXABAY_API_KEY: "cle-pixabay-essai-a1",
  BUFFER_API_KEY: "cle-buffer-essai-a1",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "ACCES-ESSAI",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "seau-essai",
  FOURNISSEUR_VISAGE: "heygen",
  FOURNISSEUR_MONTAGE: "studio-rendu",
  FOURNISSEUR_VOIX: "heygen",
  FOURNISSEUR_SCRIPT: "claude",
  FOURNISSEUR_ILLUSTRATION: "reel",
  FOURNISSEUR_STOCKAGE: "r2",
  FOURNISSEUR_ALIGNEMENT: "studio-aligneur",
  STUDIO_RENDU_URL: "http://studio-rendu.essai",
  STUDIO_RENDU_CLE: "cle-rendu-essai",
  STUDIO_ALIGNEUR_URL: "http://studio-aligneur.essai",
});

// 14/10 (voix de référence) : la voix lue ressemble à la v4 du premier coup (contrôle de ressemblance actif, 1 lecture).
const MESURES_VOIX_V4 = Object.fromEntries(Object.entries(REFERENCE_V4).map(([k, v]) => [`voix.${k}`, v]));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/* ------------------------------------------------------------------ */
/* Le réseau doublé                                                     */
/* ------------------------------------------------------------------ */

const R = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string; corps?: unknown }[],
  rendus: new Map<string, unknown>(),
  alignements: new Map<string, { texte: string }>(),
  fal: 0,
  lecturesVoix: 0,
  /** Pexels trouve une vidéo verticale (sinon : rien). */
  pexelsTrouve: false,
}));

const LOOKS = { aTq: "look_a_tq", aFace: "look_a_face", bTq: "look_b_tq", bFace: "look_b_face" };

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  const corps = typeof init?.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return undefined; } })() : undefined;
  R.appels.push({ hote: u.hostname, methode, chemin: u.pathname, corps });

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
  if (u.hostname === "studio-aligneur.essai") {
    if (methode === "POST") {
      const d = corps as { idAlignement: string; texte: string };
      R.alignements.set(d.idAlignement, d);
      return json({ idAlignement: d.idAlignement }, 202);
    }
    const id = decodeURIComponent(u.pathname.replace(/^\/alignements\//, ""));
    const d = R.alignements.get(id);
    if (!d) return new Response("", { status: 404 });
    const mots = d.texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.35, finSec: i * 0.35 + 0.3 }));
    return json({ statut: "termine", resultat: { mots, motsNonAlignes: 0, modele: "whisperx-essai", dureeCalculSec: 1 } });
  }
  if (u.hostname === "api.heygen.com") {
    if (u.pathname === "/v3/avatars/looks") {
      const look = (id: string, name: string) => ({ ...F.lookTermine.data, id, name });
      return json({ data: [look(LOOKS.aTq, "A trois-quarts"), look(LOOKS.aFace, "A face"), look(LOOKS.bTq, "B trois-quarts"), look(LOOKS.bFace, "B face")], has_more: false });
    }
    if (methode === "POST" && u.pathname === "/v3/videos") return json({ data: { video_id: `video-${new Headers(init?.headers).get("Idempotency-Key")}`, status: "waiting", output_format: "webm" } });
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
  // Banques gratuites : rien de trouvé (la cascade passe à la fabrication).
  if (u.hostname === "api.pexels.com") {
    if (!R.pexelsTrouve) return json({ videos: [] });
    const n = R.appels.filter((a) => a.hote === "api.pexels.com").length;
    // La page porte les mots de la recherche (la description en est tirée, et doit être pertinente).
    const slug = (u.searchParams.get("query") ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return json({ videos: [{ id: 9000 + n, width: 1080, height: 1920, duration: 12, url: `https://www.pexels.com/video/${slug}-${9000 + n}/`, image: `https://images.pexels.com/videos/${9000 + n}/vignette.jpg`, user: { name: "Essai" }, video_files: [{ quality: "hd", file_type: "video/mp4", width: 1080, height: 1920, link: `https://videos.pexels.com/video-files/${9000 + n}/essai.mp4` }] }] });
  }
  if (u.hostname === "videos.pexels.com" || u.hostname === "images.pexels.com") return new Response(new Uint8Array(64).fill(3), { status: 200, headers: { "content-type": u.hostname.startsWith("videos") ? "video/mp4" : "image/jpeg" } });
  if (u.hostname === "pixabay.com") return json({ hits: [] });
  // fal.ai : file d'attente doublée (soumission, état, résultat), fichier produit.
  if (u.hostname === "queue.fal.run") {
    if (methode === "POST") {
      const id = `req-${++R.fal}`;
      const modele = u.pathname.slice(1);
      return json({ request_id: id, status_url: `https://queue.fal.run/${modele}/requests/${id}/status`, response_url: `https://queue.fal.run/${modele}/requests/${id}` });
    }
    if (u.pathname.endsWith("/status")) return json({ status: "COMPLETED" });
    const id = u.pathname.split("/").at(-1);
    return u.pathname.includes("image-to-video") ? json({ video: { url: `https://fal.media/files/${id}.mp4`, content_type: "video/mp4" } }) : json({ images: [{ url: `https://fal.media/files/${id}.jpg`, content_type: "image/jpeg" }] });
  }
  if (u.hostname === "fal.media") return new Response(new Uint8Array(64).fill(7), { status: 200, headers: { "content-type": u.pathname.endsWith(".mp4") ? "video/mp4" : "image/jpeg" } });
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

// HeyGen : le VRAI fournisseur de double (client branché sur le réseau doublé) ; voix HeyGen doublée (payée au caractère).
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
      R.lecturesVoix++;
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-${R.lecturesVoix}.mp3`, cout: centimes(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-a1", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
  };
});

// Le stockage R2 garde le `fetch` du moment de sa création (src/fournisseurs/r2/stockage.ts:85) : doublé AVANT les
// imports, sinon ses lectures et effacements partiraient sur le vrai réseau.
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const idees = await import("@/services/idees");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const reglages = await import("@/services/reglages");
const personnages = await import("@/services/personnages");
const doublesHeygen = await import("@/services/doubles-heygen");
const renduDouble = await import("@/services/rendu-double");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { centimes } = await import("@/lib/montants");

const MDP = "essai-e2e-verif1-a1-allumes";
const SUJET = SUJETS_BANC[0];

const claude = { appels: {} as Record<string, number> };
function fauxClaude(): typeof fetch {
  const roles = Object.values(ROLES_ECRITURE) as DefinitionRole[];
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()));
    if (!role) throw new Error("Rôle Claude inattendu");
    claude.appels[role.id] = (claude.appels[role.id] ?? 0) + 1;
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: 2500, cacheEcrit: 1000, sortie: 1500 }));
  }) as typeof fetch;
}

function lecteurHeygen(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  R.appels = [];
  R.rendus.clear();
  R.alignements.clear();
  R.fal = 0;
  R.lecturesVoix = 0;
  R.pexelsTrouve = false;
  claude.appels = {};
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  await ecrireParametre("generateur.chaine", "complete");
  for (const m of SUJET.matieres) await depots().matieres.enregistrer(m);
  for (const p of SUJET.preuves) await depots().preuves.enregistrer(p);
  await ecrireParametre("fournisseur.publication", "buffer");
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await ecrireParametre("fournisseur.miniature", "studio-rendu");
  await ecrireParametre("fournisseur.etalonnage", "studio-rendu");
  await ecrireParametre("fournisseur.son", "studio-rendu");
  await ecrireParametre("budget.seuilConfirmation", centimes(1_000_000));
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch), lecteurHeygen(1_000_000)], ["anthropic", "heygen"]);
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fauxClaude(), attenteMs: () => 0 });
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Les deux avatars HeyGen de Will (A habituel, B pour l'avocat), sa voix HeyGen, les deux interrupteurs allumés. */
async function preparerWill() {
  const d = depots();
  const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
  for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
  const aTq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: LOOKS.aTq, angle: "trois-quarts", tenue: "Chemise noire" });
  const aFace = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: LOOKS.aFace, angle: "face", tenue: "Chemise noire" });
  const bTq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: LOOKS.bTq, angle: "trois-quarts", tenue: "Costume" });
  const bFace = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: LOOKS.bFace, angle: "face", tenue: "Costume" });
  await personnages.choisirVisageParDefaut(moi.id, aTq);
  await personnages.choisirVisagePourFormat(moi.id, "avocat", bTq);
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { fournisseur: "heygen" });
  await renduDouble.definirRenduDouble({ allume: true });
  await reglages.definirMontageReel("avocat", true);
  return { moi, aTq, aFace, bTq, bFace };
}

async function ideeJusquAVersionValidee() {
  const idee = await idees.ajouterIdee(SUJET.idee, "avocat");
  const r = await bg.lancerGeneration({ idee: idee.texte, ideeId: idee.id, reseaux: SUJET.reseaux, formatId: "avocat", pilier: SUJET.pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error("lancement refusé");
  await bg.tourBoucleGeneration();
  const m = (await depots().scriptsMaitres.obtenir(r.scriptMaitreId))!;
  if (m.exception?.source === "proposition-machine" && !m.exception.valideeParWill) await bg.validerException(m.id, "c-est-juste");
  await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe)).map((v) => v.id));
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && !x.archiveLe && x.etat === "validee"))[0];
  if (!v) throw new Error("aucune version validée");
  return { r, v };
}

async function jusquAuBout(travailId: string) {
  const m = creerMoteurMontageAvocat();
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 400; i++) {
    const t = (await depots().travaux.obtenir(travailId))!;
    if (t.statut === "termine" || t.statut === "echec") break;
    vi.setSystemTime(Date.now() + 15_000);
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000, synchroBuffer: async () => undefined });
  }
  vi.useRealTimers();
  return (await depots().travaux.obtenir(travailId))!;
}

const rendusHeygen = () => R.appels.filter((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos");
const operationsRendu = () => R.appels.filter((a) => a.hote === "studio-rendu.essai" && a.methode === "POST").map((a) => (a.corps as DemandeRendu).operation);

describe("E2E-verif1 a1 · idée → script Claude → vidéo prête, interrupteurs ALLUMÉS (config de production)", () => {
  it("l'avatar DU FORMAT (B, « Costume ») est figé dans la commande et envoyé à HeyGen ; jamais l'avatar habituel A", async () => {
    const will = await preparerWill();
    const { v } = await ideeJusquAVersionValidee();
    expect(await reglages.moteurAuLancement("avocat")).toBe("montage-avocat");
    vi.stubEnv("NODE_ENV", "production");
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-a1-on-1", lancer: true, prixConfirme: 1_000_000 });
    vi.unstubAllEnvs();
    expect(r.travailId).toBeTruthy();
    // La vidéo de la version a pris l'avatar du format à sa création (C4).
    const video = (await depots().videos.obtenir(r.videoId))!;
    expect(video.distribution[0]).toMatchObject({ personnageId: will.moi.id, visageId: will.bTq });
    const version = (await depots().versions.lister((x) => x.videoId === r.videoId))[0];
    expect(version.commande.moteurId).toBe("montage-avocat");
    expect(version.commande.distribution[0].visageId).toBe(will.bTq);
    const resolus = version.commande.distribution[0].visagesResolus ?? {};
    expect(resolus["trois-quarts"]).toMatchObject({ visageId: will.bTq, idExterne: LOOKS.bTq, fournisseur: "heygen" });
    if (resolus.face) expect(resolus.face).toMatchObject({ visageId: will.bFace, idExterne: LOOKS.bFace });

    const travail = await jusquAuBout(r.travailId!);
    expect(travail.erreur?.messagePourWill ?? "").toBe("");
    expect(travail.statut).toBe("termine");
    await travaux.executerSuites([{ type: "finition", videoId: r.videoId, titre: video.titre, ratio: "9:16", textes: true }, { type: "generateur", videoId: r.videoId }]);

    // HeyGen n'a reçu QUE les looks de l'avatar B.
    const avatars = rendusHeygen().map((a) => (a.corps as { avatar_id?: string }).avatar_id);
    expect(avatars.length).toBeGreaterThanOrEqual(1);
    expect(avatars).toContain(LOOKS.bTq);
    expect(avatars.every((x) => x === LOOKS.bTq || x === LOOKS.bFace)).toBe(true);

    // Voix lue une fois (HeyGen), montage et miniature sur studio-rendu ; la vidéo est prête, sans clip de démonstration.
    expect(R.lecturesVoix).toBe(1);
    expect(operationsRendu()).toContain("composition");
    expect(operationsRendu()).toContain("miniature");
    const apres = (await depots().videos.obtenir(r.videoId))!;
    expect(apres.statut).toBe("prete");
    const sorties = await depots().sorties.lister((s) => s.versionId === version.id);
    expect(sorties.length).toBeGreaterThanOrEqual(1);
    for (const s of sorties) expect((await depots().fichiers.obtenir(s.fichierId))?.cleStockage).not.toMatch(/^\/?demo\//);
    expect(await depots().miniatures.compter((m) => m.videoId === r.videoId)).toBeGreaterThanOrEqual(1);
    // Sous-titres de la version présents.
    expect((await depots().sousTitres.lister((s) => s.versionId === version.id)).some((s) => s.segments.length > 0)).toBe(true);
    // Dépenses : voix et double au nom de HeyGen.
    const lignes = (await depots().depenses.lister((d) => d.videoId === r.videoId)).flatMap((d) => d.lignes);
    expect(lignes.filter((l) => l.etape === "Voix" && l.fournisseur === "heygen")).toHaveLength(1);
    expect(lignes.some((l) => l.etape.startsWith("Double") && l.fournisseur === "heygen")).toBe(true);
  });

  /** Version validée dont Claude a annoté des intentions d'illustration (rôle prose : « environ un segment sur trois »). */
  async function versionAvecIntentions() {
    await preparerWill();
    const { v } = await ideeJusquAVersionValidee();
    // Le faux Claude rejoue les sorties simulées des rôles, qui n'en portent pas : on les pose comme Claude les écrit.
    const script = (await depots().scripts.obtenir(v.scriptId))!;
    let k = 0;
    await depots().scripts.modifier(script.id, { blocs: script.blocs.map((b) => ({ ...b, segments: b.segments.map((x) => (k++ % 3 === 1 ? { ...x, intentionIllustration: "tableur rempli de chiffres sur un écran d'ordinateur" } : x)) })) });
    return v;
  }

  async function fabriquerEtFinir(varianteId: string, op: string) {
    vi.stubEnv("NODE_ENV", "production");
    const r = await bg.fabriquerVariante(varianteId, { operationId: op, lancer: true, prixConfirme: 1_000_000 });
    vi.unstubAllEnvs();
    const travail = await jusquAuBout(r.travailId!);
    const version = (await depots().versions.lister((x) => x.videoId === r.videoId))[0];
    return { r, travail, version, plans: await depots().plans.lister((p) => p.versionId === version.id) };
  }

  it("illustrations : les banques gratuites sont interrogées, fal.ai seulement pour ce qui est compté dans le prix accepté ; calage studio-aligneur non demandé pour la voix HeyGen (réglage coupé par défaut)", async () => {
    const v = await versionAvecIntentions();
    // Avant l'accord : le prix de « Fabriquer » compte déjà les illustrations à fabriquer, sans rien appeler.
    const { planFabricationSujet } = await import("@/services/fabrication-reseaux");
    const avant = await planFabricationSujet(v.scriptMaitreId);
    expect(avant?.lignes?.some((l) => l.etape === "Illustrations à fabriquer" && l.fournisseur === "fal.ai" && l.total.centimes > 0)).toBe(true);
    expect(R.appels.filter((a) => a.hote === "queue.fal.run" || a.hote === "api.pexels.com" || a.hote === "pixabay.com")).toEqual([]);

    const { travail, version, plans } = await fabriquerEtFinir(v.id, "op-a1-on-2");
    expect(travail.statut).toBe("termine");
    expect(R.appels.some((a) => a.hote === "api.pexels.com")).toBe(true);
    expect(R.appels.some((a) => a.hote === "pixabay.com")).toBe(true);
    // Le moteur pose bien des plans « illustration » sur les intentions de Claude.
    expect(plans.filter((p) => p.sourceImage === "illustration").length).toBeGreaterThanOrEqual(1);
    // CHANGÉ (VERIF-1 a1) : avant, la commande d'une vidéo de version arrivait SANS plans indicatifs (`plans: []`) et
    // le résultat de la cascade était jeté. Maintenant elle porte les illustrations du texte assemblé, cascade
    // appliquée : ici les banques ne trouvent rien, elles sont donc « à fabriquer » (fal.ai)…
    expect(version.commande.plans.length).toBeGreaterThanOrEqual(1);
    expect(version.commande.plans.every((p) => p.sourceImage === "illustration" && p.illustration?.source === "generee-ia")).toBe(true);
    // …comptées dans le prix de la version (ligne « Illustrations à fabriquer »), accepté avant le lancement…
    const lignes = await creerMoteurMontageAvocat().estimer(version.commande);
    const ligneFal = lignes.lignes.find((l) => l.etape === "Illustrations à fabriquer");
    expect(ligneFal?.quantite).toBe(version.commande.plans.length);
    // …et fal.ai n'est appelé que pour elles (une image puis un clip par illustration au plus).
    const soumissions = R.appels.filter((a) => a.hote === "queue.fal.run" && a.methode === "POST");
    expect(soumissions.length).toBeGreaterThanOrEqual(1);
    expect(soumissions.length).toBeLessThanOrEqual(2 * (ligneFal?.quantite ?? 0));
    // Calage : la voix HeyGen donne l'horodatage de ses mots ; « alignement.voixSynthese » est coupé par défaut.
    expect(R.appels.filter((a) => a.hote === "studio-aligneur.essai")).toEqual([]);
    expect(version.commande.entrees?.calerVoixSynthese).toBeUndefined();
  });

  // DÉFAUT (gêne forte, qualité) : pour une vidéo faite depuis une VERSION du générateur (« Fabriquer », chemin
  // principal de Will), `complementsGenerateur` remplace les plans de l'Aperçu par `plans: []`
  // (src/services/fabrication-reseaux.ts:155). Or la cascade (Mes images → banques Pexels/Pixabay → « à fabriquer »
  // fal.ai) ne tourne QUE sur ces plans-là (src/services/fabrication.ts:144) : son résultat est jeté. Le moteur refait
  // des plans « illustration » depuis les intentions de Claude, sans fichier (source « bibliotheque », aucun élément),
  // et la composition met le double à la place (« l'illustration n'a pas de fichier, votre double la remplace »,
  // src/briques/composition/parametres.ts:151). Les vidéos trouvées sur Pexels sont pourtant téléchargées et recopiées
  // sur R2 pour rien. Résultat : AUCUNE illustration dans les vidéos du générateur, alors que FOURNISSEUR_ILLUSTRATION=reel
  // est relié. Correction : appliquer la cascade aux plans produits par le moteur (ou aux segments à intention) pour
  // une vidéo de version, et compter la fabrication fal.ai dans l'estimation de la version.
  // CORRIGÉ : `complementsGenerateur` pose maintenant les plans indicatifs des illustrations du texte assemblé
  // (`plansIndicatifsDeLaVersion`, cascade appliquée, plans de l'Aperçu repris) avec les fichiers trouvés dans les
  // médias de la commande ; le moteur reporte l'élément sur ses plans du même segment, et un plan « à fabriquer »
  // est compté dans l'estimation (avant l'accord, sans interroger les banques : prix prudent).
  it("CORRIGÉ — une intention d'illustration trouvée sur Pexels devient une vraie illustration dans la vidéo de la version", async () => {
    R.pexelsTrouve = true;
    const v = await versionAvecIntentions();
    const { travail, plans } = await fabriquerEtFinir(v.id, "op-a1-on-3");
    expect(travail.statut).toBe("termine");
    // La banque a bien trouvé, et le fichier a été recopié sur R2 (élément créé dans la Bibliothèque).
    expect(R.appels.some((a) => a.hote === "videos.pexels.com")).toBe(true);
    expect(await depots().elements.compter((e) => e.licence?.source?.startsWith("Pexels") ?? false)).toBeGreaterThanOrEqual(1);
    // Attendu : au moins un plan de la vidéo montre cette illustration.
    expect(plans.filter((p) => p.sourceImage === "illustration" && p.illustration?.elementId).length).toBeGreaterThanOrEqual(1);
  });
});
