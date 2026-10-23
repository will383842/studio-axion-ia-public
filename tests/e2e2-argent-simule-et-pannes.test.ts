/**
 * E2E-2 (03/10) — correcteur « argent et fabrication » :
 *  - argent n° 6 : les montants simulés ne sont jamais des dépenses réelles (budget intact, ESSAI à part) ;
 *  - argent n° 7 : « Essai : rien ne sera payé » seulement si rien n'est payé ; voix HeyGen reliée → phrase exacte ;
 *  - argent n° 8 : fal.ai, une panne de SUIVI garde la demande payée (jamais soumise deux fois) ;
 *  - argent n° 13 : la voix HeyGen est enregistrée dès son paiement (pas de double compte ni de « recharge » fantôme) ;
 *  - argent n° 16 et n° 17 : jour et mois de Paris ; tableau des coûts regroupé par outil, chose pour chose ;
 *  - parcours n° 6 : pas de fausse alerte « Prononciation ajoutée depuis » ; n° 7 : « Avant de publier » part de zéro.
 * Faux fournisseurs, aucune clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { DepenseEnregistree, LigneCout, Video } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const generateurDepenses = await import("@/services/generateur-depenses");
const prononciations = await import("@/services/prononciations");
const publications = await import("@/services/publications");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moteurDeCommande } = await import("@/moteurs");
const { avancerIllustrations } = await import("@/moteurs/montage-avocat/fabrication-illustrations");
const { ErreurIllustration } = await import("@/fournisseurs/illustration/depot");

const MDP = "e2e2-argent-simule";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

let soldeHeygen = 500;
const heygen: LecteurCredit = {
  fournisseur: "heygen",
  nom: "HeyGen",
  mode: "reel",
  urlRecharge: "",
  variableCle: "HEYGEN_API_KEY",
  async lireSolde() {
    return { fournisseur: "heygen", centimes: soldeHeygen, devise: "USD", luLe: new Date().toISOString() };
  },
  async testerConnexion() {
    return { ok: true, finCle: "…x", message: "ok", testeLe: new Date().toISOString() };
  },
};

const ligne = (fournisseur: string, c: number, etape = "x"): LigneCout => ({ etape, fournisseur, unite: "forfait", quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" }, total: { centimes: c, devise: "EUR" }, nature: "reel" });

describe("argent n° 6 · les montants simulés ne consomment pas le budget", () => {
  it("fabrication avocat entièrement simulée : budget du mois intact, montant rangé à part (ESSAI)", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    const avant = await couts.resumeBudget();
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 200; i++) {
      const t = await depots().travaux.obtenir(travailId);
      if (t && (t.statut === "termine" || t.statut === "echec")) break;
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    vi.useRealTimers();
    const deps = await depots().depenses.lister((d) => d.travailId === travailId);
    expect(deps.flatMap((d) => d.lignes).some((l) => l.total.centimes > 0)).toBe(true);
    const apres = await couts.resumeBudget();
    expect(apres.depense.centimes).toBe(avant.depense.centimes);
    expect(apres.essai.centimes).toBeGreaterThan(avant.essai.centimes);
    expect(apres.engage.centimes).toBe(0);
  });

  it("une dépense réelle compte ; sa part simulée, non", () => {
    expect(couts.montantPaye({ lignes: [ligne("heygen", 300), ligne("simulation", 200), ligne("montage-avocat", 50)], total: { centimes: 550, devise: "EUR" } }).centimes).toBe(300);
    expect(couts.montantPaye({ lignes: [], total: { centimes: 42, devise: "EUR" } }).centimes).toBe(42);
  });
});

describe("argent n° 7 · la phrase « Essai » dit exactement ce qui sera payé", () => {
  it("aucun outil payant relié : « Essai : rien ne sera payé. »", async () => {
    const r = await generateurDepenses.lireResumeDepense({ centimes: 120, devise: "EUR" });
    expect(r.essai).toBe(true);
    expect(r.messageEssai).toBe("Essai : rien ne sera payé.");
  });

  it("voix HeyGen reliée, double simulé : pas « rien ne sera payé » ; la voix est annoncée comme payée", async () => {
    // Relecture finale G3 : seulement quand la vidéo part à un vrai moteur (le moteur d'essai n'appelle aucune voix).
    await ecrireParametre("moteur.avocat", "montage-avocat");
    credits.injecterLecteursPourEssai([heygen], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    const r = await generateurDepenses.lireResumeDepense({ centimes: 120, devise: "EUR" });
    expect(r.essai).toBe(false);
    expect(r.messageEssai).toMatch(/double est encore un essai/);
    expect(r.messageEssai).toMatch(/voix \(HeyGen\) sera payée/);
  });

  it("budget insuffisant signalé avant le toucher", () => {
    const r = generateurDepenses.resumeDepense({ centimes: 500, devise: "EUR" }, { jour: { centimes: 0, devise: "EUR" }, budgetMois: { centimes: 1000, devise: "EUR" }, depenseMois: { centimes: 800, devise: "EUR" }, seuil: { centimes: 2000, devise: "EUR" }, credits: [], essai: false });
    expect(r.budgetInsuffisant).toBe(true);
    // CORRECTEUR FINAL A : un essai ne paie rien, il ne manque donc jamais de budget (ni ne s'ajoute au jour).
    const essai = generateurDepenses.resumeDepense({ centimes: 500, devise: "EUR" }, { jour: { centimes: 0, devise: "EUR" }, budgetMois: { centimes: 1000, devise: "EUR" }, depenseMois: { centimes: 800, devise: "EUR" }, seuil: { centimes: 2000, devise: "EUR" }, credits: [], essai: true });
    expect(essai).toMatchObject({ budgetInsuffisant: false, jourApres: essai.jourAvant });
    expect(r.budgetRestant).toMatch(/^0/);
  });
});

describe("argent n° 8 · fal.ai : panne passagère pendant le suivi d'une demande déjà soumise", () => {
  it("la demande payée est gardée, son suivi est réessayé : une seule soumission", async () => {
    let soumissions = 0;
    let suivis = 0;
    const f = {
      id: "reel",
      fabrication: {
        soumettre: async (d: { genre: string }) => ({ idDemande: `dem-${d.genre === "image" ? ++soumissions : "clip"}` }),
        suivre: async (id: string) => {
          suivis++;
          if (suivis <= 3) throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "fal.ai ne répond pas : timeout" });
          return { statut: "fait" as const, fichierCle: `k/${id}.jpg`, mime: "image/jpeg", urlSource: `https://x/${id}`, cout: { centimes: 4, devise: "EUR" as const }, coutUsdCentimes: 4, modele: "m" };
        },
      },
    };
    let e = { plans: { "1": { phase: "image" as const, requete: "a desk with files, no people" } } } as never;
    for (let i = 0; i < 6; i++) e = (await avancerIllustrations(e, f as never, "9:16", "trav-x")) as never;
    expect(soumissions).toBe(1);
    expect((e as { plans: Record<string, { phase: string }> }).plans["1"].phase).toBe("clip");
  });
});

describe("argent n° 13 · la voix HeyGen est enregistrée dès son paiement", () => {
  it("dépense écrite pendant la fabrication, jamais recomptée ; le relevé suivant ne voit aucune recharge", async () => {
    credits.injecterLecteursPourEssai([heygen], ["heygen"]);
    soldeHeygen = 500;
    await credits.soldeFournisseur("heygen", 0); // relevé avant le paiement : 5,00 $
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const t = (await depots().travaux.obtenir(travailId))!;
    const version = (await depots().versions.obtenir(t.versionId!))!;
    const taux = await lireParametre<number>("taux.usdEur", 0.92);
    const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 3333, prixUnitaire: { centimes: 0, devise: "EUR" }, total: { centimes: Math.round(100 * taux), devise: "EUR" }, nature: "reel" };
    const moteur = { ...moteurDeCommande(version.commande), lignesPayees: () => [voix] };
    // La voix est payée chez HeyGen (1,00 $) : le tour l'écrit tout de suite.
    soldeHeygen = 400;
    const lu = { travail: t, commande: version.commande, moteur };
    await travaux.ecrireAvancement(lu, { travail: { ...t, statut: "en_cours", modifieLe: new Date(Date.now() + 1).toISOString() } });
    const apres = await depots().depenses.lister((d) => d.travailId === travailId);
    expect(apres.flatMap((d) => d.lignes).filter((l) => l.fournisseur === "heygen")).toHaveLength(1);
    // Un second tour (même voix payée) ne la recompte pas.
    const t2 = (await depots().travaux.obtenir(travailId))!;
    await travaux.ecrireAvancement({ ...lu, travail: t2 }, { travail: { ...t2, modifieLe: new Date(Date.now() + 2).toISOString() } });
    expect((await depots().depenses.lister((d) => d.travailId === travailId)).flatMap((d) => d.lignes).filter((l) => l.fournisseur === "heygen")).toHaveLength(1);
    // Solde affiché juste, et le relevé suivant ne constate aucune recharge.
    // (au centime près : la voix est enregistrée en euros, le solde est en dollars)
    expect(Math.abs((await credits.soldeFournisseur("heygen", null)).solde! - 400)).toBeLessThanOrEqual(3);
    const r = await credits.soldeFournisseur("heygen", 0);
    expect(r.solde).toBe(400);
    expect((await depots().evenements.lister()).some((e) => /Recharge HeyGen constatée/.test(e.message))).toBe(false);
  });
});

describe("argent n° 16 et n° 17 · heure de Paris, tableau des coûts", () => {
  it("le 31 octobre à 23 h 30 UTC, c'est déjà novembre à Paris", () => {
    expect(couts.moisParis("2026-10-31T23:30:00Z")).toBe("2026-11");
    expect(couts.jourParis("2026-10-03T22:30:00Z")).toBe("2026-10-04");
  });

  it("« fal » et « fal.ai » font une seule ligne ; le coût moyen ne compte que le payé ; l'écart compare le travail lancé", () => {
    const depenses = [
      { id: "d1", videoId: "v1", travailId: "t1", date: "2026-10-03T10:00:00Z", lignes: [ligne("heygen", 300), ligne("simulation", 200)], total: { centimes: 500, devise: "EUR" } },
      { id: "d2", videoId: "v1", travailId: "t-retouche", date: "2026-10-03T12:00:00Z", lignes: [ligne("fal", 50)], total: { centimes: 50, devise: "EUR" } },
      { id: "d3", videoId: "v1", date: "2026-10-02T10:00:00Z", lignes: [ligne("fal.ai", 30, "Voix")], total: { centimes: 30, devise: "EUR" } },
    ] as DepenseEnregistree[];
    const videos = [{ id: "v1", terminee: "2026-10-03T13:00:00Z", coutEstime: { centimes: 480, devise: "EUR" }, coutReel: { centimes: 580, devise: "EUR" } }] as Video[];
    const travauxListe = [{ id: "t1", cibleId: "v1", type: "fabrication" as const, statut: "termine" as const, creeLe: "2026-10-03T09:00:00Z" }];
    const t = couts.calculerTableauCouts(depenses, videos, "2026-10", 0.92, travauxListe);
    expect(t.parOutil.filter((o) => o.nom === "fal.ai")).toEqual([expect.objectContaining({ total: { centimes: 80, devise: "EUR" } })]);
    expect(t.coutMoyen?.centimes).toBe(380);
    // Audit 4.2 (série « chiffres ») : le travail t1 a une part simulée (200) : son « réel » serait en partie inventé,
    // il ne se compare pas (le cas payé est couvert par tests/chiffres-budget.test.ts).
    expect(t.ecart).toBeNull();
  });
});

describe("parcours n° 6 · pas de fausse alerte « Prononciation ajoutée depuis »", () => {
  it("vidéo du générateur (texte dit, liste vide) : rien tant que la prononciation était là ; alerte si elle arrive après", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const version = (await depots().versions.obtenir(v.versionChoisieId!))!;
    const construiteLe = new Date().toISOString();
    const texte = `${version.commande.script.texteComplet} Les PME aussi.`;
    await depots().prononciations.enregistrer({ id: "pr-pme", mot: "PME", prononciation: "pé-èm-eu", source: "manuel", creeLe: new Date(Date.now() - 60_000).toISOString(), modifieLe: new Date(Date.now() - 60_000).toISOString() });
    await depots().versions.modifier(version.id, { statut: "prete", commande: { ...version.commande, script: { ...version.commande.script, texteComplet: texte }, prononciations: [], texteDitParSegment: ["…"], construiteLe } });
    expect(await prononciations.prononciationsAjouteesDepuisVideo("v-03")).toEqual([]);
    await depots().prononciations.enregistrer({ id: "pr-aussi", mot: "aussi", prononciation: "o-ssi", source: "manuel", creeLe: new Date(Date.now() + 60_000).toISOString(), modifieLe: new Date(Date.now() + 60_000).toISOString() });
    expect((await prononciations.prononciationsAjouteesDepuisVideo("v-03")).map((p) => p.mot)).toEqual(["aussi"]);
  });

  it("prise filmée par Will : jamais d'alerte (aucune voix de synthèse)", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const version = (await depots().versions.obtenir(v.versionChoisieId!))!;
    await depots().prononciations.enregistrer({ id: "pr-x", mot: version.commande.script.texteComplet.split(/\s+/).find((m) => m.length > 4)!.replace(/[^\p{L}]/gu, ""), prononciation: "zzz", source: "manuel", creeLe: new Date(Date.now() + 60_000).toISOString(), modifieLe: new Date(Date.now() + 60_000).toISOString() });
    await depots().versions.modifier(version.id, { statut: "prete", commande: { ...version.commande, distribution: [{ ...version.commande.distribution[0], source: "rush" }] } });
    expect(await prononciations.prononciationsAjouteesDepuisVideo("v-03")).toEqual([]);
  });
});

describe("parcours n° 7 · « Avant de publier » part de zéro, une retouche décoche Image et Son", () => {
  it("nouveau kit : rien de coché ; après une retouche : Image et Son décochés", async () => {
    const id = "v-03";
    for (const k of await depots().kits.lister((x) => x.videoId === id)) await depots().kits.modifier(k.id, { videoId: `${id}-ancien` });
    const kit = await publications.genererKit(id);
    expect(kit.avantDePublier).toEqual({ image: false, son: false, sousTitres: false, mentionIA: false, droits: false });
    await publications.cocherAvantDePublier(id, "image", true);
    await publications.cocherAvantDePublier(id, "son", true);
    await publications.cocherAvantDePublier(id, "droits", true);
    await publications.decocherApresRetouche(id, "retouche");
    expect((await depots().kits.trouver((k) => k.videoId === id))!.avantDePublier).toMatchObject({ image: false, son: false, droits: true });
  });
});

describe("argent n° 9 · redémarrage pendant la lecture d'une voix HeyGen", () => {
  it("la lecture perdue est comptée comme dépense probable (au nom de HeyGen), une fois", async () => {
    const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
    const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
    await ecrireParametre("moteur.avocat", "montage-avocat");
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    let lectures = 0;
    const voix = { ...fournisseurVoixSimulation, id: "heygen", lire: async (d: Parameters<typeof fournisseurVoixSimulation.lire>[0]) => (++lectures === 1 ? new Promise<never>(() => undefined) : fournisseurVoixSimulation.lire(d)) };
    const m = creerMoteurMontageAvocat({ voix: () => voix });
    boucle.simulerRedemarragePourEssai();
    await boucle.contenuDuTour({ choisirMoteur: () => m, delai: () => 20 });
    // Mise en ligne : le processus meurt, le suivant relit le travail en base (sans la liste des appels en vol).
    boucle.avancementsEnVol().clear();
    boucle.simulerRedemarragePourEssai();
    const t = (await depots().travaux.obtenir(travailId))!;
    await depots().travaux.enregistrer({ ...t, reprise: undefined });
    await boucle.contenuDuTour({ choisirMoteur: () => m });
    const probables = (await depots().depenses.lister((d) => d.videoId === "v-03")).flatMap((d) => d.lignes).filter((l) => /probablement payée/.test(l.etape));
    expect(probables).toHaveLength(1);
    expect(probables[0].fournisseur).toBe("heygen");
    // Un autre tour ne la recompte pas.
    boucle.simulerRedemarragePourEssai();
    await boucle.contenuDuTour({ choisirMoteur: () => m });
    expect((await depots().depenses.lister((d) => d.videoId === "v-03")).flatMap((d) => d.lignes).filter((l) => /probablement payée/.test(l.etape))).toHaveLength(1);
  });
});
