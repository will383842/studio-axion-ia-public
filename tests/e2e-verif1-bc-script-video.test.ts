/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS B (bc), de bout en bout : un script COLLÉ ou IMPORTÉ (.txt, .docx, .pdf) →
 * découpé → enregistré avec la vidéo (comme l'assistant : `creerBrouillon`, puis `enregistrerBrouillonExpress` avec les
 * blocs) → Aperçu → « Fabriquer » → la fabrication part AVEC CE TEXTE, et la voix lit CE TEXTE.
 *
 * Configuration de PRODUCTION reproduite (valeurs factices) : clés HeyGen, Claude, R2, fal, Pexels, Pixabay ;
 * FOURNISSEUR_VISAGE=heygen, FOURNISSEUR_VOIX=heygen, FOURNISSEUR_MONTAGE=studio-rendu, FOURNISSEUR_SCRIPT=claude,
 * FOURNISSEUR_ILLUSTRATION=reel, FOURNISSEUR_STOCKAGE=r2, FOURNISSEUR_ALIGNEMENT=studio-aligneur ; en base :
 * publication=buffer, texte-reseaux=claude, miniature / étalonnage / son = studio-rendu ; voix de Will reliée à HeyGen.
 * Interrupteurs « Votre avatar parle » et « Montage réel » ÉTEINTS (sauf le dernier bloc, qui les allume).
 *
 * Un seul `fetch` doublé sert tout (studio-rendu, HeyGen, R2 signé en local, Claude) ; toute autre adresse fait
 * échouer le test. NODE_ENV=production n'est posé que le temps du lancement (garde « simulation en production »).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_V4 } from "@/briques/voix-maitre/reference";
import { NextRequest } from "next/server";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { fabriquerDocx, fabriquerPdf } from "./fixtures/e2e-verif1-bc-fichiers";
import type { DemandeRendu } from "@/fournisseurs/types";

Object.assign(process.env, {
  STUDIO_RENDU_URL: "http://studio-rendu.essai",
  STUDIO_RENDU_CLE: "cle-rendu-essai",
  STUDIO_ALIGNEUR_URL: "http://studio-aligneur.essai",
  FOURNISSEUR_ALIGNEMENT: "studio-aligneur",
  FOURNISSEUR_MONTAGE: "studio-rendu",
  FOURNISSEUR_VISAGE: "heygen",
  FOURNISSEUR_VOIX: "heygen",
  FOURNISSEUR_SCRIPT: "claude",
  FOURNISSEUR_ILLUSTRATION: "reel",
  FOURNISSEUR_STOCKAGE: "r2",
  FOURNISSEUR_NOTIFICATION: "web-push-email",
  HEYGEN_API_KEY: "cle-heygen-essai-bc",
  ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE,
  FAL_KEY: "cle-fal-essai",
  PEXELS_API_KEY: "cle-pexels-essai",
  PIXABAY_API_KEY: "cle-pixabay-essai",
  BUFFER_API_KEY: "cle-buffer-essai",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "ACCES-ESSAI",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "seau-essai",
});

// 14/10 (voix de référence) : la voix lue ressemble à la v4 du premier coup (contrôle de ressemblance actif, 1 lecture).
const MESURES_VOIX_V4 = Object.fromEntries(Object.entries(REFERENCE_V4).map(([k, v]) => [`voix.${k}`, v]));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/* ------------------------------------------------------------------ */
/* Le réseau doublé (modèle : tests/r8-bout-en-bout.test.ts)            */
/* ------------------------------------------------------------------ */

const R = vi.hoisted(() => ({
  appels: [] as { hote: string; methode: string; chemin: string }[],
  rendus: new Map<string, unknown>(),
  /** Textes envoyés à la voix (HeyGen doublée), dans l'ordre. */
  textesLus: [] as string[],
}));

const MESURES_COMPOSITION = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  const corps = typeof init?.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return undefined; } })() : undefined;
  R.appels.push({ hote: u.hostname, methode, chemin: u.pathname });
  if (u.hostname === "studio-rendu.essai") {
    if (methode === "POST" && u.pathname === "/rendus") {
      const d = corps as DemandeRendu;
      R.rendus.set(d.idRendu, d);
      return json({ idRendu: d.idRendu });
    }
    const d = R.rendus.get(decodeURIComponent(u.pathname.replace(/^\/rendus\//, ""))) as DemandeRendu | undefined;
    if (!d) return new Response("", { status: 404 });
    const mesures = d.operation === "composition" ? MESURES_COMPOSITION : d.operation === "miniature" ? { instant: 3, nettete: 80 } : d.operation === "mesure-son" ? { lufs: -14, creteVraieDbtp: -2 } : d.parametres?.mode === "mesure-voix" ? MESURES_VOIX_V4 : undefined;
    return json({ statut: "termine", sortieCle: d.sortie.cle, ...(mesures ? { mesures } : {}) });
  }
  if (u.hostname === "api.heygen.com") {
    if (u.pathname === "/v3/avatars/looks") return json({ data: [F.lookTermine.data, { ...F.lookTermine.data, id: "look_essai_face_002", name: "Presque de face, chemise noire" }], has_more: false });
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
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
  const { centimes } = await import("@/lib/montants");
  const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
  const f = ((u: string, i?: RequestInit) => reseau(u, i)) as unknown as typeof fetch;
  // Voix HeyGen doublée : réelle (payée au caractère), elle GARDE le texte qu'on lui demande de lire.
  const voix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    nom: "Voix HeyGen",
    mode: "reel" as const,
    async lire(d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) {
      R.textesLus.push(d.texte);
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: `studio/essai/voix/lecture-${R.textesLus.length}.mp3`, cout: centimes(d.texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9) };
    },
  };
  return {
    visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-heygen-essai-bc", fetch: f }), { stockage: async () => (await import("@/fournisseurs")).resoudreFournisseur("stockage"), fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume: async () => (await import("@/services/rendu-double")).renduDoubleAllume() }) }),
    voixHeygen: () => ({ heygen: voix }),
    videosHeygen: () => null,
  };
});

// Le stockage R2 (et tout client créé à l'import) garde le `fetch` du moment : il est doublé AVANT tout import.
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const videos = await import("@/services/videos");
const express = await import("@/services/express");
const scripts = await import("@/services/scripts");
const reglages = await import("@/services/reglages");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const doublesHeygen = await import("@/services/doubles-heygen");
const renduDouble = await import("@/services/rendu-double");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { texteVoixDe } = await import("@/moteurs/montage-avocat");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { POST } = await import("@/app/api/import/route");
const { texteScript } = await import("@/domaine/derivations");

const MDP = "e2e-verif1-bc-script-video";
const mots = (t: string) => t.split(/\s+/).filter(Boolean);

const TEXTE = "Votre patron peut-il lire vos mails ?\n\nOui, s'ils sont professionnels. Mais un mail marqué « personnel » est protégé, même sur l’ordinateur du bureau.\n\nRetenez ce mot : personnel.";

/** Une page PDF fait 595 points de large : un paragraphe y tient sur plusieurs lignes de 60 caractères au plus. */
function lignesDePage(p: string): string[] {
  const lignes: string[] = [];
  for (const m of p.split(" ")) {
    if (lignes.length && (lignes.at(-1)! + " " + m).length <= 60) lignes[lignes.length - 1] += ` ${m}`;
    // Un guillemet ouvrant passe à la ligne avec le mot qui le suit (comme le fait un traitement de texte).
    else if (lignes.at(-1)?.endsWith(" «")) {
      lignes[lignes.length - 1] = lignes.at(-1)!.slice(0, -2);
      lignes.push(`« ${m}`);
    } else lignes.push(m);
  }
  return lignes;
}

/** Les quatre façons d'avoir le texte, comme l'écran : collé, .txt (navigateur), .docx et .pdf (route /api/import). */
async function texteDe(source: "colle" | "txt" | "docx" | "pdf"): Promise<string> {
  if (source === "colle") return TEXTE;
  if (source === "txt") return new Blob([new TextEncoder().encode(TEXTE)]).text();
  const octets = source === "docx" ? await fabriquerDocx(TEXTE.split("\n\n").map((p, i) => ({ morceaux: i === 1 ? [{ t: p.slice(0, 4), gras: true }, p.slice(4)] : [p] }))) : fabriquerPdf(TEXTE.split("\n\n").map((p) => ({ lignes: lignesDePage(p) })));
  const r = await POST(new NextRequest("http://localhost/api/import", { method: "POST", body: octets, headers: { "x-nom-fichier": encodeURIComponent(`Mon script.${source}`) }, duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]));
  const corps = (await r.json()) as { texte?: string; erreur?: string };
  if (!corps.texte) throw new Error(`import refusé : ${corps.erreur}`);
  return corps.texte;
}

/** L'assistant : découpage (« Utiliser ce texte »), brouillon créé, texte enregistré avec la vidéo. */
async function scriptEnregistre(texte: string): Promise<{ videoId: string; scriptId: string }> {
  const blocs = await scripts.decouperTexteColle("avocat", texte);
  const videoId = await videos.creerBrouillon("avocat", {});
  const { scriptId } = await express.enregistrerBrouillonExpress(videoId, { sujet: "Votre patron lit vos mails", etapeAssistant: "script" }, blocs);
  return { videoId, scriptId: scriptId! };
}

async function enProduction<T>(f: () => Promise<T>): Promise<T> {
  const avant = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  try {
    return await f();
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = avant;
  }
}

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string }[] };
    const r = /<reseau id="([^"]+)"/.exec(corps.messages?.[0]?.content ?? "")?.[1] ?? "?";
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
  R.textesLus = [];
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  // Réglages posés EN BASE en production.
  for (const [k, v] of Object.entries({ "fournisseur.publication": "buffer", "fournisseur.texte-reseaux": "claude", "fournisseur.miniature": "studio-rendu", "fournisseur.etalonnage": "studio-rendu", "fournisseur.son": "studio-rendu" })) await ecrireParametre(k, v);
  // La voix de Will est reliée à HeyGen (FOURNISSEUR_VOIX=heygen).
  for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
  // Les fabrications de démonstration ne tiennent pas la boucle de fond.
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  brancherClaude();
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const SOURCES = ["colle", "txt", "docx", "pdf"] as const;

describe("B · script collé ou importé → enregistré → « Fabriquer » (fabrication lancée avec CE texte)", () => {
  it.each(SOURCES)("%s : le script enregistré est le texte de Will, mot pour mot, et c'est lui que la vidéo lira", async (source) => {
    const texte = await texteDe(source);
    expect(mots(texte)).toEqual(mots(TEXTE));
    const { videoId, scriptId } = await scriptEnregistre(texte);
    // Script enregistré, rattaché à la vidéo, sujet repris (pas « Nouvelle vidéo »).
    const script = (await depots().scripts.obtenir(scriptId))!;
    expect((await depots().videos.obtenir(videoId))!.scriptId).toBe(scriptId);
    expect(script.sujet).toBe("Votre patron lit vos mails");
    expect(mots(texteScript(script.blocs))).toEqual(mots(TEXTE));
    // Aperçu : des plans, un prix, rien de bloquant.
    const apercu = await fabrication.apercuFabrication(videoId);
    expect(apercu.plans.length).toBeGreaterThan(0);
    expect(apercu.budget.depasse).toBe(false);
    // Lancement (hors production : la garde « simulation en production » ne joue pas).
    const { travailId, versionId } = await fabrication.lancerFabrication(videoId, { confirme: apercu.estimation.total.centimes });
    expect(travailId).toBeTruthy();
    const version = (await depots().versions.obtenir(versionId))!;
    expect(mots(texteScript(version.commande.script.blocs))).toEqual(mots(TEXTE));
    // Le texte que le moteur avocat enverrait à la voix (même fonction que montage-avocat/index.ts:648).
    expect(mots(texteVoixDe(version.commande).texte)).toEqual(mots(TEXTE));
    // Un second toucher sur « Fabriquer » ne lance rien de plus.
    expect((await fabrication.lancerFabrication(videoId, { confirme: apercu.estimation.total.centimes })).travailId).toBe(travailId);
    expect(await depots().travaux.compter((t) => t.cibleId === videoId)).toBe(1);
  });

  it("interrupteurs éteints : le moteur est la SIMULATION (rien n'est payé), et l'écran le dit (bouton « Fabriquer » marqué Essai)", async () => {
    const { videoId } = await scriptEnregistre(await texteDe("docx"));
    expect((await reglages.decisionMontageReel("avocat")).moteurId).toBe("simulation");
    const apercu = await fabrication.apercuFabrication(videoId);
    expect(apercu.budget.montageReel).toBe(false);
    // CORRECTEUR FINAL A : la pastille Essai suit le prix réel (ni avatar ni montage réel), comme la feuille de confirmation.
    expect(readFileSync("src/assistant/etapes/Apercu.tsx", "utf8")).toMatch(/icone="clap"\s+essai=\{!donnees\.budget\.double && !donnees\.budget\.montageReel\}/);
  });

  // BLOQUANT CONFIRMÉ (configuration de production d'aujourd'hui, interrupteurs éteints) : « Fabriquer » est REFUSÉ
  // pour tout script collé ou importé, quel que soit le texte. La garde « simulation en production »
  // (services/fabrication.ts:586-607, appelée ligne 658) voit une ligne RÉELLE dans l'estimation — les « Textes des
  // réseaux » par Claude (avecTextesDesReseaux, fabrication.ts:655), et la voix HeyGen de Will — alors que le moteur est
  // la simulation (interrupteur « Montage réel » éteint). Elle refuse avec « le montage de la vidéo, le double et les
  // illustrations sont encore en essai … Reliez ces outils dans Réglages > Connexions », alors que dans Réglages >
  // Connexions ces trois outils sont RELIÉS : Will ne trouve aucun geste qui débloque. L'Aperçu ne prévient de rien
  // (bouton « Fabriquer · x € » actif). Attendu : soit la vidéo part en essai (rien de payé, pas de texte Claude),
  // soit le refus nomme le VRAI geste (allumer « Montage réel », Réglages › Connexions › Montage) — jamais « Reliez »
  // un outil déjà relié.
  it("CORRIGÉ — production, interrupteurs éteints : « Fabriquer » aboutit, ou le refus nomme le vrai geste (« Montage réel »)", async () => {
    const { videoId } = await scriptEnregistre(await texteDe("pdf"));
    const apercu = await fabrication.apercuFabrication(videoId);
    const r = await enProduction(() => fabrication.lancerFabrication(videoId, { confirme: apercu.estimation.total.centimes }).then(() => null, (e: Error & { code?: string }) => e));
    if (r) expect(r.message).toMatch(/Montage réel/);
  });

  it("CORRECTEUR FINAL A — en production, voix HeyGen : le refus nomme le vrai geste ; plus de ligne Claude pour une vidéo d'essai ; rien n'est créé ni payé", async () => {
    const { videoId } = await scriptEnregistre(await texteDe("pdf"));
    const apercu = await fabrication.apercuFabrication(videoId);
    expect(apercu.budget).toMatchObject({ depasse: false, montageReel: false });
    // Vidéo d'essai : aucun texte écrit (ni payé) par Claude ; seule la voix HeyGen de Will serait payée.
    expect(apercu.estimation.lignes.filter((l) => l.fournisseur !== "simulation").map((l) => l.etape)).toEqual(["Voix"]);
    const erreur = await enProduction(() => fabrication.lancerFabrication(videoId, { confirme: apercu.estimation.total.centimes }).then(() => null, (e: Error & { code?: string }) => e));
    expect(erreur).toMatchObject({ code: "SIMULATION_EN_PRODUCTION" });
    expect(erreur!.message).not.toMatch(/Reliez ces outils/);
    expect(erreur!.message).toMatch(/Montage réel des vidéos/);
    expect(erreur!.message).toMatch(/Ma vidéo HeyGen/);
    expect(await depots().travaux.compter((t) => t.cibleId === videoId)).toBe(0);
    expect(await depots().versions.compter((v) => v.videoId === videoId)).toBe(0);
  });
});

describe("B · interrupteurs ALLUMÉS (« Votre avatar parle » + « Montage réel ») : la voix lit le texte importé", () => {
  /** Will choisit son double (deux angles), allume les deux interrupteurs ; la vidéo prend le double, sans illustrations. */
  async function allumer(videoId: string) {
    const d = depots();
    const moi = (await d.personnages.trouver((p) => p.nature === "moi"))!;
    for (const v of await d.visages.lister((x) => x.personnageId === moi.id)) await d.visages.modifier(v.id, { statut: "brouillon" });
    const tq = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
    await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_face_002", angle: "face", tenue: "Chemise noire" });
    await d.personnages.modifier(moi.id, { visageParDefautId: tq });
    await renduDouble.definirRenduDouble({ allume: true });
    await reglages.definirMontageReel("avocat", true);
    const video = (await d.videos.obtenir(videoId))!;
    await d.videos.modifier(videoId, { briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"], distribution: video.distribution.map((x, i) => (i === 0 ? { ...x, source: "double" as const, personnageId: moi.id, visageId: tq, visagesParAngle: undefined } : x)) });
    await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram"]);
  }

  async function jusquAuBout(travailId: string) {
    const m = creerMoteurMontageAvocat();
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 400; i++) {
      const t = (await depots().travaux.obtenir(travailId))!;
      if (t.statut === "termine") break;
      if (t.statut === "echec") await travaux.reessayerTravail(travailId);
      vi.setSystemTime(Date.now() + 15_000);
      await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 5_000 });
    }
    vi.useRealTimers();
    return (await depots().travaux.obtenir(travailId))!;
  }

  it(".docx importé → montage réel (production) → la voix HeyGen lit exactement le texte importé, une fois ; la vidéo va au bout", async () => {
    const texte = await texteDe("docx");
    const { videoId } = await scriptEnregistre(texte);
    await allumer(videoId);
    const apercu = await fabrication.apercuFabrication(videoId);
    expect(apercu.budget).toMatchObject({ montageReel: true, confirmationRequise: true });
    // Le prix est exigé (garde R8), puis la fabrication part, en production.
    await expect(enProduction(() => fabrication.lancerFabrication(videoId))).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const { travailId, versionId } = await enProduction(() => fabrication.lancerFabrication(videoId, { confirme: apercu.estimation.total.centimes }));
    expect((await depots().versions.obtenir(versionId))!.commande.moteurId).toBe("montage-avocat");
    const travail = await jusquAuBout(travailId);
    expect(travail.statut).toBe("termine");
    // La voix a lu UNE fois, et exactement le texte importé (aucun mot ajouté, perdu ou réécrit).
    expect(R.textesLus).toHaveLength(1);
    expect(mots(R.textesLus[0])).toEqual(mots(TEXTE));
    // Le double HeyGen a bien été rendu (pas de démonstration), la composition faite sur studio-rendu.
    expect(R.appels.some((a) => a.hote === "api.heygen.com" && a.methode === "POST" && a.chemin === "/v3/videos")).toBe(true);
    expect(R.appels.some((a) => a.hote === "studio-rendu.essai" && a.methode === "POST")).toBe(true);
    expect((await depots().videos.obtenir(videoId))!.statut).toBe("prete");
  }, 120_000);
});
