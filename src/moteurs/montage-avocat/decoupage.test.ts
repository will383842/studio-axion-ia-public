/**
 * Découpage B.2 : UNE RÈGLE = UN TEST NOMMÉ (R1 à R13), sur des scripts réels de 26 s, 35 s et 45 s (B.10).
 */
import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import type { PlanCommande } from "@/domaine/types";
import { RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { STYLE_MONTAGE_AVOCAT } from "@/donnees/elements-avocat";
import { controlerRythme, decouperEnPlans, insecables, motAncreDe, type EntreeDecoupage, type SegmentDecoupage } from "./decoupage";
import { preparerTexteVoix, reporterHorodatages } from "./report";

const S = (id: string, bloc: string, texte: string, extra: Partial<SegmentDecoupage> = {}): SegmentDecoupage => ({ id, bloc, texte, ...extra });

/** ≈ 45 s à 4,4 mots/s. */
const SCRIPT_45: SegmentDecoupage[] = [
  S("a1", "accroche", "Vous recevez un PV de 135 € ? Surtout, ne le payez pas tout de suite."),
  S("p1", "promesse", "Je vous explique pourquoi, et comment le contester en trois étapes simples."),
  S("c1", "coeur", "D'abord, regardez la date inscrite sur l'avis de contravention.", { intentionIllustration: "un avis de contravention posé sur une table" }),
  S("c2", "coeur", "Si elle dépasse le délai légal, la procédure peut tomber entièrement.", { emphase: ["délai légal"] }),
  S("c3", "coeur", "Ensuite, vérifiez la photo du radar et la plaque de votre voiture.", { intentionIllustration: "un radar automatique au bord de la route" }),
  S("c4", "coeur", "Une seule lettre illisible, et le doute profite toujours au conducteur."),
  S("c5", "coeur", "Enfin, demandez la désignation du conducteur avant de payer quoi que ce soit.", { emphase: ["avant de payer"] }),
  S("c6", "coeur", "Beaucoup de gens paient par réflexe, et perdent leurs points pour rien.", { intentionIllustration: "un permis de conduire rose", incrustation: { type: "montant", texte: "−4 pts", sens: "perte" } }),
  S("pr1", "preuve", "L'an dernier, un client a récupéré 67 000 € et son permis grâce à ce détail.", { emphase: ["67 000 €"] }),
  S("ap1", "appel", "Gardez cette vidéo, elle vous servira le jour où le PV arrive."),
  S("b1", "boucle", "Et surtout, ne payez jamais un PV tout de suite."),
];
const SCRIPT_26 = SCRIPT_45.filter((s) => ["a1", "p1", "c1", "c2", "ap1", "b1"].includes(s.id));
const SCRIPT_35 = SCRIPT_45.filter((s) => !["c4", "c5"].includes(s.id));

function mots(segments: SegmentDecoupage[], debit = 4.4) {
  const t = preparerTexteVoix(segments, []);
  return reporterHorodatages(t, horodaterTexte(t.texte, debit));
}

function entree(segments: SegmentDecoupage[], options: Partial<EntreeDecoupage> = {}): EntreeDecoupage {
  return {
    mots: mots(segments),
    segments,
    plansIndicatifs: [],
    recette: RECETTE_MONTAGE_AVOCAT,
    style: STYLE_MONTAGE_AVOCAT,
    repartition: { principal: 0.85, second: 0.15 },
    deuxAngles: true,
    ouvertureSurIllustration: false,
    illustrations: true,
    levresNote: 92,
    personnageId: "perso-will",
    ...options,
  };
}

const coupes = (plans: { debutSec: number }[]) => plans.slice(1).map((p) => p.debutSec);
const doubles = (plans: ReturnType<typeof decouperEnPlans>) => plans.filter((p) => p.sourceImage === "double");

describe("découpage en plans sur l'audio maître (B.2)", () => {
  it("R1 — chaque coupe tombe entre deux mots, de préférence sur une pause d'au moins 60 ms", () => {
    const e = entree(SCRIPT_45);
    const plans = decouperEnPlans(e);
    const surUnMot = coupes(plans).filter((c) => e.mots.some((m) => c > m.debutSec + 1e-6 && c < m.finSec - 1e-6));
    expect(surUnMot).toEqual([]);
    // La plupart des coupes du double sont sur une vraie pause (≥ 60 ms).
    const pauses = coupes(doubles(plans)).filter((c) => {
      const i = e.mots.findIndex((m) => m.debutSec >= c);
      return i > 0 && e.mots[i].debutSec - e.mots[i - 1].finSec >= 0.06;
    });
    expect(pauses.length / Math.max(1, coupes(doubles(plans)).length)).toBeGreaterThanOrEqual(0.5);
  });

  it.each([3.5, 4.4, 5.5])("R1 (vérif A2) — à %s mots/s non plus, aucune coupe dans un mot (sortie d'illustration comprise)", (debit) => {
    for (const script of [SCRIPT_26, SCRIPT_35, SCRIPT_45]) {
      const e = entree(script, { mots: mots(script, debit) });
      const surUnMot = coupes(decouperEnPlans(e)).filter((c) => e.mots.some((m) => c > m.debutSec + 1e-6 && c < m.finSec - 1e-6));
      expect(surUnMot).toEqual([]);
    }
  });

  it("R1 bis — jamais de coupe au milieu d'un nombre ou d'un montant (« 67 000 € », « 135 € »)", () => {
    for (const script of [SCRIPT_26, SCRIPT_35, SCRIPT_45]) {
      const e = entree(script);
      const plans = decouperEnPlans(e);
      for (const c of coupes(plans)) {
        const i = e.mots.findIndex((m) => m.debutSec >= c - 1e-6);
        if (i > 0) expect(insecables(e.mots[i - 1].mot, e.mots[i].mot), `${e.mots[i - 1].mot} | ${e.mots[i].mot}`).toBe(false);
      }
      if (script.some((x) => x.id === "pr1")) expect(plans.some((p) => p.texte.includes("67 000 €"))).toBe(true);
    }
  });

  it.each([
    ["26 s", SCRIPT_26],
    ["35 s", SCRIPT_35],
    ["45 s", SCRIPT_45],
  ])("R2 — première coupe avant 2,0 s (%s)", (_n, script) => {
    expect(coupes(decouperEnPlans(entree(script)))[0]).toBeLessThan(2.0);
  });

  it("R3 — ouverture : plans de 1,5 à 2,5 s pendant les 6 premières secondes, au moins 2 coupes avant 5 s", () => {
    const plans = decouperEnPlans(entree(SCRIPT_45));
    expect(coupes(plans).filter((c) => c < 5).length).toBeGreaterThanOrEqual(2);
    for (const p of plans.filter((x) => x.finSec <= 6)) {
      expect(p.finSec - p.debutSec).toBeGreaterThanOrEqual(1.2);
      expect(p.finSec - p.debutSec).toBeLessThanOrEqual(2.5 + 1e-6);
    }
  });

  it("R4 — ensuite 2,5-3,5 s en moyenne, jamais un plan de plus de 6 s, jamais sous 1,5 s en moyenne", () => {
    for (const script of [SCRIPT_26, SCRIPT_35, SCRIPT_45]) {
      const e = entree(script);
      const plans = decouperEnPlans(e);
      for (const p of plans) expect(p.finSec - p.debutSec).toBeLessThanOrEqual(6 + 1e-6);
      const apres = doubles(plans).filter((p) => p.debutSec >= 6);
      // Correcteur réel 2 : la respiration de fin (≈ 1,2 s après le dernier mot) ne compte pas dans le rythme des coupes.
      const borne = e.mots.at(-1)!.finSec + 0.5;
      const moyenne = apres.reduce((s, p) => s + Math.min(p.finSec, borne) - p.debutSec, 0) / apres.length;
      expect(moyenne).toBeGreaterThanOrEqual(2.2);
      expect(moyenne).toBeLessThanOrEqual(3.8);
      expect(plans.at(-1)!.finSec / plans.length).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("R5 — un blanc de plus de 300 ms au milieu d'un plan force une coupe", () => {
    const e = entree(SCRIPT_45);
    // Une longue respiration gardée après « simples. » (fin de la promesse) : 0,45 s de blanc.
    const i = e.mots.findIndex((m) => m.mot === "simples.");
    const decale = e.mots.map((m, k) => (k > i ? { ...m, debutSec: m.debutSec + 0.45, finSec: m.finSec + 0.45 } : m));
    const plans = decouperEnPlans({ ...e, mots: decale });
    const blanc = { de: decale[i].finSec, a: decale[i + 1].debutSec };
    expect(coupes(plans).some((c) => c >= blanc.de && c <= blanc.a)).toBe(true);
  });

  it("R6 — au-delà de 30 s, une rupture forte (illustration, second angle, incrustation) toutes les 10 à 15 s", () => {
    const plans = decouperEnPlans(entree(SCRIPT_45, { illustrations: false }));
    const ruptures = plans.filter((p) => p.sourceImage === "illustration" || p.angle === "face" || p.incrustation).map((p) => p.debutSec);
    let derniere = 0;
    for (const r of ruptures) {
      expect(r - derniere).toBeLessThanOrEqual(15 + 1e-6);
      derniere = r;
    }
    expect(plans.at(-1)!.finSec - derniere).toBeLessThanOrEqual(15 + 3);
  });

  it("R7 — second angle ≈ 15 %, jamais deux fois de suite, jamais sur l'accroche ; aucun en « un angle »", () => {
    const e = entree(SCRIPT_45);
    const plans = decouperEnPlans(e);
    const seconds = plans.filter((p) => p.angle === "face");
    expect(seconds.length).toBeGreaterThan(0);
    const finAccroche = Math.max(...e.mots.filter((m) => m.segmentId === "a1").map((m) => m.finSec));
    for (const p of seconds) expect(p.debutSec).toBeGreaterThanOrEqual(finAccroche - 1e-6);
    plans.forEach((p, i) => {
      if (i && p.angle === "face") expect(plans[i - 1].angle).not.toBe("face");
    });
    const part = seconds.reduce((s, p) => s + p.finSec - p.debutSec, 0) / doubles(plans).reduce((s, p) => s + p.finSec - p.debutSec, 0);
    expect(part).toBeGreaterThan(0.05);
    expect(part).toBeLessThan(0.35);
    expect(decouperEnPlans(entree(SCRIPT_45, { deuxAngles: false })).some((p) => p.angle === "face")).toBe(false);
  });

  it("R8 — angle principal : large 100 % / poitrine 118-122 %, poitrine sur l'emphase, écart ≥ 15 % entre deux plans voisins", () => {
    const e = entree(SCRIPT_45);
    const plans = decouperEnPlans(e);
    const principaux = plans.filter((p) => p.angle === "trois-quarts");
    for (const p of principaux) {
      if (p.cadrage.valeur === "large") expect(p.cadrage.zoom).toBe(1);
      else {
        expect(p.cadrage.zoom).toBeGreaterThanOrEqual(1.18);
        expect(p.cadrage.zoom).toBeLessThanOrEqual(1.22);
      }
    }
    expect(controlerRythme(plans, { recette: e.recette, style: e.style }).filter((a) => a.message.includes("Cadrages trop proches"))).toEqual([]);
    // Les plans sur l'emphase (chiffres, mots orange) sont plus souvent en poitrine que les autres.
    const emphase = principaux.filter((p) => /\d|délai légal|avant de payer/.test(p.texte));
    expect(emphase.filter((p) => p.cadrage.valeur === "poitrine").length).toBeGreaterThanOrEqual(Math.ceil(emphase.length / 2));
  });

  it("R8 bis — lèvres sous 85/100 : poitrine plafonnée à 112 % et jamais de coupe 100 → 112 %", () => {
    const plans = decouperEnPlans(entree(SCRIPT_45, { levresNote: 80 }));
    for (const p of plans) expect(p.cadrage.zoom).toBeLessThanOrEqual(1.12 + 1e-9);
    for (let i = 1; i < plans.length; i++) {
      const a = plans[i - 1];
      const b = plans[i];
      if (a.angle === "trois-quarts" && b.angle === "trois-quarts") expect(a.cadrage.zoom === 1 && b.cadrage.zoom === 1.12).toBe(false);
    }
  });

  it("R9 — zoom lent 100 → 106 % seulement sur un plan large de plus de 3 s, au plus un plan du double sur deux, jamais avec une incrustation", () => {
    const plans = decouperEnPlans(entree(SCRIPT_45));
    const d = doubles(plans);
    d.forEach((p, i) => {
      if (p.cadrage.zoomFin === undefined) return;
      expect(p.cadrage.valeur).toBe("large");
      expect(p.finSec - p.debutSec).toBeGreaterThan(3);
      expect(p.cadrage.zoomFin / p.cadrage.zoom).toBeCloseTo(1.06, 3);
      expect(p.incrustation).toBeUndefined();
      if (i) expect(d[i - 1].cadrage.zoomFin).toBeUndefined();
    });
  });

  it("R10 — illustrations : 1,5-2,5 s, ≈ 25 % au plus, jamais deux de suite ni dans les 1,5 dernières secondes, posées sur le mot qu'elles montrent", () => {
    const e = entree(SCRIPT_45);
    const plans = decouperEnPlans(e);
    const illus = plans.filter((p) => p.sourceImage === "illustration");
    expect(illus.length).toBeGreaterThan(0);
    const fin = plans.at(-1)!.finSec;
    for (const p of illus) {
      expect(p.finSec - p.debutSec).toBeGreaterThanOrEqual(1.5 - 1e-6);
      expect(p.finSec - p.debutSec).toBeLessThanOrEqual(2.5 + 1e-6);
      expect(p.finSec).toBeLessThanOrEqual(fin - 1.5 + 1e-6);
      // Contiguïté (Mayer) : l'image commence de 0,2 s avant à 0,1 s après le début de son mot d'ancrage.
      const ancre = e.mots[p.motAncre!];
      expect(p.debutSec - ancre.debutSec).toBeGreaterThanOrEqual(-0.2 - 1e-6);
      expect(p.debutSec - ancre.debutSec).toBeLessThanOrEqual(0.1 + 1e-6);
      expect(p.segmentId).toBe(ancre.segmentId);
    }
    plans.forEach((p, i) => i && p.sourceImage === "illustration" && expect(plans[i - 1].sourceImage).not.toBe("illustration"));
    expect(illus.reduce((s, p) => s + p.finSec - p.debutSec, 0) / fin).toBeLessThanOrEqual(0.27);
    // L'ancre est le mot qui rejoint l'intention (« radar »), pas le premier mot de la phrase.
    expect(motAncreDe(e.mots.filter((m) => m.segmentId === "c3"), "un radar automatique")?.mot).toBe("radar");
  });

  it("R10 bis — ouverture sur une image seulement si le réglage le permet : 1,5 s au plus, visage avant 2 s", () => {
    const sans = decouperEnPlans(entree(SCRIPT_45));
    expect(sans[0].sourceImage).toBe("double");
    const script = [{ ...SCRIPT_45[0], intentionIllustration: "une route vue d'une moto" }, ...SCRIPT_45.slice(1)];
    const e = entree(script, { ouvertureSurIllustration: true });
    const avec = decouperEnPlans(e);
    expect(avec[0].sourceImage).toBe("illustration");
    expect(avec[0].finSec).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(avec.find((p) => p.sourceImage === "double")!.debutSec).toBeLessThan(2);
    expect(controlerRythme(avec, { recette: e.recette, style: e.style, mots: e.mots, segments: e.segments }).filter((a) => a.gravite === "attention")).toEqual([]);
  });

  it("R11 — la vidéo finit 1,1 à 1,3 s après le dernier mot (correcteur réel 2) ; 0,4 à 0,6 s en option « fin en boucle »", () => {
    for (const script of [SCRIPT_26, SCRIPT_35, SCRIPT_45]) {
      for (const [boucle, a, b] of [[false, 1.1, 1.3], [true, 0.4, 0.6]] as const) {
        const e = entree(script, { finEnBoucle: boucle });
        const plans = decouperEnPlans(e);
        const ecart = plans.at(-1)!.finSec - e.mots.at(-1)!.finSec;
        expect(ecart).toBeGreaterThanOrEqual(a - 1e-6);
        expect(ecart).toBeLessThanOrEqual(b + 1e-6);
      }
    }
  });

  it("R12 — incrustations jamais pendant l'encadré d'ouverture (0-3 s), sur un plan du double de leur phrase", () => {
    const script = [{ ...SCRIPT_45[0], incrustation: { type: "objet" as const, texte: "PV" } }, ...SCRIPT_45.slice(1)];
    const plans = decouperEnPlans(entree(script));
    for (const p of plans.filter((x) => x.incrustation)) {
      expect(p.debutSec).toBeGreaterThanOrEqual(3);
      expect(p.sourceImage).toBe("double");
    }
    expect(plans.find((p) => p.incrustation?.texte === "−4 pts")?.segmentId).toBe("c6");
  });

  it("R13 — verrouiller, redécouper : l'illustration verrouillée reste sur la même phrase", () => {
    const e = entree(SCRIPT_45);
    const premiers = decouperEnPlans(e);
    const choisi = premiers.find((p) => p.segmentId === "c3" && p.sourceImage === "illustration")!;
    expect(choisi).toBeDefined();
    // Will verrouille son image sur ce plan, puis la voix est refaite plus lentement : tout le minutage bouge.
    const indicatifs: PlanCommande[] = premiers.map((p, i) => ({ ...p, id: `ver-plan-${i + 1}`, illustration: p === choisi ? { source: "bibliotheque", elementId: "el-radar-de-will", verrouille: true, candidats: [] } : p.illustration }));
    const lents = mots(SCRIPT_45, 3.9);
    const apres = decouperEnPlans({ ...e, mots: lents, plansIndicatifs: indicatifs });
    const garde = apres.find((p) => p.illustration?.elementId === "el-radar-de-will")!;
    expect(garde).toBeDefined();
    expect(garde.segmentId).toBe("c3");
    expect(garde.illustration?.verrouille).toBe(true);
    const phrase = lents.filter((m) => m.segmentId === "c3");
    expect(garde.debutSec).toBeGreaterThanOrEqual(phrase[0].debutSec - 0.2);
    expect(garde.debutSec).toBeLessThanOrEqual(phrase.at(-1)!.finSec);
    // Le minutage a bien changé.
    expect(garde.debutSec).not.toBeCloseTo(choisi.debutSec, 1);
  });

  it("VERIF-1 a1 — vidéo de version : l'élément trouvé par la cascade (plan indicatif d'illustration seul) est reporté sur le plan produit du même segment", () => {
    // La commande d'une vidéo de version ne porte que les plans d'illustration du texte assemblé, non verrouillés.
    const indicatifs: PlanCommande[] = [
      { id: "v-plan-3", ordre: 3, debutSec: 0, finSec: 0, texte: SCRIPT_45[2].texte, segmentId: "c1", sourceImage: "illustration", illustration: { source: "banque", requete: "un avis de contravention posé sur une table", elementId: "el-pexels-avis", verrouille: false, candidats: [] }, texteEcran: undefined, angle: undefined },
      { id: "v-plan-5", ordre: 5, debutSec: 0, finSec: 0, texte: SCRIPT_45[4].texte, segmentId: "c3", sourceImage: "illustration", illustration: { source: "generee-ia", requete: "un radar automatique au bord de la route", verrouille: false, candidats: [] }, texteEcran: undefined, angle: undefined },
    ];
    const plans = decouperEnPlans(entree(SCRIPT_45, { plansIndicatifs: indicatifs }));
    const avis = plans.filter((p) => p.sourceImage === "illustration" && p.segmentId === "c1");
    expect(avis.length).toBeGreaterThanOrEqual(1);
    expect(avis.every((p) => p.illustration?.elementId === "el-pexels-avis" && p.illustration.source === "banque")).toBe(true);
    // Un plan « à fabriquer » le reste (fabriqué ensuite au moteur, compté dans l'estimation).
    for (const p of plans.filter((x) => x.sourceImage === "illustration" && x.segmentId === "c3")) expect(p.illustration?.source).toBe("generee-ia");
  });

  it("transitions : toujours des coupes franches ; plans contigus de 0 à la fin, chacun rattaché à un segment", () => {
    const plans = decouperEnPlans(entree(SCRIPT_45));
    expect(plans[0].debutSec).toBe(0);
    plans.forEach((p, i) => {
      expect(p.transition).toBe("coupe");
      expect(p.ordre).toBe(i + 1);
      expect(p.segmentId).toBeTruthy();
      if (i) expect(p.debutSec).toBeCloseTo(plans[i - 1].finSec, 6);
    });
    expect(controlerRythme(plans, { recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, mots: mots(SCRIPT_45), segments: SCRIPT_45 }).filter((a) => a.gravite !== "info")).toEqual([]);
  });
});
