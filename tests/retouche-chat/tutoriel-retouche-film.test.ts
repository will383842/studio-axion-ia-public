/**
 * T-EXT-53c — retouche du film du tutoriel par le chat : aperçu (plan-pret, rien d'écrit, rien de rendu), application, moteur
 * (réglages repris, même voix, même film). Doubles seulement : 0 €, aucun appel réel.
 */
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { creerMoteurTutorielOutil, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { proprietesTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import type { OperationMontage } from "@/moteurs/types";
import { PORTEE_MOTEURS } from "@/briques/retouche-portee";
import { appliquerRetouche, PHRASE_RENDU_NON_BRANCHE, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import {
  appliquerOperationsFilm,
  appliquerRetoucheTutoriel,
  apercevoirRetoucheTutoriel,
  changementsFilm,
  etapeIdsDuFilm,
  etapesDuFilm,
  REMARQUE_REGLAGES_ILLISIBLES,
  lireOperationsFilm,
  lireReglagesFilm,
  operationsDeFabrication,
} from "@/services/retouche-chat/tutoriel-retouche-film";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "../tutoriel-outil/doubles";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
// Les étapes du film = les cibles de la navigation filmée (pas les scènes du plan).
const IDS = ["accueil", "stocks", "ventes"];
const etapes = etapesDuFilm(IDS);
const FILM = { etapesFilm: () => IDS };
const NAV = {
  version: "navigation-filmee.v1",
  videoCle: "studio/test/film.mp4",
  maquette: "tableau",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 400,
  dureeVoixMs: 60000,
  cibles: IDS.map((etapeId, i) => ({ etapeId, zonePct: { x: 10, y: 10 + i * 20, largeur: 30, hauteur: 12 }, instantMs: 3000 + i * 5000, finMs: 5000 + i * 5000 })),
};
const entreesFilm = { tutorielOutil: { scriptColle: true, navigationFilmee: NAV } };

function doubles() {
  const appeler = vi.fn(async () => {
    throw new Error("aucun appel réel");
  });
  const rendreScenes = vi.fn();
  const enregistrerVersion = vi.fn();
  const choisirVersion = vi.fn();
  const ports = { appeler, rendreScenes, enregistrerVersion, choisirVersion, lireVersionChoisie: async () => ({ versionId: "ver-1", plan }) } as unknown as PortsRetoucheChat;
  return { ports, appeler, rendreScenes, enregistrerVersion, choisirVersion };
}

const zoomPlus = (etape: number) => [{ type: "ajuster-camera-etape", etape, zoom: "plus" }];

describe("53c · aperçu", () => {
  it("plan-pret avec changements en mots simples, sans écriture ni rendu ni appel", async () => {
    const d = doubles();
    const r = await apercevoirRetoucheTutoriel("v1", "zoome plus sur l'étape 2", d.ports, { ...FILM, lireFilm: () => zoomPlus(2) });
    expect(r.statut).toBe("plan-pret");
    if (r.statut !== "plan-pret") return;
    expect(r.changements).toEqual([{ etape: 2, avant: "zoom normal", apres: "plus serré" }]);
    expect(r.reglagesFilm?.parEtape[etapes[1].etapeId]).toEqual({ zoom: "plus" });
    expect(d.rendreScenes).not.toHaveBeenCalled();
    expect(d.enregistrerVersion).not.toHaveBeenCalled();
    expect(d.choisirVersion).not.toHaveBeenCalled();
    // `appeler` est ici un double qui lève (aucun appel réel) : en production, le port du tutoriel est `appelNonBranche` (53b absent).
  });

  it("opération du film hors liste ou avec champ en trop : écartée avec une remarque, jamais d'exception", async () => {
    const d = doubles();
    const r = await apercevoirRetoucheTutoriel("v1", "x", d.ports, { ...FILM, lireFilm: () => [{ type: "ajuster-camera-etape", etape: 1, zoom: "plus", code: "x" }, { type: "lancer-script" }] });
    expect(r.statut).toBe("plan-pret");
    if (r.statut !== "plan-pret") return;
    expect(r.changements).toEqual([]);
    expect(r.reglagesFilm).toBeNull();
    expect(r.remarques.join(" ")).toContain("n'a pas été comprise");
  });

  it("étape inconnue : remarque, aucun changement", async () => {
    const r = await apercevoirRetoucheTutoriel("v1", "x", doubles().ports, { ...FILM, lireFilm: () => zoomPlus(9) });
    if (r.statut !== "plan-pret") throw new Error("attendu plan-pret");
    expect(r.changements).toEqual([]);
    expect(r.remarques.join(" ")).toContain("n'existe pas");
  });

  it("part des réglages de la version d'avant et dit « avant → après »", async () => {
    const avant = { parEtape: { [etapes[0].etapeId]: { zoom: "plus" } } };
    const r = await apercevoirRetoucheTutoriel("v1", "x", doubles().ports, { ...FILM, lireFilm: () => zoomPlus(1).map((o) => ({ ...o, zoom: "moins" })), reglagesAvant: () => avant });
    if (r.statut !== "plan-pret") throw new Error("attendu plan-pret");
    expect(r.changements).toEqual([{ etape: 1, avant: "zoom plus serré", apres: "plus large" }]);
  });

  it("sans version : inchangée, phrase claire", async () => {
    const d = doubles();
    const r = await apercevoirRetoucheTutoriel("v1", "x", { ...d.ports, lireVersionChoisie: async () => null });
    expect(r.statut).toBe("inchangee");
  });

  it("aucun montant dans les phrases", async () => {
    const r = await apercevoirRetoucheTutoriel("v1", "x", doubles().ports, { ...FILM, lireFilm: () => [...zoomPlus(1), { type: "changer-cran", cran: "sobre" }, { type: "changer-volet", actif: false }] });
    if (r.statut !== "plan-pret") throw new Error("attendu plan-pret");
    expect(JSON.stringify(r.changements) + r.remarques.join(" ")).not.toMatch(/[$€]|\d+,\d+/);
  });
});

describe("53c · lecture et application des crans (en attendant 53a)", () => {
  it("la dernière opération gagne sur une même étape ; seule l'étape visée change", () => {
    const { reglages } = appliquerOperationsFilm(undefined, lireOperationsFilm([...zoomPlus(1), { type: "ajuster-camera-etape", etape: 1, zoom: "moins" }]).operations, etapes);
    expect(reglages.parEtape[etapes[0].etapeId].zoom).toBe("moins");
    expect(Object.keys(reglages.parEtape)).toEqual([etapes[0].etapeId]);
  });
  it("lecture stricte : étape inconnue, cran inconnu, champ en trop → refus", () => {
    const ids = etapes.map((e) => e.etapeId);
    expect(lireReglagesFilm({ parEtape: { [ids[0]]: { zoom: "plus" } } }, ids)).not.toBeNull();
    expect(lireReglagesFilm({ parEtape: { inconnue: { zoom: "plus" } } }, ids)).toBeNull();
    expect(lireReglagesFilm({ parEtape: { [ids[0]]: { zoom: "x3" } } }, ids)).toBeNull();
    expect(lireReglagesFilm({ parEtape: {}, code: 1 }, ids)).toBeNull();
  });
  it("changements : rien de changé → liste vide", () => expect(changementsFilm(undefined, { parEtape: {} }, etapes)).toEqual([]));
});

describe("53c · application", () => {
  it("rend les réglages reçus (relus) au navigateur, sans rendu ni version", async () => {
    const d = doubles();
    const reglagesFilm = { parEtape: { [etapes[1].etapeId]: { rythme: "plus-lent" } } };
    const r = await appliquerRetoucheTutoriel("v1", { demande: "ralentis l'étape 2", operations: [], reglagesFilm }, d.ports, FILM);
    expect(r.statut).toBe("plan-pret");
    if (r.statut !== "plan-pret") return;
    expect(r.reglagesFilm).toEqual(reglagesFilm);
    expect(r.changements).toEqual([{ etape: 2, avant: "rythme normal", apres: "plus lent" }]);
    expect(d.rendreScenes).not.toHaveBeenCalled();
    expect(d.enregistrerVersion).not.toHaveBeenCalled();
  });
  it("réglages illisibles : version d'avant gardée, remarque", async () => {
    const r = await appliquerRetoucheTutoriel("v1", { demande: "x", operations: [], reglagesFilm: { parEtape: { inconnue: {} } } }, doubles().ports, FILM);
    expect(r.statut).toBe("inchangee");
    expect(r.remarques.join(" ")).toContain(REMARQUE_REGLAGES_ILLISIBLES);
  });
  it("opération de fabrication : ajoutée seulement si les réglages sont lisibles", () => {
    const ids = etapes.map((e) => e.etapeId);
    expect(operationsDeFabrication({ parEtape: { [ids[0]]: { zoom: "plus" } } }, ids)).toEqual([{ type: "reglagesFilm", reglages: { parEtape: { [ids[0]]: { zoom: "plus" } } } }]);
    expect(operationsDeFabrication({ parEtape: { x: {} } }, ids)).toEqual([]);
    expect(operationsDeFabrication(undefined, ids)).toEqual([]);
  });
});

describe("53c · les étapes sont celles du film, pas les scènes du plan", () => {
  it("numéros = rang des cibles ; une étape répétée compte une fois ; sans film : aucune étape", () => {
    expect(etapesDuFilm(["a", "b", "b", "c"])).toEqual([{ numero: 1, etapeId: "a" }, { numero: 2, etapeId: "b" }, { numero: 3, etapeId: "c" }]);
    expect(etapeIdsDuFilm(entreesFilm)).toEqual(IDS);
    expect(etapeIdsDuFilm({ tutorielOutil: { scriptColle: true } })).toEqual([]);
    expect(etapeIdsDuFilm(undefined)).toEqual([]);
  });
  it("« étape 3 » vise la 3e cible du film, même si le plan a plus de scènes (accroche)", async () => {
    expect(plan.scenes.length).toBeGreaterThan(0);
    const r = await apercevoirRetoucheTutoriel("v1", "zoome plus sur l'étape 3", doubles().ports, { ...FILM, lireFilm: () => zoomPlus(3) });
    if (r.statut !== "plan-pret") throw new Error("attendu plan-pret");
    expect(Object.keys(r.reglagesFilm!.parEtape)).toEqual([IDS[2]]);
    expect(r.changements).toEqual([{ etape: 3, avant: "zoom normal", apres: "plus serré" }]);
  });
  it("un identifiant de scène du plan n'est pas une étape du film : refus", () => {
    const sceneId = plan.scenes[0]!.id;
    expect(IDS).not.toContain(sceneId);
    expect(lireReglagesFilm({ parEtape: { [sceneId]: { zoom: "plus" } } }, IDS)).toBeNull();
  });
  it("sans film dans la version : toute étape est inconnue, aucun changement", async () => {
    const r = await apercevoirRetoucheTutoriel("v1", "x", doubles().ports, { lireFilm: () => zoomPlus(1) });
    if (r.statut !== "plan-pret") throw new Error("attendu plan-pret");
    expect(r.changements).toEqual([]);
    expect(r.remarques.join(" ")).toContain("n'existe pas");
  });
});

describe("53c · appliquer sans opération du film : même sortie qu'appliquerRetouche", () => {
  const sceneId = plan.scenes[0]!.id;
  const cas: [string, unknown][] = [
    ["aucune opération", []],
    ["une opération du plan", [{ type: "ajouter-dynamisme", sceneIds: [sceneId], intensite: "leger" }]],
    ["une opération illisible (remarque)", [{ type: "lancer-script" }]],
    ["une opération sur une scène inconnue (remarque « ignorée »)", [{ type: "retirer-piece", sceneId: "inconnue", piece: "x" }]],
  ];
  it.each(cas)("%s", async (_nom, operations) => {
    // Le port du tutoriel n'a pas de rendu (la route n'en passe pas) : « plan-pret ».
    const sansRendu = () => ({ ...doubles().ports, rendreScenes: undefined }) as PortsRetoucheChat;
    const attendu = await appliquerRetouche("v1", { demande: "plus de dynamisme", operations }, sansRendu());
    expect(await appliquerRetoucheTutoriel("v1", { demande: "plus de dynamisme", operations }, sansRendu(), FILM)).toEqual(attendu);
  });
  it("le plan prêt garde la phrase « rendu non branché » et les remarques, jamais « Rien n'a changé »", async () => {
    const ports = { ...doubles().ports, rendreScenes: undefined } as PortsRetoucheChat;
    const r = await appliquerRetoucheTutoriel("v1", { demande: "plus de dynamisme", operations: [{ type: "ajouter-dynamisme", sceneIds: [sceneId], intensite: "fort" }, { type: "lancer-script" }] }, ports, FILM);
    expect(r.statut).toBe("plan-pret");
    expect(r.remarques).toContain(PHRASE_RENDU_NON_BRANCHE);
    expect(r.remarques.length).toBeGreaterThan(1);
  });
  it("avec réglages du film seuls : plan-pret avec la phrase « rendu non branché »", async () => {
    const ports = { ...doubles().ports, rendreScenes: undefined } as PortsRetoucheChat;
    const r = await appliquerRetoucheTutoriel("v1", { demande: "zoom", operations: [], reglagesFilm: { parEtape: { [IDS[2]]: { zoom: "plus" } } } }, ports, FILM);
    expect(r.statut).toBe("plan-pret");
    expect(r.remarques).toContain(PHRASE_RENDU_NON_BRANCHE);
  });
});

/* ------------------------------ moteur ------------------------------ */
const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: Parameters<typeof moteur.avancer>[1], travail: Parameters<typeof moteur.avancer>[0]) {
  let t = travail;
  for (let i = 1; i <= 400; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error("pas fini");
}

describe("53c · moteur", () => {
  async function base() {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel({ ratios: ["4:5"], entrees: entreesFilm });
    const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    return { j, moteur, c, parent: { versionId: "ver-1", projetMontage: resultat!.projetMontage, pistes: [] } };
  }
  const retoucher = (b: Awaited<ReturnType<typeof base>>, operations?: OperationMontage[]) =>
    b.moteur.retoucher({ commande: b.c, contexte: { travailId: "t-r", versionId: "ver-2", titre: "R", maintenant: T0 }, planIds: [], consigne: "x", parent: b.parent, ...(operations ? { operations } : {}) } as never);
  const etatDe = (t: Awaited<ReturnType<typeof retoucher>>) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;

  it("la portée de l'opération est connue (scenes)", () => expect(PORTEE_MOTEURS.reglagesFilm).toBe("scenes"));

  it("réglages repris dans l'état ; voix et plan d'avant gardés ; 0 appel de plus", async () => {
    const b = await base();
    const avant = { voix: b.j.voix.length, claude: b.j.claude.length };
    const reglages = { parEtape: { [IDS[0]]: { zoom: "plus" } } };
    const t = await retoucher(b, [{ type: "reglagesFilm", reglages }]);
    expect(etatDe(t).reglagesFilm).toEqual(reglages);
    expect(etatDe(t).parent?.audio).toBeDefined();
    const { resultat } = await mener(b.moteur, b.c, t);
    expect((resultat!.projetMontage.tutoriel as { reglagesFilm?: unknown }).reglagesFilm).toEqual(reglages);
    // « même film, 0 capture » : aucune voix, aucun Claude, aucune capture de plus.
    expect(b.j.voix.length - avant.voix).toBe(0);
    expect(b.j.claude.length - avant.claude).toBe(0);
    expect(b.j.rendus.filter((d) => /capture/i.test(String(d.operation))).length).toBe(0);
  });

  it("réglages illisibles : réglages d'avant gardés, réserve", async () => {
    const b = await base();
    const t = await retoucher(b, [{ type: "reglagesFilm", reglages: "nimporte quoi" }]);
    expect(etatDe(t).reglagesFilm).toBeUndefined();
    expect(etatDe(t).reserves).toContain("Réglages du film illisibles : version d'avant gardée");
  });

  it("la dernière opération gagne", async () => {
    const b = await base();
    const t = await retoucher(b, [{ type: "reglagesFilm", reglages: { parEtape: { [IDS[0]]: { zoom: "plus" } } } }, { type: "reglagesFilm", reglages: { parEtape: { [IDS[0]]: { zoom: "moins" } } } }]);
    expect(etatDe(t).reglagesFilm).toEqual({ parEtape: { [IDS[0]]: { zoom: "moins" } } });
  });

  it.each([
    ["étape absente du film", { parEtape: { s1: { zoom: "plus" } } }],
    ["cran inconnu", { parEtape: { [IDS[0]]: { zoom: "enorme" } } }],
    ["champ en trop dans l'étape", { parEtape: { [IDS[0]]: { zoom: "plus", code: "alert(1)" } } }],
    ["champ en trop au premier niveau", { parEtape: {}, script: "x" }],
    ["cran global inconnu", { parEtape: {}, global: { cran: "fou" } }],
  ])("lecture stricte, %s : réserve, réglages d'avant gardés", async (_nom, reglages) => {
    const b = await base();
    const t = await retoucher(b, [{ type: "reglagesFilm", reglages }]);
    expect(etatDe(t).reglagesFilm).toBeUndefined();
    expect(etatDe(t).reserves).toContain(REMARQUE_REGLAGES_ILLISIBLES);
  });

  it("réglages illisibles : ceux de la version d'avant restent", async () => {
    const b = await base();
    const bonnes = { parEtape: { [IDS[1]]: { rythme: "plus-lent" } } };
    const t1 = await retoucher(b, [{ type: "reglagesFilm", reglages: bonnes }]);
    const { resultat } = await mener(b.moteur, b.c, t1);
    const b2 = { ...b, parent: { versionId: "ver-2", projetMontage: resultat!.projetMontage, pistes: [] } };
    const t2 = await retoucher(b2, [{ type: "reglagesFilm", reglages: { parEtape: { [IDS[1]]: { rythme: "x" } } } }]);
    expect(etatDe(t2).reglagesFilm).toEqual(bonnes);
  });

  it("les réglages du chat n'entrent pas dans l'empreinte des formats tant que le rendu les ignore", async () => {
    const b = await base();
    const sans = etatDe(await retoucher(b));
    const avec = etatDe(await retoucher(b, [{ type: "reglagesFilm", reglages: { parEtape: { [IDS[0]]: { zoom: "plus" } } } }]));
    const { resultat: r1 } = await mener(b.moteur, b.c, await retoucher(b));
    const { resultat: r2 } = await mener(b.moteur, b.c, await retoucher(b, [{ type: "reglagesFilm", reglages: { parEtape: { [IDS[0]]: { zoom: "plus" } } } }]));
    expect(sans.reglagesFilm).toBeUndefined();
    expect(avec.reglagesFilm).toBeDefined();
    const emp = (r: typeof r1) => (r!.projetMontage.tutoriel as { empreintesFormats?: unknown }).empreintesFormats;
    expect(emp(r2)).toEqual(emp(r1));
  });

  it("propriétés du rendu : les réglages voyagent avec la navigation ; absents : rien d'ajouté", async () => {
    const b = await base();
    const etat0 = etatDe(await retoucher(b, [{ type: "reglagesFilm", reglages: { parEtape: { [IDS[0]]: { zoom: "plus" } } } }]));
    const etat = { ...etat0, plan: { plan: etat0.parent!.plan!, source: "repris", scenesTouchees: [] } } as unknown as EtatTutoriel;
    const nav = { videoCle: "k", debutFilmMs: 0, dureeVoixMs: 1000, cran: "equilibre", basculeMs: 0, zones: [], cibles: [] } as never;
    const outils = { sousTitres: undefined };
    const avecR = proprietesTutoriel(etat, "4:5", false, outils, nav);
    expect((avecR.navigation as { reglagesFilm?: unknown }).reglagesFilm).toEqual({ parEtape: { [IDS[0]]: { zoom: "plus" } } });
    expect(avecR.reglagesFilm).toEqual({ parEtape: { [IDS[0]]: { zoom: "plus" } } });
    const sansR = proprietesTutoriel({ ...etat, reglagesFilm: undefined }, "4:5", false, outils, nav);
    expect("reglagesFilm" in sansR).toBe(false);
    expect("reglagesFilm" in (sansR.navigation ?? {})).toBe(false);
  });
});
