/**
 * CORRECTEUR RÉEL 2 · tâche 2 (04/10) : Will veut être « dans » un décor fait dans l'application HeyGen (un look de son
 * avatar). Le studio ne CRÉE toujours aucun look (`LOOKS_HEYGEN_PAR_LE_STUDIO = false`) : il RELIE un look existant à
 * un décor réaliste, puis rend le double SUR ce look, AVEC son fond (mp4, ni détourage ni fond uni), et compose par le
 * chemin `lookReel`. Même tarif à la seconde. Sans clé ni réseau : HeyGen et le stockage sont doublés.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { CommandeFabrication, Travail, ValeurDecor } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo } from "@/moteurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;
const LOOK_DECOR = { ...F.lookTermine.data, id: "look_bureau_halo_001", name: "New Avatar · bureau halo", avatar_type: "photo_avatar", preview_image_url: "https://files2.heygen.ai/apercus/look_bureau.webp" };
const LOOK_PAS_PRET = { ...F.lookAccordAttendu.data, id: "look_pas_pret", name: "New Avatar · en cours" };

const heygen = vi.hoisted(() => ({ requetes: [] as { methode: string; url: string; corps?: Record<string, unknown>; cle?: string }[], looks: [] as Record<string, unknown>[] }));
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  heygen.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}`, corps: typeof init?.body === "string" ? JSON.parse(init.body) : undefined, cle: entetes["Idempotency-Key"] });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/avatars/looks") return json({ data: heygen.looks, has_more: false });
  if (u.hostname === "api.heygen.com" && u.pathname.startsWith("/v3/avatars/looks/")) {
    const l = heygen.looks.find((x) => x.id === decodeURIComponent(u.pathname.split("/").pop()!));
    return l ? json({ data: l }) : new Response(JSON.stringify({ error: { code: "not_found", message: "Look not found" } }), { status: 404 });
  }
  if (u.hostname === "api.heygen.com" && methode === "POST" && u.pathname === "/v3/videos") return json({ data: { video_id: `video-${entetes["Idempotency-Key"]}`, status: "waiting", output_format: "mp4" } });
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
  return { visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai-reel2", fetch: f }), { stockage, fetch: f, resoudre: async () => ["203.0.113.10"], renduAvatarAutorise: true }) }), voixHeygen: () => ({}) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const decors = await import("@/services/decors");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { refusDouble, etatInitialDouble, compositionDuDouble } = await import("@/moteurs/montage-avocat/double");
const { RECETTE_MONTAGE_AVOCAT } = await import("@/formats/avocat");
const { corpsRendu, LOOKS_HEYGEN_PAR_LE_STUDIO } = await import("@/fournisseurs/heygen/rendus");
const { lookExistantDepuis } = await import("@/fournisseurs/heygen/looks");
const { etatDecor } = await import("@/domaine/decors");

const T0 = Date.UTC(2026, 9, 4, 9, 0, 0);
const MDP = "essai-reel2-decor";
const DECOR = "decor-r2-bibliotheque";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  heygen.requetes = [];
  heygen.looks = [LOOK_DECOR, LOOK_PAS_PRET];
  delete process.env.STUDIO_RENDU_URL;
  await auth.seConnecter(MDP, false);
});

const valeurDecor = async () => (await depots().elements.obtenir(DECOR))!.valeur as ValeurDecor;
const ecrituresHeygen = () => heygen.requetes.filter((r) => r.url.startsWith("api.heygen.com") && r.methode !== "GET");

describe("relier un look HeyGen existant à un décor (lecture gratuite, rien de créé)", () => {
  it("le studio ne crée toujours aucun look", () => {
    expect(LOOKS_HEYGEN_PAR_LE_STUDIO).toBe(false);
  });

  it("liste les looks du compte (tous, pas seulement les doubles) en mots simples, par une lecture seule", async () => {
    const r = await decors.looksHeygenPourDecors();
    expect(r.branche).toBe(true);
    expect(r.looks.map((l) => [l.idExterne, l.utilisable])).toEqual([
      ["look_bureau_halo_001", true],
      ["look_pas_pret", false],
    ]);
    const lecture = heygen.requetes.find((x) => x.url.startsWith("api.heygen.com/v3/avatars/looks"))!;
    expect(lecture.url).toContain("ownership=private");
    expect(lecture.url).not.toContain("avatar_type=");
    expect(ecrituresHeygen()).toEqual([]);
    expect(lookExistantDepuis({ id: "x", status: "completed", supported_api_engines: ["avatar_iv"] }).utilisable).toBe(false);
  });

  it("« Relier ce look » : look posé sur l'angle, aperçu copié en vignette, décor à vérifier ; validé → prêt", async () => {
    await decors.relierLookDecor(DECOR, { idExterne: "look_bureau_halo_001", angle: "trois-quarts" });
    const v = await valeurDecor();
    expect(v.lookIdParAngle).toEqual({ "trois-quarts": "look_bureau_halo_001" });
    expect(v.statut).toBe("a_verifier");
    expect(etatDecor(v)).toBe("look-a-verifier");
    // L'aperçu (Will dans le décor) devient la vignette du décor sur le double, copiée chez nous.
    const f = await depots().fichiers.obtenir(v.vignetteDoubleFichierId!);
    expect(f).toMatchObject({ mime: "image/webp" });
    expect(heygen.requetes.some((x) => x.url.startsWith("files2.heygen.ai/apercus/look_bureau.webp"))).toBe(true);
    expect(heygen.requetes.some((x) => x.methode === "PUT" && x.url.startsWith("r2.exemple/"))).toBe(true);
    expect(ecrituresHeygen()).toEqual([]);
    const vue = (await decors.ecranDecors()).realistes.find((x) => x.id === DECOR)!;
    expect(vue.looksRelies).toEqual([{ angle: "trois-quarts", idExterne: "look_bureau_halo_001" }]);
    expect(vue.libelleEtat).toBe("À vérifier");
    await decors.validerDecor(DECOR);
    expect(etatDecor(await valeurDecor())).toBe("look-pret");
  });

  it("ROUGE — refus clairs : look pas prêt, look absent du compte, décor posé par le studio, angle inconnu ; rien d'écrit", async () => {
    await expect(decors.relierLookDecor(DECOR, { idExterne: "look_pas_pret", angle: "trois-quarts" })).rejects.toMatchObject({ code: "LOOK_PAS_PRET" });
    await expect(decors.relierLookDecor(DECOR, { idExterne: "look_inconnu", angle: "trois-quarts" })).rejects.toMatchObject({ code: "INTROUVABLE" });
    await expect(decors.relierLookDecor("decor-n1-halo-orange", { idExterne: "look_bureau_halo_001", angle: "trois-quarts" })).rejects.toMatchObject({ code: "PAS_UN_LOOK" });
    await expect(decors.relierLookDecor(DECOR, { idExterne: "look_bureau_halo_001", angle: "profil" })).rejects.toMatchObject({ code: "ANGLE" });
    expect((await valeurDecor()).lookIdParAngle ?? {}).toEqual({});
    expect(ecrituresHeygen()).toEqual([]);
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
  preparerDepot: async (d) => ({ cleStockage: `studio/dev/${d.typeEntite}/${d.entiteId}/${d.fichierId}.mp4`, urlDepot: "" }),
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

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail) {
  let travail = t;
  let resultat: Awaited<ReturnType<MoteurVideo["avancer"]>>["resultat"];
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/** Commande avec le double RÉEL de Will (un angle) et, si demandé, le décor relié au look HeyGen. */
async function commande(options: { decor?: "valide" | "a_verifier" | "aucun"; deuxAngles?: boolean } = {}): Promise<CommandeFabrication> {
  const c = { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
  const d = c.distribution[0];
  const reel = (id: string) => ({ visageId: `vis-${id}`, idExterne: id, fournisseur: "heygen", statut: "pret" as const });
  const base: CommandeFabrication = { ...c, renduDouble: { allume: true, fond: "sans-fond" }, distribution: [{ ...d, source: "double", fournisseurVoix: "heygen", modeAngles: options.deuxAngles ? "deux-angles" : "un-angle", visagesResolus: { "trois-quarts": reel("look_tq"), face: reel("look_face") } }] };
  if ((options.decor ?? "valide") === "aucun") return base;
  const valeur: ValeurDecor = { ...(await valeurDecor()), lookIdParAngle: { "trois-quarts": "look_bureau_halo_001" }, statut: options.decor === "a_verifier" ? "a_verifier" : "valide" };
  return { ...base, styles: { ...base.styles, decor: { id: DECOR, nom: "Bibliothèque", valeur } } };
}

const rendusHeygen = () => heygen.requetes.filter((r) => r.methode === "POST" && r.url === "api.heygen.com/v3/videos");

describe("décor relié : le double est rendu SUR le look, avec son fond, au même prix", () => {
  it("corps du rendu : mp4 avec le fond du look, sans `background`, Avatar V 1080p", () => {
    const corps = corpsRendu({ lookId: "look_bureau_halo_001", audioUrl: "https://r2.exemple/a", titre: "x", cleIdempotence: "k", avecSonFond: true });
    expect(corps).toMatchObject({ avatar_id: "look_bureau_halo_001", output_format: "mp4", engine: { type: "avatar_v" }, resolution: "1080p", aspect_ratio: "9:16" });
    expect(corps).not.toHaveProperty("background");
    // Sans décor relié : inchangé (webm transparent).
    expect(corpsRendu({ lookId: "l", audioUrl: "https://r2.exemple/a", titre: "x", cleIdempotence: "k" }).output_format).toBe("webm");
    // F4 : référence des gestes seulement si elle diffère du look rendu.
    expect(corpsRendu({ lookId: "l", audioUrl: "https://r2.exemple/a", titre: "x", cleIdempotence: "k", referenceLookId: "filme" }).engine).toEqual({ type: "avatar_v", reference_look_id: "filme" });
    expect(corpsRendu({ lookId: "l", audioUrl: "https://r2.exemple/a", titre: "x", cleIdempotence: "k", referenceLookId: "l" }).engine).toEqual({ type: "avatar_v" });
  });

  it("état initial : le look du décor remplace l'identifiant du double, fond « decor-du-look » ; composition par `lookReel`", async () => {
    const audio = { fichierCle: "audio-maitre.wav", dureeSec: 12 };
    const e = etatInitialDouble(await commande(), RECETTE_MONTAGE_AVOCAT, [], audio);
    expect(e.lookIds).toEqual({ "trois-quarts": "look_bureau_halo_001" });
    expect(e.fond).toBe("decor-du-look");
    const sans = etatInitialDouble(await commande({ decor: "aucun" }), RECETTE_MONTAGE_AVOCAT, [], audio);
    expect(sans).toMatchObject({ lookIds: { "trois-quarts": "look_tq" }, fond: "sans-fond" });
    const fait = { ...e, pieces: e.pieces.map((p) => ({ ...p, phase: "faite" as const, videoCle: "double.mp4" })) };
    expect(compositionDuDouble(fait)).toEqual({ pistesDouble: { "trois-quarts": "double.mp4" }, pistesDepuisLook: true });
    expect(compositionDuDouble({ ...fait, fond: "sans-fond" })).toEqual({ pistesDouble: { "trois-quarts": "double.mp4" } });
  });

  it("ROUGE — refusé AVANT toute dépense : décor pas encore validé ; second angle sans look", async () => {
    expect(refusDouble(await commande({ decor: "a_verifier" }), RECETTE_MONTAGE_AVOCAT, () => true, true)).toBe("Validez d'abord le décor « Bibliothèque » sur sa vignette (Bibliothèque, Décors).");
    expect(refusDouble(await commande({ deuxAngles: true }), RECETTE_MONTAGE_AVOCAT, () => true, true)).toMatch(/n'a pas de look HeyGen pour le second angle/);
    expect(refusDouble(await commande(), RECETTE_MONTAGE_AVOCAT, () => true, true)).toBeNull();
  });

  it("moteur réel : rendu HeyGen sur le look du décor (mp4, sans fond ajouté), composition opaque sans liseré, même tarif à la seconde", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, renduDoubleAutorise: true });
    const c = await commande();
    const sansDecor = await commande({ decor: "aucun" });
    // Prix annoncé : identique avec ou sans décor relié (même tarif HeyGen à la seconde).
    const lignesDouble = async (x: CommandeFabrication) => (await m.estimer(x)).lignes.filter((l) => l.etape.startsWith("Double") || l.fournisseur === "heygen").map((l) => [l.etape, l.quantite, l.total.centimes]);
    expect(await lignesDouble(c)).toEqual(await lignesDouble(sansDecor));
    const { travail, resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "trav-r2", versionId: "ver-r2", titre: "Décor HeyGen", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(rendusHeygen()).toHaveLength(1);
    const corps = rendusHeygen()[0].corps!;
    expect(corps).toMatchObject({ avatar_id: "look_bureau_halo_001", output_format: "mp4", engine: { type: "avatar_v" } });
    expect(corps).not.toHaveProperty("background");
    // F4 : gestes appris du look FILMÉ de Will (référence), consigne de gestes et de regard par défaut.
    // ESSAI RÉEL n° 2 : la référence est DANS engine (HeyGen refuse le premier niveau).
    expect(corps.engine).toEqual({ type: "avatar_v", reference_look_id: "look_tq" });
    expect(corps).not.toHaveProperty("reference_look_id");
    expect(String(corps.motion_prompt)).toMatch(/steady head.*small natural hand gestures below the chest/);
    const compo = rendu.recues.find((d) => d.operation === "composition")!;
    const image = (compo.parametres as { image: { doubles: { principal: { type: string; transparent?: boolean } }; contour?: unknown } }).image;
    expect(image.doubles.principal).toMatchObject({ type: "video", transparent: false });
    expect(image.contour).toBeUndefined();
    const lignes = resultat!.lignesReelles.filter((l) => l.etape.startsWith("Double"));
    expect(lignes).toEqual([expect.objectContaining({ fournisseur: "heygen", unite: "seconde", quantite: 12.48, nature: "reel" })]);
    expect((resultat!.projetMontage as { doubleDecorDuLook?: boolean }).doubleDecorDuLook).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* C — refaire le montage ne repaie pas l'avatar                         */
/* ------------------------------------------------------------------ */

describe("RÉEL 2 · C — refaire le montage (même texte, même voix) reprend le rendu du double déjà payé", () => {
  it("2e fabrication sur le même audio maître : aucun rendu HeyGen, ni ligne « Double » à l'estimation ni au coût réel", async () => {
    const { doubleDejaRenduDepuis } = await import("@/moteurs/montage-avocat/double");
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, renduDoubleAutorise: true });
    const c1 = await commande({ decor: "aucun" });
    const un = await jusquAuBout(m, c1, await m.lancer(c1, { travailId: "trav-1", versionId: "ver-1", titre: "Première", maintenant: T0 }));
    expect(un.travail.statut).toBe("termine");
    expect(rendusHeygen()).toHaveLength(1);
    const pisteDouble = (un.travail.parametres!.double as { pieces: { videoCle: string }[] }).pieces[0].videoCle;
    // Ce que le service transmet à la nouvelle fabrication : la voix déjà payée, puis le double rendu sur elle.
    const audio = (un.travail.parametres!.voix as { audio: { fichierCle: string; empreinte: string; mots: never[]; dureeSec: number } }).audio;
    const c2: CommandeFabrication = { ...c1, audioMaitre: { fichierCle: audio.fichierCle, empreinte: audio.empreinte, mots: audio.mots, dureeSec: audio.dureeSec } };
    c2.doubleDejaRendu = doubleDejaRenduDepuis([{ ...un.travail, statut: "termine" }], c2.audioMaitre);
    expect(c2.doubleDejaRendu?.pieces).toHaveLength(1);
    const etapes = (await m.estimer(c2)).lignes.map((l) => l.etape);
    expect(etapes).not.toContain("Double, angle principal");
    expect(etapes).not.toContain("Voix");
    expect((await m.estimer(c1)).lignes.map((l) => l.etape)).toContain("Double, angle principal");
    heygen.requetes = [];
    const deux = await jusquAuBout(m, c2, await m.lancer(c2, { travailId: "trav-2", versionId: "ver-2", titre: "Refait", maintenant: T0 }));
    expect(deux.travail.statut).toBe("termine");
    expect(rendusHeygen()).toEqual([]);
    expect(deux.resultat!.lignesReelles.filter((l) => l.etape.startsWith("Double"))).toEqual([]);
    const compo = rendu.recues.filter((d) => d.operation === "composition").at(-1)!;
    expect(Object.values(compo.entrees)).toEqual(expect.arrayContaining([expect.stringContaining(pisteDouble)]));
  });

  it("ROUGE — fond, look ou son différents : le rendu n'est PAS repris (il serait faux)", async () => {
    const { renduReutilisable } = await import("@/moteurs/montage-avocat/double");
    const deja = { empreinteAudio: "e", audioCle: "audio.wav", fournisseur: "heygen", fond: "sans-fond" as const, lookIds: { "trois-quarts": "look_tq" }, pieces: [{ angle: "trois-quarts" as const, index: 0, tranche: false, debutSec: 0, finSec: 12, videoCle: "double.webm" }] };
    const p = { angle: "trois-quarts" as const, tranche: false, debutSec: 0, finSec: 12 };
    expect(renduReutilisable({ doubleDejaRendu: deja }, "audio.wav", "sans-fond", "look_tq", p)).toEqual({ videoCle: "double.webm" });
    expect(renduReutilisable({ doubleDejaRendu: deja }, "audio.wav", "uni", "look_tq", p)).toBeNull();
    expect(renduReutilisable({ doubleDejaRendu: deja }, "audio.wav", "sans-fond", "look_bureau_halo_001", p)).toBeNull();
    expect(renduReutilisable({ doubleDejaRendu: deja }, "autre.wav", "sans-fond", "look_tq", p)).toBeNull();
    expect(renduReutilisable({ doubleDejaRendu: deja }, "audio.wav", "sans-fond", "look_tq", { ...p, finSec: 13 })).toBeNull();
  });
});
