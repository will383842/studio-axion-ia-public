/**
 * AJOUTER UN CAS, côté services : le cas ajouté à la main est durable, listé avec les autres, soumis aux MÊMES contrôles avant
 * le prix que ceux du catalogue (non validé, retiré, déjà traité), figé dans sa vidéo, et son prix est celui du moteur.
 * Base en mémoire, aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";
import { FORMULAIRE_MINIMAL } from "../../cas-ajoutes/formulaires";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const ajoutes = await import("@/services/cas-concret-ajoutes");
const lecture = await import("@/services/cas-concret-ajoutes-lecture");
const retires = await import("@/services/cas-concret-retires");
const acces = await import("@/services/cas-concret-stock-acces");
const scripts = await import("@/services/cas-concret-scripts");
const { construireCommande } = await import("@/services/fabrication");
const { moteurDeCommande } = await import("@/moteurs");
const { ecrireParametre } = await import("@/services/_commun");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { PHRASE_CAS_RETIRE } = await import("@/domaine/cas-retires");
const { PHRASE_CAS_TRAITE } = await import("@/domaine/cas-traites");
const { preparerCasAjoute } = await import("@/moteurs/montage-cas-concret/cas-ajoutes");
const { dureesDesFins, ficheParGabarit } = await import("@/moteurs/montage-cas-concret/ecriture");
const { bornesDesFins, texteFourniDesEcrans } = await import("@/moteurs/montage-cas-concret/script-fourni");

const lancer = vi.fn(async () => ({ travailId: "t-ajout" }));
const MDP = "cas-concret-ajoute";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

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

const demande = (casId: string, plus: Record<string, unknown> = {}) => ({ casId, reseaux: RESEAUX, mot: "IA", avecMot: false, essai: false, ...plus }) as Parameters<typeof service.preparerEtLancer>[0];
const texteDuCas = () => {
  const r = preparerCasAjoute(FORMULAIRE_MINIMAL, { id: "ajout-essai-ab12", autres: CATALOGUE });
  if (!r.ok) throw new Error(r.raisons.join("|"));
  const b = bornesDesFins(r.cas);
  return texteFourniDesEcrans(ficheParGabarit(r.cas, { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins([b.courte, b.longue])).ecrans, r.cas);
};

describe("ajouter un cas · écriture", () => {
  it("session exigée : sans connexion, rien n'est écrit", async () => {
    reinitialiserRequete();
    await expect(ajoutes.ajouterCas(FORMULAIRE_MINIMAL)).rejects.toBeTruthy();
    expect(await lecture.lireCasAjoutes()).toEqual([]);
  });

  it("refus en phrases : rien n'est écrit", async () => {
    await expect(ajoutes.ajouterCas({ ...FORMULAIRE_MINIMAL, resultat: "Vos devis sont suivis en 3 jours." })).rejects.toMatchObject({ code: "CAS_AJOUT_REFUSE" });
    await expect(ajoutes.ajouterCas({ ...FORMULAIRE_MINIMAL, inconnu: 1 })).rejects.toMatchObject({ code: "CAS_AJOUT_REFUSE" });
    await expect(ajoutes.ajouterCas("pas un objet")).rejects.toMatchObject({ code: "CAS_AJOUT_REFUSE" });
    await expect(ajoutes.ajouterCas({ ...FORMULAIRE_MINIMAL, scene: "x".repeat(25_000) })).rejects.toMatchObject({ code: "CAS_AJOUT_REFUSE" });
    expect(await lecture.lireCasAjoutes()).toEqual([]);
  });

  it("écriture durable, validation par empreinte, journal ; le cas est lu par l'accès par identifiant et listé", async () => {
    const r = await ajoutes.ajouterCas({ ...FORMULAIRE_MINIMAL, secteur: "AS", taille: "TPE" });
    expect(r.casId).toMatch(/^ajout-/);
    const lus = await lecture.lireEntreesCasAjoutes();
    expect(Object.keys(lus)).toEqual([r.casId]);
    expect(lus[r.casId]).toMatchObject({ secteur: "AS", taille: "TPE", historique: [{ version: 1 }] });
    expect((await acces.trouverCasAutorise(r.casId))?.titre).toBe(FORMULAIRE_MINIMAL.titre);
    const liste = await service.listerCas();
    expect(liste.valides.map((c) => c.cas.id)).toContain(r.casId);
    expect(liste.valides.find((c) => c.cas.id === r.casId)!.cas.valideParWill).toBeUndefined();
    const journal = await depots().evenements.lister(() => true);
    expect(journal.some((j) => /Cas ajouté : /.test(j.message ?? ""))).toBe(true);
  });

  it("non validé (case décochée) : le cas est « à valider »", async () => {
    const r = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL, { valider: false });
    const liste = await service.listerCas();
    expect(liste.aValider.map((c) => c.cas.id)).toContain(r.casId);
    expect(liste.valides.map((c) => c.cas.id)).not.toContain(r.casId);
  });

  it("deux ajouts du même formulaire : le second est refusé (thème, mot et sujet distincts exigés)", async () => {
    await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    await expect(ajoutes.ajouterCas(FORMULAIRE_MINIMAL)).rejects.toMatchObject({ code: "CAS_AJOUT_REFUSE" });
    expect(await lecture.lireCasAjoutes()).toHaveLength(1);
  });

  it("plafond de 200 cas ajoutés", async () => {
    const r = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    const un = (await lecture.lireEntreesCasAjoutes())[r.casId];
    const beaucoup: Record<string, unknown> = {};
    for (let i = 0; i < lecture.CAS_AJOUTES_MAX; i++) beaucoup[`ajout-x${i}-aaaa`] = { ...un, cas: { ...un.cas, id: `ajout-x${i}-aaaa` } };
    await ecrireParametre(lecture.CLE_CAS_AJOUTES, beaucoup);
    await expect(ajoutes.ajouterCas({ ...FORMULAIRE_MINIMAL, theme: "Autre", mot: "AUTRE", sujet: "Les relances restent oubliées trop souvent." })).rejects.toMatchObject({ code: "CAS_AJOUT_PLEIN" });
  });

  it("anti-doublon : un avertissement « ressemble à… » n'empêche pas l'ajout (aucun refus ne vient de la ressemblance)", async () => {
    const apercu = await ajoutes.controlerCasAjoute(FORMULAIRE_MINIMAL);
    expect(apercu.ok).toBe(true);
    expect(apercu.ressemblances).toEqual([]);
    const r = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    // Un second cas très proche (titre et promesse identiques, thème, mot et sujet distincts) : signalé, pas bloqué.
    const proche = { ...FORMULAIRE_MINIMAL, theme: "Relances devis", mot: "RELANCES", sujet: "Vos devis envoyés restent sans réponse." };
    const a2 = await ajoutes.controlerCasAjoute(proche);
    expect(a2.ok).toBe(true);
    expect(a2.ressemblances.map((x) => x.id)).toContain(r.casId);
    await expect(ajoutes.ajouterCas(proche)).resolves.toMatchObject({ casId: expect.stringMatching(/^ajout-/) });
  });
});

describe("ajouter un cas · script fourni", () => {
  it("script refusé : rien n'est écrit (ni cas, ni validation)", async () => {
    await expect(ajoutes.ajouterCas(FORMULAIRE_MINIMAL, { script: "Une seule ligne sans queue ni tête" })).rejects.toMatchObject({ code: "SCRIPT_FOURNI_REFUSE" });
    expect(await lecture.lireCasAjoutes()).toEqual([]);
  });

  it("script conforme : enregistré comme script fourni", async () => {
    const r = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL, { script: texteDuCas() });
    expect(r.scriptEnregistre).toBe(true);
    const cas = (await acces.trouverCasAutorise(r.casId))!;
    const s = await scripts.scriptValideCourant(cas);
    expect(s?.fourni).toBe(true);
    expect(s?.casId).toBe(r.casId);
  }, 30_000);
});

describe("ajouter un cas · contrôles avant le prix (jamais contournés)", () => {
  it("non validé hors essai : refus avant le prix ; en essai : permis", async () => {
    const { casId } = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL, { valider: false });
    expect((await service.estimerCas(casId, RESEAUX, false)).refus).toMatch(/pas encore validé/);
    expect((await service.estimerCas(casId, RESEAUX, false, { essai: true })).refus).toBeUndefined();
    const r = await service.preparerEtLancer(demande(casId, { accordCentimes: 10_000 }), { lancer });
    expect(r.statut).toBe("refusee");
    expect(lancer).not.toHaveBeenCalled();
  }, 30_000);

  it("retiré : refus net, avant toute création de vidéo ; remis, tout repart", async () => {
    const { casId } = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    await retires.retirerCas(casId);
    expect((await service.estimerCas(casId, RESEAUX, false)).refus).toBe(PHRASE_CAS_RETIRE);
    expect(await service.preparerEtLancer(demande(casId, { accordCentimes: 10_000 }), { lancer })).toEqual({ statut: "refusee", phrase: PHRASE_CAS_RETIRE });
    expect(await depots().videos.compter((v) => v.formatId === "cas-concret")).toBe(0);
    await retires.remettreCas(casId);
    expect((await service.estimerCas(casId, RESEAUX, false)).refus).toBeUndefined();
  }, 30_000);

  it("déjà traité (vidéo finie) : refus net, comme pour un cas du catalogue", async () => {
    const { casId } = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    const a = await service.preparerEtLancer(demande(casId, { accordCentimes: undefined }), { lancer });
    expect(a.statut).toBe("accord-requis");
    if (a.statut !== "accord-requis") return;
    await depots().videos.modifier(a.videoId, { statut: "prete" });
    expect((await service.estimerCas(casId, RESEAUX, false)).refus).toBe(PHRASE_CAS_TRAITE);
  }, 30_000);

  it("le cas ajouté est figé dans sa vidéo ; le montant demandé est celui du moteur sur la commande", async () => {
    const { casId } = await ajoutes.ajouterCas(FORMULAIRE_MINIMAL);
    const feuille = (await service.estimerCas(casId, RESEAUX, false)).centimes;
    const a = await service.preparerEtLancer(demande(casId, { accordCentimes: undefined }), { lancer });
    expect(a.statut).toBe("accord-requis");
    if (a.statut !== "accord-requis") return;
    const commande = await construireCommande(a.videoId);
    const e = commande.entrees.casConcret as { casFige?: { id: string }; casId: string };
    expect(e.casId).toBe(casId);
    expect(e.casFige?.id).toBe(casId);
    expect((await moteurDeCommande(commande).estimer(commande)).total.centimes).toBe(a.centimes);
    expect(feuille).toBe(a.centimes);
    expect(moteurDeCommande(commande).refusAuLancement?.(commande)).toBeNull();
  }, 30_000);

  it("un cas du catalogue n'est JAMAIS figé (comme avant) : aucune différence pour le stock", async () => {
    const id = CATALOGUE[0].id;
    await service.confirmerCas(id);
    const a = await service.preparerEtLancer(demande(id, { accordCentimes: undefined }), { lancer });
    if (a.statut !== "accord-requis") return;
    const commande = await construireCommande(a.videoId);
    expect((commande.entrees.casConcret as Record<string, unknown>).casFige).toBeUndefined();
  }, 30_000);
});
