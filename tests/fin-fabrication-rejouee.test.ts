/**
 * GV2-38 : une fin de fabrication interrompue pendant l'enregistrement du résultat est rejouée UNE seule fois,
 * sans deuxième dépense ni deuxième solde de réservation. Aucun appel réseau, aucun fournisseur réel.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const credits = await import("@/services/credits");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { ErreurLecture } = await import("@/fournisseurs/credits");
import type { LecteurCredit } from "@/fournisseurs/types";
import type { LigneCout, SegmentSousTitres } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs";
import { additionner, centimes } from "@/lib/montants";

void ErreurLecture;
const MDP = "essai-gv2-38-rejeu";

beforeAll(async () => {
  process.env.SESSION_SECRET = "g".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  credits.injecterLecteursPourEssai(null);
  vi.useFakeTimers({ toFake: ["Date"] });
  await auth.seConnecter(MDP, false);
  for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
  const lecteur: LecteurCredit = {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: 1_000_000, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…Zq7W", message: "ok", testeLe: new Date().toISOString() };
    },
  };
  credits.injecterLecteursPourEssai([lecteur], ["heygen"]);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  boucle.arreterBoucle();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const LIGNE: LigneCout = { etape: "Finition", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: centimes(40), total: centimes(40), nature: "reel" };
/** Une dépense de voix payée dès la lecture + la dépense de fin ; une version de sous-titres d'origine + celle du moteur. */
const DEPENSES_NORMALES = 2;
const SOUS_TITRES_NORMAUX = 2;
const SOUS_TITRES = [{ id: "seg-1", debutSec: 0, finSec: 1, mots: [] }] as SegmentSousTitres[];

/** Moteur simulé dont le résultat final porte des sous-titres et des lignes réelles choisies. */
function moteur(lignes: LigneCout[] | "simulation"): MoteurVideo {
  return {
    ...moteurSimulation,
    avancer: async (t, c, n) => {
      const r = await moteurSimulation.avancer(t, c, n);
      return r.resultat ? { ...r, resultat: { ...r.resultat, lignesReelles: lignes === "simulation" ? r.resultat.lignesReelles : lignes, sousTitres: SOUS_TITRES } } : r;
    },
  };
}
const tour = (m: MoteurVideo) => async () => {
  vi.setSystemTime(Date.now() + 5_000);
  await boucle.contenuDuTour({ choisirMoteur: () => m });
};
async function lancer(m: MoteurVideo, apresLancement?: (versionId: string) => void): Promise<{ travailId: string; unTour: () => Promise<void>; coutAvant: ReturnType<typeof centimes> | undefined }> {
  const coutAvant = (await depots().videos.obtenir("v-04"))!.coutReel;
  const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
  apresLancement?.((await depots().travaux.obtenir(travailId))!.versionId!);
  const unTour = tour(m);
  for (let i = 0; i < 80 && (await depots().travaux.obtenir(travailId))!.statut !== "termine"; i++) await unTour();
  return { travailId, unTour, coutAvant };
}
async function constats(travailId: string) {
  const d = depots();
  const t = (await d.travaux.obtenir(travailId))!;
  const video = (await d.videos.obtenir(t.cibleId))!;
  const version = (await d.versions.obtenir(t.versionId!))!;
  const deps = await d.depenses.lister((x) => x.travailId === travailId);
  const reservations = await d.reservations.lister((r) => r.travailId === travailId);
  const sousTitres = await d.sousTitres.lister((s) => s.versionId === t.versionId);
  return { t, video, version, deps, reservations, sousTitres };
}
/** Fait lever UNE fois (la première écriture qui correspond) la méthode du dépôt : coupure d'essai en pleine fin de fabrication. */
const erreurUneFois = (depot: object, methode: "enregistrer" | "modifier", seulement: (a: unknown[]) => boolean) => {
  const cible = depot as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const origine = cible[methode].bind(depot);
  let leve = false;
  vi.spyOn(cible, methode).mockImplementation((...a: unknown[]) => {
    if (!leve && seulement(a)) {
      leve = true;
      throw new Error("coupure d'essai");
    }
    return origine(...a);
  });
};

describe("GV2-38 · fin de fabrication rejouée une seule fois", () => {
  it("erreur pendant les produits du moteur : une dépense, une réservation soldée, coût sans double", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { travailId, unTour, coutAvant } = await lancer(moteur([LIGNE]), (versionId) => erreurUneFois(depots().sousTitres, "enregistrer", (a) => (a[0] as { versionId?: string }).versionId === versionId));
    let c = await constats(travailId);
    expect(c.t.statut).toBe("termine");
    expect(c.t.finAAppliquer).toMatchObject({ rejouee: false, faits: ["depense"] });
    expect(c.video.statut).toBe("en_fabrication");
    expect(c.version.statut).not.toBe("prete");
    await unTour();
    c = await constats(travailId);
    expect(c.video.statut).toBe("prete");
    expect(c.version.statut).toBe("prete");
    expect(c.t.finAAppliquer).toBeUndefined();
    expect(c.deps).toHaveLength(DEPENSES_NORMALES);
    expect(c.deps.filter((x) => x.lignes.some((l) => l.etape === "Finition"))).toHaveLength(1);
    expect(c.reservations).toHaveLength(1);
    expect(c.reservations[0]).toMatchObject({ statut: "consommee", libereeLe: expect.any(String) });
    expect(c.sousTitres).toHaveLength(SOUS_TITRES_NORMAUX);
    expect(c.video.coutReel).toEqual(additionner(coutAvant, ...c.deps.flatMap((x) => x.lignes).map((l) => l.total)));
    await unTour();
    c = await constats(travailId);
    expect(c.deps).toHaveLength(DEPENSES_NORMALES);
    expect(c.deps.filter((x) => x.lignes.some((l) => l.etape === "Finition"))).toHaveLength(1);
    expect(c.sousTitres).toHaveLength(SOUS_TITRES_NORMAUX);
  });

  it("erreur après la dépense et les produits : le rejeu n'écrit aucune dépense, ne touche pas la réservation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { travailId, unTour, coutAvant } = await lancer(moteur([LIGNE]), (versionId) => erreurUneFois(depots().versions, "modifier", (a) => a[0] === versionId && (a[1] as { statut?: string } | undefined)?.statut === "prete"));
    let c = await constats(travailId);
    expect(c.t.finAAppliquer?.faits).toEqual(["depense", "produits"]);
    expect(c.sousTitres).toHaveLength(SOUS_TITRES_NORMAUX);
    const reservationAvant = structuredClone(c.reservations);
    const depensesAvant = structuredClone(c.deps);
    await unTour();
    c = await constats(travailId);
    expect(c.video.statut).toBe("prete");
    expect(c.t.finAAppliquer).toBeUndefined();
    expect(c.deps).toEqual(depensesAvant);
    expect(c.reservations).toEqual(reservationAvant);
    expect(c.sousTitres).toHaveLength(SOUS_TITRES_NORMAUX);
    expect(c.video.coutReel).toEqual(additionner(coutAvant, ...c.deps.flatMap((x) => x.lignes).map((l) => l.total)));
  });

  it("lignes réelles vides (vidéo d'essai) : une seule dépense vide après rejeu", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "simulation" });
    const { travailId, unTour } = await lancer(moteur([]), (versionId) => erreurUneFois(depots().sousTitres, "enregistrer", (a) => (a[0] as { versionId?: string }).versionId === versionId));
    await unTour();
    await unTour();
    const c = await constats(travailId);
    expect(c.video.statut).toBe("prete");
    expect(c.deps).toHaveLength(1);
    expect(c.deps[0].lignes).toHaveLength(0);
  });

  it("arrêt pendant le rejeu (rejouee déjà posée) : appliquerResultat n'est pas rappelé, échec propre, argent intact", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { travailId, unTour } = await lancer(moteur([LIGNE]), (versionId) => erreurUneFois(depots().sousTitres, "enregistrer", (a) => (a[0] as { versionId?: string }).versionId === versionId));
    const d = depots();
    const t = (await d.travaux.obtenir(travailId))!;
    await d.travaux.enregistrer({ ...t, finAAppliquer: { ...t.finAAppliquer!, rejouee: true } });
    const avant = await constats(travailId);
    const reservationAvant = structuredClone(avant.reservations);
    const depensesAvant = structuredClone(avant.deps);
    const suiteSousTitres = vi.spyOn(d.sousTitres, "enregistrer");
    suiteSousTitres.mockClear();
    await unTour();
    const c = await constats(travailId);
    expect(suiteSousTitres).not.toHaveBeenCalled();
    expect(c.video.statut).toBe("echec");
    expect(c.version.statut).toBe("echec");
    expect(c.t.finAAppliquer).toBeUndefined();
    const notifs = await d.notifications.lister((n) => n.type === "echec" && n.titre === "La fin de la fabrication n'a pas pu être enregistrée");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].message).toBe("Vous pouvez réessayer.");
    expect(c.deps).toEqual(depensesAvant);
    expect(c.reservations).toEqual(reservationAvant);
    await unTour();
    const apres = await constats(travailId);
    expect(apres.video.statut).toBe("echec");
    expect(await d.notifications.lister((n) => n.titre === "La fin de la fabrication n'a pas pu être enregistrée")).toHaveLength(1);
    expect(apres.deps).toEqual(depensesAvant);
  });

  it("chemin normal : aucune note, une dépense, un solde", async () => {
    const { travailId } = await lancer(moteur([LIGNE]));
    const c = await constats(travailId);
        expect(c.video.statut).toBe("prete");
    expect(c.t.finAAppliquer).toBeUndefined();
    expect(c.deps).toHaveLength(DEPENSES_NORMALES);
    expect(c.deps.filter((x) => x.lignes.some((l) => l.etape === "Finition"))).toHaveLength(1);
    expect(c.reservations.map((r) => r.statut)).toEqual(["consommee"]);
    expect(c.sousTitres).toHaveLength(SOUS_TITRES_NORMAUX);
    expect(await travaux.rejouerFinsInterrompues()).toEqual([]);
  });

  it("la note n'alourdit pas ce qui part vers l'écran", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { travailId } = await lancer(moteur([LIGNE]), (versionId) => erreurUneFois(depots().sousTitres, "enregistrer", (a) => (a[0] as { versionId?: string }).versionId === versionId));
    const t = (await depots().travaux.obtenir(travailId))!;
    expect(t.finAAppliquer).toBeDefined();
    expect(travaux.allegerTravail(t).finAAppliquer).toBeUndefined();
  });
});
