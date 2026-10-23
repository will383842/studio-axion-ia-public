/**
 * VOIX DE RÉFÉRENCE (14/10) branchée sur le format AVOCAT (décision de Will du 14/10 : maquette ET montage final),
 * avec des doubles seulement (aucun appel réel). Prouve : le réglage figé dans la commande au lancement (commande
 * d'avant = contrôle coupé) ; la reprise après échec ne relit ni ne repaie aucune lecture déjà payée ; toutes les
 * lectures payées sont comptées (fabrication et maquette) ; le prix annoncé = le maximum (2 lectures par défaut, 3 au plus à 2 relances) ; le plafond
 * revérifié avant chaque relecture ; le nettoyage des blancs propre à l'avocat inchangé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { REFERENCE_V4, type MesureVoix } from "@/briques/voix-maitre/reference";
import type { PriseVoixMesuree } from "@/briques/voix-maitre/types";
import type { CommandeFabrication, LigneCout, MotHorodate, Travail, VoixBrutePayee } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat, lignesVoixPayee } = await import("@/moteurs/montage-avocat");
const { prixVideoReelle } = await import("@/moteurs/montage-avocat/prix-reel");
const { lignesVoixMaquetteRestantes } = await import("@/briques/voix-maitre/reference");
const { prixMontageReel } = await import("@/services/reglages");
const { centimes } = await import("@/lib/montants");
const { RECETTE_MONTAGE_AVOCAT } = await import("@/formats/avocat");

const MDP = "voix-reference-avocat";
const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);
const ACTIF = { actif: true, relancesMax: 1 }; // défaut (décision de Will du 14/10) : 1 relance, 2 lectures au plus
const PLEIN = { actif: true, relancesMax: 2 }; // réglage explicite : 2 relances, 3 lectures au plus
const LOIN: MesureVoix = { ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.2 };
const aPlat = (m: MesureVoix) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`voix.${k}`, v]));

beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

function motsDe(texte: string): MotHorodate[] {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 40)
    .map((mot, i) => ({ mot, debutSec: +(0.05 + i * 0.4).toFixed(3), finSec: +(0.35 + i * 0.4).toFixed(3) }));
}

/**
 * Doubles : chaque lecture PAYÉE coûte 10 c (`lectures` les compte) ; `pannesLecture` fait échouer les lectures de ce
 * rang AVANT paiement ; chaque mesure rend la suivante de `mesures` ; `panneMesure` fait échouer (définitivement) la
 * mesure de ces rangs (1 = la première mesure soumise) ; `panneAnalyse` refuse l'analyse des respirations.
 */
function doubles(o: { mesures: MesureVoix[]; pannesLecture?: number[]; panneMesure?: number[]; panneAnalyse?: boolean }) {
  const file = [...o.mesures];
  const soumises = new Map<string, DemandeRendu>();
  const etat = { tentatives: 0, lectures: 0, mesures: 0, audioSeul: true };
  const voix = {
    id: "heygen",
    mode: "reel",
    get capacites() {
      return { audioSeul: etat.audioSeul, horodatageMots: true };
    },
    async lire(d: { texte: string }) {
      etat.tentatives++;
      if (o.pannesLecture?.includes(etat.tentatives)) throw Object.assign(new Error("voix indisponible"), { reessayable: false });
      etat.lectures++;
      const mots = motsDe(d.texte);
      return { fichierCle: `studio/test/brut-${etat.lectures}.mp3`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, cout: { centimes: 10, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = (): StockageFichiers =>
    ({
      urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
      urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
      urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
    }) as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      if (d.parametres.mode === "mesure-voix") etat.mesures++;
      soumises.set(d.idRendu, { ...d, parametres: { ...d.parametres, rang: etat.mesures } });
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") {
        if (o.panneMesure?.includes(d.parametres.rang as number)) return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "mesure impossible" } } as EtatRendu;
        return { statut: "termine", sortieCle: d.sortie.cle, mesures: aPlat(file.shift() ?? REFERENCE_V4) };
      }
      if (o.panneAnalyse && d.parametres.mode === "analyse") return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "son illisible" } } as EtatRendu;
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: { dureeSec: 5 } };
    },
  };
  const m = creerMoteurMontageAvocat({ voix: () => voix, stockage, rendu, pauseMs: 0 });
  return { m, etat };
}

const phaseVoix = (t: Travail) => (t.parametres?.voix as { phase: string } | undefined)?.phase;

/** Avance jusqu'à la fin de la voix ou à la première panne (la boucle de fond marque alors l'étape « échec »). */
async function avancerVoix(m: ReturnType<typeof doubles>["m"], t: Travail, c: CommandeFabrication): Promise<{ t: Travail; panne?: unknown }> {
  for (let i = 0; i < 60; i++) {
    if (t.etapes.find((e) => e.cle === "voix")?.statut === "terminee") return { t };
    try {
      t = JSON.parse(JSON.stringify((await m.avancer(t, c, T0 + i * 1000)).travail)) as Travail;
    } catch (panne) {
      return { t: { ...t, statut: "echec", etapes: t.etapes.map((e) => (e.cle === "voix" ? { ...e, statut: "echec" as const } : e)) }, panne };
    }
  }
  throw new Error("voix inachevée");
}

async function commandeAvocat(): Promise<CommandeFabrication> {
  const c = await fabrication.construireCommande("v-03");
  expect(c.formatId).toBe("avocat");
  return c;
}

describe("voix de référence · avocat · réglage figé au lancement", () => {
  it("la commande de l'avocat fige le contrôle (actif, 1 relance par défaut) ; la commande d'avant (sans entrée) = contrôle coupé", async () => {
    const c = await commandeAvocat();
    expect(c.entrees?.ressemblanceVoix).toEqual(ACTIF);
    // Contrôle actif par défaut : chaque lecture est mesurée, relue UNE fois au plus (2 lectures), toutes comptées.
    const a = doubles({ mesures: [LOIN, LOIN, LOIN] });
    const r = await avancerVoix(a.m, await a.m.lancer(c, { travailId: "t1", versionId: "v1", titre: "T", maintenant: T0 }), c);
    expect(a.etat.lectures).toBe(2);
    const audio = (r.t.parametres?.voix as { audio: { coutCentimes: number; ressemblance?: { prises: unknown[] } } }).audio;
    expect(audio.coutCentimes).toBe(20);
    expect(audio.ressemblance?.prises).toHaveLength(2);
    // Réglage explicite à 2 relances : 3 lectures au plus.
    const plein = { ...c, entrees: { ...c.entrees, ressemblanceVoix: PLEIN } };
    const p = doubles({ mesures: [LOIN, LOIN, LOIN] });
    const rp = await avancerVoix(p.m, await p.m.lancer(plein, { travailId: "t1b", versionId: "v1b", titre: "T", maintenant: T0 }), plein);
    expect(p.etat.lectures).toBe(3);
    expect((rp.t.parametres?.voix as { audio: { coutCentimes: number } }).audio.coutCentimes).toBe(30);
    // Commande d'avant : aucune mesure, une seule lecture.
    const { ressemblanceVoix: _r, ...entrees } = c.entrees ?? {};
    void _r;
    const avant = { ...c, entrees };
    const b = doubles({ mesures: [LOIN] });
    const rb = await avancerVoix(b.m, await b.m.lancer(avant, { travailId: "t2", versionId: "v2", titre: "T", maintenant: T0 }), avant);
    expect(b.etat.lectures).toBe(1);
    expect(b.etat.mesures).toBe(0);
    expect((rb.t.parametres?.voix as { audio: { ressemblance?: unknown } }).audio.ressemblance).toBeUndefined();
  });

  it("le nettoyage des blancs propre à l'avocat ne change pas", () => {
    expect(RECETTE_MONTAGE_AVOCAT.nettoyageBlancs).toEqual({ seuilMs: 180, cibleMs: [80, 120], fonduMs: [10, 20], respirationMs: [150, 250], teteMaxMs: 100 });
  });
});

describe("voix de référence · avocat · reprise après échec (aucune lecture payée relue ni repayée)", () => {
  it("panne de la MESURE puis « Réessayer » : la lecture payée est mesurée, pas relue ni sautée", async () => {
    const c = await commandeAvocat();
    const a = doubles({ mesures: [LOIN, REFERENCE_V4], panneMesure: [1] });
    const r1 = await avancerVoix(a.m, await a.m.lancer(c, { travailId: "t3", versionId: "v3", titre: "T", maintenant: T0 }), c);
    expect(r1.panne).toBeDefined();
    expect(a.etat.lectures).toBe(1);
    const repris = await a.m.reessayer(r1.t, T0 + 100_000);
    expect(repris.parametres?.voix).toMatchObject({ phase: "a-mesurer", brut: { fichierCle: "studio/test/brut-1.mp3" }, prises: [] });
    const r2 = await avancerVoix(a.m, repris, c);
    expect(r2.panne).toBeUndefined();
    // 1re lecture (payée avant la panne) mesurée LOIN, 2e ressemblante : 2 lectures payées, jamais 3.
    expect(a.etat.lectures).toBe(2);
    expect((r2.t.parametres?.voix as { audio: { coutCentimes: number; ressemblance: { prises: unknown[]; retenue: number } } }).audio).toMatchObject({ coutCentimes: 20, ressemblance: { retenue: 1 } });
  });

  it("panne pendant une RELECTURE puis « Réessayer » : les lectures déjà payées et mesurées sont gardées", async () => {
    const c = await commandeAvocat();
    // 1re lecture payée (LOIN), la relecture tombe en panne avant d'être payée, puis réussit.
    const a = doubles({ mesures: [LOIN, REFERENCE_V4], pannesLecture: [2] });
    const r1 = await avancerVoix(a.m, await a.m.lancer(c, { travailId: "t4", versionId: "v4", titre: "T", maintenant: T0 }), c);
    expect(r1.panne).toBeDefined();
    expect(phaseVoix(r1.t)).toBe("a-relire");
    const repris = await a.m.reessayer(r1.t, T0 + 100_000);
    expect(repris.parametres?.voix).toMatchObject({ phase: "a-relire", prises: [{ brut: { fichierCle: "studio/test/brut-1.mp3" } }] });
    const r2 = await avancerVoix(a.m, repris, c);
    expect(r2.panne).toBeUndefined();
    expect(a.etat.lectures).toBe(2);
    const audio = (r2.t.parametres?.voix as { audio: { coutCentimes: number; ressemblance: { prises: { fichierCle: string }[] } } }).audio;
    expect(audio.coutCentimes).toBe(20);
    expect(audio.ressemblance.prises.map((p) => p.fichierCle)).toEqual(["studio/test/brut-1.mp3", "studio/test/brut-2.mp3"]);
  });
});

describe("voix de référence · avocat · dépense : toutes les lectures payées comptent", () => {
  const brut = (n: number) => ({ fichierCle: `studio/test/brut-${n}.mp3`, dureeSec: 3, mots: [], coutCentimes: 10, fournisseur: "heygen", caracteres: 100 });
  const prise = (n: number): PriseVoixMesuree => ({ brut: brut(n), empreinteDemande: `e#lecture-${n}`, mesure: LOIN, ressemblante: false, ecarts: [] });
  const total = (l: LigneCout[]) => l.reduce((s, x) => s + x.total.centimes, 0);

  it("lignesVoixPayee compte les lectures déjà mesurées (etat.prises) en plus de la lecture en cours", () => {
    expect(total(lignesVoixPayee({ phase: "a-relire", texte: "t", prises: [prise(1), prise(2)] }))).toBe(20);
    expect(total(lignesVoixPayee({ phase: "mesure", brut: brut(2), texte: "t", prises: [prise(1)], demande: {} as DemandeRendu }))).toBe(20);
    expect(total(lignesVoixPayee({ phase: "a-mesurer", brut: brut(3), texte: "t", prises: [prise(1), prise(2)] }))).toBe(30);
    expect(lignesVoixPayee({ phase: "a-relire", texte: "t", prises: [prise(1), prise(2)] })[0]).toMatchObject({ etape: "Voix", fournisseur: "heygen", quantite: 200 });
    // Sans contrôle : comme avant (la lecture en cours seule).
    expect(total(lignesVoixPayee({ phase: "a-analyser", brut: brut(1) }))).toBe(10);
  });

  it("maquette en panne après une relecture : l'erreur porte TOUTES les lectures payées, la maquette suivante les reprend sans relire", async () => {
    const c = await commandeAvocat();
    // 1re lecture LOIN ; la mesure de la 2e lecture tombe en panne (définitive).
    const a = doubles({ mesures: [LOIN, REFERENCE_V4], panneMesure: [2] });
    const erreur = (await a.m.maquette(c).catch((e) => e)) as { lignesPayees?: LigneCout[]; voixBrute?: VoixBrutePayee };
    expect(a.etat.lectures).toBe(2);
    expect(total(erreur.lignesPayees ?? [])).toBe(20);
    expect(erreur.voixBrute).toMatchObject({ fichierCle: "studio/test/brut-2.mp3", controleVoix: { phase: "a-mesurer", prises: [{ brut: { fichierCle: "studio/test/brut-1.mp3" } }] } });
    // Maquette suivante (le service garde `voixBrute`) : la 2e lecture est mesurée, aucune n'est relue ni recomptée.
    const b = doubles({ mesures: [REFERENCE_V4] });
    const m = await b.m.maquette(c, { voixBrute: JSON.parse(JSON.stringify(erreur.voixBrute)) as VoixBrutePayee });
    expect(b.etat.lectures).toBe(0);
    expect(b.etat.mesures).toBe(1);
    expect(total(m.lignesReelles ?? [])).toBe(0);
  });

  it("maquette en panne pendant une relecture : reprise en relecture, les lectures payées gardées (une seule lecture de plus)", async () => {
    const c = await commandeAvocat();
    const a = doubles({ mesures: [LOIN], pannesLecture: [2] });
    const erreur = (await a.m.maquette(c).catch((e) => e)) as { lignesPayees?: LigneCout[]; voixBrute?: VoixBrutePayee };
    expect(a.etat.lectures).toBe(1);
    expect(total(erreur.lignesPayees ?? [])).toBe(10);
    expect(erreur.voixBrute?.controleVoix).toMatchObject({ phase: "a-relire", prises: [{ brut: { fichierCle: "studio/test/brut-1.mp3" } }] });
    const b = doubles({ mesures: [REFERENCE_V4] });
    const m = await b.m.maquette(c, { voixBrute: JSON.parse(JSON.stringify(erreur.voixBrute)) as VoixBrutePayee });
    expect(b.etat.lectures).toBe(1);
    // Seule la nouvelle lecture est payée par cette maquette (la 1re l'a été par la précédente).
    expect(total(m.lignesReelles ?? [])).toBe(10);
  });

  it("maquette en panne après le choix de la prise : le rapport de ressemblance est repris avec le son, rien n'est relu", async () => {
    const c = await commandeAvocat();
    // 1re lecture LOIN, 2e ressemblante ; l'analyse des respirations est refusée définitivement.
    const a = doubles({ mesures: [LOIN, REFERENCE_V4], panneAnalyse: true });
    const erreur = (await a.m.maquette(c).catch((e) => e)) as { lignesPayees?: LigneCout[]; voixBrute?: VoixBrutePayee };
    expect(a.etat.lectures).toBe(2);
    expect(total(erreur.lignesPayees ?? [])).toBe(20);
    expect(erreur.voixBrute).toMatchObject({ fichierCle: "studio/test/brut-2.mp3", ressemblance: { retenue: 1, ressemblante: true } });
    expect(erreur.voixBrute?.controleVoix).toBeUndefined();
    const b = doubles({ mesures: [] });
    const m = await b.m.maquette(c, { voixBrute: JSON.parse(JSON.stringify(erreur.voixBrute)) as VoixBrutePayee });
    expect([b.etat.lectures, b.etat.mesures]).toEqual([0, 0]);
    expect(total(m.lignesReelles ?? [])).toBe(0);
  });
});

describe("voix de référence · avocat · prix annoncé = maximum (2 lectures par défaut, 3 au plus)", () => {
  it("estimation de l'avocat (fabrication et maquette) : la ligne Voix couvre 2 lectures par défaut, 3 à 2 relances ; commande d'avant : 1", async () => {
    const c = await commandeAvocat();
    const m = creerMoteurMontageAvocat({ pauseMs: 0 });
    const voix = async (x: CommandeFabrication) => (await m.estimer(x)).lignes.find((l) => l.etape === "Voix")!;
    const { ressemblanceVoix: _r, ...entrees } = c.entrees ?? {};
    void _r;
    const une = await voix({ ...c, entrees });
    const deux = await voix(c);
    expect(deux.quantite).toBe(2 * une.quantite);
    expect(deux.total.centimes).toBeGreaterThanOrEqual(2 * une.total.centimes - 1);
    expect(deux.total.centimes).toBeLessThanOrEqual(2 * une.total.centimes);
    const trois = await voix({ ...c, entrees: { ...c.entrees, ressemblanceVoix: PLEIN } });
    expect(trois.quantite).toBe(3 * une.quantite);
    expect(trois.total.centimes).toBeGreaterThanOrEqual(3 * une.total.centimes - 2);
    expect(trois.total.centimes).toBeLessThanOrEqual(3 * une.total.centimes);
  });

  it("prix d'une vidéo montée pour de vrai : paramètre optionnel lecturesVoixMax (absent : prix d'avant)", () => {
    const avant = prixVideoReelle({ reseaux: [] });
    const deux = prixVideoReelle({ reseaux: [], lecturesVoixMax: 2 });
    const trois = prixVideoReelle({ reseaux: [], lecturesVoixMax: 3 });
    const v = (p: typeof avant) => p.lignes.find((l) => l.quoi === "Voix")!.montant.centimes;
    expect(v(deux)).toBeGreaterThanOrEqual(2 * v(avant) - 1);
    expect(v(deux)).toBeLessThanOrEqual(2 * v(avant));
    expect(v(trois)).toBeGreaterThanOrEqual(3 * v(avant) - 2);
    expect(v(trois)).toBeLessThanOrEqual(3 * v(avant));
    expect(trois.total.centimes - avant.total.centimes).toBe(v(trois) - v(avant));
    expect(prixVideoReelle({ reseaux: [], lecturesVoixMax: 1 })).toEqual(avant);
  });
});

describe("voix de référence · avocat · prix vérifié d'une maquette reprise", () => {
  const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 300, prixUnitaire: centimes(1), total: centimes(300), nature: "estime" };
  const prise = (n: number): PriseVoixMesuree => ({ brut: { fichierCle: `b-${n}`, dureeSec: 3, mots: [], coutCentimes: 10, fournisseur: "heygen", caracteres: 100 }, empreinteDemande: `e#lecture-${n}`, mesure: LOIN, ressemblante: false, ecarts: [] });
  const c = { entrees: { ressemblanceVoix: PLEIN } };
  const cDefaut = { entrees: { ressemblanceVoix: ACTIF } };

  it("son repris sans contrôle en cours : rien à payer ; contrôle en cours : seulement les relectures encore permises", () => {
    expect(lignesVoixMaquetteRestantes([voix], {}, c)).toEqual([]);
    // Défaut (1 relance, 2 lectures au plus) : 1 lecture payée (à mesurer) → 1 relecture ; 2 payées → rien.
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-mesurer", prises: [] } }, cDefaut)).toEqual([{ ...voix, quantite: 150, total: centimes(150) }]);
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-relire", prises: [prise(1)] } }, cDefaut)).toEqual([{ ...voix, quantite: 150, total: centimes(150) }]);
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-mesurer", prises: [prise(1)] } }, cDefaut)).toEqual([]);
    // Réglé à 2 relances (3 lectures au plus) : 1 lecture payée (à mesurer) : 2 relectures possibles au plus.
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-mesurer", prises: [] } }, c)).toEqual([{ ...voix, quantite: 200, total: centimes(200) }]);
    // 2 lectures payées et mesurées, la 3e à lire : une seule.
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-relire", prises: [prise(1), prise(2)] } }, c)).toEqual([{ ...voix, quantite: 100, total: centimes(100) }]);
    // Plafond atteint : rien.
    expect(lignesVoixMaquetteRestantes([voix], { controleVoix: { phase: "a-mesurer", prises: [prise(1), prise(2)] } }, c)).toEqual([]);
  });

  it("écran Réglages : le prix d'une vidéo avocat montée pour de vrai montre la voix lue 2 fois par défaut", async () => {
    const p = await prixMontageReel("avocat");
    const avant = prixVideoReelle({ reseaux: [], lecturesVoixMax: 1 });
    const unique = avant.lignes.find((l) => l.quoi === "Voix")!.montant.centimes;
    const montre = p.lignes.find((l) => l.quoi === "Voix")!.montant.centimes;
    expect(montre).toBeGreaterThanOrEqual(2 * unique - 1);
    expect(montre).toBeLessThanOrEqual(2 * unique);
  });

  it("écran Réglages : réglé à 2 relances, la voix est montrée lue 3 fois", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("voix.ressemblance", { actif: true, relancesMax: 2 });
    const p = await prixMontageReel("avocat");
    const unique = prixVideoReelle({ reseaux: [], lecturesVoixMax: 1 }).lignes.find((l) => l.quoi === "Voix")!.montant.centimes;
    const montre = p.lignes.find((l) => l.quoi === "Voix")!.montant.centimes;
    expect(montre).toBeGreaterThanOrEqual(3 * unique - 2);
    expect(montre).toBeLessThanOrEqual(3 * unique);
  });
});

describe("voix de référence · avocat · plafond revérifié avant chaque relecture", () => {
  it("la voix vérifiée avant chaque relecture : devenue incompatible, la relecture n'est pas payée", async () => {
    const c = await commandeAvocat();
    const a = doubles({ mesures: [LOIN] });
    let e: Parameters<typeof a.m.avancerVoix>[0] = { phase: "a-lire" };
    for (let i = 0; i < 10 && e.phase !== "a-relire"; i++) e = await a.m.avancerVoix(e, c, "id", T0);
    a.etat.audioSeul = false;
    await expect(a.m.avancerVoix(e, c, "id", T0)).rejects.toMatchObject({ code: "VOIX_INCOMPATIBLE" });
    expect(a.etat.lectures).toBe(1);
  });

  it("plafond des lectures atteint (prix confirmé couvert) : aucune lecture de plus n'est payée", async () => {
    const c = await commandeAvocat();
    const a = doubles({ mesures: [] });
    const brut = (n: number) => ({ fichierCle: `b-${n}`, dureeSec: 3, mots: [], coutCentimes: 10, fournisseur: "heygen", caracteres: 100 });
    const prises = [1, 2, 3].map((n): PriseVoixMesuree => ({ brut: brut(n), empreinteDemande: `e#lecture-${n}`, mesure: LOIN, ressemblante: false, ecarts: [] }));
    // Défaut (1 relance) : 2 lectures déjà payées = plafond atteint.
    await expect(a.m.avancerVoix({ phase: "a-relire", texte: "t", prises: prises.slice(0, 2) }, c, "id", T0)).rejects.toMatchObject({ code: "PLAFOND_VOIX" });
    // Réglé à 2 relances : plafond à 3 lectures.
    await expect(a.m.avancerVoix({ phase: "a-relire", texte: "t", prises }, { ...c, entrees: { ...c.entrees, ressemblanceVoix: PLEIN } }, "id", T0)).rejects.toMatchObject({ code: "PLAFOND_VOIX" });
    // Commande d'avant (contrôle coupé) : une seule lecture permise, aucune relecture.
    const { ressemblanceVoix: _r, ...entrees } = c.entrees ?? {};
    void _r;
    await expect(a.m.avancerVoix({ phase: "a-relire", texte: "t", prises: prises.slice(0, 1) }, { ...c, entrees }, "id", T0)).rejects.toMatchObject({ code: "PLAFOND_VOIX" });
    expect(a.etat.lectures).toBe(0);
  });
});
