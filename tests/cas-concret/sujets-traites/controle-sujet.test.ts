/**
 * LOT L3 · SUJET DÉJÀ TRAITÉ DANS LE CAS CONCRET (le doublon mesuré en prod : deux vidéos de `recrutement-apporteurs`,
 * même script rejoué). Le contrôle `verifierSujet` joue dans `preparerEtLancer`, AVANT toute création et tout prix, et
 * `estimerCas` annonce `dejaTraite` à la fiche de prix. « Nouvel angle » = l'option existante « Nouveau script ».
 * Base en mémoire, lancement simulé : aucun appel réseau, rien de payé.
 * Depuis le 23/10/2026, une vidéo PRÊTE rend le cas indisponible (refus net, voir `cas-traites.test.ts`) : le contrôle à trois
 * choix ne joue donc plus que pour une vidéo comptée mais pas finie (ici « en fabrication »), ou en pause.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo dans ces tests.
vi.mock("@/donnees/bases-usine", () => ({ metiers: () => [], casUsage: () => [] }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const scripts = await import("@/services/cas-concret-scripts");
const service = await import("@/services/cas-concret");
const { ecrireParametre } = await import("@/services/_commun");
await import("@/services/videos");
const { SCRIPT_V4_RECRUTEMENT } = await import("@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs");
const { choixApresEstimation, choixApresInterrupteur, nouveauScriptPourEstimation, peutFabriquer, sujetAEnvoyer } = await import("../../../src/components/formats/cas-concret/entree/sujet-deja-traite");

import type { Video } from "@/domaine/types";

const MDP = "cas-sujets-traites";
const CAS = "recrutement-apporteurs";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());
beforeEach(() => lancer.mockClear());

const RELU = scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT);
let n = 0;
const lancer = vi.fn(async () => ({ travailId: `t-sj-${++n}` }));
const demande = (o: Partial<Parameters<typeof service.preparerEtLancer>[0]> = {}) => ({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, empreinteScriptRelu: RELU, ...o });

function video(id: string, extra: Partial<Video> = {}): Video {
  const maintenant = new Date().toISOString();
  return { id, titre: "Recruter des apporteurs", sujet: "x", formatId: "cas-concret", statut: "en_fabrication", entrees: { casConcret: { casId: CAS } }, creeLe: maintenant, modifieLe: maintenant, ...extra } as unknown as Video;
}
const nombre = (c: "videos" | "depenses" | "travaux") => depots()[c].compter();
const entreesCas = async (videoId: string): Promise<Record<string, unknown>> => ((await depots().videos.obtenir(videoId))!.entrees as { casConcret: Record<string, unknown> }).casConcret;

describe("nouvelle vidéo d'un cas déjà traité : refus avant tout", () => {
  it("rien créé, rien payé, aucun lancement ; précédents avec lien, niveau « identique », trois suggestions au plus, jeton", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = { videos: await nombre("videos"), depenses: await nombre("depenses"), travaux: await nombre("travaux") };
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.niveau).toBe("identique");
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
    expect(r.precedents[0]!.lien).toBe("/videos/v-prete");
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(r.suggestions.every((s) => s.casId !== CAS)).toBe(true);
    expect({ videos: await nombre("videos"), depenses: await nombre("depenses"), travaux: await nombre("travaux") }).toEqual(avant);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("l'estimation annonce `dejaTraite` pour la fiche de prix ; rien si le cas est libre", async () => {
    expect((await service.estimerCas(CAS, RESEAUX, false)).dejaTraite).toBeUndefined();
    await depots().videos.enregistrer(video("v-prete"));
    const e = await service.estimerCas(CAS, RESEAUX, false);
    expect(e.dejaTraite).toMatchObject({ niveau: "identique", precedents: [{ videoId: "v-prete" }] });
    // Une confirmation valable fait disparaître l'annonce.
    const ok = await service.estimerCas(CAS, RESEAUX, false, { sujet: { choix: "refaire", jeton: e.dejaTraite!.jeton } });
    expect(ok.dejaTraite).toBeUndefined();
  });
});

describe("les trois choix", () => {
  it("« Refaire quand même » avec le bon jeton : la vidéo part, le script validé est rejoué (repère relu gardé)", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await service.preparerEtLancer(demande(), { lancer });
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const r = await service.preparerEtLancer(demande({ sujet: { choix: "refaire", jeton: refus.jeton } }), { lancer });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const e = await entreesCas(r.videoId);
    expect(e.scriptRelu).toBe(RELU);
    expect("nouveauScript" in e).toBe(false);
  });

  it("« Nouvel angle » : un nouveau script est forcé (option « Nouveau script »), aucun repère relu exigé, ancien script intact", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await service.preparerEtLancer(demande({ empreinteScriptRelu: undefined }), { lancer });
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const r = await service.preparerEtLancer(demande({ empreinteScriptRelu: undefined, sujet: { choix: "nouvel-angle", jeton: refus.jeton } }), { lancer });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const e = await entreesCas(r.videoId);
    expect(e.nouveauScript).toBe(1);
    expect("scriptRelu" in e).toBe(false);
    expect(await scripts.scriptValideDuStudio(CAS)).toEqual(SCRIPT_V4_RECRUTEMENT);
    expect(await scripts.historiqueScriptsValides(CAS)).toEqual([]);
  });

  it("« Nouvel angle » coûte l'écriture : l'accord du script rejoué ne suffit pas, le prix est redemandé", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await service.preparerEtLancer(demande(), { lancer });
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const rejoue = await service.estimerCas(CAS, RESEAUX, false);
    const r = await service.preparerEtLancer(demande({ accordCentimes: rejoue.centimes, sujet: { choix: "nouvel-angle", jeton: refus.jeton } }), { lancer });
    expect(r.statut).toBe("accord-requis");
    if (r.statut === "accord-requis") expect(r.centimes).toBeGreaterThan(rejoue.centimes);
  });

  it("jeton périmé : refus de nouveau (jetonPerime), rien d'enregistré", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await service.preparerEtLancer(demande(), { lancer });
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    await depots().videos.enregistrer(video("v-autre"));
    const avant = await nombre("videos");
    const r = await service.preparerEtLancer(demande({ sujet: { choix: "refaire", jeton: refus.jeton } }), { lancer });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.jetonPerime).toBe(true);
    expect(await nombre("videos")).toBe(avant);
  });

  it("une confirmation donnée pour un autre cas ne vaut pas ici", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await service.preparerEtLancer(demande(), { lancer });
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const r = await service.preparerEtLancer({ casId: "rappels-rendez-vous", reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, essai: true, sujet: { choix: "refaire", jeton: refus.jeton } }, { lancer });
    expect(r.statut).not.toBe("sujet-deja-traite");
  });
});

describe("pas de contrôle quand ce n'est pas une nouvelle vidéo comptée", () => {
  it("échec puis nouvel essai : libre", async () => {
    await depots().videos.enregistrer(video("v-echec", { statut: "echec" }));
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("brouillon du même cas repris : libre (le brouillon ne prend pas le sujet)", async () => {
    await depots().videos.enregistrer(video("v-brouillon", { statut: "brouillon" }));
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r.statut).toBe("lancee");
    if (r.statut === "lancee") expect(r.videoId).toBe("v-brouillon");
  });

  const travailDe = (videoId: string, code: string) =>
    depots().travaux.enregistrer({ id: `t-${videoId}`, type: "fabrication", cibleId: videoId, titre: videoId, statut: "echec", etapes: [], progression: 0, tentatives: 1, cleIdempotence: videoId, fournisseurUtilise: "x", erreur: { code, reessayable: false, messagePourWill: "x" }, creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() } as never);

  it("« Faire réécrire » : la vidéo du même cas en pause (script à valider) ne bloque pas son propre cas, ni l'estimation", async () => {
    await depots().videos.enregistrer(video("v-pause", { statut: "echec" }));
    await travailDe("v-pause", "CAS_CONCRET_SCRIPT_A_VALIDER");
    expect((await service.estimerCas(CAS, RESEAUX, false)).dejaTraite).toBeUndefined();
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("pause du MÊME cas + vidéo prête du même cas : le cas reste pris (seule la pause est libérée)", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    await depots().videos.enregistrer(video("v-pause", { statut: "echec" }));
    await travailDe("v-pause", "CAS_CONCRET_SCRIPT_A_VALIDER");
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("sujet-deja-traite");
  });

  it("brouillon repris ET pause du même cas : les deux sont écartés, « Faire réécrire » part", async () => {
    await depots().videos.enregistrer(video("v-brouillon", { statut: "brouillon" }));
    await depots().videos.enregistrer(video("v-pause", { statut: "echec" }));
    await travailDe("v-pause", "CAS_CONCRET_SCRIPT_A_VALIDER");
    expect((await service.estimerCas(CAS, RESEAUX, false)).dejaTraite).toBeUndefined();
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("DEUX pauses du même cas : les deux sont écartées", async () => {
    for (const id of ["v-pause-1", "v-pause-2"]) {
      await depots().videos.enregistrer(video(id, { statut: "echec" }));
      await travailDe(id, "CAS_CONCRET_SCRIPT_A_VALIDER");
    }
    expect((await service.estimerCas(CAS, RESEAUX, false)).dejaTraite).toBeUndefined();
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("deux pauses + une vidéo prête du même cas : le cas reste pris", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    for (const id of ["v-pause-1", "v-pause-2"]) {
      await depots().videos.enregistrer(video(id, { statut: "echec" }));
      await travailDe(id, "CAS_CONCRET_SCRIPT_A_VALIDER");
    }
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("sujet-deja-traite");
  });

  it("une vraie panne (ancienne pause suivie d'un travail en échec d'un autre code) n'entre PAS dans la liste ignorée : la vidéo prête garde le cas", async () => {
    const sujets = await import("@/services/sujets-traites");
    const espion = vi.spyOn(sujets, "verifierSujet");
    await depots().videos.enregistrer(video("v-prete"));
    await depots().videos.enregistrer(video("v-panne", { statut: "echec" }));
    await depots().videos.enregistrer(video("v-pause", { statut: "echec" }));
    await travailDe("v-pause", "CAS_CONCRET_SCRIPT_A_VALIDER");
    // v-panne : ancienne pause, puis une vraie panne plus récente.
    const t = (id: string, code: string, creeLe: string) => depots().travaux.enregistrer({ id, type: "fabrication", cibleId: "v-panne", titre: id, statut: "echec", etapes: [], progression: 0, tentatives: 1, cleIdempotence: id, fournisseurUtilise: "x", erreur: { code, reessayable: false, messagePourWill: "x" }, creeLe, modifieLe: creeLe } as never);
    await t("t-panne-ancien", "CAS_CONCRET_SCRIPT_A_VALIDER", "2026-10-01T10:00:00.000Z");
    await t("t-panne-recent", "AUTRE_PANNE", "2026-10-02T10:00:00.000Z");
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("sujet-deja-traite");
    const ignores = espion.mock.calls.flatMap((c) => c[0].ignorerVideoIds ?? []);
    expect(ignores).toContain("v-pause");
    expect(ignores).not.toContain("v-panne");
    expect(ignores).not.toContain("v-prete");
  });

  it("pause d'un AUTRE cas seule : ce cas est libre", async () => {
    await depots().videos.enregistrer(video("v-autre", { statut: "echec", entrees: { casConcret: { casId: "autre-cas" } } } as never));
    await travailDe("v-autre", "CAS_CONCRET_SCRIPT_A_VALIDER");
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("pause du même cas mise à la corbeille : elle ne bloque pas non plus son cas", async () => {
    await depots().videos.enregistrer(video("v-pause", { statut: "archivee", statutAvantArchive: "echec" } as never));
    await travailDe("v-pause", "CAS_CONCRET_SCRIPT_A_VALIDER");
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("vidéo de démonstration : ignorée", async () => {
    await depots().videos.enregistrer(video("v-demo", { estDemo: true }));
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });

  it("« Nouveau script » ne contourne PAS le contrôle : sans confirmation, refus ; avec « nouvel angle » et le jeton, la vidéo part et c'est journalisé", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = await nombre("travaux");
    const refus = await service.preparerEtLancer(demande({ nouveauScript: true, empreinteScriptRelu: undefined }), { lancer });
    expect(refus.statut).toBe("sujet-deja-traite");
    expect(await nombre("travaux")).toBe(avant);
    if (refus.statut !== "sujet-deja-traite") return;
    const r = await service.preparerEtLancer(demande({ nouveauScript: true, empreinteScriptRelu: undefined, sujet: { choix: "nouvel-angle", jeton: refus.jeton } }), { lancer });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    expect((await entreesCas(r.videoId)).nouveauScript).toBe(1);
    const journal = await depots().evenements.lister((e) => e.entiteId === r.videoId);
    expect(journal.some((e) => /choix « nouvel-angle »/.test(e.message))).toBe(true);
  });

  it("l'estimation avec « Nouveau script » annonce aussi le cas déjà traité", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    expect((await service.estimerCas(CAS, RESEAUX, false, { nouveauScript: true })).dejaTraite).toMatchObject({ niveau: "identique" });
  });
});

describe("réglage sujets.garde", () => {
  it("« eteint » : comme avant, mêmes entrées de vidéo avec ou sans vidéo comptée", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    const sans = await service.preparerEtLancer(demande(), { lancer });
    if (sans.statut !== "lancee") throw new Error(JSON.stringify(sans));
    const clesSans = Object.keys(await entreesCas(sans.videoId)).sort();
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
    await ecrireParametre("sujets.garde", "eteint");
    await d.videos.enregistrer(video("v-prete"));
    const avec = await service.preparerEtLancer(demande(), { lancer });
    expect(avec.statut).toBe("lancee");
    if (avec.statut === "lancee") expect(Object.keys(await entreesCas(avec.videoId)).sort()).toEqual(clesSans);
    expect((await service.estimerCas(CAS, RESEAUX, false)).dejaTraite).toBeUndefined();
  });

  it("« avertissement » : ne bloque pas", async () => {
    await ecrireParametre("sujets.garde", "avertissement");
    await depots().videos.enregistrer(video("v-prete"));
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
  });
});

describe("double clic", () => {
  it("deux lancements en même temps : un seul part, l'autre est refusé comme sujet déjà traité", async () => {
    const lancerEnFile = vi.fn(async (videoId: string) => {
      await depots().videos.modifier(videoId, { statut: "en_file" });
      return { travailId: `t-dc-${++n}` };
    });
    const dep = { lancer: ((id: string) => lancerEnFile(id)) as never };
    const [a, b] = await Promise.all([service.preparerEtLancer(demande(), dep), service.preparerEtLancer(demande(), dep)]);
    expect([a.statut, b.statut].sort()).toEqual(["lancee", "sujet-deja-traite"]);
    expect(lancerEnFile).toHaveBeenCalledTimes(1);
  });
});

describe("ordre de l'écran (fonctions pures)", () => {
  const dejaTraite = { niveau: "identique" as const, precedents: [], suggestions: [], jeton: "abcd", phrase: "x" };

  it("le bouton principal reste bloqué tant que les trois choix ne sont pas faits", () => {
    expect(peutFabriquer(undefined, undefined)).toBe(true);
    expect(peutFabriquer(dejaTraite, undefined)).toBe(false);
    expect(peutFabriquer(dejaTraite, { choix: "refaire", jeton: "abcd" })).toBe(true);
  });

  it("« Nouvel angle » allume le nouveau script pour le prix ; sinon l'interrupteur de Will décide", () => {
    expect(nouveauScriptPourEstimation(false, { choix: "nouvel-angle", jeton: "abcd" })).toBe(true);
    expect(nouveauScriptPourEstimation(false, { choix: "refaire", jeton: "abcd" })).toBe(false);
    expect(nouveauScriptPourEstimation(true, undefined)).toBe(true);
  });

  it("le choix tombe si l'estimation annonce encore (ou de nouveau) un sujet déjà traité : jeton périmé, prix redemandé", () => {
    const choix = { choix: "refaire" as const, jeton: "abcd" };
    expect(choixApresEstimation(choix, undefined)).toEqual(choix);
    expect(choixApresEstimation(choix, dejaTraite)).toBeUndefined();
    expect(choixApresEstimation(undefined, undefined)).toBeUndefined();
  });

  it("la confirmation envoyée au serveur est exactement le choix et le jeton", () => {
    expect(sujetAEnvoyer({ choix: "nouvel-angle", jeton: "abcd" })).toEqual({ choix: "nouvel-angle", jeton: "abcd" });
    expect(sujetAEnvoyer(undefined)).toBeUndefined();
  });

  it("l'interrupteur « Nouveau script » et « Nouvel angle » sont synchronisés", () => {
    expect(choixApresInterrupteur(true, undefined, dejaTraite)).toEqual({ choix: "nouvel-angle", jeton: "abcd" });
    expect(choixApresInterrupteur(true, undefined, undefined)).toBeUndefined();
    expect(choixApresInterrupteur(true, { choix: "refaire", jeton: "abcd" }, dejaTraite)).toEqual({ choix: "refaire", jeton: "abcd" });
    expect(choixApresInterrupteur(false, { choix: "nouvel-angle", jeton: "abcd" }, dejaTraite)).toBeUndefined();
    expect(choixApresInterrupteur(false, { choix: "refaire", jeton: "abcd" }, dejaTraite)).toEqual({ choix: "refaire", jeton: "abcd" });
  });
});
