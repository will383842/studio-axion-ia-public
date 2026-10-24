/**
 * PRIX EXACT, de bout en bout côté services : pour un script validé du studio, la feuille de prix (estimerCas), le montant
 * demandé au lancement (preparerEtLancer sans accord) et l'estimation du moteur sur la commande réellement construite
 * (celle que la fabrication réserve) sont IDENTIQUES au centime ; sans ligne « Écriture » ; un script plus long coûte plus,
 * un plus court moins ; un lancement avec exactement ce montant passe, un montant inférieur d'un centime est refusé.
 * Base en mémoire, aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const fourni = await import("@/services/cas-concret-script-fourni");
const scripts = await import("@/services/cas-concret-scripts");
const { construireCommande } = await import("@/services/fabrication");
const { moteurDeCommande } = await import("@/moteurs");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { dureesDesFins, ficheParGabarit } = await import("@/moteurs/montage-cas-concret/ecriture");
const { bornesDesFins, texteFourniDesEcrans } = await import("@/moteurs/montage-cas-concret/script-fourni");

const lancer = vi.fn(async () => ({ travailId: "t-prix" }));
const MDP = "cas-concret-prix-exact";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const CAS_ID = "rappels-rendez-vous";
const CAS = trouverCas(CAS_ID)!;
const b0 = bornesDesFins(CAS);
const TEXTE = texteFourniDesEcrans(ficheParGabarit(CAS, { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins([b0.courte, b0.longue])).ecrans, CAS);
const TEXTE_LONG = TEXTE.split("\n").map((l) => (/^\[(étape \d|détail)\]/.test(l) ? l.replace(/\.$/, "") + " dès que vous le décidez." : l)).join("\n");
const TEXTE_COURT = TEXTE.split("\n").map((l) => (/^\[détail\]/.test(l) ? "[détail] Rien d'autre à faire ici." : l)).join("\n");

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  lancer.mockClear();
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
});

const demande = (plus: Record<string, unknown> = {}) => ({ casId: CAS_ID, reseaux: RESEAUX, mot: "IA", avecMot: false, essai: true, ...plus }) as Parameters<typeof service.preparerEtLancer>[0];
type Lignes = { lignes: { etape: string; quantite: number }[]; total: { centimes: number } };

/** Les trois prix pour le script courant du cas : feuille, montant demandé au lancement, estimation du moteur sur la commande. */
async function troisPrix() {
  const script = (await scripts.scriptValideCourant(CAS))!;
  expect(script).toBeTruthy();
  const feuille = (await service.estimerCas(CAS_ID, RESEAUX, false, { essai: true })).centimes;
  const relu = { empreinteScriptRelu: scripts.empreinteScriptValide(script) };
  const r = await service.preparerEtLancer(demande({ ...relu, accordCentimes: undefined }), { lancer });
  if (r.statut !== "accord-requis") throw new Error(`attendu accord-requis, reçu ${r.statut}`);
  const commande = await construireCommande(r.videoId);
  expect((commande.entrees.casConcret as { scriptFige?: unknown }).scriptFige).toBeTruthy();
  const e = (await moteurDeCommande(commande).estimer(commande)) as unknown as Lignes;
  return { feuille, lancement: r.centimes, moteur: e.total.centimes, e, relu, videoId: r.videoId };
}

describe("prix exact d'un script validé du studio", () => {
  it("feuille, lancement et moteur donnent le MÊME prix au centime, sans « Écriture » ; plus long = plus cher, plus court = moins cher", async () => {
    const sans = await service.estimerCas(CAS_ID, RESEAUX, false, { essai: true });
    const prix: Record<string, number> = {};
    for (const [nom, texte] of [["court", TEXTE_COURT], ["gabarit", TEXTE], ["long", TEXTE_LONG]] as const) {
      await fourni.enregistrerScriptFourni(CAS_ID, texte);
      const p = await troisPrix();
      expect(p.lancement).toBe(p.feuille);
      expect(p.moteur).toBe(p.feuille);
      expect(p.e.lignes.some((l) => l.etape === "Écriture")).toBe(false);
      prix[nom] = p.feuille;
      // Autre vidéo à chaque tour : on repart d'une base propre.
      reinitialiserDepots();
      await auth.seConnecter(MDP, false);
      const d = depots();
      const base = (await d.voix.obtenir("voix-will"))!;
      await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
      await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
    }
    expect(prix.gabarit).toBeLessThan(sans.centimes);
    expect(prix.long).toBeGreaterThanOrEqual(prix.gabarit);
    expect(prix.court).toBeLessThanOrEqual(prix.gabarit);
  }, 60_000);

  it("le lancement passe avec exactement le prix, et un centime de moins est refusé (aucune dépense au-delà du prix confirmé)", async () => {
    await fourni.enregistrerScriptFourni(CAS_ID, TEXTE_LONG);
    const p = await troisPrix();
    lancer.mockClear();
    const trop = await service.preparerEtLancer(demande({ ...p.relu, accordCentimes: p.lancement - 1 }), { lancer });
    expect(trop.statut).toBe("accord-requis");
    expect(lancer).not.toHaveBeenCalled();
    const bon = await service.preparerEtLancer(demande({ ...p.relu, accordCentimes: p.lancement }), { lancer });
    expect(bon.statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("un cas sans script du studio : prix d'avant, AVEC la ligne « Écriture » et sans script figé", async () => {
    const r = await service.preparerEtLancer(demande({ accordCentimes: undefined }), { lancer });
    expect(r.statut).toBe("accord-requis");
    if (r.statut !== "accord-requis") return;
    const commande = await construireCommande(r.videoId);
    expect((commande.entrees.casConcret as { scriptFige?: unknown }).scriptFige).toBeUndefined();
    const e = (await moteurDeCommande(commande).estimer(commande)) as unknown as Lignes;
    expect(e.lignes.some((l) => l.etape === "Écriture")).toBe(true);
    expect(e.total.centimes).toBe(r.centimes);
    expect((await service.estimerCas(CAS_ID, RESEAUX, false, { essai: true })).centimes).toBe(r.centimes);
  }, 60_000);
});
