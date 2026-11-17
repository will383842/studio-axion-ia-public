/**
 * C3-UT-3.11 · P-7 (accord de Williams du 17/11/2026) : la fiche d'extraits part avec sa vidéo, UNIQUEMENT à la suppression
 * DÉFINITIVE décidée par Williams. L'id quitte les `famille` des autres fiches, qui restent intactes pour le reste.
 * Une archive (corbeille / non définitive) et une vidéo sans fiche ne touchent à AUCUNE fiche. Dépôts en mémoire.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { etatRequete, mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const suppression = await import("@/services/suppression-video");
const corbeille = await import("@/services/corbeille");
const { ecrireParametre } = await import("@/services/_commun");
import type { ElementBibliotheque } from "@/domaine/types";

const ID = "v-01";
const AUTRE = "v-03";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const MDP = "essai-extraits-123";
const JOUR = 86_400_000;
let t0 = 0;

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit dans les tests")));
  await auth.seConnecter(MDP, false);
  t0 = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Réglage allumé (éteint par défaut : seul `true` strict allume). */
const allumer = () => ecrireParametre(suppression.REGLAGE_EFFACER_FICHE_EXTRAITS, true);
/** La boucle de fond n'a aucune session : plus de cookie. */
const sansSession = () => etatRequete.cookies.clear();
/** Plan ENTIER ; seul l'identifiant aléatoire de l'événement du journal est neutralisé (tout le reste est comparé tel quel). */
const planDe = async (id = ID) => {
  const plan = await suppression.planifierSuppression((await depots().videos.obtenir(id))!);
  return JSON.parse(JSON.stringify(plan).replace(/ev-[0-9a-f]{12}/g, "ev-X")) as typeof plan;
};

const fiche = (videoId: string, famille: string[], extra: Partial<ElementBibliotheque> = {}): ElementBibliotheque =>
  ({
    id: `fiche-${videoId}`,
    type: "source-extraits",
    nom: `Extraits ${videoId}`,
    motsCles: [],
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId,
        versionId: `${videoId}-ver`,
        sortieId: `${videoId}-sor`,
        ratio: "9:16",
        licence: { type: "propriete", usageCommercial: true, reseaux: [] },
        famille,
        plages: [{ texte: `paroles de ${videoId}` }],
        rangee: false,
        sourcePreferee: false,
      },
    },
    licence: { type: "propriete", usageCommercial: true, reseaux: [] },
    formatsParDefaut: [],
    marqueId: "m",
    ...H,
    ...extra,
  }) as unknown as ElementBibliotheque;

async function semer(avecFicheDeLaVideo = true) {
  const d = depots();
  if (avecFicheDeLaVideo) await d.elements.enregistrer(fiche(ID, [ID, AUTRE]));
  await d.elements.enregistrer(fiche(AUTRE, [AUTRE, ID]));
  await d.elements.enregistrer(fiche("v-04", ["v-04"]));
  await d.elements.enregistrer(fiche("v-05", ["v-05", ID], { derniereVideoId: ID, id: "fiche-double" }));
}

const tout = async () => JSON.stringify(await depots().elements.lister());
/** Les seules fiches d'extraits (hors « dernière vidéo », que master oublie déjà à la suppression, sans lien avec P-7). */
const fichesSeules = async () =>
  JSON.stringify((await depots().elements.lister((e) => e.valeur.type === "source-extraits")).map(({ derniereVideoId: _d, modifieLe: _m, ...e }) => (void _d, void _m, e)));
const citeId = (t: string) => new RegExp(`(?<![A-Za-z0-9_-])${ID}(?![A-Za-z0-9_-])`).test(t);

describe("suppression définitive : fiche d'extraits (P-7)", () => {
  it("la fiche de la vidéo est dans lot.supprimer, les autres fiches sont réécrites sans l'id", async () => {
    await semer();
    await allumer();
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    expect(plan.lot.supprimer).toContainEqual({ collection: "elements", id: `fiche-${ID}` });
    expect(plan.lot.supprimer.filter((x) => x.collection === "elements")).toHaveLength(1);
    const ecrits = plan.lot.enregistrer.filter((x) => x.collection === "elements");
    expect(ecrits.map((x) => x.entite.id).sort()).toEqual(["fiche-double", `fiche-${AUTRE}`]);
    for (const e of ecrits) expect(citeId(JSON.stringify(e.entite))).toBe(false);
  });

  it("applique le lot : plus aucune citation, fiches des autres vidéos intactes sauf l'id retiré", async () => {
    await semer();
    await allumer();
    const avant = (await depots().elements.lister()).find((e) => e.id === "fiche-v-04");
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    const d = depots();
    expect(await d.elements.obtenir(`fiche-${ID}`)).toBeNull();
    expect(citeId(await tout())).toBe(false);
    expect(await d.elements.obtenir("fiche-v-04")).toEqual(avant);
    const autre = (await d.elements.obtenir(`fiche-${AUTRE}`))!;
    expect(autre.valeur).toMatchObject({ fiche: { videoId: AUTRE, famille: [AUTRE], plages: [{ texte: `paroles de ${AUTRE}` }] } });
  });

  it("fiche avec derniereVideoId = id ET famille contenant l'id : une seule écriture, les deux retraits faits", async () => {
    await semer();
    await allumer();
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    const doubles = plan.lot.enregistrer.filter((x) => x.collection === "elements" && x.entite.id === "fiche-double");
    expect(doubles).toHaveLength(1);
    const e = doubles[0].entite as unknown as ElementBibliotheque;
    expect(e.derniereVideoId).toBeUndefined();
    expect(e.valeur).toMatchObject({ fiche: { famille: ["v-05"] } });
  });

  it("vidéo sans fiche : le plan ENTIER (lot, fichiers, objets, dossiers) est identique à celui d'un dépôt sans aucune fiche", async () => {
    await allumer();
    const d = depots();
    const sans = await planDe();
    await d.elements.enregistrer(fiche(AUTRE, [AUTRE]));
    await d.elements.enregistrer(fiche("v-04", ["v-04"]));
    const avec = await planDe();
    expect(avec).toEqual(sans);
    expect(avec.lot.supprimer.filter((x) => x.collection === "elements")).toEqual([]);
    expect(avec.lot.enregistrer.filter((x) => x.collection === "elements")).toEqual([]);
  });

  it("réglage éteint (défaut) : plan ENTIER identique à celui de master (la fiche et les familles ne sont pas regardées)", async () => {
    await semer();
    const eteint = await planDe();
    // Référence « master » (même dépôt, les autres fiches retirées) : seule la fiche qui a derniereVideoId = id bouge, comme avant P-7.
    for (const f of [`fiche-${ID}`, `fiche-${AUTRE}`, "fiche-v-04"]) await depots().elements.supprimer(f);
    const master = await planDe();
    expect(eteint).toEqual(master);
    expect(eteint.lot.supprimer.filter((x) => x.collection === "elements")).toEqual([]);
    const double = eteint.lot.enregistrer.filter((x) => x.collection === "elements").map((x) => x.entite as unknown as ElementBibliotheque);
    expect(double).toHaveLength(1);
    expect(double[0].valeur).toMatchObject({ fiche: { famille: ["v-05", ID] } });
  });

  it("réglage non strictement `true` (« true », 1) : plan identique à éteint", async () => {
    await semer();
    const eteint = await planDe();
    for (const v of ["true", 1, "oui"]) {
      await ecrireParametre(suppression.REGLAGE_EFFACER_FICHE_EXTRAITS, v);
      expect(await planDe()).toEqual(eteint);
    }
  });

  it("réglage allumé mais SANS session (boucle de fond) : plan ENTIER identique à éteint", async () => {
    await semer();
    const eteint = await planDe();
    await allumer();
    sansSession();
    expect(await planDe()).toEqual(eteint);
  });

  it("archive (suppression simple, non définitive) : aucune fiche d'extraits touchée", async () => {
    await semer();
    const avant = await tout();
    await videos.archiverVideos([ID]);
    expect((await depots().videos.obtenir(ID))?.statut).toBe("archivee");
    expect(await tout()).toBe(avant);
  });

  it("corbeille réelle (mettreALaCorbeille) puis restauration, réglage allumé : fiches d'extraits identiques", async () => {
    await semer();
    await allumer();
    const avant = await tout();
    await corbeille.mettreALaCorbeille([ID]);
    expect((await depots().videos.obtenir(ID))?.corbeilleLe).toBeTruthy();
    expect(await tout()).toBe(avant);
    await corbeille.restaurerDeLaCorbeille([ID]);
    expect((await depots().videos.obtenir(ID))?.corbeilleLe).toBeFalsy();
    expect(await tout()).toBe(avant);
  });

  it("purge automatique (purgerCorbeille, sans session, réglage allumé) : fiche intacte avant ET après 30 jours, même vidéo effacée", async () => {
    await semer();
    await allumer();
    const avant = await fichesSeules();
    await corbeille.mettreALaCorbeille([ID]);
    sansSession();
    vi.setSystemTime(t0 + 29 * JOUR);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 0 });
    expect(await depots().videos.obtenir(ID)).not.toBeNull();
    expect(await fichesSeules()).toBe(avant);
    vi.setSystemTime(t0 + 31 * JOUR);
    expect(await corbeille.purgerCorbeille()).toMatchObject({ supprimees: 1 });
    expect(await depots().videos.obtenir(ID)).toBeNull();
    expect(await fichesSeules()).toBe(avant);
    expect(await depots().elements.obtenir(`fiche-${ID}`)).not.toBeNull();
  });

  it("suppression manuelle depuis la corbeille (viderCorbeille, avec session) : la fiche part, réglage allumé", async () => {
    await semer();
    await allumer();
    await corbeille.mettreALaCorbeille([ID]);
    expect((await corbeille.viderCorbeille([ID])).supprimees).toBe(1);
    expect(await depots().elements.obtenir(`fiche-${ID}`)).toBeNull();
    expect(citeId(await tout())).toBe(false);
  });
});
