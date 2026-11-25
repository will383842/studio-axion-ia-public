/**
 * S2-16-b-v21p : « refaire la voix » branchée pour le cas concret. Le service (`src/services/refaire-voix.ts`) fait
 * passer la prononciation À JOUR dans les entrées de la retouche (`prononciationsRetouche`), après un plafond PAR VIDÉO
 * (60 centimes d'euro) contrôlé AVANT `lancerRetouche` ; le moteur du cas concret (`montage-cas-concret/index.ts`) la
 * lit pour la retouche seulement. Doubles seulement : `lancerRetouche` remplacé, banc du cas concret, 0 €, aucun appel.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { estimerRetoucheCasConcret } from "@/moteurs/montage-cas-concret";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { banc } from "../cas-concret/moteur/doubles";

vi.setConfig({ testTimeout: 60_000 }); // premier import à froid de fabrication (~6 s) : le délai par défaut (5 s) rougit le 1er cas

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

type Appel = { videoId: string; planIds: string[]; consigne: string; options: Record<string, unknown> };
const lance = vi.hoisted(() => ({ appels: [] as Appel[], reserveUsd: 0 }));

vi.mock("@/services/fabrication", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  // Double de `lancerRetouche` : note l'appel, crée la retouche et (si demandé) sa réservation HeyGen active, comme la vraie.
  lancerRetouche: async (videoId: string, planIds: string[], consigne: string, options: Record<string, unknown> = {}) => {
    lance.appels.push({ videoId, planIds, consigne, options });
    const { depots } = await import("@/donnees/memoire");
    const n = lance.appels.length;
    const le = new Date().toISOString();
    await depots().retouches.enregistrer({ id: `ret-${n}`, videoId, versionId: "ver-1", planIds, consigne, statut: "en_cours", travailId: `trav-${n}`, creeLe: le, modifieLe: le } as never);
    if (lance.reserveUsd) await depots().reservations.enregistrer({ id: `res-${n}`, fournisseur: "heygen", videoId, travailId: `trav-${n}`, centimes: lance.reserveUsd, devise: "USD", statut: "active", creeLe: le, modifieLe: le } as never);
    return { retoucheId: `ret-${n}`, travailId: `trav-${n}` };
  },
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const rv = await import("@/services/refaire-voix");
const { hash } = await import("@node-rs/argon2");

const MDP = "essai-s2-16-b";
const TEXTE = "Chez Axion, Zernio publie vos vidéos. ";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

/** Vidéo du cas concret avec sa version choisie ; `repete` : nombre de fois le texte (37 caractères chacun). */
async function preparer(opts: { repete?: number; formatId?: string } = {}) {
  const le = new Date(Date.now() - 120_000).toISOString();
  const entrees = { casConcret: { casId: "cas-1", reseaux: ["facebook"] }, autre: { garde: 1 } };
  const commande = { formatId: opts.formatId ?? "cas-concret", script: { blocs: [], texteComplet: TEXTE.repeat(opts.repete ?? 1).trim() }, distribution: [{ role: "voix", source: "double", voixId: "vx-1", personnageId: "p-1" }], entrees, prononciations: [] };
  await depots().videos.enregistrer({ id: "v-1", formatId: commande.formatId, versionChoisieId: "ver-1", creeLe: le, modifieLe: le } as never);
  await depots().versions.enregistrer({ id: "ver-1", videoId: "v-1", numero: 1, commande, creeLe: le, modifieLe: le } as never);
  await depots().prononciations.enregistrer({ id: "pr-1", mot: "Zernio", prononciation: "zèrnio", source: "manuel", creeLe: le, modifieLe: le } as never);
  return { entrees };
}

const refaire = () => rv.refaireVoixAvecPrononciation("v-1", ["pl-1"], "Refaire la phrase", { phrasesVisees: ["Zernio publie vos vidéos."] });

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  lance.appels = [];
  lance.reserveUsd = 0;
});

describe("S2-16-b-v21p : service « refaire la voix »", () => {
  it("(a) réglage `false` écrit : la retouche part comme sur master (aucune entrée ajoutée, aucun plafond)", async () => {
    await preparer({ repete: 100 }); // au-dessus du plafond : éteint, il n'est pas lu
    await ecrireParametre(rv.PARAM_REFAIRE_AVEC_PRONONCIATION, false);
    const r = await refaire();
    expect(r).toEqual({ ok: true, retoucheId: "ret-1", travailId: "trav-1" });
    expect(lance.appels).toEqual([{ videoId: "v-1", planIds: ["pl-1"], consigne: "Refaire la phrase", options: {} }]);
  });

  it("(a) `\"true\"`, `1`, absent : allumé (seul `false` éteint) ; lecture qui lève : comportement d'aujourd'hui", async () => {
    await preparer();
    for (const v of ["true", 1, undefined]) {
      lance.appels = [];
      if (v !== undefined) await ecrireParametre(rv.PARAM_REFAIRE_AVEC_PRONONCIATION, v);
      else await depots().parametres.enregistrer({ id: rv.PARAM_REFAIRE_AVEC_PRONONCIATION, valeur: null, creeLe: "", modifieLe: "" } as never);
      expect((await refaire()).ok).toBe(true);
      expect(lance.appels[0].options).toHaveProperty("entrees.prononciationsRetouche");
    }
    lance.appels = [];
    const vrai = depots().parametres.obtenir.bind(depots().parametres);
    const espion = vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === rv.PARAM_REFAIRE_AVEC_PRONONCIATION) throw new Error("panne");
      return vrai(id);
    });
    try {
      expect((await refaire()).ok).toBe(true);
    } finally {
      espion.mockRestore();
    }
    expect(lance.appels[0].options).toEqual({});
  });

  it("(b) allumé : la retouche reçoit la liste à jour ; les entrées courantes sont recopiées (aucune perdue)", async () => {
    const { entrees } = await preparer();
    const accord = { montantCentimes: 10, le: "2026-11-21T00:00:00.000Z" } as never;
    const r = await rv.refaireVoixAvecPrononciation("v-1", ["pl-1"], "Refaire la phrase", { confirme: accord, phrasesVisees: ["Zernio publie vos vidéos."] });
    expect(r.ok).toBe(true);
    const o = lance.appels[0].options as { confirme: unknown; entrees: Record<string, unknown> };
    expect(o.confirme).toBe(accord);
    // La base À JOUR (entrées de départ du dépôt comprises), telle que `prononciationsActives` la rend pour cette voix.
    const { prononciationsActives } = await import("@/domaine/prononciations");
    const attendue = prononciationsActives(await depots().prononciations.lister(), { voixId: "vx-1", personnageId: "p-1" }).map((p) => ({ mot: p.mot, prononciation: p.prononciation }));
    expect(attendue).toContainEqual({ mot: "Zernio", prononciation: "zèrnio" });
    expect(o.entrees).toEqual({ ...entrees, prononciationsRetouche: attendue });
    // La version courante n'est pas modifiée (les entrées sont une copie).
    expect((await depots().versions.obtenir("ver-1"))!.commande.entrees).toEqual(entrees);
  });

  it("(c) estimation au-dessus du plafond (60 c€ par vidéo) : refus AVANT lancerRetouche, phrase sans montant", async () => {
    await preparer({ repete: 70 }); // ≈ 2 590 caractères × 0,027 c€ ≈ 70 c€ > 60
    const r = await refaire();
    expect(r.ok).toBe(false);
    expect(lance.appels).toHaveLength(0);
    if (!r.ok) {
      expect(r.phrase).toMatch(/limite prévue pour cette vidéo/);
      expect(r.phrase).not.toMatch(/\d|€|\$/);
    }
  });

  it("(c) l'estimation porte sur le texte LU (après prononciations) : une prononciation qui allonge le texte fait dépasser 60 c€, la même sans allonger passe", async () => {
    await preparer({ repete: 55 }); // 2 089 caractères × 0,027 c€ ≈ 56,4 → 57 c€ ≤ 60 : passe (« zèrnio » a la longueur de « Zernio »)
    expect((await refaire()).ok).toBe(true);
    expect(lance.appels).toHaveLength(1);
    lance.appels = [];
    const le = new Date().toISOString();
    // La prononciation active s'allonge de 6 caractères par occurrence (55 occurrences) : 2 419 caractères ≈ 65,3 → 66 c€ > 60 : refus.
    await depots().prononciations.enregistrer({ id: "pr-1", mot: "Zernio", prononciation: "zèr-ni-o-ou-o", source: "manuel", creeLe: le, modifieLe: le } as never);
    const r = await refaire();
    expect(r.ok).toBe(false);
    expect(lance.appels).toHaveLength(0);
    if (!r.ok) expect(r.phrase).toMatch(/limite prévue pour cette vidéo/);
  });

  it("(c) un 2e clic qui ferait dépasser 60 c€ cumulés sur la vidéo est refusé ; le 1er passe", async () => {
    await preparer({ repete: 35 }); // ≈ 1 295 caractères ≈ 35 c€
    lance.reserveUsd = Math.ceil(1295 * 0.03 * 1.2); // réservation HeyGen de la 1re retouche (marge 20 %)
    expect((await refaire()).ok).toBe(true);
    expect(await rv.dejaEngageRefaireVoixCentimes("v-1", 0.9)).toBeCloseTo(lance.reserveUsd * 0.9, 5);
    const r2 = await refaire();
    expect(r2.ok).toBe(false);
    expect(lance.appels).toHaveLength(1);
  });

  it("(c) déjà engagé = dépenses de voix des retouches de la vidéo + réservations HeyGen actives (les autres ne comptent pas)", async () => {
    await preparer();
    const le = new Date().toISOString();
    await depots().retouches.enregistrer({ id: "r-a", videoId: "v-1", versionId: "ver-1", planIds: [], consigne: "x", statut: "terminee", travailId: "t-a", creeLe: le, modifieLe: le } as never);
    await depots().retouches.enregistrer({ id: "r-b", videoId: "v-2", versionId: "ver-2", planIds: [], consigne: "x", statut: "en_cours", travailId: "t-b", creeLe: le, modifieLe: le } as never);
    const ligne = (unite: string, c: number) => ({ etape: "Voix", fournisseur: "heygen", unite, quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" }, total: { centimes: c, devise: "EUR" }, nature: "reel" });
    await depots().depenses.enregistrer({ id: "d-1", videoId: "v-1", travailId: "t-a", lignes: [ligne("caractere", 12), ligne("seconde", 50)], total: { centimes: 62, devise: "EUR" }, date: le, creeLe: le, modifieLe: le } as never);
    await depots().depenses.enregistrer({ id: "d-2", videoId: "v-2", travailId: "t-b", lignes: [ligne("caractere", 40)], total: { centimes: 40, devise: "EUR" }, date: le, creeLe: le, modifieLe: le } as never);
    await depots().reservations.enregistrer({ id: "res-a", fournisseur: "heygen", videoId: "v-1", travailId: "t-a", centimes: 10, devise: "USD", statut: "active", creeLe: le, modifieLe: le } as never);
    await depots().reservations.enregistrer({ id: "res-b", fournisseur: "heygen", videoId: "v-1", travailId: "t-a", centimes: 99, devise: "USD", statut: "consommee", creeLe: le, modifieLe: le } as never);
    await depots().reservations.enregistrer({ id: "res-c", fournisseur: "studio-rendu", videoId: "v-1", travailId: "t-a", centimes: 99, devise: "EUR", statut: "active", creeLe: le, modifieLe: le } as never);
    expect(await rv.dejaEngageRefaireVoixCentimes("v-1", 0.9)).toBeCloseTo(12 + 10 * 0.9, 5);
    expect(await rv.dejaEngageRefaireVoixCentimes("v-sans", 0.9)).toBe(0);
  });

  it("(c) plafond lu par constante (réglage écrit plus bas : refus) ; plafond illisible : refus clair, rien n'est lancé", async () => {
    await preparer({ repete: 10 }); // ≈ 10 c€
    await ecrireParametre(rv.PARAM_PLAFOND_REFAIRE_CENTIMES, 5);
    expect((await refaire()).ok).toBe(false);
    await ecrireParametre(rv.PARAM_PLAFOND_REFAIRE_CENTIMES, "beaucoup");
    const r = await refaire();
    expect(r).toEqual({ ok: false, phrase: expect.stringMatching(/illisible/) });
    expect(lance.appels).toHaveLength(0);
    expect(rv.PLAFOND_REFAIRE_VOIX_CENTIMES_EUR).toBe(60);
  });

  it("sans session : refus avant toute lecture, rien n'est lancé", async () => {
    await preparer();
    reinitialiserRequete();
    await expect(refaire()).rejects.toThrow();
    expect(lance.appels).toHaveLength(0);
  });

  it("(d) format « impossible » (face caméra) : refus clair, rien n'est lancé", async () => {
    await preparer({ formatId: "facecam" });
    const r = await refaire();
    expect(r).toEqual({ ok: false, phrase: expect.stringMatching(/n'est pas possible pour ce format/) });
    expect(lance.appels).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* Moteur du cas concret (banc de doubles, aucun appel réel)            */
/* ------------------------------------------------------------------ */

const T0 = Date.UTC(2026, 10, 21, 9);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const ops = (o: unknown[]) => o as OperationMontage[];

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

async function videoFabriquee() {
  const b = banc({ motSur: ["facebook", "instagram"], retouches: true });
  const c = b.commande();
  const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
  expect(fin.travail.statut).toBe("termine");
  const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(fin.resultat!.projetMontage)), pistes: [] };
  return { b, c, parent };
}

const OPERATION = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }];

/** Retouche menée au bout : textes lus par la voix, textes écrits des écrans, aperçu. */
async function retouche(plus: Record<string, unknown> | null, operation: unknown[] = OPERATION) {
  const { b, c, parent } = await videoFabriquee();
  const commande = plus ? { ...c, entrees: { ...c.entrees, ...plus } } : c;
  const apercu = estimerRetoucheCasConcret(commande, operation, parent);
  const lus = b.d.lus.length;
  const t = await b.moteur.retoucher({ commande, contexte: ctx("t-2"), planIds: [], consigne: "Refaire la phrase", operations: ops(operation), parent });
  const fin = await avancerJusqua(b.moteur, commande, t);
  if (fin.travail.statut !== "termine") throw new Error(JSON.stringify(fin.travail.erreur ?? fin.travail.etapes.filter((e) => e.statut === "echec")));
  const projet = fin.resultat!.projetMontage.casConcret as { fiche: { ecrans: { id: string; texteDit: string }[] } };
  return { lus: b.d.lus.slice(lus), ecrits: projet.fiche.ecrans.map((e) => `${e.id}:${e.texteDit}`), apercu: JSON.stringify(apercu), sousTitres: JSON.stringify(fin.resultat!.projetMontage.sousTitres ?? null) };
}

describe("S2-16-b-v21p : le cas concret lit `prononciationsRetouche` pour la retouche seulement", () => {
  it("(b) avec la liste à jour : le texte LU change, le texte ÉCRIT et les sous-titres restent les mêmes", async () => {
    const sans = await retouche(null);
    const avec = await retouche({ prononciationsRetouche: [{ mot: "annonce", prononciation: "a-nonce" }] });
    expect(sans.lus.join(" ")).toContain("notre petite annonce");
    expect(avec.lus.join(" ")).toContain("notre petite a-nonce");
    expect(avec.lus.join(" ")).not.toContain("petite annonce");
    // Voix de départ de la retouche à la même prononciation : les fins (qui ne disent pas le mot) sont reprises, rien n'est relu en plus.
    expect(avec.lus).toHaveLength(sans.lus.length);
    expect(avec.ecrits).toEqual(sans.ecrits);
    expect(avec.ecrits.join(" ")).toContain("notre petite annonce");
    expect(avec.sousTitres).toEqual(sans.sousTitres);
    // L'aperçu (réservation de la retouche) compte aussi le texte lu à jour.
    expect(avec.apercu).not.toEqual(sans.apercu);
  });

  it("(b) seule la prononciation change (le texte écrit est le même) : la prise qui dit le mot est relue en plus, avec la prononciation à jour", async () => {
    // « Changer le mot » ne relit que les fins ; le corps (qui dit « annonce ») est repris tel quel sans prononciation neuve.
    const mot = [{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }];
    const sans = await retouche(null, mot);
    expect(sans.lus.join(" ")).not.toContain("notre annonce");
    const avec = await retouche({ prononciationsRetouche: [{ mot: "annonce", prononciation: "a-nonce" }] }, mot);
    // Avec la prononciation à jour, la prise du corps n'est plus la même : elle est relue, avec « a-nonce ».
    expect(avec.lus.filter((t) => t.includes("notre a-nonce"))).toHaveLength(1);
    expect(avec.lus.join(" ")).not.toContain("notre annonce");
    expect(avec.lus.length).toBe(sans.lus.length + 1);
    expect(avec.ecrits).toEqual(sans.ecrits);
  });

  it("(e) sans `prononciationsRetouche` (ou pas un tableau) : retouche identique au caractère près ; entrées mal formées ignorées", async () => {
    const sans = await retouche(null);
    const pasTableau = await retouche({ prononciationsRetouche: "annonce=a-nonce" });
    expect(pasTableau).toEqual(sans);
    const malFormees = await retouche({ prononciationsRetouche: [null, { mot: 3 }, { mot: "annonce" }] });
    expect(malFormees.lus).toEqual(sans.lus);
    expect(malFormees.ecrits).toEqual(sans.ecrits);
  });

  it("(e) une FABRICATION (pas une retouche) ignore l'entrée : la commande garde ses propres prononciations", async () => {
    const b1 = banc({ motSur: ["facebook"], retouches: true });
    const f1 = await avancerJusqua(b1.moteur, b1.commande(), await b1.moteur.lancer(b1.commande(), ctx("t-1")));
    const b2 = banc({ motSur: ["facebook"], retouches: true });
    const c2 = { ...b2.commande(), entrees: { ...b2.commande().entrees, prononciationsRetouche: [{ mot: "annonce", prononciation: "a-nonce" }] } };
    const f2 = await avancerJusqua(b2.moteur, c2, await b2.moteur.lancer(c2, ctx("t-1")));
    expect(f2.travail.statut).toBe(f1.travail.statut);
    expect(b2.d.lus).toEqual(b1.d.lus);
    expect(b2.d.lus.join(" ")).not.toContain("a-nonce");
  });
});
