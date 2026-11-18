/**
 * G12-09b-a · le moteur « face caméra animée » v4 refait une version À PARTIR DU PROJET GARDÉ (re-rendu gratuit, sans Opus, sans
 * vidéos, sans IA du plan de scènes), derrière un interrupteur que personne n'allume encore (valeur connue, `true` exact seulement).
 * Preuve par le chemin réel : le VRAI moteur `creerMoteurMontageFacecamAnimee`, de « lancer » à « terminé » avec des outils doubles
 * (aucun réseau, aucun Claude réel), projet passé par la base (JSON), puis `retoucher` et `avancer` jusqu'au bout.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import * as moteurFA from "@/moteurs/montage-facecam-animee";
import { creerMoteurMontageFacecamAnimee, ID_MOTEUR_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import type { OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { ParentRetouche, ResultatFabrication } from "@/moteurs/types";

/** Clé de la valeur connue (écrite par le service, G12-09b-b) : locale, pour que (a) tourne aussi sur master. */
const CLE_RETOUCHE_GRATUITE_FA = Symbol.for("studio-axion-ia.facecam-animee-retouche-gratuite");
const RACINE = join(__dirname, "..", "..");
const PLAN_VALIDE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;
const PRISE = "studio/dev/entree/facecam-animee/f-1.mov";

const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
const REPONSE = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_VALIDE.elementsV4!.map(({ medias: _m, ...e }) => e), motsForts };

const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: ID_MOTEUR_FACECAM_ANIMEE, ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle: PRISE, fichierId: "f-1", texteValide: SCRIPT, accordEssaiReel: true } } } as unknown as CommandeFabrication;
const SANS_PRISE = { ...COMMANDE, entrees: {} } as unknown as CommandeFabrication;

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

/** Version d'origine finie par la vraie chaîne, puis son projet passé par la base (JSON). */
async function versionOrigine() {
  const o = outilsDoubles();
  const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o, true), statutFormat: "masque" });
  const fin = await jusquAuBout(m, await m.lancer(COMMANDE, { travailId: "trav-1", versionId: "ver-1", titre: "Essai" }));
  expect(fin.travail.statut).toBe("termine");
  expect(o.rendre).toHaveBeenCalledTimes(1);
  const parent: ParentRetouche = { versionId: "ver-1", projetMontage: JSON.parse(JSON.stringify(fin.resultat!.projetMontage)), pistes: [] };
  return { parent, rendu: o.rendre.mock.calls[0][0] as Record<string, unknown> };
}

const CTX = { travailId: "trav-2", versionId: "ver-2", titre: "Essai", maintenant: Date.UTC(2026, 10, 18, 12) };
const demande = (parent: ParentRetouche | undefined, commande = COMMANDE, operations?: unknown[]) => ({ commande, contexte: CTX, planIds: ["p-1"], consigne: "Refaire", parent, ...(operations ? { operations } : {}) }) as Parameters<ReturnType<typeof creerMoteurMontageFacecamAnimee>["retoucher"]>[0];

const MESSAGE_REFUS = "La retouche d'une vidéo face caméra animée viendra plus tard : déposez la prise à nouveau pour une nouvelle mise en scène.";
/** Travail de retouche tel que l'écrit master b9b2d01 (avant la fiche), recopié à l'horloge fixée. */
const ETAPES_MASTER = [
  { cle: "mise-en-scene", nom: "La mise en scène", icone: "baguette", dependDe: [], statut: "en_attente", progression: 0, sortieFichierIds: [], planifie: { debut: CTX.maintenant + 500, fin: CTX.maintenant + 3500 } },
  { cle: "montage", nom: "Le montage", icone: "film", dependDe: ["mise-en-scene"], statut: "en_attente", progression: 0, sortieFichierIds: [], planifie: { debut: CTX.maintenant + 3500, fin: CTX.maintenant + 6500 } },
  { cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: ["montage"], statut: "en_attente", progression: 0, sortieFichierIds: [], planifie: { debut: CTX.maintenant + 6500, fin: CTX.maintenant + 8500 } },
];
const PARAMETRES_MASTER = { planIds: ["p-1"], version: "complete", charte: "interface-claire/1" };

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA];
});

describe("G12-09b-a · a) éteint = identique", () => {
  const eteints: [string, () => ReturnType<typeof creerMoteurMontageFacecamAnimee>][] = [
    ["dépendance absente", () => creerMoteurMontageFacecamAnimee()],
    ["() => false", () => creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => false })],
    ["valeur rangée \"true\"", () => (((globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = "true"), creerMoteurMontageFacecamAnimee())],
    ["valeur rangée 1", () => (((globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = 1), creerMoteurMontageFacecamAnimee())],
  ];
  it.each(eteints)("%s : capacité, refus et travail de retouche de master", async (_nom, fabrique) => {
    const { parent } = await versionOrigine();
    const m = fabrique();
    expect(m.capacites.retoucheParPlan).toBe(false);
    expect(JSON.stringify(m.refusRetouche!(COMMANDE))).toBe(JSON.stringify({ code: "RETOUCHE_NON_PRISE_EN_CHARGE", message: MESSAGE_REFUS }));
    expect(m.refusRetouche!(SANS_PRISE)).toBeNull();
    for (const p of [parent, undefined]) {
      const t = await m.retoucher(demande(p));
      expect(t.etapes).toEqual(ETAPES_MASTER);
      expect(t.parametres).toEqual(PARAMETRES_MASTER);
      expect({ type: t.type, statut: t.statut, cleIdempotence: t.cleIdempotence, finEstimee: t.finEstimee }).toEqual({ type: "retouche", statut: "en_file", cleIdempotence: "v-1:ver-2:retouche", finEstimee: new Date(CTX.maintenant + 8500).toISOString() });
    }
  });
});

describe("G12-09b-a · b) allumé : la version gardée est re-rendue, à 0 €, sans Opus, sans vidéos, sans IA", () => {
  it("capacité, refus avec prise levé, travail « retouche » à « rendu », rendu identique sauf idRendu", async () => {
    const { parent, rendu: renduOrigine } = await versionOrigine();
    const o = outilsDoubles();
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o), retoucheGratuite: () => true, statutFormat: "masque" });
    expect(m.capacites.retoucheParPlan).toBe(true);
    expect(m.refusRetouche!(COMMANDE)).toBeNull();
    expect((await m.estimerRetouche(COMMANDE, ["p-1"], { parent })).total).toEqual({ centimes: 0, devise: "EUR" });

    const t = await m.retoucher(demande(parent));
    expect(t.type).toBe("retouche");
    expect(t.statut).toBe("en_file");
    expect((t.parametres?.facecamAnimeeV4 as { etape: string }).etape).toBe("rendu");
    expect(t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle)).toEqual(["transcription", "coupes", "mise-en-scene", "videos"]);

    const fin = await jusquAuBout(m, t);
    expect(fin.travail.statut).toBe("termine");
    expect(o.rendre).toHaveBeenCalledTimes(1);
    const { idRendu, ...nouveau } = o.rendre.mock.calls[0][0] as Record<string, unknown>;
    const { idRendu: idOrigine, ...origine } = renduOrigine;
    expect(idOrigine).toBe("fa4-ver-1");
    expect(idRendu).toBe("fa4-ver-2");
    expect(Object.keys(nouveau).sort()).toEqual(Object.keys(origine).sort());
    for (const cle of ["priseCle", "plan", "gardes", "recadrage", "videos"]) expect(nouveau[cle], cle).toEqual(origine[cle]);
    expect((nouveau.videos as unknown[]).length).toBeGreaterThan(0);
    for (const f of [o.transcrire, o.reperer, o.appelerRealisateur, o.videos, o.planScenes.appeler, o.plafondClaudeAtteint]) expect(f).not.toHaveBeenCalled();
    expect(fin.resultat?.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("la valeur connue `true` exact (rangée par le service, G12-09b-b) allume aussi", async () => {
    expect((moteurFA as Record<string, unknown>).CLE_RETOUCHE_GRATUITE_FA).toBe(CLE_RETOUCHE_GRATUITE_FA);
    (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = true;
    const m = creerMoteurMontageFacecamAnimee();
    expect(m.capacites.retoucheParPlan).toBe(true);
    expect(m.refusRetouche!(COMMANDE)).toBeNull();
    expect(m.refusRetouche!(SANS_PRISE)?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
  });
});

describe("G12-09b-a · c) d) allumé mais impossible : échec motivé, 0 appel", () => {
  async function essai(projetMontage: Record<string, unknown> | undefined, operations?: unknown[]) {
    const o = outilsDoubles();
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o), retoucheGratuite: () => true });
    const t = await m.retoucher(demande(projetMontage ? { versionId: "ver-1", projetMontage, pistes: [] } : undefined, COMMANDE, operations));
    const apres = await jusquAuBout(m, t);
    const appels = [o.transcrire, o.reperer, o.appelerRealisateur, o.videos, o.planScenes.appeler, o.plafondClaudeAtteint, o.rendre].reduce((n, f) => n + f.mock.calls.length, 0);
    return { t, apres, appels };
  }

  it("c) projet sans transcription : RETOUCHE_GRATUITE_IMPOSSIBLE, phrase « coupes non retrouvées »", async () => {
    const { parent } = await versionOrigine();
    const sans = { ...parent.projetMontage! };
    delete sans.transcription;
    const { t, apres, appels } = await essai(sans);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("RETOUCHE_GRATUITE_IMPOSSIBLE");
    expect(t.erreur?.messagePourWill).toContain("pas été retrouvées à l'identique");
    expect(apres.travail.statut).toBe("echec");
    expect(apres.resultat).toBeUndefined();
    expect(appels).toBe(0);
  });

  it("c) plan illisible ou projet absent : message de refusRetoucheGratuiteV4", async () => {
    const { parent } = await versionOrigine();
    for (const projet of [{ ...parent.projetMontage!, plan: { illisible: true } }, undefined]) {
      const { t, apres, appels } = await essai(projet);
      expect(t.statut).toBe("echec");
      expect(t.erreur?.code).toBe("RETOUCHE_GRATUITE_IMPOSSIBLE");
      expect(t.erreur?.messagePourWill).toBe(`Cette vidéo n'a pas gardé ce qu'il faut pour être refaite sans frais. ${MESSAGE_REFUS}`);
      expect(apres.travail.statut).toBe("echec");
      expect(appels).toBe(0);
    }
  });

  it("d) opérations de la conversation : échec motivé, 0 appel", async () => {
    const { parent } = await versionOrigine();
    const { t, apres, appels } = await essai(parent.projetMontage, [{ type: "supprimer", planId: "p-1" }]);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.messagePourWill).toBe("Les changements de la mise en scène par la conversation viendront plus tard : seule la version gardée peut être refaite.");
    expect(apres.travail.statut).toBe("echec");
    expect(appels).toBe(0);
  });
});

describe("G12-09b-a · e) garde de texte", () => {
  it("index.ts n'importe reprise-rendu-v4 et retouche-gratuite que par `await import(`", () => {
    const index = readFileSync(join(RACINE, "src/moteurs/montage-facecam-animee/index.ts"), "utf8");
    for (const nom of ["reprise-rendu-v4", "retouche-gratuite"]) {
      const lignes = index.split("\n").filter((l) => l.includes(`"./${nom}"`));
      expect(lignes.length, nom).toBe(1);
      expect(lignes[0], nom).toContain(`await import("./${nom}")`);
      expect(index, nom).not.toMatch(new RegExp(`from\\s+["']\\./${nom}["']`));
    }
  });
});
