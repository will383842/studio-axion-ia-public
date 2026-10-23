/**
 * S1a : `listerCas`, `confirmerCas`, `estimerCas`, `preparerEtLancer`. Base en mémoire, lancement par un double :
 * aucun service réel, aucun `fetch`, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const mots = await import("@/services/cas-concret-mots");
const { ecrireParametre } = await import("@/services/_commun");
const { construireCommande } = await import("@/services/fabrication");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");

const MDP = "cas-concret-lancement";
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
  await donnerVoixAvocat();
});

/** « Moi » a deux voix prêtes : la voix par défaut, puis (en second) celle du format avocat. */
async function donnerVoixAvocat(avocat: "pret" | "absente" | "brouillon" = "pret") {
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  if (avocat !== "absente") await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: avocat === "pret" ? "pret" : "brouillon" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: avocat === "absente" ? {} : { avocat: "voix-avocat-test" } });
}

const demande = (o: Partial<Parameters<typeof service.preparerEtLancer>[0]> = {}) => ({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT, ...o });

let travaux = 0;
const lancer = vi.fn(async () => ({ travailId: `t-test-${++travaux}` }));

const videosCas = async () => depots().videos.lister((v) => v.formatId === "cas-concret");

describe("cas valides", () => {
  it("recrutement-apporteurs est valide sans aucun réglage", async () => {
    const { valides, aValider } = await service.listerCas();
    expect(valides.map((c) => c.cas.id)).toContain("recrutement-apporteurs");
    expect(aValider.map((c) => c.cas.id)).not.toContain("recrutement-apporteurs");
    expect(valides.length + aValider.length).toBe(CATALOGUE.length);
  });

  it("confirmer 6 cas ne crée ni Matière ni Preuve", async () => {
    const avant = { m: await depots().matieres.lister(), p: await depots().preuves.lister() };
    const { aValider } = await service.listerCas();
    for (const c of aValider.slice(0, 6)) await service.confirmerCas(c.cas.id);
    expect(await depots().matieres.lister()).toEqual(avant.m);
    expect(await depots().preuves.lister()).toEqual(avant.p);
    expect((await service.listerCas()).aValider).toHaveLength(Math.max(0, aValider.length - 6));
    const journal = await depots().evenements.lister((e) => e.message.startsWith("Cas validé : "));
    expect(journal).toHaveLength(Math.min(6, aValider.length));
  });

  it("un cas dont l'empreinte a changé redevient « à valider »", async () => {
    const { aValider } = await service.listerCas();
    const id = aValider[0].cas.id;
    await service.confirmerCas(id);
    expect((await service.listerCas()).valides.map((c) => c.cas.id)).toContain(id);
    const reglage = (await depots().parametres.obtenir("casConcret.validations"))!;
    await depots().parametres.modifier("casConcret.validations", { valeur: { ...(reglage.valeur as object), [id]: { empreinte: "cas-ancienne", valideLe: new Date().toISOString() } } });
    expect((await service.listerCas()).aValider.map((c) => c.cas.id)).toContain(id);
  });

  it("une validation de plus de 180 jours ne vaut plus", async () => {
    const { aValider } = await service.listerCas();
    const id = aValider[0].cas.id;
    const il = Date.now() - 181 * 86_400_000;
    await service.confirmerCas(id, { maintenant: il });
    expect((await service.listerCas()).aValider.map((c) => c.cas.id)).toContain(id);
    await service.confirmerCas(id, { maintenant: Date.now() - 10 * 86_400_000 });
    expect((await service.listerCas()).valides.map((c) => c.cas.id)).toContain(id);
  });
});

describe("estimerCas", () => {
  it("rend un montant sans créer de vidéo", async () => {
    // V4-3 : un cas sans script validé (l'écriture se paie ; la voix d'essai est gratuite) ; « recrutement-apporteurs »
    // n'a plus d'écriture à payer (son script validé est rejoué).
    const e = await service.estimerCas("rappels-rendez-vous", RESEAUX, true, { essai: true });
    expect(e.centimes).toBeGreaterThan(0);
    expect(e.phrase).toMatch(/^environ .*€/);
    expect(await videosCas()).toHaveLength(0);
  });
});

describe("preparerEtLancer", () => {
  it("lance un cas valide : voix de l'avocat par son identifiant, script trame, entrées complètes", async () => {
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await videosCas();
    expect(v.statut).toBe("brouillon");
    expect(v.distribution).toEqual([{ role: "voix", source: "double", personnageId: "p-will", voixId: "voix-avocat-test" }]);
    const e = (v.entrees as { casConcret: Record<string, unknown> }).casConcret;
    expect(e).toMatchObject({ casId: "recrutement-apporteurs", porte: "A", mot: "IA", avecMot: true, essai: false, reseaux: RESEAUX });
    expect(e.empreinteCas).toMatch(/^cas-/);
    expect(e.codeSuivi).toMatch(/^cc-recrutement-apporteurs-[a-z0-9]{1,6}$/);
    const script = (await depots().scripts.obtenir(v.scriptId!))!;
    expect(script.blocs.length).toBeGreaterThanOrEqual(8);
    expect(script.blocs.every((b) => b.segments[0].texte.length > 0)).toBe(true);
  });

  it("L0a · un cas qui a un script validé : le script de la vidéo EST ce script (un bloc par écran, texte dit)", async () => {
    const { scriptValideDuCatalogue } = await import("@/moteurs/montage-cas-concret/script-valide");
    const valide = scriptValideDuCatalogue("recrutement-apporteurs")!;
    await service.preparerEtLancer(demande(), { lancer });
    const [v] = await videosCas();
    const script = (await depots().scripts.obtenir(v.scriptId!))!;
    expect(script.blocs.map((b) => b.segments.map((s) => s.texte).join(" "))).toEqual(valide.ecrans.map((e) => e.texteDit.trim()));
    expect(script.blocs[0].blocRecette).toBe("accroche");
    expect(script.blocs.at(-1)!.blocRecette).toBe("question");
    expect(script.blocs[0].segments[0].id).toBe(`${v.id}-s1`);
  });

  it("L0a · au lancement de la fabrication, aucun sous-titre « de lancement » n'est tiré du brouillon", async () => {
    const r = await service.preparerEtLancer(demande());
    expect(r.statut).toBe("lancee");
    const [v] = await videosCas();
    expect(await depots().sousTitres.lister((s) => s.videoId === v.id)).toEqual([]);
  });

  it("entrees.casConcret est recopié dans la commande", async () => {
    await service.preparerEtLancer(demande(), { lancer });
    const [v] = await videosCas();
    const commande = await construireCommande(v.id);
    expect(commande.entrees.casConcret).toEqual((v.entrees as Record<string, unknown>).casConcret);
    expect(commande.distribution[0].voixId).toBe("voix-avocat-test");
  });

  it("sans montant confirmé suffisant, rien n'est lancé", async () => {
    lancer.mockClear();
    for (const accordCentimes of [undefined, true, 1]) {
      // V4-3 : un cas sans script validé, en essai (un prix non nul ; voir « rend un montant »).
      const r = await service.preparerEtLancer(demande({ accordCentimes, casId: "rappels-rendez-vous", essai: true }), { lancer });
      expect(r.statut).toBe("accord-requis");
    }
    expect(lancer).not.toHaveBeenCalled();
  });

  it("refus de budget puis nouvel essai : même vidéo, pas de « mot déjà pris »", async () => {
    const a = await service.preparerEtLancer(demande({ accordCentimes: undefined }), { lancer });
    const b = await service.preparerEtLancer(demande(), { lancer });
    expect(a.statut).toBe("accord-requis");
    expect(b.statut).toBe("lancee");
    expect(await videosCas()).toHaveLength(1);
    expect(b.statut === "lancee" && a.statut === "accord-requis" && b.videoId === a.videoId).toBe(true);
  });

  it("deux appels simultanés : une seule vidéo", async () => {
    await Promise.all([service.preparerEtLancer(demande(), { lancer }), service.preparerEtLancer(demande(), { lancer })]);
    expect(await videosCas()).toHaveLength(1);
  });

  it("mot déjà pris par une autre vidéo du format : refusé ; sans le mot, permis", async () => {
    // X6 : le contrôle ne vaut que pour un mot réellement dit, donc branché sur un compte coché.
    await mots.poserBranchementMot("IA", "facebook", "branche", "2026-10-12T08:00:00.000Z");
    await service.preparerEtLancer(demande(), { lancer });
    const r = await service.preparerEtLancer(demande({ casId: "rappels-rendez-vous", essai: true }), { lancer });
    expect(r).toEqual({ statut: "refusee", phrase: "Ce mot est déjà pris par une autre vidéo." });
    const sans = await service.preparerEtLancer(demande({ casId: "rappels-rendez-vous", essai: true, avecMot: false }), { lancer });
    expect(sans.statut).toBe("lancee");
  });

  it("refuse un mot mal formé, aucun réseau, un cas inconnu, un cas changé", async () => {
    expect((await service.preparerEtLancer(demande({ mot: "a b" }), { lancer })).statut).toBe("refusee");
    expect(await service.preparerEtLancer(demande({ reseaux: [] }), { lancer })).toEqual({ statut: "refusee", phrase: "Choisissez au moins un réseau." });
    expect((await service.preparerEtLancer(demande({ casId: "nexiste-pas" }), { lancer })).statut).toBe("refusee");
    expect(await service.preparerEtLancer(demande({ empreinteVue: "cas-vieille" }), { lancer })).toEqual({ statut: "refusee", phrase: "Ce cas a changé : relisez-le avant de fabriquer." });
    expect(await videosCas()).toHaveLength(0);
  });

  it("un cas non validé est refusé, sauf en essai", async () => {
    const { aValider } = await service.listerCas();
    const casId = aValider[0].cas.id;
    expect((await service.preparerEtLancer(demande({ casId, mot: "ESSAI" }), { lancer })).statut).toBe("refusee");
    expect(await videosCas()).toHaveLength(0);
    const r = await service.preparerEtLancer(demande({ casId, mot: "ESSAI", essai: true }), { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await videosCas();
    expect((v.entrees as { casConcret: { essai: boolean } }).casConcret.essai).toBe(true);
  });

  it("X8 · rien de désigné pour l'avocat, ou la voix désignée pas prête : la voix habituelle est lue", async () => {
    for (const etat of ["absente", "brouillon"] as const) {
      reinitialiserDepots();
      await auth.seConnecter(MDP, false);
      await donnerVoixAvocat(etat);
      expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
      const [v] = await videosCas();
      expect(v.distribution[0]).toMatchObject({ personnageId: "p-will", voixId: "voix-will" });
    }
  });

  it("aucune voix prête de HeyGen : refus, rien de créé", async () => {
    await depots().voix.modifier("voix-will", { statut: "brouillon" });
    await depots().voix.modifier("voix-avocat-test", { fournisseur: "elevenlabs" });
    expect(await service.preparerEtLancer(demande(), { lancer })).toEqual({ statut: "refusee", phrase: "Votre voix n'est pas prête." });
    expect(await videosCas()).toHaveLength(0);
  });

  it("deux vidéos du même cas ont deux codes de suivi différents, stables à la reprise", async () => {
    const a = await service.preparerEtLancer(demande({ accordCentimes: undefined }), { lancer });
    const codeA = ((await videosCas())[0].entrees as { casConcret: { codeSuivi: string } }).casConcret.codeSuivi;
    // Reprise du brouillon : le code ne change pas.
    await service.preparerEtLancer(demande({ accordCentimes: undefined }), { lancer });
    expect(((await videosCas())[0].entrees as { casConcret: { codeSuivi: string } }).casConcret.codeSuivi).toBe(codeA);
    // Brouillon lancé (statut quitté) : la prochaine demande crée une autre vidéo. Le contrôle « sujet déjà traité »
    // (lot L3) refuserait ce second lancement du même cas : il est éteint ici, ce test ne parle que des codes de suivi.
    await ecrireParametre("sujets.garde", "eteint");
    if (a.statut === "accord-requis") await depots().videos.modifier(a.videoId, { statut: "en_fabrication" });
    await service.preparerEtLancer(demande({ mot: "AUTRE", accordCentimes: undefined }), { lancer });
    const codes = (await videosCas()).map((v) => (v.entrees as { casConcret: { codeSuivi: string } }).casConcret.codeSuivi);
    expect(codes).toHaveLength(2);
    expect(new Set(codes).size).toBe(2);
  });

  it("le fichier n'importe ni publications ni buffer", () => {
    const source = readFileSync(join(process.cwd(), "src/services/cas-concret.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*(publications|buffer)[^"']*["']/);
  });
});
