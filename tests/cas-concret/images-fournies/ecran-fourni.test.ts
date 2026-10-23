/**
 * P2S · lot B · écran fourni : image déposée, zones masquées, attestation. Partie pure (captures.ts) et service.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { recrutementApporteurs } from "../../../src/formats/cas-concret/catalogue/recrutement-apporteurs";
import { VERSION_FICHE_ECRANS, type EcranCorps, type FicheEcrans } from "../../../src/moteurs/montage-cas-concret/fiche";
import { appliquerCaptures, ecransUtilisables, lireEcransFournis, PHRASES_ECRAN_FOURNI, planCaptures, refusEcransFournis, zonesMasqueesValides, type EcranFourni } from "../../../src/moteurs/montage-cas-concret/captures";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { deposerFichierSimule } = await import("@/services/fichiers");
const { ecrireParametre } = await import("@/services/_commun");
const ecrans = await import("../../../src/components/formats/cas-concret/ecran-fourni/service");

const MDP = "cas-concret-ecran-fourni";
const commun = { fond: "sombre" as const, marque: "axion-ia.com", texteDit: "Elle s'inscrit toute seule.", avanceMs: 0, evenements: [], total: 6, puces: [] as string[] };
const etape = (id: string, numero: number, etapeCas: number | null): EcranCorps =>
  ({ ...commun, id, type: "etape", numero, titre: "L'étape", ligne: "Elle avance.", visuel: etapeCas === null ? { sorte: "objet", objet: "pile-notifications" } : { sorte: "ecran", etapeCas, repli: "telephone-notification" } }) as EcranCorps;
const fiche = (): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a",
  ecrans: [etape("e01", 1, null), etape("e02", 2, 2), etape("e03", 3, 4)],
});
const fourni = (o: Partial<EcranFourni> = {}): EcranFourni => ({ etapeCas: 2, cle: "studio/test/entree/x/f-1.png", mime: "image/png", masques: [], attesteLe: "2026-10-12T08:00:00.000Z", ...o });

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Portage P3 : le réglage est éteint par défaut ; allumé ici, dans la base de test seulement.
  await ecrireParametre("casConcret.ecranFourni", true);
});

describe("écran fourni (pur)", () => {
  it("sans la case cochée, l'image n'est pas utilisée et un refus est donné", () => {
    const sans = fourni({ attesteLe: undefined });
    expect(ecransUtilisables([sans], recrutementApporteurs)).toEqual([]);
    expect(refusEcransFournis([sans], recrutementApporteurs)).toBe(PHRASES_ECRAN_FOURNI.sansAttestation);
    expect(refusEcransFournis([fourni()], recrutementApporteurs)).toBeNull();
    expect(refusEcransFournis([], recrutementApporteurs)).toBeNull();
    expect(refusEcransFournis(undefined, recrutementApporteurs)).toBeNull();
  });

  it("une étape qui n'est pas un écran réel, ou un type d'image inconnu, est refusé", () => {
    expect(refusEcransFournis([fourni({ etapeCas: 1 })], recrutementApporteurs)).toBe(PHRASES_ECRAN_FOURNI.etapeInconnue);
    expect(refusEcransFournis([fourni({ etapeCas: 99 })], recrutementApporteurs)).toBe(PHRASES_ECRAN_FOURNI.etapeInconnue);
    expect(refusEcransFournis([fourni({ mime: "image/gif" })], recrutementApporteurs)).toBe(PHRASES_ECRAN_FOURNI.imageInvalide);
  });

  it("l'image masquée remplace la capture : plus de demande pour l'étape, la capture retenue est l'image", () => {
    const sans = planCaptures(fiche(), recrutementApporteurs);
    expect(sans.map((d) => d.id)).toEqual(["e02", "e03"]);
    const avec = planCaptures(fiche(), recrutementApporteurs, [fourni()]);
    expect(avec.map((d) => d.id)).toEqual(["e03"]);
    const a = appliquerCaptures(fiche(), { demandes: avec, resultats: {} }, [fourni()], recrutementApporteurs);
    expect(a.captures.e02).toEqual({ cle: "studio/test/entree/x/f-1.png", mime: "image/png" });
    expect(a.fiche.ecrans.find((e) => e.id === "e02")).toMatchObject({ visuel: { sorte: "ecran" } });
    // l'étape sans image garde son repli, comme avant
    expect(a.fiche.ecrans.find((e) => e.id === "e03")).toMatchObject({ visuel: { sorte: "objet" } });
    expect(a.journal).toHaveLength(1);
  });

  it("une image non attestée ne change rien au plan ni à l'application", () => {
    const sans = fourni({ attesteLe: undefined });
    expect(planCaptures(fiche(), recrutementApporteurs, [sans]).map((d) => d.id)).toEqual(["e02", "e03"]);
    expect(Object.keys(appliquerCaptures(fiche(), { demandes: [], resultats: {} }, [sans], recrutementApporteurs).captures)).toEqual([]);
  });

  it("zones : ramenées dans l'image, les vides et les invalides disparaissent ; lecture tolérante", () => {
    expect(zonesMasqueesValides([{ x: 0.5, y: 0.1, largeur: 0.9, hauteur: 0.2 }, { x: 2, y: 0, largeur: 1, hauteur: 1 }, { x: 0, y: 0, largeur: 0, hauteur: 0.5 }, "x"])).toEqual([{ x: 0.5, y: 0.1, largeur: 0.5, hauteur: 0.2 }]);
    expect(lireEcransFournis("n'importe quoi")).toEqual([]);
    expect(lireEcransFournis([fourni(), fourni({ cle: "autre" }), { etapeCas: 0 }])).toHaveLength(1);
  });
});

describe("service de l'écran fourni", () => {
  const casId = "recrutement-apporteurs";
  const deposer = () => deposerFichierSimule({ nom: "ecran.png", mime: "image/png", taille: 1200, typeEntite: ecrans.TYPE_ENVOI_ECRAN, entiteId: casId });

  it("refuse sans la case cochée, et rien n'est gardé", async () => {
    const f = await deposer();
    await expect(ecrans.poserEcranFourni({ casId, etapeCas: 2, fichierId: f.id, masques: [], attestation: false })).rejects.toThrow(PHRASES_ECRAN_FOURNI.sansAttestation);
    expect(await ecrans.ecransFournisDuCas(casId)).toEqual([]);
  });

  it("accepte avec la case cochée : image gardée, datée, zones validées ; la retirer la supprime", async () => {
    const f = await deposer();
    const r = await ecrans.poserEcranFourni({ casId, etapeCas: 2, fichierId: f.id, masques: [{ x: 0.1, y: 0.1, largeur: 0.2, hauteur: 0.1 }], attestation: true }, { maintenant: Date.parse("2026-10-12T08:00:00Z") });
    expect(r.attesteLe).toBe("2026-10-12T08:00:00.000Z");
    expect(r.cle).toBe(f.cleStockage);
    const lues = await ecrans.ecransFournisDuCas(casId);
    expect(lues).toHaveLength(1);
    expect(ecransUtilisables(lues, recrutementApporteurs)).toHaveLength(1);
    await ecrans.retirerEcranFourni(casId, 2);
    expect(await ecrans.ecransFournisDuCas(casId)).toEqual([]);
  });

  it("refuse un fichier jamais envoyé, une étape sans écran réel, un cas inconnu", async () => {
    await expect(ecrans.poserEcranFourni({ casId, etapeCas: 2, fichierId: "f-inconnu", masques: [], attestation: true })).rejects.toThrow();
    const f = await deposer();
    await expect(ecrans.poserEcranFourni({ casId, etapeCas: 1, fichierId: f.id, masques: [], attestation: true })).rejects.toThrow(PHRASES_ECRAN_FOURNI.etapeInconnue);
    await expect(ecrans.poserEcranFourni({ casId: "inconnu", etapeCas: 2, fichierId: f.id, masques: [], attestation: true })).rejects.toThrow();
  });
});
