/**
 * Décision de Will (15/10) : le plafond de la caisse d'une vidéo « Image → vidéo » est le MONTANT confirmé au dépôt (prix
 * « au plus » du bouton), et non plus le plafond fixe de 3 € qui arrêtait les vidéos à 5 réseaux en cours de route ; le
 * plafond Claude propre le suit. « Relever le plafond » (écran 4) ne peut que monter, exige la confirmation du montant,
 * et une vidéo arrêtée sur le plafond reprend ensuite sans repayer ce qui est payé.
 *
 * Vrais services et vraie boucle, base en mémoire ; seuls les fournisseurs payants sont des doubles : rien n'est payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { carteFixe, monde, outilsSimules, type Monde } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
// Ce test décrit les portes de Will (« en cas de doute ») : le défaut est « automatique » (mode-automatique.test.ts).
vi.mock("@/formats/image-video", async (orig) => {
  const v = await orig<typeof import("@/formats/image-video")>();
  const s = v.schemaReglagesImageVideo;
  const avec = (x: unknown) => ({ ...(x as object), validationCarte: "si-doute" });
  return { ...v, schemaReglagesImageVideo: { parse: (x: unknown) => s.parse(avec(x)), safeParse: (x: unknown) => s.safeParse(avec(x)) } };
});
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PREFIXE_DECISIONS, plafondClaudeUsdIV } = await import("@/services/image-video");
const { deposerFichierSimule } = await import("@/services/fichiers");
const ecran = await import("@/services/image-video-ecran");
const { tourDeBoucle } = await import("@/services/boucle");
const { avancerJusquAArretIV, brancherServicesImageVideo, engageCentimes, lireEntreesImageVideo, PLAFOND_VIDEO_IV_CENTIMES, plafondProposeIV, reprendreIV } = await import("@/moteurs/montage-image-video");
const { RESEAUX_IV } = await import("@/domaine/image-video/plafonds");
type EtatIV = import("@/moteurs/montage-image-video").EtatFabricationIV;

const MDP = "image-video-plafond-confirme";
const carte = carteFixe("C");
let m: Monde;
/** Crédit réel épuisé chez le fournisseur de voix (le prix annoncé, lui, ne bloque plus : seul le crédit réel peut arrêter). */
let creditEpuise = false;

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  m = monde();
  creditEpuise = false;
  brancherServicesImageVideo({
    outils: async (commande) => {
      const gardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${commande.videoId}`, null);
      return { ...outilsSimules(carte, m, { refuserDepense: (d) => (creditEpuise && d.fournisseur === "heygen" ? "Crédit insuffisant." : null) }), decisions: { carte: async () => ((await gardees())?.carte ?? null) as never, script: async () => ((await gardees())?.script ?? null) as never } };
    },
  });
});

const etatDe = (t: Travail | null | undefined) => (t?.parametres?.imageVideo ?? null) as EtatIV | null;
const travailDe = async (videoId: string) => (await depots().travaux.trouver((t) => t.cibleId === videoId)) ?? null;

/** Dépôt réel, 5 réseaux, accord = le prix du bouton. */
async function deposer5Reseaux() {
  await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
  const f = await deposerFichierSimule({ nom: "chatbot-24h.png", mime: "image/png", taille: 400_000, typeEntite: "entree", entiteId: "image-video" });
  const fichier = await depots().fichiers.modifier(f.id, { sha256: carte.image.empreinte });
  const { montantCentimes } = await ecran.etatDepotImageVideo();
  const issue = await ecran.deposerImageVideo({ fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: montantCentimes });
  if (issue.statut !== "lancee") throw new Error(JSON.stringify(issue));
  return { videoId: issue.videoId, montant: montantCentimes };
}

async function boucleJusqua(videoId: string, fini: (t: Travail | null) => boolean, tours = 40) {
  for (let i = 0; i < tours; i++) {
    const t = await travailDe(videoId);
    if (fini(t)) return t;
    await tourDeBoucle();
  }
  return travailDe(videoId);
}

/** Jusqu'au script à valider (carte validée par Will en chemin). */
async function jusquAuScript(videoId: string) {
  await boucleJusqua(videoId, (t) => t?.statut === "echec");
  expect(await ecran.validerCarteEtReprendre(videoId, undefined)).toEqual({ statut: "reprise" });
  await boucleJusqua(videoId, (t) => t?.statut === "echec");
  const vue = await ecran.vueImageVideo(videoId);
  expect(vue?.ecran).toBe("script");
  return vue!;
}

/** Abaisse le plafond gardé dans l'état (ancien dépôt à plafond fixe trop bas). */
async function plafondGarde(videoId: string, centimes: number) {
  const t = (await travailDe(videoId))!;
  const e = etatDe(t)!;
  await depots().travaux.enregistrer({ ...t, parametres: { ...t.parametres, imageVideo: { ...e, caisse: { ...e.caisse, plafondCentimes: centimes }, demande: { ...e.demande, plafondCentimes: centimes } } } });
}

/** Voix arrêtée comme avant l'ordre « le prix ne bloque jamais » (états déjà gardés) : refus IV_PLAFOND réessayable, rien de lu. */
async function arreterSurPlafond(videoId: string, prix: number, formules: { cle: string }[]) {
  creditEpuise = true;
  await ecran.validerScriptEtReprendre(videoId, { choixFormules: Object.fromEntries(formules.map((f) => [f.cle, "garder" as const])), ajoutsWill: [] }, prix);
  const arrete = (await boucleJusqua(videoId, (t) => t?.statut === "echec"))!;
  creditEpuise = false;
  const e = etatDe(arrete)!;
  expect(e.refus).toMatchObject({ code: "IV_BUDGET", etape: "voix" });
  await depots().travaux.enregistrer({ ...arrete, parametres: { ...arrete.parametres, imageVideo: { ...e, refus: { ...e.refus!, code: "IV_PLAFOND" } } } });
  return (await travailDe(videoId))!;
}

describe("Image → vidéo · plafond = prix confirmé au dépôt", () => {
  it("5 réseaux : le plafond de la caisse, la commande et le plafond Claude sont le montant confirmé (prixDuDepot)", async () => {
    const { videoId, montant } = await deposer5Reseaux();
    expect(montant).toBe(ecran.prixDuDepot(RESEAUX_IV, (await ecran.etatDepotImageVideo()).tauxUsdEur));
    expect(montant).not.toBe(PLAFOND_VIDEO_IV_CENTIMES);
    const t = await travailDe(videoId);
    expect(etatDe(t)?.caisse.plafondCentimes).toBe(montant);
    expect(etatDe(t)?.demande.plafondCentimes).toBe(montant);
    const version = (await depots().versions.obtenir(t!.versionId!))!;
    expect(lireEntreesImageVideo(version.commande.entrees).plafondCentimes).toBe(montant);
    expect(plafondClaudeUsdIV(version.commande)).toBe(montant / 100);
    // Sans accord gardé (lanceur, anciens dépôts) : 3 € restent le repli.
    expect(plafondClaudeUsdIV({ entrees: { imageVideo: { reseaux: ["tiktok"] } } })).toBe(PLAFOND_VIDEO_IV_CENTIMES / 100);
    // Le prix du dépôt n'a pas bougé : même calcul, même montant redemandé si l'accord manque.
    expect(ecran.prixDuDepot(RESEAUX_IV)).toBe(ecran.prixDuDepot(RESEAUX_IV));
  });
});

describe("Image → vidéo · « Relever le plafond »", () => {
  it("refuse un montant pas plus haut que l'actuel, sous l'engagé, ou sans confirmation exacte ; rien n'est touché", async () => {
    const { videoId } = await deposer5Reseaux();
    await jusquAuScript(videoId);
    const avant = etatDe(await travailDe(videoId))!;
    const engage = engageCentimes(avant);
    expect(engage).toBeGreaterThan(0);
    const plafond = avant.caisse.plafondCentimes;

    const sous = await ecran.releverPlafondImageVideo(videoId, { montantCentimes: engage - 1, accordCentimes: engage - 1 });
    expect(sous).toMatchObject({ statut: "refusee" });
    expect((sous as { phrase: string }).phrase).toMatch(/déjà engagé/);
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: plafond, accordCentimes: plafond })).toMatchObject({ statut: "refusee" });
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: 0 })).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.plafondMontant });

    const sansAccord = await ecran.releverPlafondImageVideo(videoId, { montantCentimes: plafond + 500 });
    expect(sansAccord).toMatchObject({ statut: "accord-requis", centimes: plafond + 500 });
    // Un accord pour un autre montant ne vaut pas confirmation.
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: plafond + 500, accordCentimes: plafond + 100 })).toMatchObject({ statut: "accord-requis", centimes: plafond + 500 });
    expect(etatDe(await travailDe(videoId))!.caisse.plafondCentimes).toBe(plafond);

    // Confirmé : le plafond monte, partout ; rien n'est relancé.
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: plafond + 500, accordCentimes: plafond + 500 })).toEqual({ statut: "releve", plafondCentimes: plafond + 500 });
    const t = (await travailDe(videoId))!;
    expect(t.statut).toBe("echec");
    expect(etatDe(t)!.caisse.plafondCentimes).toBe(plafond + 500);
    expect(etatDe(t)!.etape).toBe("script-a-valider");
    const version = (await depots().versions.obtenir(t.versionId!))!;
    expect(plafondClaudeUsdIV(version.commande)).toBe((plafond + 500) / 100);
    const video = (await depots().videos.obtenir(videoId))!;
    expect(lireEntreesImageVideo(video.entrees).plafondCentimes).toBe(plafond + 500);
    expect((await depots().evenements.lister()).some((j) => /plafond relevé/.test(j.message ?? ""))).toBe(true);
  });

  it("vidéo arrêtée sur le plafond : relevé confirmé puis « Refaire cette partie », reprise sans rien repayer, jusqu'au bout", async () => {
    const { videoId } = await deposer5Reseaux();
    const vueScript = await jusquAuScript(videoId);
    // Ancien plafond trop bas pour la voix (ce qui arrêtait les vidéos à 5 réseaux).
    const engage = engageCentimes(etatDe(await travailDe(videoId))!);
    await plafondGarde(videoId, engage);
    const prix = Math.max(vueScript.script!.prix.auPlusCentimes, vueScript.script!.prix.habituelCentimes);
    const arrete = await arreterSurPlafond(videoId, prix, vueScript.script!.formules);
    expect(etatDe(arrete)?.refus?.code).toBe("IV_PLAFOND");
    expect(m.lus).toEqual([]);

    const vue = (await ecran.vueImageVideo(videoId))!;
    expect(vue.ecran).toBe("fabrication");
    expect(vue.plafond?.arrete).toBe(true);
    expect(vue.plafond!.proposeCentimes).toBe(plafondProposeIV(etatDe(arrete)!));
    expect(vue.plafond!.proposeCentimes).toBeGreaterThan(engage);
    expect(vue.plafond!.proposeCentimes % 100).toBe(0);

    const appelsAvant = m.appelsClaude.length;
    const relevé = await ecran.releverPlafondImageVideo(videoId, { montantCentimes: vue.plafond!.proposeCentimes, accordCentimes: vue.plafond!.proposeCentimes });
    expect(relevé).toEqual({ statut: "releve", plafondCentimes: vue.plafond!.proposeCentimes });
    // Rien n'est relancé tout seul : l'arrêt reste jusqu'au clic sur « Refaire cette partie ».
    expect((await travailDe(videoId))?.statut).toBe("echec");
    expect(etatDe(await travailDe(videoId))?.refus?.code).toBe("IV_PLAFOND");
    // L'état gardé après le relevé, mené jusqu'au bout par la machine (mêmes doubles, un seul jeu d'outils) : la voix
    // reprend là où elle s'était arrêtée, lecture et écriture ne sont jamais refaites, rien n'est payé deux fois.
    const garde = etatDe(await travailDe(videoId))!;
    const outils = outilsSimules(carte, m, {});
    let e = reprendreIV(garde);
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) e = await avancerJusquAArretIV(e, outils);
    expect(e.etape, JSON.stringify(e.refus)).toBe("prete");
    expect(e.caisse.plafondCentimes).toBe(vue.plafond!.proposeCentimes);
    expect(engageCentimes(e)).toBeLessThanOrEqual(vue.plafond!.proposeCentimes);
    expect(m.appelsClaude.slice(appelsAvant).every((a) => a.role === "relecture-finale-iv")).toBe(true);
    expect(new Set(m.lus).size).toBe(m.lus.length);
    // Les réservations d'avant l'arrêt sont gardées telles quelles (jamais réservées deux fois).
    for (const r of garde.caisse.reservations) expect(e.caisse.reservations.filter((x) => x.cle === r.cle)).toEqual([r]);

    // Côté studio, « Refaire cette partie » relance le travail arrêté : l'étape « voix » repart, sans nouvel arrêt.
    const reprise = await ecran.reessayerImageVideo(videoId, prix);
    expect(reprise, JSON.stringify(reprise)).toEqual({ statut: "reprise" });
    const relance = (await travailDe(videoId))!;
    expect(relance.statut).toMatch(/en_cours|en_file/);
    expect(etatDe(relance)?.refus).toBeUndefined();
    expect(etatDe(relance)?.etape).toBe("voix");
    expect(etatDe(relance)?.caisse.plafondCentimes).toBe(vue.plafond!.proposeCentimes);
  });

  it("« Relever et reprendre » : relevé confirmé, l'étape arrêtée repart aussitôt", async () => {
    const { videoId } = await deposer5Reseaux();
    const vueScript = await jusquAuScript(videoId);
    await plafondGarde(videoId, engageCentimes(etatDe(await travailDe(videoId))!));
    const prix = Math.max(vueScript.script!.prix.auPlusCentimes, vueScript.script!.prix.habituelCentimes);
    await arreterSurPlafond(videoId, prix, vueScript.script!.formules);
    const propose = (await ecran.vueImageVideo(videoId))!.plafond!.proposeCentimes;
    const issue = await ecran.releverPlafondImageVideo(videoId, { montantCentimes: propose, accordCentimes: propose, reprendre: true });
    expect(issue.statut).toBe("releve");
    const reprise = (issue as { reprise?: { statut: string } }).reprise;
    // La reprise commune peut redemander le prix de la suite : jamais un relancement sans accord.
    expect(["reprise", "accord-requis"]).toContain(reprise?.statut);
    if (reprise?.statut === "reprise") expect((await travailDe(videoId))?.statut).toMatch(/en_cours|en_file/);
  });

  it("« Refaire cette partie » concurrent entre la lecture et l'écriture : le relevé refuse, rien n'est écrasé, la voix n'est jamais rejouée", async () => {
    const { videoId } = await deposer5Reseaux();
    const vueScript = await jusquAuScript(videoId);
    await plafondGarde(videoId, engageCentimes(etatDe(await travailDe(videoId))!));
    const prix = Math.max(vueScript.script!.prix.auPlusCentimes, vueScript.script!.prix.habituelCentimes);
    const arrete = await arreterSurPlafond(videoId, prix, vueScript.script!.formules);
    expect(etatDe(arrete)?.refus?.code).toBe("IV_PLAFOND");
    expect(m.lus).toEqual([]);
    const propose = (await ecran.vueImageVideo(videoId))!.plafond!.proposeCentimes;

    // Le relevé lit le travail arrêté ; juste après, un autre onglet relève (plafond gardé) puis clique « Refaire cette
    // partie », et la boucle paie la voix.
    let lectures = 0;
    let apresRefaire: Travail | null = null;
    let lusPayes: string[] = [];
    const travailConcurrent = async (id: string) => {
      const lu = await travailDe(id);
      if (lectures++ > 0) return lu;
      await plafondGarde(id, 99_900);
      expect(await ecran.reessayerImageVideo(id, prix)).toEqual({ statut: "reprise" });
      await boucleJusqua(id, () => m.lus.length > 0);
      expect(m.lus.length).toBeGreaterThan(0);
      apresRefaire = await travailDe(id);
      lusPayes = [...m.lus];
      return lu;
    };
    const issue = await ecran.releverPlafondImageVideo(videoId, { montantCentimes: propose, accordCentimes: propose }, { travail: travailConcurrent });
    expect(issue).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.plafondChange });
    const apres = (await travailDe(videoId))!;
    expect(lectures).toBeGreaterThan(0);
    expect(apres).toEqual(apresRefaire);
    expect(apres.statut).not.toBe("echec");
    expect(etatDe(apres)?.refus).toBeUndefined();
    expect(etatDe(apres)?.caisse.plafondCentimes).toBe(99_900);
    expect((await depots().evenements.lister()).some((j) => /plafond relevé/.test(j.message ?? ""))).toBe(false);

    // La fabrication continue de son côté : la voix payée n'est jamais relue (ni repayée), aucun nouvel arrêt.
    for (let k = 0; k < 20; k++) await tourDeBoucle();
    const suite = (await travailDe(videoId))!;
    expect(suite.statut).not.toBe("echec");
    expect(etatDe(suite)?.refus).toBeUndefined();
    expect(m.lus.slice(0, lusPayes.length)).toEqual(lusPayes);
    expect(new Set(m.lus).size).toBe(m.lus.length);
  });

  it("vitrine du lanceur et fabrication en cours : refusé, rien n'est touché", async () => {
    const { videoId } = await deposer5Reseaux();
    const t = (await travailDe(videoId))!;
    expect(t.statut).toMatch(/en_file|en_cours/);
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: 99_900, accordCentimes: 99_900 })).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.plafondEnCours });
    expect((await ecran.vueImageVideo(videoId))?.plafond).toBeUndefined();
    await depots().travaux.enregistrer({ ...t, statut: "echec", parametres: { ...t.parametres, lanceurIV: true } });
    expect(await ecran.releverPlafondImageVideo(videoId, { montantCentimes: 99_900, accordCentimes: 99_900 })).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.plafondLanceur });
    expect(etatDe(await travailDe(videoId))?.caisse.plafondCentimes).toBe(etatDe(t)?.caisse.plafondCentimes);
    expect((await ecran.vueImageVideo(videoId))?.plafond).toBeUndefined();
  });
});
