/**
 * T-DECLINAISONS-FACECAM-v20f : tests directs des 8 fonctions synchrones de `montage-facecam/declinaisons.ts`
 * qu'aucun test n'appelait : preparerDeclinaisons, bandeAvecDeclinaisons, declinaisonsFinies, controlePlans,
 * bouchePctDesPlans, etatRepriseFormats, raccordsDesGardes, habillagesFormatsRegles.
 * États construits à la main (cast sur les seuls champs lus). Aucun réseau, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import {
  bouchePctDesPlans,
  bandeAvecDeclinaisons,
  controlePlans,
  declinaisonsFinies,
  etatRepriseFormats,
  habillagesFormatsRegles,
  preparerDeclinaisons,
  raccordsDesGardes,
} from "@/moteurs/montage-facecam/declinaisons";
import type { EtatChaine } from "@/moteurs/montage-facecam/chaine";
import type { PlanCamera } from "@/briques/realisation";
import { controlerFormat, DIMENSIONS_FACECAM, positionSousTitresFormat, VERSION_FORMATS_FACECAM, type PlanFormat, type RatioFacecam } from "@/briques/formats-facecam";

const SOURCE = { largeur: 3840, hauteur: 2160 };

function plan(debutSec: number, finSec: number, x = 1500, taille: 100 | 115 | 130 = 100): PlanCamera {
  return {
    debutSec,
    finSec,
    priseDebutSec: debutSec + 10,
    priseFinSec: finSec + 10,
    taille,
    cadre: { x, y: 0, largeur: 1214, hauteur: 2160 },
    ouverture: debutSec === 0 ? "debut" : "coupe",
    yeuxHauteur: 0.34,
  };
}

function planFormat(ratio: RatioFacecam, o: Partial<PlanFormat> = {}): PlanFormat {
  return { ...plan(0, 4), ratio, yeuxLargeur: 0.5, yeuxHauteur: 0.34, visage: [0.3, 0.2, 0.4, 0.4], agrandissement: 1, ...o };
}

const etatAvecPlans = (plans: PlanCamera[]) => ({ plans, travaux: {} }) as unknown as EtatChaine;
const cmd = (ratios: string[] = ["9:16"], entrees: unknown = {}) => ({ ratios, entrees }) as unknown as Parameters<typeof preparerDeclinaisons>[1];

describe("preparerDeclinaisons", () => {
  it("sans plan (absents ou liste vide) : rien n'est écrit", () => {
    const sansListe = { travaux: {} } as unknown as EtatChaine;
    preparerDeclinaisons(sansListe, cmd(["9:16", "1:1"]), { source: SOURCE });
    expect(sansListe.declinaisons).toBeUndefined();
    const vide = etatAvecPlans([]);
    preparerDeclinaisons(vide, cmd(["9:16", "1:1"]), { source: SOURCE });
    expect(vide.declinaisons).toBeUndefined();
  });

  it("9:16 seul : l'état reste celui du 9:16 seul", () => {
    const etat = etatAvecPlans([plan(0, 4)]);
    preparerDeclinaisons(etat, cmd(["9:16"]), { source: SOURCE });
    expect(etat.declinaisons).toBeUndefined();
  });

  it("un seul ratio demandé (1:1) : un plan par plan du 9:16, bornes et tailles recopiées", () => {
    const plans = [plan(0, 4, 1500, 100), plan(4, 9.5, 1600, 130)];
    const etat = etatAvecPlans(plans);
    preparerDeclinaisons(etat, cmd(["9:16", "1:1"]), { source: SOURCE });
    const d = etat.declinaisons!;
    expect(d.version).toBe(VERSION_FORMATS_FACECAM);
    expect(d.ratios).toEqual(["1:1"]);
    expect(d.source).toEqual(SOURCE);
    expect(d.cadrages).toEqual({});
    expect(Object.keys(d.plans)).toEqual(["1:1"]);
    const p = d.plans["1:1"]!;
    expect(p).toHaveLength(2);
    expect(p.map((x) => x.ratio)).toEqual(["1:1", "1:1"]);
    expect(p.map((x) => [x.debutSec, x.finSec, x.priseDebutSec, x.priseFinSec])).toEqual([
      [0, 4, 10, 14],
      [4, 9.5, 14, 19.5],
    ]);
    expect(p.map((x) => x.taille)).toEqual([100, 130]);
    expect(p.map((x) => x.ouverture)).toEqual(["debut", "coupe"]);
    // la fenêtre d'un format carré est carrée, dans la source
    for (const x of p) {
      expect(x.cadre.largeur).toBe(x.cadre.hauteur);
      expect(x.cadre.x).toBeGreaterThanOrEqual(0);
      expect(x.cadre.x + x.cadre.largeur).toBeLessThanOrEqual(SOURCE.largeur);
    }
  });

  it("trois ratios demandés : l'ordre 4:5, 1:1, 16:9 et une liste de plans par format", () => {
    const etat = etatAvecPlans([plan(0, 4), plan(4, 8), plan(8, 12)]);
    preparerDeclinaisons(etat, cmd(["16:9", "1:1", "4:5", "9:16"]), { source: SOURCE });
    const d = etat.declinaisons!;
    expect(d.ratios).toEqual(["4:5", "1:1", "16:9"]);
    expect(Object.keys(d.plans)).toEqual(["4:5", "1:1", "16:9"]);
    for (const r of d.ratios) expect(d.plans[r]!.map((x) => x.ratio)).toEqual([r, r, r]);
    // 16:9 : fenêtre plus large que haute ; 4:5 : plus haute que large
    expect(d.plans["16:9"]![0].cadre.largeur).toBeGreaterThan(d.plans["16:9"]![0].cadre.hauteur);
    expect(d.plans["4:5"]![0].cadre.largeur).toBeLessThan(d.plans["4:5"]![0].cadre.hauteur);
  });

  it("les formats viennent aussi de entrees.facecamFormats", () => {
    const etat = etatAvecPlans([plan(0, 4)]);
    preparerDeclinaisons(etat, cmd(["9:16"], { facecamFormats: { version: 1, ratios: ["16:9", "bidon"] } }), { source: SOURCE });
    expect(etat.declinaisons!.ratios).toEqual(["16:9"]);
  });

  it("ne mute que etat.declinaisons (plans, travaux et le reste intacts) et ne touche pas les plans du 9:16", () => {
    const plans = [plan(0, 4), plan(4, 8)];
    const etat = etatAvecPlans(plans);
    const avant = structuredClone(etat);
    preparerDeclinaisons(etat, cmd(["9:16", "1:1", "16:9"]), { source: SOURCE });
    const { declinaisons, ...reste } = etat;
    expect(declinaisons).toBeDefined();
    expect(reste).toEqual(avant);
    expect(etat.plans).toBe(plans);
    expect(plans).toEqual(avant.plans);
  });

  it("deuxième appel : les plans déjà faits sont gardés tels quels, le nouveau format est ajouté", () => {
    const etat = etatAvecPlans([plan(0, 4)]);
    preparerDeclinaisons(etat, cmd(["9:16", "1:1"]), { source: SOURCE });
    const d = etat.declinaisons!;
    const premiers = d.plans["1:1"];
    preparerDeclinaisons(etat, cmd(["9:16", "1:1", "16:9"]), { source: SOURCE });
    expect(etat.declinaisons).toBe(d);
    expect(d.ratios).toEqual(["1:1", "16:9"]);
    expect(d.plans["1:1"]).toBe(premiers);
    expect(d.plans["16:9"]).toHaveLength(1);
  });

  it("formats imposés (format ajouté après coup) : seuls ceux-là, quoi que disent les entrées", () => {
    const etat = etatAvecPlans([plan(0, 4)]);
    preparerDeclinaisons(etat, cmd(["9:16", "1:1"]), { source: SOURCE });
    etat.declinaisons!.imposes = ["16:9"];
    preparerDeclinaisons(etat, cmd(["9:16", "1:1", "4:5"]), { source: SOURCE });
    expect(etat.declinaisons!.ratios).toEqual(["16:9"]);
    expect(Object.keys(etat.declinaisons!.plans)).toEqual(["1:1", "16:9"]);
  });
});

describe("bandeAvecDeclinaisons", () => {
  const cadre = (x: number, largeur: number) => ({ x, y: 0, largeur, hauteur: 2160 });
  const etat = (plans916: PlanCamera[], plansFormat: Record<string, PlanFormat[]> | undefined, ratios: string[]) =>
    ({ plans: plans916, travaux: {}, ...(plansFormat ? { declinaisons: { version: "v", ratios, source: SOURCE, plans: plansFormat, cadrages: {} } } : {}) }) as unknown as EtatChaine;

  it("sans déclinaison : null (la bande d'avant)", () => {
    expect(bandeAvecDeclinaisons(etat([plan(0, 4)], undefined, []), SOURCE)).toBeNull();
  });

  it("sans plan du 9:16 : null", () => {
    const e = etat([], { "1:1": [planFormat("1:1")] }, ["1:1"]);
    delete (e as { plans?: unknown }).plans;
    expect(bandeAvecDeclinaisons(e, SOURCE)).toBeNull();
  });

  it("déclinaison sans plan de format : null, et d.bande n'est pas écrite", () => {
    const e = etat([plan(0, 4)], {}, ["1:1"]);
    expect(bandeAvecDeclinaisons(e, SOURCE)).toBeNull();
    expect(e.declinaisons!.bande).toBeUndefined();
  });

  it("union du 9:16 et du format : x le plus à gauche, largeur paire, écrite dans d.bande", () => {
    // 9:16 : cadre 1000..1600 -> marge 32 -> 968..1632 ; format : 800..2000 -> 768..2032
    const e = etat([{ ...plan(0, 4), cadre: cadre(1000, 600) }], { "1:1": [planFormat("1:1", { cadre: cadre(800, 1200) })] }, ["1:1"]);
    const bande = bandeAvecDeclinaisons(e, SOURCE);
    expect(bande).toEqual({ x: 768, largeur: 1264 });
    expect(e.declinaisons!.bande).toBe(bande);
  });

  it("le 9:16 dépasse le format à droite : la fin du 9:16 fait foi ; marge coupée à 0 et à la largeur de la source", () => {
    // 9:16 : 10..3900 -> x0=0, x1=min(3840, 3932)=3840 ; format : 100..300
    const e = etat([{ ...plan(0, 4), cadre: cadre(10, 3890) }], { "16:9": [planFormat("16:9", { cadre: cadre(100, 200) })] }, ["16:9"]);
    expect(bandeAvecDeclinaisons(e, SOURCE)).toEqual({ x: 0, largeur: 3840 });
  });

  it("plusieurs ratios : tous les cadres de tous les formats comptent", () => {
    const e = etat(
      [{ ...plan(0, 4), cadre: cadre(1500, 600) }],
      { "1:1": [planFormat("1:1", { cadre: cadre(1400, 700) })], "16:9": [planFormat("16:9", { cadre: cadre(2400, 1000) })] },
      ["1:1", "16:9"],
    );
    // plus à gauche : 1400-32 = 1368 ; plus à droite : 3400+32 = 3432 -> largeur 2064
    expect(bandeAvecDeclinaisons(e, SOURCE)).toEqual({ x: 1368, largeur: 2064 });
  });
});

describe("declinaisonsFinies", () => {
  const fin = (d: unknown) => declinaisonsFinies({ declinaisons: d } as Pick<EtatChaine, "declinaisons">);
  const suivi = (statut: "soumis" | "termine" | "echec") => ({ id: "t", statut, essais: 0 });

  it("sans déclinaison : vrai", () => {
    expect(declinaisonsFinies({})).toBe(true);
  });
  it("liste de ratios vide : vrai", () => {
    expect(fin({ ratios: [], cadrages: {} })).toBe(true);
  });
  it("un ratio sans cadrage : faux", () => {
    expect(fin({ ratios: ["1:1"], cadrages: {} })).toBe(false);
  });
  it("un cadrage soumis : faux ; terminé : vrai", () => {
    expect(fin({ ratios: ["1:1"], cadrages: { "1:1": suivi("soumis") } })).toBe(false);
    expect(fin({ ratios: ["1:1"], cadrages: { "1:1": suivi("termine") } })).toBe(true);
  });
  it("un échec seul : faux ; échec déclaré raté : vrai", () => {
    expect(fin({ ratios: ["1:1"], cadrages: { "1:1": suivi("echec") } })).toBe(false);
    expect(fin({ ratios: ["1:1"], cadrages: { "1:1": suivi("echec") }, rates: [{ ratio: "1:1", message: "x" }] })).toBe(true);
  });
  it("trois ratios : faux tant qu'un seul manque, vrai quand l'un est terminé et les autres ratés", () => {
    const d = { ratios: ["4:5", "1:1", "16:9"], cadrages: { "4:5": suivi("termine"), "1:1": suivi("termine") } };
    expect(fin(d)).toBe(false);
    expect(fin({ ...d, rates: [{ ratio: "16:9", message: "x" }] })).toBe(true);
    // un raté d'un autre format ne règle pas le format qui manque
    expect(fin({ ...d, rates: [{ ratio: "4:5", message: "x" }] })).toBe(false);
  });
});

describe("bouchePctDesPlans et controlePlans", () => {
  it("liste vide : undefined", () => {
    expect(bouchePctDesPlans([])).toBeUndefined();
  });

  it("un plan : yeux + 0,36 × hauteur du visage, en % de la hauteur du format", () => {
    // 1:1 : yeux à 34 %, visage haut de 40 % -> 34 + 0,36 × 40 = 48,4
    expect(bouchePctDesPlans([planFormat("1:1")])).toBeCloseTo(48.4, 6);
    // le calcul se fait dans la hauteur du format du premier plan (hauteur px en %, indépendante de H ici)
    expect(DIMENSIONS_FACECAM["1:1"].hauteur).toBeGreaterThan(0);
  });

  it("plusieurs plans : la bouche la plus basse", () => {
    const haut = planFormat("4:5", { yeuxHauteur: 0.3, visage: [0.3, 0.1, 0.4, 0.3] });
    const bas = planFormat("4:5", { yeuxHauteur: 0.4, visage: [0.3, 0.2, 0.4, 0.5] });
    expect(bouchePctDesPlans([haut])).toBeCloseTo(30 + 0.36 * 30, 6);
    expect(bouchePctDesPlans([bas])).toBeCloseTo(40 + 0.36 * 50, 6);
    expect(bouchePctDesPlans([haut, bas])).toBeCloseTo(58, 6);
    expect(bouchePctDesPlans([bas, haut])).toBeCloseTo(58, 6);
  });

  it("controlePlans : même résultat que controlerFormat avec la ligne des sous-titres calée sur la bouche", () => {
    const plans = [planFormat("1:1"), planFormat("1:1", { debutSec: 4, finSec: 8 })];
    const c = controlePlans("1:1", plans);
    expect(c.ratio).toBe("1:1");
    expect(Array.isArray(c.defauts)).toBe(true);
    expect(c.ok).toBe(c.defauts.length === 0);
    // même verdict qu'un appel direct avec la ligne de sous-titres calée sur la bouche
    const centrePct = positionSousTitresFormat("1:1", bouchePctDesPlans(plans));
    expect(c).toEqual(controlerFormat({ ratio: "1:1", plans, sousTitres: { centrePct } }));
  });

  it("controlePlans : c'est la bouche qui décide de la ligne des sous-titres (valeur exacte, pas de recalcul)", () => {
    // bouche à 38 + 0,36 × 75 = 65 % : la ligne est calée ≈ 75 % -> aucun défaut.
    // Si la bouche était ignorée (ligne du milieu, 67,5 %), le défaut « sous-titres-sur-visage » apparaîtrait.
    const c = controlePlans("1:1", [planFormat("1:1", { yeuxHauteur: 0.38, visage: [0.3, 0.1, 0.4, 0.75] })]);
    expect(c.ok).toBe(true);
    expect(c.defauts).toEqual([]);
  });

  it("controlePlans : un visage sorti de l'image est signalé (ok faux), un visage bien placé ne l'est pas", () => {
    const bon = controlePlans("16:9", [planFormat("16:9", { yeuxHauteur: 0.34, yeuxLargeur: 0.5, visage: [0.4, 0.15, 0.2, 0.3] })]);
    const coupe = controlePlans("16:9", [planFormat("16:9", { yeuxHauteur: 0.05, yeuxLargeur: 0.5, visage: [0.4, -0.2, 0.2, 0.3] })]);
    expect(bon.ratio).toBe("16:9");
    expect(coupe.ok).toBe(false);
    expect(coupe.defauts.length).toBeGreaterThan(0);
    expect(coupe.defauts.map((d) => d.type)).toContain("visage-coupe");
    expect(coupe.alertes.length).toBeGreaterThan(0);
  });

  it("controlePlans sans plan : ok, aucun défaut", () => {
    const c = controlePlans("4:5", []);
    expect(c.ok).toBe(true);
    expect(c.defauts).toEqual([]);
    expect(c.alertes).toEqual([]);
  });
});

describe("etatRepriseFormats", () => {
  const plans = [plan(0, 4), plan(4, 9)];
  const son = { id: "son", statut: "termine", essais: 0 };
  const projet = (reprise: unknown) => ({ repriseFormats: reprise }) as Record<string, unknown>;
  const bonne = (extra: Record<string, unknown> = {}) => projet({ version: "v", travaux: { son }, plans, faits: [], ...extra });

  it("projet absent ou sans repriseFormats : null", () => {
    expect(etatRepriseFormats(undefined, ["1:1"])).toBeNull();
    expect(etatRepriseFormats({}, ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet(null), ["1:1"])).toBeNull();
  });

  it("reprise corrompue (pas un objet, plans absents ou vides, son absent ou pas terminé) : null", () => {
    expect(etatRepriseFormats(projet("abc"), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet(42), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son } }), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son }, plans: [] }), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: {}, plans }), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son: { ...son, statut: "soumis" } }, plans }), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son: { ...son, statut: "echec" } }, plans }), ["1:1"])).toBeNull();
  });

  it("aucun format voulu, ou le 9:16 seul : null", () => {
    expect(etatRepriseFormats(bonne(), [])).toBeNull();
    expect(etatRepriseFormats(bonne(), ["9:16"])).toBeNull();
  });

  it("un format voulu : état de reprise, formats imposés, plans recalculés, source par défaut 4K", () => {
    const e = etatRepriseFormats(bonne(), ["9:16", "1:1"])!;
    expect(e.version).toBe("reprise-formats-1");
    expect(e.plans).toBe(plans);
    expect(e.sauts).toEqual([]);
    expect(e.mots).toEqual({ statut: "fait", essais: 0 });
    expect(e.travaux.son).toEqual(son);
    const d = e.declinaisons!;
    expect(d.version).toBe(VERSION_FORMATS_FACECAM);
    expect(d.ratios).toEqual(["1:1"]);
    expect(d.imposes).toEqual(["1:1"]);
    expect(d.source).toEqual({ largeur: 3840, hauteur: 2160 });
    expect(d.cadrages).toEqual({});
    expect(Object.keys(d.plans)).toEqual(["1:1"]);
    expect(d.plans["1:1"]).toHaveLength(2);
    expect(d.plans["1:1"]!.map((x) => [x.ratio, x.debutSec, x.finSec])).toEqual([["1:1", 0, 4], ["1:1", 4, 9]]);
    expect("bande" in d).toBe(false);
    expect("passeLarge" in d).toBe(false);
    expect("repriseHabillage" in d).toBe(false);
  });

  it("trois formats : l'ordre voulu est gardé, le 9:16 écarté", () => {
    const d = etatRepriseFormats(bonne(), ["16:9", "9:16", "4:5"])!.declinaisons!;
    expect(d.ratios).toEqual(["16:9", "4:5"]);
    expect(d.imposes).toEqual(["16:9", "4:5"]);
    expect(Object.keys(d.plans)).toEqual(["16:9", "4:5"]);
  });

  it("la source vient de la passe des visages, et une source gardée l'emporte", () => {
    const visages = { id: "v", statut: "termine", essais: 0, resultat: { largeurSource: 1920, hauteurSource: 1080 } };
    const dv = etatRepriseFormats(projet({ travaux: { son, visages }, plans }), ["1:1"])!.declinaisons!;
    expect(dv.source).toEqual({ largeur: 1920, hauteur: 1080 });
    const dg = etatRepriseFormats(projet({ travaux: { son, visages }, plans, source: { largeur: 2560, hauteur: 1440 } }), ["1:1"])!.declinaisons!;
    expect(dg.source).toEqual({ largeur: 2560, hauteur: 1440 });
  });

  it("bande, passe élargie et habillage gardés sont repris tels quels", () => {
    const bande = { x: 400, largeur: 2000 };
    const passeLarge = { id: "p", statut: "soumis" as const, essais: 1 };
    const habillage = { dureeSec: 9 };
    const d = etatRepriseFormats(bonne({ bande, passeLarge, habillage }), ["1:1"])!.declinaisons!;
    expect(d.bande).toEqual(bande);
    expect(d.passeLarge).toEqual(passeLarge);
    expect(d.repriseHabillage).toEqual(habillage);
  });

  it("travaux copiés (modifier l'état ne touche pas la reprise gardée)", () => {
    const p = bonne();
    const e = etatRepriseFormats(p, ["1:1"])!;
    expect(e.travaux).not.toBe((p.repriseFormats as { travaux: unknown }).travaux);
    e.travaux.son = undefined;
    expect((p.repriseFormats as { travaux: { son: unknown } }).travaux.son).toBe(son);
  });
});

describe("raccordsDesGardes", () => {
  it("aucun passage ou un seul : aucun raccord", () => {
    expect(raccordsDesGardes([])).toEqual([]);
    expect(raccordsDesGardes([{ debutSec: 3, finSec: 8 }])).toEqual([]);
  });

  it("deux passages : un raccord à la fin du premier (temps monté)", () => {
    expect(raccordsDesGardes([{ debutSec: 3, finSec: 5 }, { debutSec: 9, finSec: 12 }])).toEqual([2]);
  });

  it("trois passages : raccords cumulés, le dernier passage n'en ajoute pas", () => {
    expect(raccordsDesGardes([{ debutSec: 1, finSec: 2.5 }, { debutSec: 10, finSec: 12.25 }, { debutSec: 20, finSec: 21 }])).toEqual([1.5, 3.75]);
  });

  it("passages voisins (bout à bout) : un raccord à chaque jonction", () => {
    expect(raccordsDesGardes([{ debutSec: 0, finSec: 2 }, { debutSec: 2, finSec: 4 }, { debutSec: 4, finSec: 6 }])).toEqual([2, 4]);
  });

  it("passages qui se chevauchent : seules les durées comptent (le chevauchement ne change rien)", () => {
    expect(raccordsDesGardes([{ debutSec: 0, finSec: 5 }, { debutSec: 3, finSec: 8 }, { debutSec: 6, finSec: 9 }])).toEqual([5, 10]);
  });

  it("arrondi au millième (pas de 0,30000000000000004)", () => {
    const r = raccordsDesGardes([{ debutSec: 0, finSec: 0.1 }, { debutSec: 0, finSec: 0.2 }, { debutSec: 0, finSec: 1 }]);
    expect(r).toEqual([0.1, 0.3]);
  });

  it("ne modifie pas la liste reçue", () => {
    const gardes = [{ debutSec: 0, finSec: 2 }, { debutSec: 5, finSec: 6 }];
    const copie = structuredClone(gardes);
    raccordsDesGardes(gardes);
    expect(gardes).toEqual(copie);
  });
});

describe("habillagesFormatsRegles", () => {
  const regle = (d: unknown) => habillagesFormatsRegles({ declinaisons: d } as Pick<EtatChaine, "declinaisons">);
  const termine = { id: "c", statut: "termine" as const, essais: 0 };
  const entreeHabillage = {};
  const sortie = { fichierCle: "k", vignetteCle: "v", alertes: [] };

  it("sans déclinaison : vrai", () => {
    expect(habillagesFormatsRegles({})).toBe(true);
  });
  it("liste de ratios vide : vrai", () => {
    expect(regle({ ratios: [], cadrages: {} })).toBe(true);
  });
  it("format raté : vrai, même sans habillage", () => {
    expect(regle({ ratios: ["1:1"], cadrages: { "1:1": termine }, entreeHabillage, rates: [{ ratio: "1:1", message: "x" }] })).toBe(true);
  });
  it("sans habillage préparé : rien n'attendu sans piste ; piste terminée avec entrée d'habillage : on attend", () => {
    expect(regle({ ratios: ["1:1"], cadrages: {} })).toBe(true);
    expect(regle({ ratios: ["1:1"], cadrages: { "1:1": termine } })).toBe(true);
    expect(regle({ ratios: ["1:1"], cadrages: { "1:1": { ...termine, statut: "soumis" } }, entreeHabillage })).toBe(true);
    expect(regle({ ratios: ["1:1"], cadrages: { "1:1": termine }, entreeHabillage })).toBe(false);
  });
  it("habillage préparé : réglé seulement avec une sortie ou abandonné", () => {
    const base = { ratios: ["1:1"], cadrages: { "1:1": termine }, entreeHabillage };
    expect(regle({ ...base, habillages: { "1:1": { cartes: [] } } })).toBe(false);
    expect(regle({ ...base, habillages: { "1:1": { cartes: [], sortie } } })).toBe(true);
    expect(regle({ ...base, habillages: { "1:1": { cartes: [], abandonne: true } } })).toBe(true);
  });
  it("deux formats : faux tant que l'un n'est pas réglé, vrai quand les deux le sont", () => {
    const base = { ratios: ["1:1", "16:9"], cadrages: { "1:1": termine, "16:9": termine }, entreeHabillage };
    expect(regle({ ...base, habillages: { "1:1": { cartes: [], sortie } } })).toBe(false);
    expect(regle({ ...base, habillages: { "1:1": { cartes: [], sortie }, "16:9": { cartes: [], abandonne: true } } })).toBe(true);
    expect(regle({ ...base, habillages: { "1:1": { cartes: [], sortie } }, rates: [{ ratio: "16:9", message: "x" }] })).toBe(true);
  });
});
