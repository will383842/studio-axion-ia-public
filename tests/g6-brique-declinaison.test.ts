/**
 * G6 · brique commune « déclinaison par réseau » (PURE) : mère = la plus longue, union des zones protégées, coupes
 * imposées aux frontières, assemblage début neuf + corps de la mère + fin neuve sur des coupes, retrait du segment
 * facultatif, raccord visible détecté, commande partielle (seul ce qui est refait est payé), recalage du débit,
 * incrustation d'appel ; texte DIT transmis (une seule application des prononciations).
 */
import { describe, expect, it } from "vitest";
import {
  assembler,
  avecIncrustationAppel,
  choisirMere,
  commandePartielle,
  coupesImposees,
  debitMesure,
  etapesVariante,
  raccordsSurMere,
  ratiosDeLaMere,
  recalerDebit,
  reseauxDesCalques,
  suitesContigues,
  tempsDesSegments,
  tranchesGardees,
  zoneAuMoins,
  zonesProtegeesUnion,
  type SourceAssemblage,
} from "@/briques/declinaison";
import { obtenirReseau } from "@/reseaux";
import { preparerTexteVoix, preparerTexteVoixDit, reporterHorodatages } from "@/moteurs/montage-avocat/report";
import type { CommandeFabrication, IdReseau, MotHorodate } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";

const plan = (ordre: number, debutSec: number, finSec: number, segmentId: string): PlanProduit =>
  ({ ordre, debutSec, finSec, segmentId, texte: segmentId, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: ordre % 2 ? 1 : 1.2 }, transition: "coupe" }) as PlanProduit;

/** Une mère : o1 o2 | c1 c2 | f1 (facultatif) | c3 | a1, une coupe à chaque frontière (plans). */
function mere(sansCoupeOuverture = false): SourceAssemblage {
  const segments = [
    { segmentId: "o1", debutSec: 0.2, finSec: 2.0 },
    { segmentId: "o2", debutSec: 2.2, finSec: 4.0 },
    { segmentId: "c1", debutSec: 4.3, finSec: 8.0 },
    { segmentId: "c2", debutSec: 8.2, finSec: 12.0 },
    { segmentId: "f1", debutSec: 12.3, finSec: 16.0 },
    { segmentId: "c3", debutSec: 16.3, finSec: 20.0 },
    { segmentId: "a1", debutSec: 20.3, finSec: 22.0 },
  ];
  const bornes = sansCoupeOuverture ? [0, 2.1, 5.5, 8.1, 12.15, 16.15, 20.15, 22.5] : [0, 2.1, 4.15, 8.1, 12.15, 16.15, 20.15, 22.5];
  const ids = ["o1", "o2", "c1", "c2", "f1", "c3", "a1"];
  const plans = bornes.slice(0, -1).map((b, i) => plan(i + 1, b, bornes[i + 1], ids[i]));
  const motsPrononces: MotHorodate[] = segments.flatMap((s) => [
    { mot: `${s.segmentId}-a`, debutSec: s.debutSec, finSec: (s.debutSec + s.finSec) / 2 },
    { mot: `${s.segmentId}-b`, debutSec: (s.debutSec + s.finSec) / 2, finSec: s.finSec },
  ]);
  return { nom: "mere", dureeSec: 22.5, segments, motsPrononces, plans };
}

/** Le son neuf d'une version TikTok : ot1 | at1 bt1, une coupe entre l'ouverture et la fin. */
function partiel(): SourceAssemblage {
  const segments = [
    { segmentId: "ot1", debutSec: 0.1, finSec: 2.5 },
    { segmentId: "at1", debutSec: 2.8, finSec: 4.6 },
    { segmentId: "bt1", debutSec: 4.8, finSec: 6.0 },
  ];
  return { nom: "partiel", dureeSec: 6.5, segments, motsPrononces: segments.map((s) => ({ mot: s.segmentId, debutSec: s.debutSec, finSec: s.finSec })), plans: [plan(1, 0, 2.65, "ot1"), plan(2, 2.65, 6.5, "at1")] };
}

describe("G6 · mère, ratios, zones", () => {
  it("la mère est la version la plus longue (choix stable à égalité) ; 9:16 toujours, 4:5 et Carré en option", () => {
    expect(choisirMere([{ code: "0042-AV-TT", dureeSec: 31 }, { code: "0042-AV-LI", dureeSec: 38 }, { code: "0042-AV-FB", dureeSec: 34 }])?.code).toBe("0042-AV-LI");
    expect(choisirMere([{ code: "0042-AV-TT", dureeSec: 30 }, { code: "0042-AV-IG", dureeSec: 30 }])?.code).toBe("0042-AV-IG");
    expect(ratiosDeLaMere()).toEqual(["9:16"]);
    expect(ratiosDeLaMere(["1:1", "4:5", "16:9"])).toEqual(["9:16", "4:5", "1:1"]);
  });

  it("union la plus stricte des zones protégées des réseaux cochés : au moins aussi stricte que chacun", () => {
    const reseaux: IdReseau[] = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"];
    const u = zonesProtegeesUnion(reseaux)!;
    for (const r of reseaux) {
      const z = obtenirReseau(r).zonesProtegees["9:16"];
      if (z) expect(zoneAuMoins(u, z)).toBe(true);
    }
  });

  it("encadré et incrustation d'appel suivent le réseau de LA version ; la mère, tous les réseaux cochés", () => {
    expect(reseauxDesCalques({ reseaux: ["tiktok", "linkedin"] })).toEqual(["tiktok", "linkedin"]);
    expect(reseauxDesCalques({ reseaux: ["tiktok", "linkedin"], variante: { id: "v", code: "x", reseau: "tiktok", videoMereId: "m", tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 } } })).toEqual(["tiktok"]);
  });
});

describe("G6 · coupes imposées et assemblage", () => {
  it("une coupe imposée à chaque frontière ouverture | corps | facultatif | corps | fin, aucune ailleurs", () => {
    const t = mere().segments;
    expect(coupesImposees(t, { ouverture: ["o1", "o2"], fin: ["a1"], facultatifs: ["f1"] })).toEqual([4.15, 12.15, 16.15, 20.15]);
    expect(coupesImposees(t, undefined)).toEqual([]);
  });

  it("version TikTok : début neuf, corps de la mère en deux morceaux (segment facultatif retiré), fin neuve ; raccords sur des coupes", () => {
    const etapes = etapesVariante({ ordreVersion: ["ot1", "c1", "c2", "c3", "at1", "bt1"], refaits: new Set(["ot1", "at1", "bt1"]), ordreMere: mere().segments.map((s) => s.segmentId) });
    expect(etapes).toEqual([
      { source: "partiel", segmentIds: ["ot1"] },
      { source: "mere", segmentIds: ["c1", "c2"] },
      { source: "mere", segmentIds: ["c3"] },
      { source: "partiel", segmentIds: ["at1", "bt1"] },
    ]);
    const r = assembler([mere(), partiel()], etapes);
    expect(r.morceaux.map((m) => [m.entree, m.deSec, m.aSec])).toEqual([
      ["partiel", 0, 2.65],
      ["mere", 4.15, 12.15],
      ["mere", 16.15, 20.15],
      ["partiel", 2.65, 6.5],
    ]);
    expect(r.visible).toBe(false);
    expect(r.jointures).toHaveLength(3);
    // Aucune variante ne refait le corps : chaque mot du corps vient de la mère, à la même durée.
    const corpsMere = mere().motsPrononces.filter((m) => /^c\d/.test(m.mot));
    const corpsVersion = r.motsPrononces.filter((m) => /^c\d/.test(m.mot));
    expect(corpsVersion.map((m) => m.mot)).toEqual(corpsMere.map((m) => m.mot));
    corpsVersion.forEach((m, i) => expect(+(m.finSec - m.debutSec).toFixed(3)).toBe(+(corpsMere[i].finSec - corpsMere[i].debutSec).toFixed(3)));
    expect(r.motsPrononces.some((m) => m.mot.startsWith("f1"))).toBe(false);
    // Plans du corps repris tels quels (mêmes durées, mêmes cadrages), replacés bout à bout.
    const plansCorps = r.plans.filter((p) => /^c/.test(p.segmentId));
    expect(plansCorps.map((p) => +(p.finSec - p.debutSec).toFixed(2))).toEqual([3.95, 4.05, 4]);
    expect(r.plans.map((p) => p.ordre)).toEqual(r.plans.map((_, i) => i + 1));
    expect(r.dureeSec).toBe(+(2.65 + 8 + 4 + 3.85).toFixed(3));
    expect(tranchesGardees(r)).toEqual({ debutRemplaceSec: 4.15, finRemplaceSec: 20.15 });
  });

  it("raccord sans coupe de la mère : visible (bascule en corps distinct), dit avant toute dépense", () => {
    const etapes = etapesVariante({ ordreVersion: ["ot1", "c1", "c2", "c3", "at1", "bt1"], refaits: new Set(["ot1", "at1", "bt1"]), ordreMere: mere().segments.map((s) => s.segmentId) });
    expect(raccordsSurMere(mere(), etapes).visible).toBe(false);
    const r = raccordsSurMere(mere(true), etapes);
    expect(r.visible).toBe(true);
    expect(r.raisons[0]).toMatch(/aucune coupe/);
    expect(assembler([mere(true), partiel()], etapes).visible).toBe(true);
  });

  it("2e ouverture : seule l'ouverture est refaite, le corps ET la fin viennent de la vidéo source", () => {
    const etapes = etapesVariante({ ordreVersion: ["ot1", "c1", "c2", "f1", "c3", "a1"], refaits: new Set(["ot1"]), ordreMere: mere().segments.map((s) => s.segmentId) });
    expect(etapes).toEqual([
      { source: "partiel", segmentIds: ["ot1"] },
      { source: "mere", segmentIds: ["c1", "c2", "f1", "c3", "a1"] },
    ]);
    const r = assembler([mere(), partiel()], etapes);
    expect(r.morceaux.at(-1)).toMatchObject({ entree: "mere", deSec: 4.15, aSec: 22.5 });
  });

  it("prises filmées (sans plans) : coupées avant le premier mot et après le dernier, marges gardées", () => {
    const prise = (nom: string, ids: string[], debut: number): SourceAssemblage => ({
      nom,
      dureeSec: debut + ids.length * 2 + 1.5,
      segments: ids.map((id, i) => ({ segmentId: id, debutSec: debut + i * 2, finSec: debut + i * 2 + 1.8 })),
      motsPrononces: ids.map((id, i) => ({ mot: id, debutSec: debut + i * 2, finSec: debut + i * 2 + 1.8 })),
    });
    const r = assembler([prise("debut", ["ot1"], 1.0), prise("corps", ["c1", "c2"], 1.4), prise("fin", ["at1"], 0.8)], [
      { source: "debut", segmentIds: ["ot1"] },
      { source: "corps", segmentIds: ["c1", "c2"] },
      { source: "fin", segmentIds: ["at1"] },
    ]);
    expect(r.morceaux.map((m) => [m.entree, m.deSec, m.aSec])).toEqual([
      ["debut", 0.75, 3.3],
      ["corps", 1.15, 5.7],
      ["fin", 0.55, 3.1],
    ]);
    expect(suitesContigues(["c1", "c3"], ["c1", "c2", "c3"])).toEqual([["c1"], ["c3"]]);
  });
});

describe("G6 · ce qui est payé, débit, appel, texte dit", () => {
  const commande = {
    script: {
      blocs: [
        { id: "b1", blocRecette: "accroche", segments: [{ id: "ot1", texte: "Un PV de 135 € ?" }] },
        { id: "b2", blocRecette: "coeur", segments: [{ id: "c1", texte: "Le corps commun de la vidéo, long, très long, qui ne se refait jamais." }] },
        { id: "b3", blocRecette: "appel", segments: [{ id: "at1", texte: "Écrivez-nous." }] },
      ],
      texteComplet: "Un PV de 135 € ? Le corps commun de la vidéo, long, très long, qui ne se refait jamais. Écrivez-nous.",
    },
    dureeCibleSec: 30,
    plans: [],
    texteDitParSegment: ["Un pé vé de cent trente-cinq euros ?", "Le corps commun de la vidéo, long, très long, qui ne se refait jamais.", "Écrivez-nous."],
  } as unknown as CommandeFabrication;

  it("commande partielle : seuls les segments refaits (texte, texte dit, durée au prorata)", () => {
    const p = commandePartielle(commande, new Set(["ot1", "at1"]));
    expect(p.script.texteComplet).toBe("Un PV de 135 € ? Écrivez-nous.");
    expect(p.texteDitParSegment).toEqual(["Un pé vé de cent trente-cinq euros ?", "Écrivez-nous."]);
    expect(p.dureeCibleSec).toBeLessThan(commande.dureeCibleSec / 2);
  });

  it("incrustation d'appel posée sur le 1er segment du bloc d'appel, jamais en double", () => {
    const b = avecIncrustationAppel(commande.script.blocs, "appel", "incrustation-appel-logo");
    expect(b[2].segments[0].incrustation).toEqual({ type: "objet", elementId: "incrustation-appel-logo" });
    expect(b[0].segments[0].incrustation).toBeUndefined();
    const deja = avecIncrustationAppel([{ ...b[2] }], "appel", "autre");
    expect(deja[0].segments[0].incrustation?.elementId).toBe("incrustation-appel-logo");
  });

  it("recalage du débit : 50 relevés au plus, rien avant 5, puis la médiane des 10 derniers (non bornée)", () => {
    let e = { releves: [] as number[], valeur: null as number | null };
    for (const x of [4.1, 4.3, 4.2, 4.4]) e = recalerDebit(e.releves, x);
    expect(e.valeur).toBeNull();
    e = recalerDebit(e.releves, 3.0);
    expect(e.valeur).toBe(4.2);
    for (let i = 0; i < 60; i++) e = recalerDebit(e.releves, 3.2);
    expect(e.releves).toHaveLength(50);
    expect(e.valeur).toBe(3.2);
    expect(debitMesure([{ mot: "a", debutSec: 0, finSec: 0.2 }, { mot: "b", debutSec: 0.3, finSec: 0.5 }, { mot: "c", debutSec: 0.6, finSec: 0.8 }, { mot: "d", debutSec: 0.9, finSec: 1.1 }, { mot: "e", debutSec: 1.2, finSec: 1.25 }])).toBe(4);
  });

  it("texte DIT transmis : même texte lu qu'une seule substitution, et report sur le texte validé (sous-titres en forme affichée)", () => {
    const segments = commande.script.blocs.flatMap((b) => b.segments);
    const dit = preparerTexteVoixDit(segments, commande.texteDitParSegment!);
    const substitue = preparerTexteVoix(segments, [
      { mot: "PV", prononciation: "pé vé" },
      { mot: "135 €", prononciation: "cent trente-cinq euros" },
    ]);
    expect(dit.texte).toBe(substitue.texte);
    // Une 2e application n'a pas lieu : « pé vé » reste tel quel, même si une règle « vé » existait.
    expect(dit.texte).toContain("pé vé");
    const prononces = dit.motsPrononces.map((m, i) => ({ mot: m, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));
    const reportes = reporterHorodatages(dit, prononces);
    expect(reportes.map((m) => m.mot).slice(0, 4)).toEqual(["Un", "PV", "de", "135"]);
    expect(reportes[4].mot.startsWith("€")).toBe(true);
    expect(reportes.find((m) => m.mot === "PV")!.debutSec).toBe(0.3);
    expect(tempsDesSegments(reportes).map((t) => t.segmentId)).toEqual(["ot1", "c1", "at1"]);
  });
});
