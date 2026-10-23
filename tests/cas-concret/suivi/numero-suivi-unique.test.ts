/**
 * PR-A « Lien suivi : numéro unique pour tout le studio » : le code du lien suivi (« 0001-CC-IG ») ne vient plus de
 * `version.numero` (qui repart de 1 pour chaque vidéo : toutes les V1 d'un format partageaient le même lien) mais de
 * `version.numeroSuivi`, unique dans tout le studio. `numero` (affiché « V{n} ») ne change pas. Aucun appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { VersionVideo } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");
const recalque = await import("@/services/recalque");
const videos = await import("@/services/videos");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { codeVersionCasConcret } = await import("@/moteurs/montage-cas-concret/fins");

const MDP = "numero-suivi-unique";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
  await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

let compteur = 0;
/** Une version de plus dans le double (modèle : une version du seed, renumérotée). */
async function ajouterVersion(videoId: string, numero: number, extra: Partial<VersionVideo> = {}) {
  const base = (await depots().versions.lister(() => true))[0]!;
  const v = { ...base, id: `ver-ns-${++compteur}`, videoId, numero, statut: "prete", ...extra } as VersionVideo;
  delete (v as { numeroSuivi?: number }).numeroSuivi;
  Object.assign(v, extra);
  await depots().versions.enregistrer(v);
  return v;
}

/** Réserve un numéro et l'écrit sur une version neuve de la vidéo, comme `creerFabrication` ; renvoie aussi l'id de la version. */
async function fabriquerVersion(videoId: string, estDemo = false) {
  let numeroSuivi = 0;
  let id = "";
  await fabrication.attribuerNumeroSuivi(estDemo, async (n) => {
    numeroSuivi = n;
    id = (await ajouterVersion(videoId, 1, { numeroSuivi: n })).id;
  });
  return { numeroSuivi, id };
}
async function fabriquer(videoId: string, estDemo = false) {
  return (await fabriquerVersion(videoId, estDemo)).numeroSuivi;
}

describe("numéro du lien suivi", () => {
  it("prochainNumero : plus haut numéro + 1 (1, 3, 4 → 5), pas le nombre de versions", async () => {
    for (const n of [1, 3, 4]) await ajouterVersion("v-ns-a", n);
    await ajouterVersion("v-ns-a", 0, { statut: "maquette" });
    expect(await fabrication.prochainNumero("v-ns-a")).toBe(5);
  });

  it("deux vidéos → deux numeroSuivi différents, donc deux utm_campaign différents", async () => {
    const a = await fabriquer("v-ns-1");
    const b = await fabriquer("v-ns-2");
    expect(a).not.toBe(b);
    expect(codeVersionCasConcret(a, "instagram")).not.toBe(codeVersionCasConcret(b, "instagram"));
  });

  it("le premier numéro est au-dessus de tout ancien numero : une version de numero 4000 → exactement 4001", async () => {
    await ajouterVersion("v-ns-3", 4000);
    expect(await fabriquer("v-ns-4")).toBe(4001);
  });

  it("2 × 10 attributions simultanées : 20 numéros distincts, et 20 numeroSuivi distincts dans les versions écrites", async () => {
    const numeros = await Promise.all(Array.from({ length: 20 }, (_, i) => fabriquer(`v-ns-c${i}`)));
    expect(new Set(numeros).size).toBe(20);
    const ecrites = (await depots().versions.lister((v) => v.videoId.startsWith("v-ns-c"))).map((v) => v.numeroSuivi);
    expect(ecrites).toHaveLength(20);
    expect(new Set(ecrites).size).toBe(20);
  });

  it("une version supprimée définitivement ne rend pas son numéro : le suivant vaut n + 1", async () => {
    const { numeroSuivi: n, id } = await fabriquerVersion("v-ns-s1");
    await depots().versions.supprimer(id);
    expect(await fabriquer("v-ns-s2")).toBe(n + 1);
  });

  it("plage réelle épuisée (8999 pris) : NUMEROS_SUIVI_EPUISES, et rien n'est écrit", async () => {
    await ajouterVersion("v-ns-p1", 1, { numeroSuivi: 8999 });
    const enregistrer = vi.fn(async () => undefined);
    await expect(fabrication.attribuerNumeroSuivi(false, enregistrer)).rejects.toMatchObject({ code: "NUMEROS_SUIVI_EPUISES" });
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it("plage démonstration épuisée (9998 pris) : NUMEROS_SUIVI_EPUISES, et rien n'est écrit", async () => {
    await ajouterVersion("v-ns-p2", 1, { numeroSuivi: 9998 });
    const enregistrer = vi.fn(async () => undefined);
    await expect(fabrication.attribuerNumeroSuivi(true, enregistrer)).rejects.toMatchObject({ code: "NUMEROS_SUIVI_EPUISES" });
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it("démonstration ≥ 9000, réel < 9000", async () => {
    expect(await fabriquer("v-ns-d", true)).toBeGreaterThanOrEqual(9000);
    expect(await fabriquer("v-ns-r", false)).toBeLessThan(9000);
  });

  it("une erreur d'écriture ne bloque rien : l'attribution suivante réussit", async () => {
    await expect(fabrication.attribuerNumeroSuivi(false, async () => { throw new Error("écriture"); })).rejects.toThrow("écriture");
    expect(await fabriquer("v-ns-e")).toBeGreaterThan(0);
  });
});

describe("numeroVersion (lu par le moteur pour le lien)", () => {
  it("cas concret : numeroSuivi, ou numero à défaut (ancienne version : lien inchangé)", async () => {
    const { outilsCasConcret } = await import("@/services/cas-concret-branchements");
    const avec = await ajouterVersion("v-ns-5", 1, { numeroSuivi: 31 });
    const sans = await ajouterVersion("v-ns-6", 42);
    const voix = (await depots().voix.lister((x) => x.statut === "pret"))[0]!;
    const o = await outilsCasConcret({ videoId: "v-ns-5", formatId: "cas-concret", distribution: [{ voixId: voix.id }] } as never, "tr-ns", {});
    expect(await o.numeroVersion?.(avec.id)).toBe(31);
    expect(await o.numeroVersion?.(sans.id)).toBe(42);
  });

  it("image-vidéo : numeroSuivi, ou numero à défaut", async () => {
    await import("@/services/image-video");
    const { servicesImageVideo } = await import("@/moteurs/montage-image-video");
    const avec = await ajouterVersion("v-ns-7", 1, { numeroSuivi: 33 });
    const sans = await ajouterVersion("v-ns-8", 12);
    expect(await servicesImageVideo().numeroVersion?.(avec.id)).toBe(33);
    expect(await servicesImageVideo().numeroVersion?.(sans.id)).toBe(12);
  });
});

describe("par le vrai service (moteur d'essai)", () => {
  it("retouche : nouveau numeroSuivi (≠ parent), numero = parent + 1", async () => {
    const video = (await depots().videos.obtenir("v-03"))!;
    const parent = (await depots().versions.obtenir(video.versionChoisieId!))!;
    const plan = (await depots().plans.lister((p) => p.versionId === parent.id))[0]!;
    const { retoucheId } = await fabrication.lancerRetouche("v-03", [plan.id], "plus net", { confirme: true });
    expect(retoucheId).toBeTruthy();
    const fille = (await depots().versions.lister((v) => v.parentVersionId === parent.id))[0]!;
    expect(fille.numero).toBe(parent.numero + 1);
    expect(fille.numeroSuivi).toBeDefined();
    expect(fille.numeroSuivi).not.toBe(parent.numeroSuivi ?? parent.numero);
  });
});

describe("lancement par le vrai service (vidéo de démonstration v-04)", () => {
  it("la version créée porte un numeroSuivi entier ≥ 9000, différent de tout autre `numeroSuivi ?? numero`", async () => {
    const { versionId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const toutes = await depots().versions.lister();
    const version = toutes.find((v) => v.id === versionId)!;
    expect(Number.isInteger(version.numeroSuivi)).toBe(true);
    expect(version.numeroSuivi!).toBeGreaterThanOrEqual(9000);
    const autres = toutes.filter((v) => v.id !== versionId).map((v) => v.numeroSuivi ?? v.numero);
    expect(autres).not.toContain(version.numeroSuivi);
  });

  it("plage démonstration épuisée : NUMEROS_SUIVI_EPUISES, la réservation de crédits est LIBÉRÉE et rien n'est créé", async () => {
    await ajouterVersion("v-ns-x", 1, { numeroSuivi: 9998 });
    const avant = await depots().versions.compter();
    const orphelins = async () => {
      const ids = new Set((await depots().versions.lister()).map((v) => v.id));
      return (await depots().plans.lister((p) => p.id.startsWith("ver-") && !ids.has(p.versionId))).length;
    };
    const avantOrphelins = await orphelins();
    await expect(fabrication.lancerFabrication("v-04", { confirme: true })).rejects.toMatchObject({ code: "NUMEROS_SUIVI_EPUISES" });
    expect(await depots().reservations.lister((r) => r.statut === "active")).toEqual([]);
    expect(await depots().versions.compter()).toBe(avant);
    // Le numéro est réservé AVANT la copie des plans : aucun plan de version n'est resté sans version.
    expect(await orphelins()).toBe(avantOrphelins);
  });
});

describe("recalque des sous-titres (gratuit)", () => {
  it("la nouvelle version a `numero` = prochainNumero d'avant l'appel (max + 1, pas le nombre de versions + 1) et garde le numeroSuivi du parent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const { versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    for (let i = 0; i < 40 && (await depots().versions.obtenir(versionId))?.statut !== "prete"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    // Des numéros 1 et 10 : max + 1 = 11, alors que le nombre de versions + 1 est plus petit.
    await depots().versions.modifier(versionId, { numero: 10 });
    await ajouterVersion("v-03", 1);
    const parent = (await depots().versions.obtenir(versionId))!;
    expect(parent.numeroSuivi).toBeDefined();
    const st = (await videos.sousTitresCourants(versionId))!;
    await videos.corrigerMotSousTitres("v-03", st.segments[0].id, 0, "Corrigé");
    const attendu = await fabrication.prochainNumero("v-03");
    expect(attendu).toBe(11);
    const r = await recalque.appliquerSousTitres("v-03");
    const nouvelle = (await depots().versions.obtenir(r.versionId))!;
    expect(nouvelle.numero).toBe(attendu);
    expect(nouvelle.numeroSuivi).toBe(parent.numeroSuivi);
  });
});
