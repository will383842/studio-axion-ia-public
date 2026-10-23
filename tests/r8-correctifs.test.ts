/**
 * CORRECTEUR R8 (relecture `68ed386`) — les défauts d'argent corrigés, chacun avec son test ROUGE avant correction :
 *  n° 1 : un accord donné EN ESSAI (vidéo « lancer dès que possible », version qui suit sa mère) ne vaut jamais pour un
 *         montage RÉEL allumé entre-temps : rien ne part, la vidéo revient en brouillon, Will est prévenu ;
 *  n° 2 : le prix de 45 s montré avant d'allumer compte le second angle quand deux avatars prêts existent ;
 *  n° 3 : la feuille « Cette vidéo sera montée pour de vrai » ne marque pas son bouton « essai ».
 * Fournisseurs doublés (même réseau doublé que `r8-bout-en-bout`) : aucun appel réel, aucune clé réelle.
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
process.env.BUFFER_API_KEY = "cle-buffer-essai-r8";
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
const reglages = await import("@/services/reglages");
const credits = await import("@/services/credits");
const doublesHeygen = await import("@/services/doubles-heygen");
const { ecrireParametre } = await import("@/services/_commun");
const renduDouble = await import("@/services/rendu-double");
const { prixVideoReelle } = await import("@/moteurs/montage-avocat/prix-reel");
const { secondesAnnonceesDouble } = await import("@/moteurs/montage-avocat/double");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { formaterMontant } = await import("@/lib/montants");

const MDP = "essai-r8-correctifs";
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

/** Brique 6 : le repère « script relu » que l'assistant joint à l'attente d'une vidéo dite par la voix de synthèse. */
async function scriptReluDe(videoId: string): Promise<string> {
  const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
  const v = await depots().videos.obtenir(videoId);
  return empreinteDesBlocs((await depots().scripts.obtenir(v!.scriptId!))!.blocs);
}

describe("n° 1 — un accord donné en essai ne vaut pas pour un montage réel", () => {
  it("ROUGE — attente confirmée en essai → interrupteur allumé → rien ne part ; brouillon, Will prévenu", async () => {
    await preparer();
    // Interrupteur éteint : Will voit le prix de l'ESSAI et coche « lancer dès que possible ».
    expect((await fabrication.apercuFabrication(VIDEO)).budget.montageReel).toBe(false);
    await credits.garderEnAttente(VIDEO, { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: await scriptReluDe(VIDEO) });
    expect((await depots().videos.obtenir(VIDEO))!.lancementEnAttente).toMatchObject({ confirme: true });
    // Puis il allume « Montage réel » : la même vidéo coûterait maintenant bien plus.
    await reglages.definirMontageReel("avocat", true);
    expect((await fabrication.apercuFabrication(VIDEO)).budget.montageReel).toBe(true);
    const avant = await travauxDeLaVideo();

    const { lancees } = await credits.lancerVideosEnAttente();

    expect(lancees).toEqual([]);
    expect(await travauxDeLaVideo()).toBe(avant);
    const v = (await depots().videos.obtenir(VIDEO))!;
    expect(v.statut).toBe("brouillon");
    expect(v.lancementEnAttente).toBeUndefined();
    const n = await depots().notifications.trouver((x) => /n'a pas pu partir/.test(x.titre));
    expect(n?.message).toMatch(/montée pour de vrai/);
    expect(rienDePaye()).toBe(true);
  });

  it("ROUGE — ancienne attente qui ne dit pas quel moteur a été confirmé : rien ne part en réel", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await depots().videos.modifier(VIDEO, { lancementEnAttente: { depuis: new Date().toISOString(), fournisseur: "heygen", confirme: true } });
    const avant = await travauxDeLaVideo();
    expect((await credits.lancerVideosEnAttente()).lancees).toEqual([]);
    expect(await travauxDeLaVideo()).toBe(avant);
    expect(await depots().notifications.trouver((x) => /n'a pas pu partir/.test(x.titre))).toBeTruthy();
  });

  it("ROUGE — version qui suit sa mère, confirmée en essai : la garde refuse au lancement (CONFIRMATION_REQUISE)", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await expect(fabrication.lancerFabricationConfirmee(VIDEO, { confirme: true, confirmationDifferee: { moteurId: "simulation" } })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(fabrication.lancerFabricationConfirmee(VIDEO, { confirme: true, confirmationDifferee: {} })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await travauxDeLaVideo()).toBe(0);
    expect(rienDePaye()).toBe(true);
  });

  it("accord donné pour le montage réel : la vidéo en attente part montée pour de vrai, comme confirmé", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await credits.garderEnAttente(VIDEO, { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: await scriptReluDe(VIDEO) });
    expect((await depots().videos.obtenir(VIDEO))!.lancementEnAttente?.moteurId).toBe("montage-avocat");
    expect((await credits.lancerVideosEnAttente()).lancees).toHaveLength(1);
    const version = (await depots().versions.lister((x) => x.videoId === VIDEO && x.statut === "en_fabrication"))[0];
    expect(version.commande.moteurId).toBe("montage-avocat");
  });

  it("accord donné en réel, montage réel coupé ensuite : la vidéo part en essai (moins cher), sans rien redemander", async () => {
    await preparer();
    await reglages.definirMontageReel("avocat", true);
    await credits.garderEnAttente(VIDEO, { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: await scriptReluDe(VIDEO) });
    await reglages.definirMontageReel("avocat", false);
    expect((await credits.lancerVideosEnAttente()).lancees).toHaveLength(1);
    expect(rienDePaye()).toBe(true);
  });
});

describe("n° 2 — prix de 45 s : le second angle compte quand deux avatars sont prêts", () => {
  const carte = async () => (await reglages.listerConnexions()).find((c) => c.type === "montage")!.montageReel!.find((f) => f.formatId === "avocat")!;

  it("ROUGE — prix pur : ⌈45 × part × 1,3 + 2⌉ s de second angle, ligne « Votre avatar, second angle »", () => {
    const ligne = (p: ReturnType<typeof prixVideoReelle>, q: string) => p.lignes.find((l) => l.quoi === q)?.montant.centimes;
    const un = prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9 });
    // 85 / 15 : ⌈45 × 0,15 × 1,3 + 2⌉ = 11 s × 7 c$ × 0,9 = 69,3 c€, compté 70 (L3-01 : au centime supérieur).
    const principal = prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9, partSecondAngle: 0.15 });
    expect(ligne(principal, "Votre avatar, second angle")).toBe(70);
    expect(principal.total.centimes).toBe(un.total.centimes + 70);
    // Égale : ⌈45 × 0,5 × 1,3 + 2⌉ = 32 s × 7 c$ × 0,9 = 201,6 c€.
    expect(ligne(prixVideoReelle({ reseaux: [], tauxUsdEur: 0.9, partSecondAngle: 0.5 }), "Votre avatar, second angle")).toBe(202);
    expect(ligne(un, "Votre avatar, second angle")).toBeUndefined();
  });

  it("ROUGE — carte Montage : deux avatars prêts → second angle compté, au même prix que l'estimation de la vidéo", async () => {
    await preparer(true);
    const f = await carte();
    expect(f.prix.lignes.map((l) => l.quoi)).toEqual(["Voix", "Votre avatar", "Votre avatar, second angle", "Textes des réseaux", "Montage, sous-titres, couleurs, son, miniature"]);
    expect(f.prix.lignes[2].montant.centimes).toBe(70);
    // Même règle que la brique « visage » : sur une vidéo de 45 s, l'estimation réservée annonce les mêmes secondes.
    await reglages.definirMontageReel("avocat", true);
    await depots().videos.modifier(VIDEO, { dureeCibleSec: 45 });
    const c = await fabrication.construireCommande(VIDEO);
    expect(c.moteurId).toBe("montage-avocat");
    expect(secondesAnnonceesDouble({ ...c, dureeCibleSec: 45 })).toBe(45 + 11);
    // Le journal de l'allumage annonce ce prix-là.
    expect((await reglages.listerJournal(5)).find((e) => /montage réel/.test(e.message))!.message).toContain(formaterMontant(f.prix.total));
  });

  it("un seul avatar prêt : un seul angle, pas de ligne de second angle", async () => {
    await preparer(false);
    expect((await carte()).prix.lignes.map((l) => l.quoi)).toEqual(["Voix", "Votre avatar", "Textes des réseaux", "Montage, sous-titres, couleurs, son, miniature"]);
  });
});

describe("n° 3 — feuille « montée pour de vrai » : le bouton n'est pas marqué « essai »", () => {
  it("ROUGE — la pastille d'essai tombe aussi quand la vidéo est montée pour de vrai sans ligne de double", () => {
    const source = readFileSync("src/assistant/etapes/Apercu.tsx", "utf8");
    expect(source).toContain("essai={!donnees.budget.double && !donnees.budget.montageReel}");
  });
});
