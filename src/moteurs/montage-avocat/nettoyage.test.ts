import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { blancsLongs, calculerCoupures, coupuresAppliquees, debitEtVitesseConseillee, decalerTemps, intervallesDesMesures } from "./nettoyage";

/** Mots à des instants choisis : [mot, début, fin]. */
const m = (liste: [string, number, number][]): MotHorodate[] => liste.map(([mot, debutSec, finSec]) => ({ mot, debutSec, finSec }));

const MOTS = m([
  ["Vous", 0.45, 0.65],
  ["payez", 0.7, 1.0],
  ["trop.", 1.05, 1.4], // blanc de 0,6 s après un point
  ["Surtout,", 2.0, 2.5], // blanc de 0,4 s après une virgule
  ["ne", 2.9, 3.0],
  ["payez", 3.03, 3.3], // blanc de 0,03 s : gardé
  ["pas", 3.6, 3.8], // blanc de 0,3 s dans la phrase
  ["maintenant.", 3.85, 4.4],
]);

describe("nettoyage des blancs : calcul des coupures (B.4)", () => {
  it("blanc de tête supprimé : la voix démarre en moins de 0,1 s", () => {
    const p = calculerCoupures({ mots: MOTS, dureeSec: 5.5 });
    expect(p.coupures[0]).toMatchObject({ raison: "tete", debutSec: 0 });
    expect(p.mots[0].debutSec).toBeLessThan(0.1);
    expect(p.mots[0].debutSec).toBeGreaterThan(0);
  });

  it("blanc > 180 ms ramené à 80-120 ms : 120 après un point, 100 après une virgule, 80 dans une phrase", () => {
    const p = calculerCoupures({ mots: MOTS, dureeSec: 5.5 });
    const blanc = (i: number) => +(p.mots[i + 1].debutSec - p.mots[i].finSec).toFixed(3);
    expect(blanc(2)).toBeCloseTo(0.12, 3);
    expect(blanc(3)).toBeCloseTo(0.1, 3);
    expect(blanc(5)).toBeCloseTo(0.08, 3);
    // Un blanc déjà court n'est pas touché.
    expect(blanc(4)).toBeCloseTo(0.03, 3);
    for (let i = 0; i + 1 < p.mots.length; i++) expect(blanc(i)).toBeLessThanOrEqual(0.12 + 1e-9);
  });

  it("les mots gardent leur durée ; la durée du son nettoyé = source − morceaux retirés", () => {
    const p = calculerCoupures({ mots: MOTS, dureeSec: 5.5 });
    MOTS.forEach((x, i) => expect(p.mots[i].finSec - p.mots[i].debutSec).toBeCloseTo(x.finSec - x.debutSec, 3));
    const retire = p.coupures.reduce((s, c) => s + c.finSec - c.debutSec, 0);
    expect(p.dureeSortieSec).toBeCloseTo(5.5 - retire, 3);
    // 0,5 s gardées après le dernier mot (la vidéo finit 0,4-0,6 s après lui).
    expect(p.dureeSortieSec - p.mots.at(-1)!.finSec).toBeCloseTo(0.5, 3);
  });

  it("fondus de 10 à 20 ms à chaque coupure", () => {
    const p = calculerCoupures({ mots: MOTS, dureeSec: 5.5 });
    for (const c of p.coupures) {
      expect(c.fonduMs).toBeGreaterThanOrEqual(10);
      expect(c.fonduMs).toBeLessThanOrEqual(20);
    }
  });

  it("respiration reconnue : raccourcie à 150-250 ms au lieu d'être supprimée, au plus une toutes les 2 phrases", () => {
    const mots = m([
      ["Un.", 0.0, 0.3],
      ["Deux.", 0.9, 1.2], // phrase 1 → respiration possible
      ["Trois.", 1.8, 2.1], // phrase 2 → trop proche de la précédente
      ["Quatre.", 2.7, 3.0], // phrase 3 → de nouveau possible
      ["Cinq.", 3.6, 3.9],
    ]);
    const respirations = [
      { debutSec: 0.45, finSec: 0.8 }, // 350 ms → raccourcie à 250
      { debutSec: 1.35, finSec: 1.7 },
      { debutSec: 2.2, finSec: 2.35 }, // 150 ms → gardée telle quelle
    ];
    const p = calculerCoupures({ mots, dureeSec: 4.5, respirations });
    expect(p.respirationsGardees).toHaveLength(2);
    expect(p.respirationsGardees[0].finSec - p.respirationsGardees[0].debutSec).toBeCloseTo(0.25, 3);
    expect(p.respirationsGardees[1].finSec - p.respirationsGardees[1].debutSec).toBeCloseTo(0.15, 3);
    // Le blanc avec respiration dure souffle + marges (> 120 ms) ; celui sans respiration retenue revient à 120 ms.
    const blanc = (i: number) => p.mots[i + 1].debutSec - p.mots[i].finSec;
    expect(blanc(0)).toBeGreaterThan(0.25);
    expect(blanc(1)).toBeCloseTo(0.12, 3);
    expect(blanc(2)).toBeGreaterThan(0.15);
    // Jamais de respiration ajoutée : sans souffle mesuré, aucun blanc ne dépasse 120 ms.
    const sans = calculerCoupures({ mots, dureeSec: 4.5 });
    for (let i = 0; i + 1 < sans.mots.length; i++) expect(sans.mots[i + 1].debutSec - sans.mots[i].finSec).toBeLessThanOrEqual(0.12 + 1e-9);
  });

  it("décalage des instants : un instant dans une coupure tombe sur le raccord", () => {
    const coupures = [{ debutSec: 1, finSec: 2 }, { debutSec: 3, finSec: 3.5 }];
    expect(decalerTemps(0.5, coupures)).toBe(0.5);
    expect(decalerTemps(1.5, coupures)).toBe(1);
    expect(decalerTemps(2.5, coupures)).toBe(1.5);
    expect(decalerTemps(4, coupures)).toBe(2.5);
  });

  it("les instants réellement coupés par studio-rendu (recalés sur un passage par zéro) font foi", () => {
    const p = calculerCoupures({ mots: MOTS, dureeSec: 5.5 });
    const mesures: Record<string, number> = {};
    p.coupures.forEach((c, i) => {
      mesures[`coupure.${i}.debut`] = c.debutSec + 0.001;
      mesures[`coupure.${i}.fin`] = c.finSec - 0.001;
    });
    const appliquees = coupuresAppliquees(p.coupures, mesures);
    expect(appliquees[1].debutSec).toBeCloseTo(p.coupures[1].debutSec + 0.001, 4);
    expect(intervallesDesMesures(mesures, "coupure")).toHaveLength(p.coupures.length);
    // Mesures incomplètes : on garde les coupures demandées.
    expect(coupuresAppliquees(p.coupures, { "coupure.0.debut": 0, "coupure.0.fin": 0.1 })).toEqual(p.coupures);
  });

  it("blancs longs listés avec leur ponctuation et leur rang de phrase", () => {
    const b = blancsLongs(MOTS, 180);
    expect(b.map((x) => x.ponctuation)).toEqual(["point", "virgule", "aucune"]);
    expect(b[0].phrase).toBe(1);
  });

  it("débit : 1,0 d'abord ; sous 4 mots/s, +0,05 pour la vidéo suivante, jamais au-delà de 1,15 (v3.2)", () => {
    const lent = m(Array.from({ length: 10 }, (_, i) => [`m${i}`, i * 0.3, i * 0.3 + 0.25] as [string, number, number]));
    expect(debitEtVitesseConseillee(lent, 1).vitesseConseillee).toBe(1.05);
    expect(debitEtVitesseConseillee(lent, 1.15).vitesseConseillee).toBe(1.15);
    const juste = m(Array.from({ length: 10 }, (_, i) => [`m${i}`, i * 0.22, i * 0.22 + 0.2] as [string, number, number]));
    expect(debitEtVitesseConseillee(juste, 1).vitesseConseillee).toBe(1);
  });
});
