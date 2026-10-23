/**
 * LOT R7e — « Votre avatar parle dans le studio » (décision de Will du 03/10, « oui pour le A »). Will crée son avatar
 * dans l'application HeyGen ; le studio, sur un texte validé, le fait parler avec sa voix clonée (porte-monnaie de
 * l'API). Réglage ÉTEINT par défaut, allumé par Will seulement (Réglages › Connexions › Double). Tout sur réponses
 * construites d'après la documentation, sans clé ni réseau, rien de payé.
 * ROUGES (chacun prouvé par mutation, voir docs/OUTILS-REELS-R7.md § R7e) : réglage éteint → aucun appel ; sans
 * confirmation → aucun appel ; reprise après panne → pas de second envoi ; plafond dépassé → refus ; décors « look »
 * → aucun appel ; deux angles sur le même son.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/app/(studio)/reglages/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true })) }));

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;

/** HeyGen doublé : chaque requête est notée ; les vidéos demandées sont gardées (et retrouvables par leur titre). */
const heygen = vi.hoisted(() => ({
  requetes: [] as { methode: string; url: string; corps?: Record<string, unknown>; cle?: string }[],
  videos: [] as { id: string; title: string }[],
  sansDetourage: new Set<string>(),
  force: undefined as boolean | undefined,
}));
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  const corps = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
  heygen.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}`, corps, cle: entetes["Idempotency-Key"] });
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/avatars/looks") {
    const look = (id: string, name: string) => ({ id, name, status: "completed", supported_api_engines: ["avatar_v"], orientation: "portrait" });
    return json({ data: [look("look_tq", "Trois-quarts"), look("look_face", "Presque de face")], has_more: false });
  }
  if (u.hostname === "api.heygen.com" && methode === "POST" && u.pathname === "/v3/videos") {
    // Documentation : un avatar entraîné sans détourage refuse la demande webm.
    if (corps?.output_format === "webm" && heygen.sansDetourage.has(String(corps.avatar_id))) return json({ error: { code: "invalid_parameter", message: "This video avatar does not support webm output. The avatar must be trained with matting enabled." } }, 400);
    const id = `video-${entetes["Idempotency-Key"]}`;
    if (!heygen.videos.some((v) => v.id === id)) heygen.videos.push({ id, title: String(corps?.title ?? "") });
    return json({ data: { video_id: id, status: "waiting", output_format: corps?.output_format } });
  }
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/videos") {
    const titre = u.searchParams.get("title") ?? "";
    return json({ data: heygen.videos.filter((v) => v.title.includes(titre)).map((v) => ({ id: v.id, title: v.title, status: "processing" })), has_more: false });
  }
  if (u.hostname === "api.heygen.com" && u.pathname.startsWith("/v3/videos/")) return json(F.videoTerminee);
  if (u.hostname === "files2.heygen.ai") return new Response(new Uint8Array(32), { status: 200, headers: { "content-length": "32" } });
  if (methode === "PUT") return (await new Response(init?.body).arrayBuffer(), new Response("", { status: 200 }));
  return new Response("{}", { status: 404 });
};
vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
  const stockage = async () => ({ ...stockageSimulation, urlLectureDuree: async (cle: string, s: number) => `https://r2.exemple/${cle}?lecture=${s}`, urlDepotDuree: async (cle: string) => `https://r2.exemple/${cle}?depot` });
  const f = reseau as unknown as typeof fetch;
  // Comme en production : le réglage de Will est relu avant chaque envoi (`services/rendu-double.ts`).
  const renduAllume = async () => (await import("@/services/rendu-double")).renduDoubleAllume();
  return { visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai-r7e", fetch: f }), { stockage, fetch: f, resoudre: async () => ["203.0.113.10"], renduAllume, get renduAvatarAutorise() { return heygen.force; } }) }), voixHeygen: () => ({}) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const doublesHeygen = await import("@/services/doubles-heygen");
const renduDouble = await import("@/services/rendu-double");
const { ecrireParametre } = await import("@/services/_commun");
const { definirBudget } = await import("@/services/couts");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { avancerDouble } = await import("@/moteurs/montage-avocat/double");
const { phraseAvatarParle } = await import("@/domaine/double-reel");
const { corpsRendu, FOND_UNI_AVATAR, LOOKS_HEYGEN_PAR_LE_STUDIO, MESSAGE_SANS_FOND_IMPOSSIBLE } = await import("@/fournisseurs/heygen/rendus");
const { resoudreFournisseur } = await import("@/fournisseurs");
const { ReglageDouble, TEXTES_DOUBLE } = await import("@/components/reglages/Double");

const T0 = Date.UTC(2026, 9, 3, 19, 0, 0);
const MDP = "essai-r7e-avatar";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  heygen.requetes = [];
  heygen.videos = [];
  heygen.sansDetourage = new Set();
  heygen.force = undefined;
  delete process.env.STUDIO_RENDU_URL;
  await auth.seConnecter(MDP, false);
  // 14/10 (voix de référence) : ce test porte sur le chemin de la voix SANS contrôle de ressemblance (réglage coupé) ;
  // l'avocat avec le contrôle actif est prouvé par tests/voix-reference/avocat.test.ts.
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
});

/* ------------------------------------------------------------------ */

const envoisPayants = () => heygen.requetes.filter((r) => r.url.startsWith("api.heygen.com") && r.methode !== "GET");
const rendusHeygen = () => heygen.requetes.filter((r) => r.methode === "POST" && r.url === "api.heygen.com/v3/videos");

/** Will relie ses deux avatars (angle principal trois-quarts, second presque de face) ; la vidéo d'exemple les prend. */
async function deuxAvatarsRelies(): Promise<void> {
  const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_tq", angle: "trois-quarts", tenue: "Chemise noire" });
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_face", angle: "face" });
  const video = (await depots().videos.obtenir("v-03"))!;
  await depots().videos.modifier("v-03", { distribution: video.distribution.map((x) => ({ ...x, visageId: undefined, visagesParAngle: undefined })) });
  heygen.requetes = [];
}

/** Correcteur 4 (B4) : un montage réel exige la voix HeyGen de Will (ici sans service inscrit : aucun appel). */
async function voixHeygenReliee(): Promise<void> {
  for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
}

/** Montage réel relié (STUDIO_RENDU_URL) et moteur avocat choisi : la console lance comme en production. */
async function enProduction(f: () => Promise<void>): Promise<void> {
  process.env.STUDIO_RENDU_URL = "http://studio-rendu.invalid";
  try {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    await f();
  } finally {
    delete process.env.STUDIO_RENDU_URL;
  }
}

const stockageSigne = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async (d) => ({ cleStockage: `studio/dev/${d.typeEntite}/${d.entiteId}/${d.fichierId}-${d.nom}`, urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}?court`,
  urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
  urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
});

function fauxRendu() {
  const recues: DemandeRendu[] = [];
  const etats = new Map<string, EtatRendu>();
  const service: ServiceRendu = {
    async soumettre(d) {
      recues.push(d);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 5e7, lufs: -14, creteVraieDbtp: -2, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lra: 2, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41, debitKbps: 14000 } : undefined });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
  return { recues, service };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/** Commande de la vidéo d'exemple, construite par le service (réglage de Will figé dedans), un seul format. */
async function commande(): Promise<CommandeFabrication> {
  return { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
}

/* ------------------------------------------------------------------ */

describe("le réglage « Votre avatar parle dans le studio »", () => {
  it("éteint par défaut ; seul Will l'allume (session exigée), consigné au journal ; figé dans la commande", async () => {
    expect(await renduDouble.lireRenduDouble()).toEqual({ allume: false, fond: "sans-fond" });
    await deuxAvatarsRelies();
    expect((await commande()).renduDouble).toEqual({ allume: false, fond: "sans-fond" });
    await renduDouble.definirRenduDouble({ allume: true });
    expect((await commande()).renduDouble).toEqual({ allume: true, fond: "sans-fond" });
    expect((await depots().evenements.lister()).some((e) => e.message === "Votre avatar parle dans le studio : allumé")).toBe(true);
    await expect(renduDouble.definirRenduDouble({ fond: "vert" as never })).rejects.toMatchObject({ code: "REGLAGE_INVALIDE" });
    // Valeur inattendue en base : éteint.
    await ecrireParametre("double.rendu", { allume: "oui" });
    expect((await renduDouble.lireRenduDouble()).allume).toBe(false);
  });

  it("ROUGE — réglage éteint : aucun appel chez HeyGen (console, moteur, fournisseur), rien d'annoncé ni de réservé", async () => {
    await deuxAvatarsRelies();
    await enProduction(async () => {
      const reservations = await depots().reservations.compter();
      await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET", message: expect.stringMatching(/Réglages, Connexions, Double/) });
      expect(await depots().reservations.compter()).toBe(reservations);
    });
    // L'estimation n'annonce rien au nom de HeyGen.
    const c = await commande();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu().service, stockage: stockageSigne });
    expect((await m.estimer(c)).lignes.filter((l) => l.etape.startsWith("Double")).every((l) => l.fournisseur === "simulation")).toBe(true);
    // Le moteur (service de rendu imposé) termine la vidéo sans faire parler l'avatar.
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-eteint", versionId: "ver-eteint", titre: "Éteint", maintenant: T0 }));
    expect(travail.parametres?.double).toBeUndefined();
    // Le fournisseur relit le réglage et refuse, sans appel.
    await expect(resoudreFournisseur("visage", "heygen").rendre({ visageId: "look_tq", audioCle: "a", audioUrl: "https://r2.exemple/a", fond: "transparent", ratio: "9:16", cleIdempotence: "k" })).rejects.toThrow(/Réglages, Connexions, Double/);
    expect(envoisPayants()).toEqual([]);
  });

  it("ROUGE — réglage éteint PENDANT la vidéo : le fournisseur relit le réglage, l'envoi suivant ne part pas", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    const c = await commande();
    await renduDouble.definirRenduDouble({ allume: false });
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu().service, stockage: stockageSigne });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-coupe", versionId: "ver-coupe", titre: "Coupé", maintenant: T0 }));
    expect(travail.statut).toBe("echec");
    expect(travail.etapes.find((e) => e.cle === "visage")?.erreur?.messagePourWill).toMatch(/ne parle pas dans le studio/);
    expect(rendusHeygen()).toEqual([]);
  });
});

describe("visage par défaut du personnage", () => {
  it("ROUGE — relier un avatar trois quarts ne remplace pas un avatar HeyGen prêt déjà choisi par défaut ; c'est noté", async () => {
    const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
    // Premier avatar relié (seul) : il devient le visage par défaut (le défaut d'essai n'est pas un avatar HeyGen prêt).
    const face = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_face", angle: "face" });
    expect((await depots().personnages.obtenir(moi.id))!.visageParDefautId).toBe(face);
    // Puis l'avatar trois quarts : le choix existant est gardé, et le journal le dit.
    await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_tq", angle: "trois-quarts" });
    expect((await depots().personnages.obtenir(moi.id))!.visageParDefautId).toBe(face);
    expect((await depots().evenements.lister()).some((e) => /visage par défaut est gardé/.test(e.message))).toBe(true);
  });
});

describe("confirmation et budget, avant toute dépense", () => {
  it("ROUGE — sans confirmation : refus « Votre avatar parle dans cette vidéo : environ … €, à confirmer », aucun appel, rien réservé", async () => {
    await deuxAvatarsRelies();
    await voixHeygenReliee();
    await renduDouble.definirRenduDouble({ allume: true });
    // Seuil très haut : seule la règle de l'avatar exige la confirmation.
    await definirBudget(100_000, 100_000);
    await enProduction(async () => {
      // CORRECTEUR FINAL A : le prix de l'avatar n'est annoncé que pour une vidéo du vrai moteur (jamais pour un essai).
      const apercu = await fabrication.apercuFabrication("v-03");
      expect(apercu.budget.double).not.toBeNull();
      expect(apercu.budget.confirmationRequise).toBe(true);
      const phrase = phraseAvatarParle(apercu.budget.double!);
      expect(phrase).toMatch(/^Votre avatar parle dans cette vidéo : environ \d+,\d\d €, à confirmer\.$/);
      for (const confirme of [undefined, false]) {
        const reservations = await depots().reservations.compter();
        await expect(fabrication.lancerFabrication("v-03", { confirme })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", message: phrase });
        expect(await depots().reservations.compter()).toBe(reservations);
      }
    });
    expect(envoisPayants()).toEqual([]);
  });

  it("ROUGE — « Fabriquer les N » (lancé confirmé d'office) : le plan donne la part de l'avatar à dire sur la feuille", async () => {
    const { SUJETS_BANC } = await import("./generateur/banc/registre-banc-g4");
    const bg = await import("@/services/boucle-generation");
    const fr = await import("@/services/fabrication-reseaux");
    const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
    const { partDoubleReel } = await import("@/domaine/double-reel");
    bg.suspendreBoucleGeneration(true);
    try {
      for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
      for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
      await deuxAvatarsRelies();
      const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
      if (!r.ok) throw new Error("écriture non lancée");
      await bg.tourBoucleGeneration();
      const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
      if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
      await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id));
      await enProduction(async () => {
        // Éteint : rien à dire.
        expect((await fr.planFabricationSujet(r.scriptMaitreId))?.avatarParle).toBeUndefined();
        await renduDouble.definirRenduDouble({ allume: true });
        const plan = (await fr.planFabricationSujet(r.scriptMaitreId))!;
        expect(plan.avatarParle).toEqual(partDoubleReel(plan.lignes!));
        expect(plan.avatarParle!.centimes).toBeGreaterThan(0);
        expect(plan.versions.every((v) => v.avatarParle && v.avatarParle.centimes > 0)).toBe(true);
        expect(phraseAvatarParle(plan.avatarParle!, plan.versions.length)).toMatch(/^Votre avatar parle dans ces vidéos : environ \d+,\d\d\s€, à confirmer\.$/);
      });
    } finally {
      bg.arreterBoucleGeneration();
    }
  }, 60_000);

  it("budget du mois dépassé : refus avant tout appel, même confirmé", async () => {
    await deuxAvatarsRelies();
    await voixHeygenReliee();
    await renduDouble.definirRenduDouble({ allume: true });
    await definirBudget(1, 0);
    await enProduction(async () => {
      await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    });
    expect(await depots().reservations.compter()).toBe(0);
    expect(envoisPayants()).toEqual([]);
  });

  it("jamais d'envoi en simulation : réglage allumé, sans montage réel relié, l'avatar ne part pas chez HeyGen", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    const c = await commande();
    const m = creerMoteurMontageAvocat({ stockage: stockageSigne });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-sim", versionId: "ver-sim", titre: "Simulé", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(travail.parametres?.double).toBeUndefined();
    expect(envoisPayants()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("l'avatar parle : la voix d'abord, chaque angle sur ce même son", () => {
  it("ROUGE — deux angles sur le même son : voix fabriquée une fois, angle principal sur l'audio maître, second sur ses tranches", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    const c = await commande();
    expect(c.distribution[0]).toMatchObject({ source: "double", modeAngles: "deux-angles", visagesResolus: { "trois-quarts": { idExterne: "look_tq", fournisseur: "heygen" }, face: { idExterne: "look_face", fournisseur: "heygen" } } });
    // La voix (doublée) est comptée : un seul son pour toute la vidéo.
    const voixSim = resoudreFournisseur("voix");
    let lectures = 0;
    const voix: FournisseurVoix = { ...voixSim, lire: async (d) => (lectures++, voixSim.lire(d)) };
    const rendu = fauxRendu();
    // Aucune autorisation forcée : c'est le réglage figé dans la commande qui allume le rendu.
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, voix: () => voix });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-son", versionId: "ver-son", titre: "Même son", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(lectures).toBe(1);
    const audio = (travail.parametres!.voix as { audio: { fichierCle: string } }).audio.fichierCle;
    const envois = rendusHeygen();
    // Angle principal : en premier, sur l'audio maître entier ; jamais un texte à relire par HeyGen.
    expect(envois[0].corps).toMatchObject({ avatar_id: "look_tq", audio_url: expect.stringContaining(audio) });
    for (const e of envois) {
      expect(e.corps).not.toHaveProperty("script");
      expect(e.corps).not.toHaveProperty("voice_id");
      expect(e.corps).toMatchObject({ engine: { type: "avatar_v" }, output_format: "webm" });
    }
    // Second angle : chaque passage parle sur une tranche découpée DANS ce même audio maître.
    const tranches = rendu.recues.filter((d) => d.operation === "extrait");
    const seconds = envois.slice(1);
    expect(seconds.length).toBeGreaterThan(0);
    expect(seconds.length).toBe(tranches.length);
    for (const t of tranches) expect(t.entrees.media).toContain(audio);
    for (const [i, e] of seconds.entries()) {
      expect(e.corps).toMatchObject({ avatar_id: "look_face" });
      expect(String(e.corps!.audio_url)).toContain(tranches[i].sortie.cle);
    }
    // La composition reçoit la piste principale et chaque passage, posés sur le décor (sans fond).
    const compo = rendu.recues.find((d) => d.operation === "composition")!;
    expect(Object.keys(compo.entrees)).toEqual(expect.arrayContaining(["double-principal", ...seconds.map((_, i) => `double-second-${i}`)]));
    expect((compo.parametres as { image: { doubles: { principal: { transparent: boolean } } } }).image.doubles.principal.transparent).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("reprise après panne et plafond", () => {
  const outils = (plafondSec: number) => ({
    visage: resoudreFournisseur("visage", "heygen"),
    rendu: fauxRendu().service,
    lecture: async (cle: string) => `https://r2.exemple/${cle}`,
    depot: async (cle: string) => `https://r2.exemple/${cle}?depot`,
    cle: (n: string) => n,
    travailId: "trav-panne",
    idBase: "p",
    titre: "Reprise",
    audioMaitreCle: "audio.wav",
    consigne: () => undefined,
    plafondSec,
  });
  const etat0 = { fournisseur: "heygen", lookIds: { "trois-quarts": "look_tq" }, pieces: [{ angle: "trois-quarts" as const, index: 0, debutSec: 0, finSec: 30, tranche: false, phase: "a-rendre" as const, audioCle: "audio.wav", essai: 0 }] };

  it("ROUGE — panne juste après l'envoi (réponse perdue) : à la reprise, le rendu est retrouvé, AUCUN second envoi", async () => {
    await renduDouble.definirRenduDouble({ allume: true });
    // Tour 1 : la décision d'envoyer est gardée, rien ne part.
    const decide = await avancerDouble(etat0, outils(45));
    expect(decide.pieces[0]).toMatchObject({ phase: "envoi", titreRendu: expect.stringMatching(/^Reprise · angle principal · [0-9a-f]{12}$/) });
    expect(decide.secondesEnvoyees).toBe(30);
    expect(rendusHeygen()).toEqual([]);
    // Relecture n° 6 : la date de la décision est gardée ; la recherche de reprise ne remonte pas plus loin.
    expect(Date.parse(decide.pieces[0].decideLe!)).toBeGreaterThan(0);
    // Tour 2 : l'envoi part… puis le serveur tombe avant d'avoir gardé la réponse.
    const envoye = await avancerDouble(decide, outils(45));
    expect(rendusHeygen()).toHaveLength(1);
    expect(envoye.pieces[0]).toMatchObject({ phase: "rendu", idExterne: "video-rendu:trav-panne:trois-quarts:0:e0" });
    // Reprise depuis le dernier état gardé (tour 1) : le rendu est retrouvé, rien n'est renvoyé ni recompté.
    const repris = await avancerDouble(decide, outils(45));
    expect(rendusHeygen()).toHaveLength(1);
    expect(repris.pieces[0]).toMatchObject({ phase: "rendu", idExterne: "video-rendu:trav-panne:trois-quarts:0:e0" });
    expect(repris.secondesEnvoyees).toBe(30);
    // Une seconde reprise identique : toujours un seul envoi.
    await avancerDouble(decide, outils(45));
    expect(rendusHeygen()).toHaveLength(1);
  });

  it("le second angle attend que l'angle principal soit accepté (un refus « sans fond » se voit avant toute dépense)", async () => {
    await renduDouble.definirRenduDouble({ allume: true });
    const etat = { ...etat0, lookIds: { "trois-quarts": "look_tq", face: "look_face" }, pieces: [...etat0.pieces, { angle: "face" as const, index: 0, debutSec: 3, finSec: 10, tranche: true, phase: "a-rendre" as const, audioCle: "tranche-0.wav", essai: 0 }] };
    const t1 = await avancerDouble(etat, outils(60));
    expect(t1.pieces.map((p) => p.phase)).toEqual(["envoi", "a-rendre"]);
    const t2 = await avancerDouble(t1, outils(60));
    expect(t2.pieces.map((p) => p.phase)).toEqual(["rendu", "a-rendre"]);
    expect(rendusHeygen().map((r) => r.corps?.avatar_id)).toEqual(["look_tq"]);
    const t3 = await avancerDouble(t2, outils(60));
    expect(t3.pieces[1].phase).toBe("envoi");
  });

  it("recherche impossible (réseau) : l'envoi part avec la MÊME clé d'idempotence (jamais payé deux fois)", async () => {
    await renduDouble.definirRenduDouble({ allume: true });
    const decide = await avancerDouble(etat0, outils(45));
    const visage = { ...outils(45).visage, retrouverRendu: async () => Promise.reject(new Error("réseau")) };
    await avancerDouble(decide, { ...outils(45), visage });
    await avancerDouble(decide, { ...outils(45), visage });
    expect(rendusHeygen().map((r) => r.cle)).toEqual(["rendu:trav-panne:trois-quarts:0:e0", "rendu:trav-panne:trois-quarts:0:e0"]);
  });

  it("ROUGE — éteint au tour 2 puis rallumé : « Réessayer » envoie bien, le plafond compte seulement ce qui est parti", async () => {
    await renduDouble.definirRenduDouble({ allume: true });
    const decide = await avancerDouble(etat0, outils(45));
    expect(decide.secondesEnvoyees).toBe(30);
    // Will éteint le réglage entre les deux tours : l'envoi est refusé, rien ne part, rien n'est compté.
    await renduDouble.definirRenduDouble({ allume: false });
    const refuse = await avancerDouble(decide, outils(45));
    expect(refuse.pieces[0].phase).toBe("echec");
    expect(refuse.secondesEnvoyees).toBe(0);
    expect(rendusHeygen()).toEqual([]);
    // Will rallume et touche « Réessayer » (même essai, comme `reessayer` du moteur).
    await renduDouble.definirRenduDouble({ allume: true });
    const relance = { ...refuse, pieces: refuse.pieces.map((p) => ({ ...p, phase: "a-rendre" as const, erreur: undefined, titreRendu: undefined, callbackId: undefined })) };
    const t1 = await avancerDouble(relance, outils(45));
    expect(t1.pieces[0].phase).toBe("envoi");
    const t2 = await avancerDouble(t1, outils(45));
    expect(t2.pieces[0].phase).toBe("rendu");
    expect(rendusHeygen()).toHaveLength(1);
    expect(t2.secondesEnvoyees).toBe(30);
    expect(t2.secondesEnvoyees!).toBeLessThanOrEqual(45);
  });

  it("ROUGE — plafond dépassé : refus clair, rien n'est envoyé", async () => {
    await renduDouble.definirRenduDouble({ allume: true });
    const refuse = await avancerDouble(etat0, outils(29));
    expect(refuse.pieces[0]).toMatchObject({ phase: "echec", erreur: expect.stringMatching(/plus que le prix annoncé/) });
    expect((await avancerDouble({ ...etat0, secondesEnvoyees: 20 }, outils(45))).pieces[0].phase).toBe("echec");
    expect(rendusHeygen()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("fond de l'avatar", () => {
  it("corps de la demande : sans fond = webm sans `background` ; fond uni = mp4 sur une couleur", () => {
    const base = { lookId: "look_tq", audioUrl: "https://r2.exemple/a", titre: "t", cleIdempotence: "k" };
    expect(corpsRendu(base)).toMatchObject({ output_format: "webm" });
    expect(corpsRendu(base)).not.toHaveProperty("background");
    expect(corpsRendu({ ...base, fondUni: FOND_UNI_AVATAR })).toMatchObject({ output_format: "mp4", background: { type: "color", value: FOND_UNI_AVATAR } });
  });

  it("HeyGen refuse « sans fond » (avatar créé sans détourage) et rien n'est encore parti : repli automatique sur le fond uni", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    heygen.sansDetourage = new Set(["look_tq", "look_face"]);
    const c = await commande();
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-uni", versionId: "ver-uni", titre: "Fond uni", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const envois = rendusHeygen();
    // Un seul refus (angle principal, webm), puis tout en fond uni ; le second angle n'est jamais parti « sans fond ».
    expect(envois[0].corps).toMatchObject({ avatar_id: "look_tq", output_format: "webm" });
    expect(envois.slice(1).every((e) => e.corps?.output_format === "mp4" && (e.corps.background as { value: string }).value === FOND_UNI_AVATAR)).toBe(true);
    expect(envois.filter((e) => e.corps?.avatar_id === "look_face").every((e) => e.corps?.output_format === "mp4")).toBe(true);
    expect((travail.parametres!.double as { fond: string }).fond).toBe("uni");
    // Composition : pistes opaques (ni décor ni liseré posés).
    const compo = rendu.recues.find((d) => d.operation === "composition")!;
    expect((compo.parametres as { image: { doubles: { principal: { transparent: boolean } } } }).image.doubles.principal.transparent).toBe(false);
  });

  it("fond uni choisi par Will : toutes les demandes en fond uni", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true, fond: "uni" });
    const c = await commande();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu().service, stockage: stockageSigne });
    await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-uni2", versionId: "ver-uni2", titre: "Uni", maintenant: T0 }));
    expect(rendusHeygen().length).toBeGreaterThan(1);
    expect(rendusHeygen().every((e) => e.corps?.output_format === "mp4")).toBe(true);
  });

  it("ROUGE — fond uni en 4:5 et 1:1 : le décor devient la même couleur unie (pas de rectangle gris sur un décor)", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true, fond: "uni" });
    const c = { ...(await commande()), ratios: ["9:16" as const, "4:5" as const, "1:1" as const] };
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-uni45", versionId: "ver-uni45", titre: "Uni 4:5", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const compos = rendu.recues.filter((d) => d.operation === "composition");
    type Image = { ratio: string; decor: { image?: string; teinte: string } };
    const images = compos.map((d) => (d.parametres as { image: Image }).image);
    expect(images.map((i) => i.ratio).sort()).toEqual(["1:1", "4:5", "9:16"]);
    for (const [k, i] of images.entries()) {
      expect(i.decor.image).toBeUndefined();
      expect(i.decor.teinte.toLowerCase()).toBe(FOND_UNI_AVATAR.toLowerCase());
      expect(compos[k].entrees).not.toHaveProperty("decor");
    }
  });

  it("second angle refusé « sans fond » alors que l'angle principal est déjà parti : arrêt clair, pas de repli payé deux fois", async () => {
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    heygen.sansDetourage = new Set(["look_face"]);
    const c = await commande();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu().service, stockage: stockageSigne });
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-mixte", versionId: "ver-mixte", titre: "Mixte", maintenant: T0 }));
    expect(travail.statut).toBe("echec");
    expect(travail.etapes.find((e) => e.cle === "visage")?.erreur?.messagePourWill).toContain(MESSAGE_SANS_FOND_IMPOSSIBLE);
    expect(rendusHeygen().filter((e) => e.corps?.avatar_id === "look_tq")).toHaveLength(1);
    expect(rendusHeygen().every((e) => e.corps?.output_format === "webm")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("décors « look HeyGen » : toujours interdits, même réglage allumé", () => {
  it("ROUGE — avatar relié, réglage allumé, décor réaliste confirmé : refus en phrase simple, AUCUN appel", async () => {
    expect(LOOKS_HEYGEN_PAR_LE_STUDIO).toBe(false);
    await deuxAvatarsRelies();
    await renduDouble.definirRenduDouble({ allume: true });
    heygen.force = true;
    await ecrireParametre("fournisseur.visage", "heygen");
    const decors = await import("@/services/decors");
    const { doublesDeBasePourLooks } = await import("@/services/personnages");
    const est = await decors.estimerLookDecor("decor-r2-bibliotheque");
    expect(est.bloque).toBe("Les décors réalistes se font dans l'application HeyGen. Le studio ne fabrique rien chez HeyGen.");
    expect(est.cout.centimes).toBe(0);
    await expect(decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: true })).rejects.toMatchObject({ code: "DECOR_DANS_HEYGEN" });
    expect(await doublesDeBasePourLooks("heygen")).toEqual([]);
    await expect(resoudreFournisseur("visage", "heygen").creerLook({ visageId: "look_tq", prompt: "bibliothèque" })).rejects.toThrow(/application HeyGen/);
    expect(envoisPayants()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("écrans en phrases simples", () => {
  const INTERDIT = /simulation|api|webm|mp4|matting|avatar_v|engine|look|digital|twin|idempotence|heygen_api|\bfalse\b|\btrue\b/i;
  it("Réglages › Connexions › Double : éteint, prix d'une minute, fond, consigne ; aucun nom technique ni anglais", () => {
    const html = renderToStaticMarkup(createElement(ReglageDouble, { initial: { allume: false, fond: "sans-fond", prixMinute: { centimes: 378, devise: "EUR" } } }));
    const texte = html.replace(/<[^>]+>/g, " ");
    expect(texte).toContain("Votre avatar parle dans le studio");
    expect(texte).toContain("Environ 3,78 € par minute de vidéo.");
    expect(texte).toContain("Sans fond, posé sur vos décors");
    expect(texte).toContain("Fond uni");
    expect(html).toMatch(/aria-checked="false"/);
    expect(texte).not.toMatch(INTERDIT);
    expect(Object.values(TEXTES_DOUBLE).filter((t) => typeof t === "string").join(" ")).not.toMatch(INTERDIT);
  });
  it("confirmation : « Votre avatar parle dans cette vidéo : environ 3,20 €, à confirmer. »", () => {
    expect(phraseAvatarParle({ centimes: 320, devise: "EUR" })).toBe("Votre avatar parle dans cette vidéo : environ 3,20 €, à confirmer.");
    expect(MESSAGE_SANS_FOND_IMPOSSIBLE).not.toMatch(INTERDIT);
  });
  it("« Ma vidéo HeyGen » reste disponible en secours (bouton de la version « je lis »)", () => {
    expect(readFileSync("src/components/generateur/VideoHeygen.tsx", "utf8")).toContain("Ma vidéo HeyGen");
    expect(readFileSync("src/components/generateur/FicheSujet.tsx", "utf8")).toMatch(/VideoHeygen|Ma vidéo HeyGen/);
  });
});
