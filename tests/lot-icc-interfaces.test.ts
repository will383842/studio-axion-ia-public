/**
 * LOT « INTENSITÉ · CRÉDITS · CALAGE » — garde des interfaces posées par l'architecte le 02/10
 * (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md` §2). Les développeurs D1, D2, D3 écrivent leurs tests dans
 * `tests/d1-*.test.ts`, `tests/d2-*.test.ts`, `tests/d3-*.test.ts` ; celui-ci reste vert d'un bout à l'autre du lot.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { resoudreFournisseur, TYPES_FOURNISSEURS } = await import("@/fournisseurs");
const { verifierBudgetEtCredits } = await import("@/services/credits");
const { bruitagesDeLaCommande } = await import("@/services/bruitages");
import { PLAFOND_PAR_NIVEAU, POIDS_EFFETS, reglageIntensite, REGLES_INTENSITE } from "@/briques/intensite";
import { voixPourFormat } from "@/domaine/voix-format";
import { appliquerAlignement } from "@/moteurs/montage-avocat/alignement";
import type { Travail } from "@/domaine/types";
import type { EtatAlignement, FournisseurAlignement, StockageFichiers } from "@/fournisseurs/types";
import { centimes } from "@/lib/montants";

const MDP_TEST = "essai-lot-icc";
const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP_TEST, false);
});

describe("intensité : constantes et réglage global", () => {
  it("poids, plafonds et règles de la consigne", () => {
    expect(POIDS_EFFETS).toMatchObject({ coupe: 1, poitrine: 1, "zoom-lent": 0.5, illustration: 2, incrustation: 2, impact: 3, bandeau: 2, souligne: 1, bruitage: 1, "second-angle": 1 });
    expect(PLAFOND_PAR_NIVEAU).toEqual({ sobre: 3, equilibre: 5, "tres-dynamique": 7 });
    expect(REGLES_INTENSITE).toMatchObject({ fenetreSec: 3, poidsFort: 2, respirationApresFortSec: 1.5 });
  });
  it("vidéo > ancien choix des sous-titres > format > Équilibré ; bruitages : vidéo > format > aucun", () => {
    expect(reglageIntensite({}, undefined)).toEqual({ niveau: "equilibre", bruitages: "aucun" });
    expect(reglageIntensite({ sousTitresIntensite: "sobre" }, { intensite: "tres-dynamique", bruitages: "discrets" })).toEqual({ niveau: "sobre", bruitages: "discrets" });
    expect(reglageIntensite({ intensite: "tres-dynamique", sousTitresIntensite: "sobre", bruitages: "aucun" }, { bruitages: "discrets" })).toEqual({ niveau: "tres-dynamique", bruitages: "aucun" });
  });
  it("la commande porte le réglage global ; l'intensité des sous-titres n'a pas bougé", async () => {
    const c = await fabrication.construireCommande("v-03");
    expect(c.intensite).toEqual({ niveau: c.sousTitres?.intensite, bruitages: expect.stringMatching(/^(aucun|discrets)$/) });
  });
});

describe("bruitages : seuls les sons écoutés et validés par Will", () => {
  it("« aucun » : rien ; « discrets » : les sons validés avec un déclencheur, jamais ceux « a_verifier »", async () => {
    const d = depots();
    const base = (await d.elements.lister((e) => e.type === "bruitage"))[0];
    expect(base).toBeDefined();
    await d.elements.enregistrer({ ...base, id: "br-tic-1", valeur: { type: "bruitage", categorie: "impact", dureeSec: 0.12, declencheur: "chiffre", variante: 1, ecoute: "validee" } });
    await d.elements.enregistrer({ ...base, id: "br-tic-2", valeur: { type: "bruitage", categorie: "impact", dureeSec: 0.12, declencheur: "chiffre", variante: 2, ecoute: "a_verifier" } });
    expect(await bruitagesDeLaCommande("aucun", "avocat")).toEqual([]);
    expect(await bruitagesDeLaCommande("discrets", "avocat")).toEqual([{ elementId: "br-tic-1", declencheur: "chiffre", variante: 1, dureeSec: 0.12 }]);
  });
  it("la démonstration n'a aucun son validé : la commande n'en porte aucun", async () => {
    const c = await fabrication.construireCommande("v-03");
    expect(c.bruitagesDisponibles).toBeUndefined();
  });
});

describe("voix par format", () => {
  const voix = [
    { id: "v-1", statut: "pret" as const },
    { id: "v-avocat", statut: "pret" as const },
    { id: "v-brouillon", statut: "brouillon" as const },
  ];
  it("vidéo > format > défaut du personnage > première prête ; une voix pas prête est ignorée", () => {
    expect(voixPourFormat(voix, { voixParFormat: { avocat: "v-avocat" } }, "avocat")?.id).toBe("v-avocat");
    expect(voixPourFormat(voix, { voixParFormat: { avocat: "v-avocat" } }, "selfie")?.id).toBe("v-1");
    expect(voixPourFormat(voix, { voixParFormat: { avocat: "v-avocat" } }, "avocat", "v-1")?.id).toBe("v-1");
    expect(voixPourFormat(voix, { voixParFormat: { avocat: "v-brouillon" }, voixParDefautId: "v-avocat" }, "avocat")?.id).toBe("v-avocat");
  });
});

describe("crédits : le garde-fou commun", () => {
  it("garde le contrôle du budget du mois à l'identique (dépassement, confirmation)", async () => {
    await expect(verifierBudgetEtCredits({ lignes: [], total: centimes(10_000_000) }, true, "Cette vidéo")).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await expect(verifierBudgetEtCredits({ lignes: [], total: centimes(1) }, false, "Cette vidéo")).resolves.toBeUndefined();
  });
  it("les collections des crédits existent (mémoire)", async () => {
    const d = depots();
    expect(await d.recharges.lister()).toEqual([]);
    expect(await d.reservations.lister()).toEqual([]);
    expect(await d.relevesSoldes.lister()).toEqual([]);
  });
});

describe("calage des mots : fournisseur et phases du moteur avocat", () => {
  const stockageSigne = (): StockageFichiers => ({
    id: "r2",
    type: "stockage",
    nom: "Stockage",
    reelPrevu: "R2",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
    confirmerDepot: async () => ({ ok: true }),
    urlLecture: async (cle) => `https://r2.exemple/${cle}`,
    urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
    urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
  });

  /** Aligneur réel imité : décale chaque mot de −0,2 s (ce que corrigerait WhisperX), ou échoue toujours. */
  function aligneurEssai(mode: "decale" | "panne"): FournisseurAlignement & { recues: string[] } {
    const demandes = new Map<string, { reference: { mot: string; debutSec: number; finSec: number }[] }>();
    const recues: string[] = [];
    return {
      id: "studio-aligneur",
      type: "alignement",
      mode: "reel",
      nom: "Calage des sous-titres",
      reelPrevu: "WhisperX",
      capacites: { asynchrone: true, accordExige: false },
      recues,
      async soumettre(d) {
        recues.push(d.idAlignement);
        demandes.set(d.idAlignement, { reference: d.reference ?? [] });
      },
      async suivre(id): Promise<EtatAlignement> {
        if (mode === "panne") return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "panne" } };
        const ref = demandes.get(id)!.reference;
        return { statut: "termine", resultat: { mots: ref.map((m) => ({ ...m, debutSec: Math.max(0, m.debutSec - 0.2), finSec: Math.max(0, m.finSec - 0.2) })), motsNonAlignes: 0, modele: "essai", dureeCalculSec: 1 } };
      },
    };
  }

  async function voixJusquAuBout(aligneur?: FournisseurAlignement): Promise<Travail> {
    let horloge = T0;
    const m = creerMoteurMontageAvocat({ rendu: creerServiceRenduSimule(() => horloge), stockage: stockageSigne, ...(aligneur ? { alignement: () => aligneur } : {}) });
    // Lot R6 : la voix de synthèse n'est plus calée par défaut (mesure D3) ; ces essais du calage de la VOIX l'allument.
    const c0 = await fabrication.construireCommande("v-03");
    const c = { ...c0, entrees: { ...c0.entrees, calerVoixSynthese: true } };
    let t = await m.lancer(c, { travailId: "t-al", versionId: "ver-al", titre: "AL", maintenant: T0 });
    for (; horloge < T0 + 60_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge += 500) t = (await m.avancer(t, c, horloge)).travail;
    return t;
  }

  it("le registre connaît le type « alignement » ; la simulation est le défaut", () => {
    expect(TYPES_FOURNISSEURS).toContain("alignement");
    expect(resoudreFournisseur("alignement").mode).toBe("simulation");
  });

  it("simulation : le calage est sauté, l'audio maître est celui d'avant", async () => {
    const t = await voixJusquAuBout();
    const voix = t.parametres?.voix as { phase: string; audio: { alignement?: unknown } };
    expect(voix.phase).toBe("faite");
    expect(voix.audio.alignement).toBeUndefined();
  });

  it("aligneur réel : les mots sont recalés AVANT le nettoyage, le rapport le dit", async () => {
    const al = aligneurEssai("decale");
    const t = await voixJusquAuBout(al);
    const voix = t.parametres?.voix as { phase: string; audio: { alignement?: { source: string; ecartMoyenMs?: number } } };
    expect(voix.phase).toBe("faite");
    expect(al.recues).toHaveLength(1);
    expect(al.recues[0]).toMatch(/^t-al-.*-alignement$/);
    expect(voix.audio.alignement).toMatchObject({ source: "aligneur" });
    expect(voix.audio.alignement?.ecartMoyenMs).toBeGreaterThan(100);
  });

  it("aligneur en panne : 3 essais, puis l'horodatage de la voix est gardé (la vidéo n'est jamais bloquée)", async () => {
    const al = aligneurEssai("panne");
    const t = await voixJusquAuBout(al);
    const voix = t.parametres?.voix as { phase: string; audio: { alignement?: { source: string } } };
    expect(voix.phase).toBe("faite");
    expect(al.recues.map((id) => id.replace(/^t-al-.*-alignement/, "alignement"))).toEqual(["alignement", "alignement-e1", "alignement-e2"]);
    expect(voix.audio.alignement).toMatchObject({ source: "voix" });
  });

  it("garde-fou : un résultat qui n'a pas le même nombre de mots est refusé", () => {
    const voix = [{ mot: "Un", debutSec: 0, finSec: 0.2 }, { mot: "PV", debutSec: 0.3, finSec: 0.6 }];
    expect(appliquerAlignement(voix, { mots: [voix[0]], motsNonAlignes: 1, modele: "x", dureeCalculSec: 0 }, 1).rapport.source).toBe("voix");
  });
});
