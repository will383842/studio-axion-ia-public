/**
 * LOT R7 (réduit, décision de Will du 03/10) — le double est créé et essayé DANS L'APPLICATION HEYGEN ; le studio le
 * LIT, le fait CHOISIR, puis le fait PARLER dans le moteur avocat. Tout sur réponses construites d'après la
 * documentation (`tests/fixtures/r7-heygen-doubles.json`), sans clé ni réseau.
 *  - doubles du compte : lecture, mots simples, choix d'un double prêt, refus d'un double pas prêt ;
 *  - rendu dans le moteur : angle principal en une piste sur l'audio maître entier, second angle par passages ± 1 s
 *    (tranches de l'audio maître), Avatar V webm 1080p, clés d'idempotence, coût réel, composition ;
 *  - ROUGES : « montage réel + double d'essai → Votre double n'est pas prêt », avant toute réservation ; un tour
 *    rejoué ne repaie rien ; la composition FFmpeg lit chaque passage à son moment.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, PlanProduit, ResultatFabrication } from "@/moteurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;
const data = (k: string) => F[k].data;

/** HeyGen doublé : chaque requête est notée ; les réponses viennent des réponses construites. */
const heygen = vi.hoisted(() => ({ requetes: [] as { methode: string; url: string; corps?: Record<string, unknown>; cle?: string }[], looks: [] as unknown[], videos: [] as unknown[], renduAutorise: true as boolean | undefined }));
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  heygen.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}`, corps: typeof init?.body === "string" ? JSON.parse(init.body) : undefined, cle: entetes["Idempotency-Key"] });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/avatars/looks") return json({ data: heygen.looks, has_more: false });
  if (u.hostname === "api.heygen.com" && methode === "POST" && u.pathname === "/v3/videos") return json({ data: { video_id: `video-${entetes["Idempotency-Key"]}`, status: "waiting", output_format: "webm" } });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/videos") return json({ data: [], has_more: false });
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
  return { visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai-r7", fetch: f }), { stockage, fetch: f, resoudre: async () => ["203.0.113.10"], get renduAvatarAutorise() { return heygen.renduAutorise; } }) }), voixHeygen: () => ({}) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const doublesHeygen = await import("@/services/doubles-heygen");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { passagesSecondAngle, refusDouble, lignesDouble, cleRendu } = await import("@/moteurs/montage-avocat/double");
const { RECETTE_MONTAGE_AVOCAT } = await import("@/formats/avocat");
const { doubleDepuisLook } = await import("@/fournisseurs/heygen/doubles");
const { argumentsImageFfmpeg, trancheDuMorceau } = await import("../studio-rendu/src/composition/image-ffmpeg");
const { resoudreFournisseur } = await import("@/fournisseurs");

const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);
const MDP = "essai-r7-double";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  heygen.requetes = [];
  heygen.looks = [data("lookTermine"), { ...data("lookAccordAttendu"), id: "look_en_attente", name: "Face, en attente" }];
  heygen.renduAutorise = true;
  delete process.env.STUDIO_RENDU_URL;
  await auth.seConnecter(MDP, false);
});

/* ------------------------------------------------------------------ */

describe("doubles du compte HeyGen (purs)", () => {
  it("terminé et Avatar V : utilisable ; en attente d'accord, raté, sans Avatar V : montré, pas choisissable, en clair", () => {
    expect(doubleDepuisLook(data("lookTermine") as never)).toMatchObject({ idExterne: "look_essai_tq_001", nom: "Trois-quarts, chemise noire", utilisable: true, orientation: "portrait" });
    expect(doubleDepuisLook(data("lookAccordAttendu") as never)).toMatchObject({ utilisable: false, raison: expect.stringMatching(/accord/) });
    expect(doubleDepuisLook(data("lookEchecEntrainement") as never)).toMatchObject({ utilisable: false, raison: expect.stringMatching(/refaites-le/) });
    const sansV = doubleDepuisLook({ id: "x", status: "completed", supported_api_engines: ["avatar_iv"] });
    expect(sansV.utilisable).toBe(false);
    expect(sansV.raison).not.toMatch(/avatar|api|engine/i);
  });
});

describe("choisir mon double HeyGen (service)", () => {
  it("lecture gratuite des doubles privés du compte, choix d'un double prêt → visage prêt relié ; second choix sans doublon", async () => {
    const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
    const { branche, doubles } = await doublesHeygen.listerDoublesHeygen(moi.id);
    expect(branche).toBe(true);
    expect(doubles.map((d) => d.utilisable)).toEqual([true, false]);
    const lecture = heygen.requetes.find((r) => r.url.startsWith("api.heygen.com/v3/avatars/looks"))!;
    expect(lecture.methode).toBe("GET");
    expect(lecture.url).toContain("ownership=private");
    expect(lecture.url).toContain("avatar_type=digital_twin");
    const id = await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts", tenue: "Chemise noire" });
    const v = (await depots().visages.obtenir(id))!;
    expect(v).toMatchObject({ statut: "pret", fournisseur: "heygen", angle: "trois-quarts", origine: "filme" });
    expect(await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts" })).toBe(id);
    await expect(doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_en_attente", angle: "face" })).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET" });
    // Aucune demande payante, aucune création chez HeyGen.
    expect(heygen.requetes.every((r) => r.methode === "GET")).toBe(true);
  });
});

describe("décors réalistes : aucune écriture payante chez HeyGen (relecture exactitude 3042b94, n° 2)", () => {
  it("ROUGE — double HeyGen choisi + décor réaliste confirmé : refus en phrase simple, AUCUN POST vers HeyGen, rien rangé ni payé", async () => {
    heygen.renduAutorise = undefined; // production : le studio ne fait pas parler le double
    const decors = await import("@/services/decors");
    const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
    await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts" });
    await ecrireParametre("fournisseur.visage", "heygen");
    const est = await decors.estimerLookDecor("decor-r2-bibliotheque");
    expect(est.bloque).toBe("Les décors réalistes se font dans l'application HeyGen. Le studio ne fabrique rien chez HeyGen.");
    expect(est.cout.centimes).toBe(0);
    expect(est.angles).toEqual([]);
    const visagesAvant = await depots().visages.compter();
    const depensesAvant = await depots().depenses.compter();
    await expect(decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: true })).rejects.toMatchObject({ code: "DECOR_DANS_HEYGEN", message: est.bloque });
    expect(heygen.requetes.filter((r) => r.url.startsWith("api.heygen.com") && r.methode !== "GET")).toEqual([]);
    expect(await depots().visages.compter()).toBe(visagesAvant);
    expect(await depots().depenses.compter()).toBe(depensesAvant);
    expect(((await depots().elements.obtenir("decor-r2-bibliotheque"))!.valeur as { lookIdParAngle?: unknown }).lookIdParAngle ?? {}).toEqual({});
  });

  it("ROUGE — le visage HeyGen choisi n'est jamais une base de décor ; creerLook du fournisseur HeyGen refuse sans appel", async () => {
    heygen.renduAutorise = undefined;
    const { doublesDeBasePourLooks } = await import("@/services/personnages");
    const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
    await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: "look_essai_tq_001", angle: "trois-quarts" });
    expect(await doublesDeBasePourLooks("heygen")).toEqual([]);
    const visage = resoudreFournisseur("visage", "heygen");
    heygen.requetes = [];
    await expect(visage.creerLook({ visageId: "look_essai_tq_001", prompt: "bibliothèque" })).rejects.toThrow(/application HeyGen/);
    expect(heygen.requetes).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("règles du double dans le moteur (pures)", () => {
  const plan = (ordre: number, debutSec: number, finSec: number, angle: "trois-quarts" | "face") => ({ ordre, debutSec, finSec, angle, sourceImage: "double" }) as unknown as PlanProduit;
  it("second angle : ses plans ± 1 s, fusionnés quand ils se touchent, bornés à la durée", () => {
    const plans = [plan(1, 0, 4, "trois-quarts"), plan(2, 4, 6, "face"), plan(3, 6, 7.5, "trois-quarts"), plan(4, 7.5, 9, "face"), plan(5, 20, 22, "face"), plan(6, 22, 30, "trois-quarts")];
    expect(passagesSecondAngle(plans, "face", 30)).toEqual([
      { debutSec: 3, finSec: 10 },
      { debutSec: 19, finSec: 23 },
    ]);
    expect(passagesSecondAngle([plan(1, 0, 2, "face")], "face", 2.5)).toEqual([{ debutSec: 0, finSec: 2.5 }]);
  });
  it("clé de rendu stable et neuve à chaque essai ; coût à la seconde au nom du fournisseur", () => {
    expect(cleRendu("trav-1", { angle: "face", index: 2, essai: 0 })).toBe("rendu:trav-1:face:2:e0");
    const l = lignesDouble({ fournisseur: "heygen", lookIds: {}, pieces: [{ angle: "trois-quarts", index: 0, debutSec: 0, finSec: 30, tranche: false, phase: "faite", essai: 0, dureeSec: 30 }] }, 0.9);
    expect(l).toEqual([expect.objectContaining({ fournisseur: "heygen", unite: "seconde", quantite: 30, total: { centimes: Math.round(7 * 0.9 * 30), devise: "EUR" }, nature: "reel" })]);
  });
});

/* ------------------------------------------------------------------ */

const stockageSigne = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async (d) => ({ cleStockage: `studio/dev/${d.typeEntite}/${d.entiteId}/${d.fichierId}.webm`, urlDepot: "" }),
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

/** Commande de la vidéo d'exemple avec un double RÉEL choisi pour les deux angles. */
async function commandeAvecDoubleReel(options: { deuxAngles?: boolean } = {}): Promise<CommandeFabrication> {
  const c = { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
  const d = c.distribution[0];
  const reel = (id: string) => ({ visageId: `vis-${id}`, idExterne: id, fournisseur: "heygen", statut: "pret" as const });
  return { ...c, distribution: [{ ...d, source: "double", modeAngles: options.deuxAngles === false ? "un-angle" : "deux-angles", visagesResolus: { "trois-quarts": reel("look_tq"), face: reel("look_face") } }] };
}

const rendusHeygen = () => heygen.requetes.filter((r) => r.methode === "POST" && r.url === "api.heygen.com/v3/videos");

describe("ÉTEINT — le studio ne fait jamais parler le double (décision de Will du 03/10)", () => {
  it("ROUGE — par défaut : montage réel refusé avec le message « faites la vidéo dans HeyGen », aucun rendu, rien d'annoncé", async () => {
    heygen.renduAutorise = undefined;
    try {
      const rendu = fauxRendu();
      const c = await commandeAvecDoubleReel();
      // Montage réel relié : refus clair au lancement.
      const reel = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, environnement: { STUDIO_RENDU_URL: "http://studio-rendu.invalid" } });
      expect(reel.refusAuLancement!(c)?.message).toMatch(/application HeyGen/);
      await expect(reel.lancer(c, { travailId: "t", versionId: "v", titre: "x", maintenant: T0 })).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET" });
      // Service de rendu imposé (sans adresse) : la vidéo se fait, le double reste simulé, aucun rendu chez HeyGen.
      const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
      const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-off", versionId: "ver-off", titre: "Éteint", maintenant: T0 }));
      expect(travail.parametres?.double).toBeUndefined();
      // Rien n'est annoncé au nom de HeyGen pour le double.
      expect((await m.estimer(c)).lignes.filter((l) => l.etape.startsWith("Double")).every((l) => l.fournisseur === "simulation")).toBe(true);
      // Le fournisseur lui-même refuse, sans appel.
      await expect(resoudreFournisseur("visage", "heygen").rendre({ visageId: "look_tq", audioCle: "a", audioUrl: "https://r2.exemple/a", fond: "transparent", ratio: "9:16", cleIdempotence: "k" })).rejects.toThrow(/application HeyGen/);
      expect(rendusHeygen()).toEqual([]);
    } finally {
      heygen.renduAutorise = true;
    }
  });
});

describe("rendu du double réel dans le moteur avocat (code conservé, autorisé ici par les tests seulement)", () => {
  it("angle principal sur l'audio maître entier, second angle par passages ; Avatar V webm 1080p ; composition avec les deux", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, renduDoubleAutorise: true });
    const c = await commandeAvecDoubleReel();
    const { travail, resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-r7", versionId: "ver-r7", titre: "Essai R7", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const etat = travail.parametres!.double as { pieces: { angle: string; tranche: boolean; debutSec: number; finSec: number; videoCle?: string }[] };
    const principal = etat.pieces.filter((p) => !p.tranche);
    const passages = etat.pieces.filter((p) => p.tranche);
    expect(principal).toHaveLength(1);
    expect(principal[0]).toMatchObject({ angle: "trois-quarts", debutSec: 0 });
    // Une tranche d'audio WAV par passage (studio-rendu), puis un rendu par pièce.
    const tranches = rendu.recues.filter((d) => d.operation === "extrait");
    expect(tranches.map((d) => d.parametres.type)).toEqual(passages.map(() => "audio"));
    expect(rendusHeygen()).toHaveLength(1 + passages.length);
    for (const r of rendusHeygen()) expect(r.corps).toMatchObject({ type: "avatar", engine: { type: "avatar_v" }, output_format: "webm", resolution: "1080p", aspect_ratio: "9:16", fit: "contain", audio_url: expect.stringMatching(/^https:\/\/r2\.exemple\/.*valable=86400$/) });
    expect(rendusHeygen()[0].corps).toMatchObject({ avatar_id: "look_tq", audio_url: expect.stringContaining("audio-maitre") });
    expect(rendusHeygen().map((r) => r.cle)).toEqual(["rendu:trav-r7:trois-quarts:0:e0", ...passages.map((_, i) => `rendu:trav-r7:face:${i}:e0`)]);
    // La composition reçoit la piste principale et chaque passage du second angle.
    const compo = rendu.recues.find((d) => d.operation === "composition")!;
    expect(Object.keys(compo.entrees)).toEqual(expect.arrayContaining(["double-principal", ...passages.map((_, i) => `double-second-${i}`)]));
    const image = (compo.parametres as { image: { doubles: { principal: { type: string }; second?: { type: string; morceaux: unknown[] } } } }).image;
    expect(image.doubles.principal.type).toBe("video");
    expect(image.doubles.second).toMatchObject({ type: "tranches", transparent: true });
    expect(image.doubles.second!.morceaux).toHaveLength(passages.length);
    // Coût réel : HeyGen à la seconde rendue, plus aucune ligne d'essai du visage.
    const lignes = resultat!.lignesReelles.filter((l) => l.etape.startsWith("Double"));
    expect(lignes.length).toBe(1 + passages.length);
    expect(lignes.every((l) => l.fournisseur === "heygen" && l.nature === "reel" && l.quantite === 12.48)).toBe(true);
    expect(resultat!.pistes?.some((p) => p.type === "plan-double" && p.fichierCle.endsWith(".webm"))).toBe(true);
    // Un tour rejoué après la fin : rien de plus chez HeyGen.
    await m.avancer(travail, c, T0 + 11 * 60_000);
    expect(rendusHeygen()).toHaveLength(1 + passages.length);
  });

  it("composition FFmpeg : chaque morceau du second angle lit SON passage, décalé de son début", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, renduDoubleAutorise: true });
    const c = await commandeAvecDoubleReel();
    await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-ff", versionId: "ver-ff", titre: "FF", maintenant: T0 }));
    const p = (rendu.recues.find((d) => d.operation === "composition")!.parametres as { image: Parameters<typeof argumentsImageFfmpeg>[0] }).image;
    const tranches = (p.doubles.second as { morceaux: { debutSec: number; finSec: number }[] }).morceaux;
    const args = argumentsImageFfmpeg(p, { grainPct: 0, grainTaillePx: 1, vignettePct: 0 }, { doubles: { principal: { fichier: "principal.webm", video: true }, second: { fichier: "s0.webm", video: true, tranches: tranches.map((t, i) => ({ fichier: `s${i}.webm`, ...t })) } }, illustrations: {}, luts: [], son: "son.wav" }, 30, "master.mov");
    const graphe = args[args.indexOf("-filter_complex") + 1];
    for (const [i] of tranches.entries()) expect(args).toContain(`s${i}.webm`);
    // Le premier morceau du second angle : trim décalé du début de son passage.
    const fps = p.fps;
    const second = p.plans.findIndex((x) => x.angle === "second" && x.type === "double");
    const debutImage = Math.ceil(p.plans[second].debutSec * fps - 1e-4);
    const ti = trancheDuMorceau(tranches, { debut: debutImage, fin: debutImage + 1 }, fps);
    expect(graphe).toContain(`[ds${ti}_0]trim=start_frame=${debutImage - Math.round(tranches[ti].debutSec * fps)}:`);
  });

  it("ROUGE — montage réel (studio-rendu configuré) avec le double d'essai : refus clair « Votre double n'est pas prêt »", async () => {
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu().service, stockage: stockageSigne, environnement: { STUDIO_RENDU_URL: "http://studio-rendu.invalid" }, renduDoubleAutorise: true });
    const essai = await fabrication.construireCommande("v-03");
    expect(m.refusAuLancement!(essai)?.message).toMatch(/^Votre double n'est pas prêt/);
    await expect(m.lancer(essai, { travailId: "t", versionId: "v", titre: "x", maintenant: T0 })).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET" });
    // Double réel mais pas validé : même refus.
    const c = await commandeAvecDoubleReel();
    const pasValide = { ...c, distribution: [{ ...c.distribution[0], visagesResolus: { ...c.distribution[0].visagesResolus, "trois-quarts": { ...c.distribution[0].visagesResolus!["trois-quarts"]!, statut: "a_verifier" as const } } }] };
    expect(m.refusAuLancement!(pasValide)?.message).toMatch(/Votre double n'est pas prêt/);
    // Correcteur 4 (B4) : double réel prêt, mais voix d'essai → refus « Reliez d'abord votre voix HeyGen » ; voix HeyGen → rien.
    expect(m.refusAuLancement!(c)).toEqual({ code: "VOIX_ESSAI", message: "Reliez d'abord votre voix HeyGen dans Personnages." });
    expect(m.refusAuLancement!({ ...c, distribution: [{ ...c.distribution[0], fournisseurVoix: "heygen" }] })).toBeNull();
    expect(refusDouble(essai, RECETTE_MONTAGE_AVOCAT, () => true, true)).toMatch(/double d'essai/);
  });

  it("ROUGE — côté console : la fabrication est refusée AVANT toute réservation, aucun appel chez HeyGen", async () => {
    process.env.STUDIO_RENDU_URL = "http://studio-rendu.invalid";
    try {
      await ecrireParametre("moteur.avocat", "montage-avocat");
      const avant = await depots().reservations.compter();
      await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET", message: expect.stringMatching(/application HeyGen/) });
      expect(await depots().reservations.compter()).toBe(avant);
      expect(heygen.requetes).toEqual([]);
    } finally {
      delete process.env.STUDIO_RENDU_URL;
    }
  });

  it("le double réel est bien inscrit avec la clé et l'interrupteur (écrit et éteint)", () => {
    expect(resoudreFournisseur("visage", "heygen").mode).toBe("reel");
  });
});

/* ------------------------------------------------------------------ */
/* Garde-fous de dépense (chacun prouvé par mutation : garde retirée → test rouge, puis restaurée).    */
/* ------------------------------------------------------------------ */

describe("garde-fous de dépense du double réel", () => {
  const ligne = (etape: string, fournisseur: string, c: number) => ({ etape, fournisseur, unite: "seconde" as const, quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" as const }, total: { centimes: c, devise: "EUR" as const }, nature: "estime" as const });

  it("ROUGE — confirmation : un double réel exige TOUJOURS la confirmation du prix, même sous le seuil", async () => {
    const { verifierBudgetEtCredits } = await import("@/services/credits");
    const { partDoubleReel } = await import("@/moteurs/montage-avocat/double");
    const estimation = { lignes: [ligne("Double, angle principal", "heygen", 150)], total: { centimes: 150, devise: "EUR" as const } };
    expect(partDoubleReel(estimation.lignes)).toEqual({ centimes: 150, devise: "EUR" });
    await expect(verifierBudgetEtCredits(estimation, undefined, "Cette vidéo")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", message: "Votre avatar parle dans cette vidéo : environ 1,50\u00a0€, à confirmer." });
    await expect(verifierBudgetEtCredits(estimation, false, "Cette vidéo")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Le double d'essai (simulation) ne demande rien de plus.
    expect(partDoubleReel([ligne("Double, angle principal", "simulation", 150)])).toBeNull();
    await expect(verifierBudgetEtCredits({ lignes: [ligne("Double, angle principal", "simulation", 150)], total: { centimes: 150, devise: "EUR" } }, undefined, "Cette vidéo")).resolves.toBeUndefined();
    expect(heygen.requetes.filter((r) => r.methode === "POST")).toEqual([]);
  });

  it("ROUGE — simulation par défaut : sans montage réel relié, aucun envoi du double chez HeyGen", async () => {
    // Ni service de rendu imposé ni STUDIO_RENDU_URL : le montage est simulé, le double aussi (rien n'est payé).
    const m = creerMoteurMontageAvocat({ stockage: stockageSigne, renduDoubleAutorise: true });
    const c = await commandeAvecDoubleReel();
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-sim", versionId: "ver-sim", titre: "Simulé", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(travail.parametres?.double).toBeUndefined();
    expect(rendusHeygen()).toEqual([]);
  });

  it("ROUGE — plafond : rien ne part si l'envoi dépasse 1,5 fois les secondes annoncées", async () => {
    const { avancerDouble, secondesAnnonceesDouble, PLAFOND_DEPASSEMENT } = await import("@/moteurs/montage-avocat/double");
    const rendre = vi.fn(async () => ({ idTravailExterne: "video-x" }));
    const outils = (plafondSec: number) => ({
      visage: { rendre } as never,
      rendu: fauxRendu().service,
      lecture: async (cle: string) => `https://r2.exemple/${cle}`,
      depot: async (cle: string) => `https://r2.exemple/${cle}?depot`,
      cle: (n: string) => n,
      travailId: "trav-p",
      idBase: "p",
      titre: "Plafond",
      audioMaitreCle: "audio.wav",
      consigne: () => undefined,
      plafondSec,
    });
    const etat = { fournisseur: "heygen", lookIds: { "trois-quarts": "look_tq" }, pieces: [{ angle: "trois-quarts" as const, index: 0, debutSec: 0, finSec: 30, tranche: false, phase: "a-rendre" as const, audioCle: "audio.wav", essai: 0 }] };
    const refuse = await avancerDouble(etat, outils(29));
    expect(rendre).not.toHaveBeenCalled();
    expect(refuse.pieces[0]).toMatchObject({ phase: "echec", erreur: expect.stringMatching(/plus que le prix annoncé/) });
    // Déjà 20 s envoyées (un essai raté) : 20 + 30 > 45, refusé aussi.
    expect((await avancerDouble({ ...etat, secondesEnvoyees: 20 }, outils(45))).pieces[0].phase).toBe("echec");
    expect(rendre).not.toHaveBeenCalled();
    // Lot R7e : l'envoi se fait en deux tours (décision gardée, puis appel).
    const decide = await avancerDouble(etat, outils(45));
    expect(rendre).not.toHaveBeenCalled();
    const ok = await avancerDouble(decide, outils(45));
    expect(rendre).toHaveBeenCalledTimes(1);
    expect(ok).toMatchObject({ secondesEnvoyees: 30, pieces: [{ phase: "rendu" }] });
    // Le plafond suit l'estimation annoncée (principal + second × 1,3 + 2), × 1,5.
    const c = await commandeAvecDoubleReel();
    const annoncees = (await creerMoteurMontageAvocat({ stockage: stockageSigne }).estimer(c)).lignes.filter((l) => l.etape.startsWith("Double")).reduce((s, l) => s + l.quantite, 0);
    expect(secondesAnnonceesDouble(c)).toBe(annoncees);
    expect(PLAFOND_DEPASSEMENT).toBe(1.5);
  });
});
