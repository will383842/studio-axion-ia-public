/**
 * S-15-b3-v21s · face caméra animée : une demande du chat sur les plaquettes (opération `plaquettesV4`) re-rend la version
 * GARDÉE avec les changements (texte, moment, retrait), sans repayer : 0 Opus, 0 vidéo, 0 IA. Éteinte : le refus d'aujourd'hui.
 * Chemin réel (VRAI moteur, outils doubles qui comptent, projet passé par JSON). Banc recopié de retouche-gratuite-moteur.test.ts.
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

import { listerPlaquettes } from "@/domaine/facecam-animee/appliquer-plaquettes";
import { garderPortee } from "@/briques/retouche-portee";
/** Clés des valeurs connues (écrites par le service). */
const CLE_RETOUCHE_GRATUITE_FA = Symbol.for("studio-axion-ia.facecam-animee-retouche-gratuite");
const RACINE = join(__dirname, "..", "..");
const PLAN_VALIDE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;
const PRISE = "studio/dev/entree/facecam-animee/f-1.mov";

const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
const REPONSE = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_VALIDE.elementsV4!.map((e) => { const { medias, ...reste } = e; void medias; return reste; }), motsForts };

const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: ID_MOTEUR_FACECAM_ANIMEE, ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle: PRISE, fichierId: "f-1", texteValide: SCRIPT, accordEssaiReel: true } } } as unknown as CommandeFabrication;

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

const CLE_PLAQUETTES_FA = Symbol.for("studio-axion-ia.facecam-animee-plaquettes");
const REFUS_AUJOURDHUI = "Les changements de la mise en scène par la conversation viendront plus tard : seule la version gardée peut être refaite.";

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA];
  delete (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA];
  vi.restoreAllMocks();
});

/** Retouche gratuite allumée (G12-09b) ; `plaquettes` : le réglage de la fiche (absent : la valeur connue). */
async function essai(parent: ParentRetouche, operations: unknown[], plaquettes?: () => boolean) {
  const o = outilsDoubles();
  const m = creerMoteurMontageFacecamAnimee({ outils: async () => enOutils(o), retoucheGratuite: () => true, statutFormat: "masque", ...(plaquettes ? { plaquettes } : {}) });
  const t = await m.retoucher(demande(parent, COMMANDE, operations));
  const apres = await jusquAuBout(m, t);
  const payants = [o.transcrire, o.reperer, o.appelerRealisateur, o.videos, o.planScenes.appeler, o.plafondClaudeAtteint].reduce((n, f) => n + f.mock.calls.length, 0);
  return { m, o, t, apres, payants };
}

/** Trois plaquettes de la version gardée : une à re-titrer (avec mots), une à décaler, une à retirer. */
function cibles(parent: ParentRetouche) {
  const liste = listerPlaquettes(parent.projetMontage!.plan as PlanFacecamAnimee);
  const avecMots = liste.find((p) => p.mots?.length)!;
  const autres = liste.filter((p) => p.uid !== avecMots.uid);
  return { liste, avecMots, decalee: autres[0], retiree: autres[autres.length - 1] };
}
const opsValides = (c: ReturnType<typeof cibles>) => [{ type: "plaquettesV4", operations: [{ type: "changer-texte", uid: c.avecMots.uid, mots: ["NOUVEAU"] }, { type: "decaler", uid: c.decalee.uid, decalageSec: 0.2 }, { type: "retirer", uid: c.retiree.uid }] }];

describe("S-15-b3 · (a) éteint = refus d'aujourd'hui", () => {
  const eteints: [string, (() => boolean) | undefined, unknown][] = [
    ["réglage absent (valeur connue absente)", undefined, undefined],
    ["valeur connue \"true\"", undefined, "true"],
    ["valeur connue 1", undefined, 1],
    ["() => false", () => false, undefined],
  ];
  it.each(eteints)("%s : RETOUCHE_NON_PRISE_EN_CHARGE mot pour mot, 0 appel, 0 rendu", async (_n, dep, connue) => {
    const { parent } = await versionOrigine();
    if (connue !== undefined) (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA] = connue;
    const { t, apres, payants, o } = await essai(parent, opsValides(cibles(parent)), dep);
    expect(t.statut).toBe("echec");
    expect(t.erreur).toEqual({ code: "RETOUCHE_NON_PRISE_EN_CHARGE", reessayable: false, messagePourWill: REFUS_AUJOURDHUI });
    expect(apres.travail.statut).toBe("echec");
    expect(payants + o.rendre.mock.calls.length).toBe(0);
  });
});

describe("S-15-b3 · (b) allumé, opérations valides : re-rendu de la version gardée, 0 €", () => {
  it("texte changé, plaquette décalée, plaquette retirée ; coupes, transcription, cadrage, prise identiques à la reprise sans opération", async () => {
    const { parent } = await versionOrigine();
    const c = cibles(parent);
    // Témoin : la reprise SANS opération (version gardée refaite telle quelle).
    const temoin = await essai(parent, [], () => true);
    expect(temoin.apres.travail.statut).toBe("termine");
    const renduTemoin = temoin.o.rendre.mock.calls[0][0] as Record<string, unknown>;

    const { t, apres, payants, o } = await essai(parent, opsValides(c), () => true);
    expect(t.statut).toBe("en_file");
    expect((t.parametres?.facecamAnimeeV4 as { etape: string }).etape).toBe("rendu");
    expect(apres.travail.statut).toBe("termine");
    expect(payants).toBe(0);
    expect(o.rendre).toHaveBeenCalledTimes(1);
    const rendu = o.rendre.mock.calls[0][0] as Record<string, unknown> & { plan: PlanFacecamAnimee };
    for (const cle of ["priseCle", "gardes", "recadrage", "videos"]) expect(rendu[cle], cle).toEqual(renduTemoin[cle]);
    const apresListe = listerPlaquettes(rendu.plan);
    expect(apresListe).toHaveLength(c.liste.length - 1);
    expect(apresListe.some((p) => p.mots?.join(" ") === "NOUVEAU")).toBe(true);
    expect(apresListe.map((p) => p.debut)).toContain(c.decalee.debut + 0.2);
    expect(rendu.plan.groupes).toEqual((renduTemoin.plan as PlanFacecamAnimee).groupes); // sous-titres (coupes et mots) inchangés
    expect(apres.resultat?.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("la valeur connue `true` exact (rangée par le service) allume aussi ; la clé est exportée par le moteur", async () => {
    expect((moteurFA as Record<string, unknown>).CLE_PLAQUETTES_FA).toBe(CLE_PLAQUETTES_FA);
    const { parent } = await versionOrigine();
    (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA] = true;
    const { apres, payants } = await essai(parent, opsValides(cibles(parent)));
    expect(apres.travail.statut).toBe("termine");
    expect(payants).toBe(0);
  });
});

describe("S-15-b3 · (c) mêlées à une autre opération : refus d'aujourd'hui", () => {
  it("plaquettesV4 + supprimer (dans les deux ordres) ⇒ RETOUCHE_NON_PRISE_EN_CHARGE, 0 appel", async () => {
    const { parent } = await versionOrigine();
    const pq = opsValides(cibles(parent))[0];
    for (const ops of [[pq, { type: "supprimer", planId: "p-1" }], [{ type: "supprimer", planId: "p-1" }, pq]]) {
      const { t, payants, o } = await essai(parent, ops, () => true);
      expect(t.erreur?.messagePourWill).toBe(REFUS_AUJOURDHUI);
      expect(payants + o.rendre.mock.calls.length).toBe(0);
    }
  });
});

describe("S-15-b3 · (d) toutes refusées : RETOUCHE_PLAQUETTES_REFUSEE", () => {
  it("uid inconnu ⇒ échec non réessayable, message = raison du code, 0 appel, 0 rendu", async () => {
    const { parent } = await versionOrigine();
    const { t, apres, payants, o } = await essai(parent, [{ type: "plaquettesV4", operations: [{ type: "retirer", uid: "plaquette-inexistante-99" }] }], () => true);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("RETOUCHE_PLAQUETTES_REFUSEE");
    expect(t.erreur?.reessayable).toBe(false);
    expect(t.erreur?.messagePourWill.length).toBeGreaterThan(5);
    expect(t.erreur?.messagePourWill).not.toMatch(/€|\$|\d+,\d\d/);
    expect(apres.travail.statut).toBe("echec");
    expect(payants + o.rendre.mock.calls.length).toBe(0);
  });

  it("opérations illisibles seulement ⇒ même échec, la remarque du lecteur est dite", async () => {
    const { parent } = await versionOrigine();
    const { t } = await essai(parent, [{ type: "plaquettesV4", operations: [{ type: "choisir-variante", uid: "x" }] }], () => true);
    expect(t.erreur?.code).toBe("RETOUCHE_PLAQUETTES_REFUSEE");
    expect(t.erreur?.messagePourWill).toContain("Changer l'animation d'une plaquette n'est pas encore possible.");
  });
});

describe("S-15-b3 · (e) prix : gratuit", () => {
  it("estimerRetouche avec l'opération = 0 € ; portée « final », gratuite pour la garde", async () => {
    const { parent } = await versionOrigine();
    const m = creerMoteurMontageFacecamAnimee({ retoucheGratuite: () => true, plaquettes: () => true });
    expect((await m.estimerRetouche(COMMANDE, ["p-1"], { parent, operations: opsValides(cibles(parent)) } as never)).total).toEqual({ centimes: 0, devise: "EUR" });
    expect(garderPortee("moteurs", ["plaquettesV4"])).toEqual({ ok: true, portees: ["final"] });
  });
});

describe("S-15-b3 · (a bis) réglage écrit par le service (retoucheChat.facecamAnimeePlaquettes)", () => {
  it("true exact allume ; absent, \"true\", 1, lecture qui lève : éteint ; une commande d'un autre moteur ne touche pas la valeur", async () => {
    vi.doMock("server-only", () => ({}));
    const s = await import("@/services/facecam-animee-retouche");
    expect(s.PARAM_PLAQUETTES_FA).toBe("retoucheChat.facecamAnimeePlaquettes");
    const valeur = () => (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA];
    const cas: [unknown, boolean][] = [[true, true], [undefined, false], ["true", false], [1, false]];
    for (const [v, attendu] of cas) {
      await s.actualiserPlaquettesFA(async (cle, defaut) => (cle === s.PARAM_PLAQUETTES_FA ? (v === undefined ? defaut : v) : defaut) as never);
      expect(valeur(), String(v)).toBe(attendu);
    }
    await s.actualiserPlaquettesFA(async () => { throw new Error("base en panne"); });
    expect(valeur()).toBe(false);
    (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA] = "témoin";
    await s.preparerRetoucheGratuiteFA({ moteurId: "montage-tableau" });
    expect(valeur()).toBe("témoin");
  });
});
