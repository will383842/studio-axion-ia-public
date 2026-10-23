/**
 * X12 · point 4 : CHAQUE arrêt prévu du cas concret garde au moins un bouton, et chaque bouton proposé est accepté par
 * le serveur (le même travail repart sur la même vidéo) ou rend une phrase claire ; rien de déjà payé n'est refait.
 * Base en mémoire, vrai lancement du format, aucun appel réel (la relance n'avance rien : la boucle de fond le fait).
 *
 * Boutons de l'écran (`SuiviCasConcret`) : arrêt réessayable → « Reprendre cette étape » (`relancerEtapeCasConcret`) ;
 * arrêt sans réessai → « Recommencer ce cas » (lien vers l'écran du format : une nouvelle vidéo, rien n'est relancé ici).
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { ErreurTravail, Travail } from "@/domaine/types";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const relance = await import("@/services/cas-concret-relance");
const { NON_REESSAYABLES } = await import("@/moteurs/montage-cas-concret");
const { ETAPES_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret/outils");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "cas-concret-x12";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const SANS_CLAUDE = { claudeActif: async () => false };

beforeAll(async () => {
  process.env.SESSION_SECRET = "x".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});

/** Une vraie vidéo du format, lancée (prix confirmé), son travail. */
async function lancerUneVideo(autre: { casId?: string; essai?: boolean } = {}): Promise<Travail> {
  const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 100_000, empreinteScriptRelu: RELU_RECRUTEMENT, ...autre });
  expect(r.statut).toBe("lancee");
  const [t] = await depots().travaux.lister((x) => x.type === "fabrication" && x.cibleId === (r as { videoId: string }).videoId);
  expect(t).toBeDefined();
  return t;
}

/** Le motif d'arrêt tel que le moteur l'écrit (code, réessayable, phrase). */
interface Motif {
  etape: (typeof ETAPES_CAS_CONCRET)[number];
  motif: string;
  code: string;
  reessayable: boolean;
}

const MOTIFS: Motif[] = [
  { etape: "ecriture", motif: "fiche refusée après 2 essais", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "ecriture", motif: "appel en panne", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "ecriture", motif: "réponse non arrivée (délai)", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "ecriture", motif: "budget refusé avant l'appel", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "ecriture", motif: "outils non reliés", code: "CAS_CONCRET_NON_RELIE", reessayable: true },
  { etape: "fiche", motif: "relecture refusée", code: "CAS_CONCRET_FICHE_REFUSEE", reessayable: false },
  { etape: "fiche", motif: "cas introuvable", code: "CAS_CONCRET_SANS_CAS", reessayable: false },
  { etape: "captures", motif: "capture ratée", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "voix", motif: "voix rejetée ou en panne", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "calage", motif: "calage impossible", code: "CAS_CONCRET_ECHEC", reessayable: false },
  { etape: "ecrans", motif: "rendu d'un écran raté", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "ecrans", motif: "rendu sans nouvelle (délai de garde)", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "montage", motif: "assemblage ou composition ratés", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "controle", motif: "contrôle d'une sortie raté", code: "CAS_CONCRET_ECHEC", reessayable: true },
  { etape: "controle", motif: "vérification bloquante", code: "CAS_CONCRET_CONTROLES_BLOQUANTS", reessayable: false },
  ...ETAPES_CAS_CONCRET.map((etape) => ({ etape, motif: "panne d'essai (simulation)", code: "CAS_CONCRET_ECHEC_SIMULE", reessayable: true })),
];

/** Le travail arrêté à `m.etape` comme le moteur le laisse : étapes d'avant faites, voix payée gardée au journal. */
async function arreter(t: Travail, m: Motif): Promise<Travail> {
  const rang = ETAPES_CAS_CONCRET.indexOf(m.etape);
  const erreur: ErreurTravail = { code: m.code, reessayable: m.reessayable, messagePourWill: `L'étape n'a pas abouti (${m.motif}).` };
  const payees = rang > ETAPES_CAS_CONCRET.indexOf("voix") ? [{ fournisseur: "heygen", caracteres: 900, coutCentimes: 42 }] : [];
  // Journal partiel (comme un journal écrit par une version antérieure du code) : seule la liste des prises payées.
  const arrete: Travail = {
    ...t,
    statut: "echec",
    erreur,
    etapes: t.etapes.map((e, i) => (i < rang ? { ...e, statut: "terminee" as const, progression: 100 } : i === rang ? { ...e, statut: "echec" as const, erreur } : { ...e, statut: "en_attente" as const })),
    parametres: { ...t.parametres, casConcret: { atteinte: rang - 1, journal: { version: "x", etapes: {}, voix: { empreinte: "v", etat: { payees } } } } },
  };
  await depots().travaux.enregistrer(arrete);
  return arrete;
}

/** Ligne du tableau étape × motif × bouton × résultat (corps de la PR). */
const tableau: string[] = [];

describe("X12 · chaque arrêt : un bouton, accepté ou une phrase, rien de payé refait", () => {
  it("les étapes sans réessai du moteur sont exactement celles de la matrice", () => {
    for (const e of ETAPES_CAS_CONCRET) {
      // Les refus généraux de l'étape (pas les cas particuliers : cas introuvable, vérification bloquante).
      const sansReessai = MOTIFS.filter((m) => m.etape === e && !m.reessayable && m.code !== "CAS_CONCRET_SANS_CAS" && m.code !== "CAS_CONCRET_CONTROLES_BLOQUANTS");
      expect(sansReessai.length > 0).toBe(NON_REESSAYABLES.has(e));
    }
  });

  it.each(MOTIFS.map((m) => [`${m.etape} · ${m.motif}`, m] as const))("%s", async (_nom, m) => {
    const t = await arreter(await lancerUneVideo(), m);
    const videos = await depots().videos.compter();
    const depenses = await depots().depenses.compter();
    const r = await relance.relancerEtapeCasConcret(t.id, undefined, SANS_CLAUDE);
    const apres = (await depots().travaux.obtenir(t.id))!;
    // (a) au moins un bouton ; (b) accepté (le même travail repart) ou une phrase ; (c) rien de payé refait.
    if (m.reessayable) {
      expect(r).toEqual({ statut: "relancee", travailId: t.id });
      expect(apres.statut).toBe("en_cours");
      expect(apres.tentatives).toBe(t.tentatives + 1);
      expect(apres.etapes.find((e) => e.cle === m.etape)?.statut).toBe("en_attente");
      // Les étapes faites restent faites ; la voix payée reste au journal.
      expect(apres.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle)).toEqual(t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle));
      expect((apres.parametres?.casConcret as { journal: { voix: { etat: { payees: unknown[] } } } }).journal.voix.etat.payees).toEqual((t.parametres?.casConcret as { journal: { voix: { etat: { payees: unknown[] } } } }).journal.voix.etat.payees);
      expect((await depots().videos.obtenir(t.cibleId))?.statut).toBe("en_fabrication");
    } else {
      expect(r).toEqual({ statut: "refusee", phrase: relance.PHRASES_RELANCE.sansReessai });
      expect(apres).toEqual(t);
    }
    expect(await depots().videos.compter()).toBe(videos);
    expect(await depots().depenses.compter()).toBe(depenses);
    tableau.push(`| ${m.etape} | ${m.motif} | ${m.reessayable ? "Reprendre cette étape" : "Recommencer ce cas"} | ${m.reessayable ? "même travail relancé (essai +1), rien repayé" : "phrase « ne se réessaie pas telle quelle »"} |`);
  });
});

describe("X12 · refus du serveur : toujours une phrase", () => {
  it("travail déjà reparti (deux onglets) : « La fabrication a déjà repris »", async () => {
    const t = await arreter(await lancerUneVideo(), MOTIFS[0]);
    expect((await relance.relancerEtapeCasConcret(t.id, undefined, SANS_CLAUDE)).statut).toBe("relancee");
    expect(await relance.relancerEtapeCasConcret(t.id, undefined, SANS_CLAUDE)).toEqual({ statut: "refusee", phrase: relance.PHRASES_RELANCE.dejaRepartie });
  });

  it("travail inconnu : phrase", async () => {
    expect(await relance.relancerEtapeCasConcret("trav-inconnu", undefined, SANS_CLAUDE)).toEqual({ statut: "refusee", phrase: relance.PHRASES_RELANCE.introuvable });
  });

  it("budget du mois atteint : la phrase du budget, rien n'est réactivé", async () => {
    // V4-3 : « recrutement-apporteurs » a un script validé (aucune écriture à payer) et la voix d'essai est gratuite :
    // son prix est nul. Un cas sans script validé (vidéo d'essai) garde un prix à confronter au budget.
    const t = await arreter(await lancerUneVideo({ casId: "rappels-rendez-vous", essai: true }), MOTIFS.find((m) => m.etape === "voix")!);
    await ecrireParametre("budget.mensuel", { centimes: 0, devise: "EUR" });
    const r = await relance.relancerEtapeCasConcret(t.id, undefined, SANS_CLAUDE);
    expect(r.statut).toBe("refusee");
    expect(r.statut === "refusee" && r.phrase).toMatch(/budget du mois/i);
    expect((await depots().travaux.obtenir(t.id))?.statut).toBe("echec");
  });

  it("écriture arrêtée, Claude réel : le prix d'un nouvel essai est annoncé AVANT, puis la relance part avec l'accord", async () => {
    const t = await arreter(await lancerUneVideo(), MOTIFS[0]);
    const r = await relance.relancerEtapeCasConcret(t.id, undefined, { claudeActif: async () => true });
    expect(r.statut).toBe("accord-requis");
    if (r.statut !== "accord-requis") return;
    expect(r.centimes).toBeGreaterThan(0);
    expect(r.phrase).toMatch(/^Les réponses déjà payées sont relues d'abord\. Si l'écriture précédente ne peut pas être reprise, un nouvel essai coûte environ \d+,\d\d\s€\.$/);
    expect((await depots().travaux.obtenir(t.id))?.statut).toBe("echec");
    expect(await relance.relancerEtapeCasConcret(t.id, r.centimes, { claudeActif: async () => true })).toEqual({ statut: "relancee", travailId: t.id });
  });

  it("travail créé AVANT la mise en ligne (journal d'ancienne forme, sans compteur de reprises) : accepté, l'écriture repart en reprise", async () => {
    const t = await lancerUneVideo();
    const ancien: Travail = {
      ...(await arreter(t, MOTIFS[0])),
      parametres: { ...t.parametres, casConcret: { atteinte: -1, journal: { version: "cas-concret/ancienne", etapes: {}, appels: { [`ccecr-${t.cibleId}-${t.versionId}-1`]: { empreinte: "ancienneconsigne0000", tentative: 1, le: 0 } } } } },
    };
    await depots().travaux.enregistrer(ancien);
    expect(await relance.relancerEtapeCasConcret(t.id, undefined, SANS_CLAUDE)).toEqual({ statut: "relancee", travailId: t.id });
    const j = ((await depots().travaux.obtenir(t.id))?.parametres?.casConcret as { journal: { reprisesEcriture?: number; appels: Record<string, unknown> } }).journal;
    expect(j.reprisesEcriture).toBe(1);
    expect(Object.keys(j.appels)).toHaveLength(1);
  });

  it("le tableau étape × motif × bouton × résultat est complet", () => {
    expect(tableau).toHaveLength(MOTIFS.length);
    if (process.env.X12_TABLEAU) console.log(["| Étape | Motif d'arrêt | Bouton | Résultat |", "|---|---|---|---|", ...tableau].join("\n"));
  });
});
