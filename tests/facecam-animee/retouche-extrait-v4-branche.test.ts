/**
 * R4-03-c2-v20j · « Changer un extrait » (téléphone v4) branché dans `retoucher` de la face caméra animée, derrière le réglage
 * `retoucheChat.facecamAnimeeExtraits` (ÉTEINT). Preuve par le chemin réel : le VRAI moteur, une version d'origine finie, le projet
 * passé par la base (JSON), puis `retoucher` avec une demande liée à la version. Port du clip doublé : aucun réseau, aucun Claude, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import { creerMoteurMontageFacecamAnimee, ID_MOTEUR_FACECAM_ANIMEE, CLE_RETOUCHE_EXTRAITS_FA } from "@/moteurs/montage-facecam-animee";
import type { OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { actualiserRetoucheExtraitsFA, PARAM_RETOUCHE_EXTRAITS_FA } from "@/services/facecam-animee-retouche";

vi.mock("server-only", () => ({}));

const RACINE = join(__dirname, "..", "..");
const PLAN_VALIDE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;
const PRISE = "studio/dev/entree/facecam-animee/f-1.mov";
const RANG = 5; // élément « MosaiqueVideos » de la fiche de répétition, transformé en téléphone pour l'essai

const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
const REPONSE = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_VALIDE.elementsV4!.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "medias"))), motsForts };

const ENTREES_BASE = { facecamAnimee: { priseCle: PRISE, fichierId: "f-1", texteValide: SCRIPT, accordEssaiReel: true } };
const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: ID_MOTEUR_FACECAM_ANIMEE, ratios: ["9:16"], briques: {}, distribution: [], entrees: ENTREES_BASE } as unknown as CommandeFabrication;
const avecDemande = (demande: unknown, extra: Record<string, unknown> = {}) => ({ ...COMMANDE, entrees: { ...ENTREES_BASE, retoucheExtraitV4: { ...(demande as object), pourVersionId: "ver-1", ...extra } } }) as unknown as CommandeFabrication;

/** Outils doubles qui COMPTENT chaque appel (aucun réseau). */
function outilsDoubles() {
  const o = {
    transcrire: vi.fn(async () => ({ mots: BRUT.mots, dureeSec: DUREE_PRISE })),
    reperer: vi.fn(async () => null),
    plafondClaudeAtteint: vi.fn(async () => false),
    appelerRealisateur: vi.fn(async () => ({ ok: true as const, donnees: REPONSE })),
    videos: vi.fn(async (d: { plan: PlanFacecamAnimee }) => {
      const els = (d.plan.elementsV4 ?? []).map((e, i) => (PLAN_VALIDE.elementsV4![i].medias ? { ...e, medias: PLAN_VALIDE.elementsV4![i].medias } : e));
      const noms = [...new Set(els.flatMap((e) => e.medias ?? []))].filter((m) => m.startsWith("broll/")).map((m) => m.slice("broll/".length));
      return { plan: { ...d.plan, elementsV4: els }, fichiers: noms.map((nom) => ({ nom, cle: `studio/dev/facecam-animee/v-1/broll/${nom}` })), manques: [] };
    }),
    // Plan de scènes : pièces du stock seulement à l'origine (le mémo est gardé) ; `appeler` compte ce qui serait payé.
    planScenes: { appeler: vi.fn(async () => ({ ok: false as const, raison: "double" })) },
    rendre: vi.fn(async (d: { idRendu: string; plan: PlanFacecamAnimee }) => ({ cle: `studio/dev/facecam-animee/v-1/${d.idRendu}.mp4`, vignetteCle: `studio/dev/facecam-animee/v-1/${d.idRendu}.jpg`, dureeSec: d.plan.duree, taille: 34_000_000 })),
  };
  return o;
}
type Doubles = ReturnType<typeof outilsDoubles>;
const enOutils = (o: Doubles, sansAppelPlanScenes = false) => ({ ...o, planScenes: sansAppelPlanScenes ? {} : o.planScenes }) as unknown as OutilsChaineV4;

async function jusquAuBout(m: ReturnType<typeof creerMoteurMontageFacecamAnimee>, t: Travail): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let r: { travail: Travail; resultat?: ResultatFabrication } = { travail: t };
  for (let k = 0; k < 15 && r.travail.statut !== "termine" && r.travail.statut !== "echec"; k++) r = await m.avancer(r.travail, COMMANDE);
  return r;
}

/** Version d'origine finie par la vraie chaîne ; l'élément RANG devient un téléphone ; projet passé par la base (JSON). */
async function versionOrigine() {
  const o = outilsDoubles();
  const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o, true), statutFormat: "masque" });
  const fin = await jusquAuBout(m, await m.lancer(COMMANDE, { travailId: "trav-1", versionId: "ver-1", titre: "Essai" }));
  expect(fin.travail.statut).toBe("termine");
  const projet = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as { plan: { elementsV4: { id: string }[] } };
  projet.plan.elementsV4[RANG]!.id = "telephone-video";
  const parent: ParentRetouche = { versionId: "ver-1", projetMontage: projet as unknown as Record<string, unknown>, pistes: [] };
  return { parent };
}

const CTX = { travailId: "trav-2", versionId: "ver-2", titre: "Essai", maintenant: Date.UTC(2026, 10, 25, 12) };
const demande = (parent: ParentRetouche | undefined, commande: CommandeFabrication, operations?: unknown[]) => ({ commande, contexte: CTX, planIds: ["p-1"], consigne: "Refaire", parent, ...(operations ? { operations } : {}) }) as Parameters<ReturnType<typeof creerMoteurMontageFacecamAnimee>["retoucher"]>[0];
const CLIP = { nom: `v4-${RANG}-r1.mp4`, cle: `studio/dev/facecam-animee/v-1/videos/v4-${RANG}-r1.mp4`, choix: { fichier: `v4-${RANG}-r1.mp4`, source: "archive-axion", id: "ext-1", scene: "axion: devis", licence: "vidéo de Will (archive)" } };
const REMPLACER = { action: "remplacer", rang: RANG, recherche: "devis" };
const RETIRER = { action: "retirer", rang: RANG };

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA];
});

/** Ce que fait AUJOURD'HUI la retouche gratuite (refus des changements, ou re-rendu) : référence de (a) à (c). */
async function referenceMaster(commande: CommandeFabrication, parent: ParentRetouche | undefined, operations?: unknown[]) {
  const m = creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true });
  return m.retoucher(demande(parent, commande, operations));
}

describe("R4-03-c2 · a) éteint = identique (règle de moteur et service)", () => {
  const eteints: [string, () => ReturnType<typeof creerMoteurMontageFacecamAnimee>][] = [
    ["dépendance absente, valeur absente", () => creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, extraitRetouche: port().f })],
    ["() => false", () => creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, retoucheExtraits: () => false, extraitRetouche: port().f })],
    ["valeur rangée \"true\"", () => (((globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA] = "true"), creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, extraitRetouche: port().f }))],
    ["valeur rangée 1", () => (((globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA] = 1), creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, extraitRetouche: port().f }))],
  ];
  it.each(eteints)("(a) %s : même Travail qu'aujourd'hui, avec et sans `operations`", async (_nom, fabrique) => {
    const { parent } = await versionOrigine();
    const commande = avecDemande(RETIRER);
    for (const ops of [undefined, [{ type: "x" }]]) {
      const t = await fabrique().retoucher(demande(parent, commande, ops));
      expect(t).toEqual(await referenceMaster(commande, parent, ops));
    }
  });

  it("(a) un port qui n'est pas branché : même Travail qu'aujourd'hui, même allumé", async () => {
    const { parent } = await versionOrigine();
    const commande = avecDemande(RETIRER);
    const m = creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, retoucheExtraits: () => true });
    expect(await m.retoucher(demande(parent, commande))).toEqual(await referenceMaster(commande, parent));
  });
});

/** Port doublé qui compte ses appels. */
function port(resultat: unknown = CLIP) {
  const f = vi.fn(async () => resultat);
  return { f: f as unknown as NonNullable<Parameters<typeof creerMoteurMontageFacecamAnimee>[0]>["extraitRetouche"], appels: f };
}
const allume = (p: ReturnType<typeof port>) => creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(outilsDoubles()), retoucheGratuite: () => true, retoucheExtraits: () => true, extraitRetouche: p.f, statutFormat: "masque" });

describe("R4-03-c2 · b) c) la demande ne vise pas cette version : chemin d'aujourd'hui, port jamais appelé", () => {
  it("(b) entrées remplacées (sans la prise) : chemin d'aujourd'hui, réglage allumé ou non", async () => {
    const { parent } = await versionOrigine();
    const sansPrise = { ...COMMANDE, entrees: { retoucheExtraitV4: { ...RETIRER, pourVersionId: "ver-1" } } } as unknown as CommandeFabrication;
    const p = port();
    expect(await allume(p).retoucher(demande(parent, sansPrise))).toEqual(await creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true }).retoucher(demande(parent, sansPrise)));
    expect(p.appels).not.toHaveBeenCalled();
  });

  it("(c) version antérieure ou `pourVersionId` absent : même Travail qu'aujourd'hui, port jamais appelé", async () => {
    const { parent } = await versionOrigine();
    const p = port();
    for (const commande of [avecDemande(REMPLACER, { pourVersionId: "ver-ancienne" }), avecDemande(REMPLACER, { pourVersionId: undefined })]) {
      expect(await allume(p).retoucher(demande(parent, commande))).toEqual(await referenceMaster(commande, parent));
    }
    expect(p.appels).not.toHaveBeenCalled();
  });

  it("(c) la demande vise la version « ver-1 » mais la version gardée est « ver-9 » : chemin d'aujourd'hui, port jamais appelé", async () => {
    const { parent } = await versionOrigine();
    const autre = { ...parent, versionId: "ver-9" };
    const p = port();
    const commande = avecDemande(REMPLACER);
    expect(await allume(p).retoucher(demande(autre, commande))).toEqual(await referenceMaster(commande, autre));
    expect(p.appels).not.toHaveBeenCalled();
  });
});

describe("R4-03-c2 · d) allumé : la demande est appliquée au projet gardé, re-rendu à 0 €", () => {
  it("(d) remplacer : port appelé UNE fois, plan rendu avec le clip v4-<rang>-r1.mp4", async () => {
    const { parent } = await versionOrigine();
    const o = outilsDoubles();
    const p = port();
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o), retoucheGratuite: () => true, retoucheExtraits: () => true, extraitRetouche: p.f, statutFormat: "masque" });
    const commande = avecDemande(REMPLACER);
    const t = await m.retoucher(demande(parent, commande));
    expect(p.appels).toHaveBeenCalledTimes(1);
    // Contrat du futur port du service : (commande, projet gardé, demande) dans CET ordre.
    expect(p.appels).toHaveBeenCalledWith(commande, expect.objectContaining({ priseCle: PRISE }), expect.objectContaining({ action: "remplacer", rang: RANG }));
    expect((t.parametres?.facecamAnimeeV4 as { etape: string }).etape).toBe("rendu");
    const fin = await jusquAuBout(m, t);
    expect(fin.travail.statut).toBe("termine");
    const rendu = o.rendre.mock.calls[0][0] as { plan: PlanFacecamAnimee; videos?: { nom: string }[] };
    expect(rendu.plan.elementsV4![RANG]!.medias).toEqual([`broll/${CLIP.nom}`]);
    expect(rendu.videos!.map((v) => v.nom)).toContain(CLIP.nom);
    for (const f of [o.transcrire, o.reperer, o.appelerRealisateur, o.videos, o.planScenes.appeler, o.plafondClaudeAtteint]) expect(f).not.toHaveBeenCalled();
    expect(fin.resultat?.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("(d) le port refuse (archive vide) : échec motivé non réessayable, aucune sortie", async () => {
    const { parent } = await versionOrigine();
    const p = port({ refus: { code: "ARCHIVE_VIDE", message: "Votre archive n'a encore aucune vidéo utilisable : rien n'a changé." } });
    const t = await allume(p).retoucher(demande(parent, avecDemande(REMPLACER)));
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: "ARCHIVE_VIDE", reessayable: false });
    expect(t.etapes[0]!.statut).toBe("echec");
  });

  it("(d) retirer : le port n'est jamais appelé, l'élément est retiré du plan rendu", async () => {
    const { parent } = await versionOrigine();
    const o = outilsDoubles();
    const p = port();
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o), retoucheGratuite: () => true, retoucheExtraits: () => true, extraitRetouche: p.f, statutFormat: "masque" });
    const fin = await jusquAuBout(m, await m.retoucher(demande(parent, avecDemande(RETIRER))));
    expect(fin.travail.statut).toBe("termine");
    expect(p.appels).not.toHaveBeenCalled();
    const rendu = o.rendre.mock.calls[0][0] as { plan: PlanFacecamAnimee };
    expect(rendu.plan.elementsV4!.length).toBe(PLAN_VALIDE.elementsV4!.length - 1);
    expect(rendu.plan.elementsV4!.some((e) => e.id === "telephone-video")).toBe(false);
  });

  it("(d) projet gardé illisible : refus motivé, port jamais appelé", async () => {
    const p = port();
    const t = await allume(p).retoucher(demande({ versionId: "ver-1", projetMontage: undefined, pistes: [] } as unknown as ParentRetouche, avecDemande(REMPLACER)));
    expect(t.statut).toBe("echec");
    expect(t.erreur?.reessayable).toBe(false);
    expect(p.appels).not.toHaveBeenCalled();
  });
});

describe("R4-03-c2 · e) le réglage du service", () => {
  const ecrit = () => (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA];
  it("(e) absent → faux ; `true` → vrai ; \"true\", 1 → faux ; lecture qui lève → faux ; la clé lue est la bonne", async () => {
    const lus: string[] = [];
    for (const [valeur, attendu] of [[undefined, false], [true, true], ["true", false], [1, false]] as const) {
      await actualiserRetoucheExtraitsFA(async (id, defaut) => (lus.push(id), valeur === undefined ? defaut : valeur));
      expect(ecrit()).toBe(attendu);
    }
    expect(new Set(lus)).toEqual(new Set([PARAM_RETOUCHE_EXTRAITS_FA]));
    expect(PARAM_RETOUCHE_EXTRAITS_FA).toBe("retoucheChat.facecamAnimeeExtraits");
    await actualiserRetoucheExtraitsFA(async () => true);
    await actualiserRetoucheExtraitsFA(async () => { throw new Error("boum"); });
    expect(ecrit()).toBe(false);
  });

  it("(e) preparerRetoucheGratuiteFA : écrit la valeur pour ce moteur seulement", async () => {
    vi.resetModules();
    vi.doMock("@/services/_commun", () => ({ lireParametre: async (id: string) => id === PARAM_RETOUCHE_EXTRAITS_FA }));
    const { preparerRetoucheGratuiteFA } = await import("@/services/facecam-animee-retouche");
    await preparerRetoucheGratuiteFA({ moteurId: "autre" } as never);
    expect(ecrit()).toBeUndefined();
    await preparerRetoucheGratuiteFA({ moteurId: ID_MOTEUR_FACECAM_ANIMEE } as never);
    expect(ecrit()).toBe(true);
    vi.doUnmock("@/services/_commun");
    vi.resetModules();
  });
});

describe("R4-03-c2 · f) AUDIT ARGENT : aucune ligne d'argent, aucun fournisseur", () => {
  it("(f) estimation de la retouche identique allumé / éteint, 0 €", async () => {
    const { parent } = await versionOrigine();
    const commande = avecDemande(REMPLACER);
    const eteint = creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true });
    const e0 = await eteint.estimerRetouche(commande, ["p-1"], { parent });
    const e1 = await allume(port()).estimerRetouche(commande, ["p-1"], { parent });
    expect(e1).toEqual(e0);
    expect(e1.total).toEqual({ centimes: 0, devise: "EUR" });
  });

  it("(f) le code ajouté ne touche ni crédits, ni budget, ni plafond, ni fournisseur", () => {
    for (const f of ["src/moteurs/montage-facecam-animee/index.ts", "src/services/facecam-animee-retouche.ts"]) {
      const texte = readFileSync(join(RACINE, f), "utf8");
      const ajoute = texte.split("\n").filter((l) => /R4-03-c2|extraitRetouche|retoucheExtraits|RETOUCHE_EXTRAITS|etatRetoucheExtraitV4|retouche-extrait-v4/.test(l)).join("\n");
      expect(ajoute).not.toMatch(/credits|budget|plafond|reserver|centimes|Usd|fournisseurs\/|generation-claude/);
    }
  });
});
