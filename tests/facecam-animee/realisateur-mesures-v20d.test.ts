/**
 * Tests directs (v20d) des mesures du réalisateur de la face caméra animée : `regles.ts` (événements, couverture,
 * silences, racines, coupes, enchaînement, mesures du plan, diversité) et `rythme.ts` (aire d'un calque, changements de
 * niveau de la prise, événements prévus, couverture continue). Entrées construites à la main, aucun réseau, aucune
 * horloge : le code n'est pas modifié, ces cas décrivent son comportement d'aujourd'hui.
 */
import { describe, expect, it } from "vitest";
import type { CalquePlan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import {
  couvertureMouvement,
  coupesDuPlan,
  estEnchainee,
  evenementsVisuels,
  mesurerDiversite,
  mesurerPlan,
  motsSimples,
  racinesDe,
  silencesDeCalques,
  silencesHorsCartes,
} from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { aireCalque, changementsDeNiveau, couvertureContinue, evenementsPrevus, type PlanRythme } from "@/moteurs/montage-facecam-animee/realisateur/rythme";
import { planValide } from "./plan-reference";

const copie = (p: PlanFacecamAnimee) => JSON.parse(JSON.stringify(p)) as PlanFacecamAnimee;
const etiquette = (debut: number, fin: number, texte = "Bureau"): CalquePlan => ({ type: "etiquette", debut, fin, texte, fond: "orange" }) as CalquePlan;
const compteur = (debut: number, fin: number, extra: Record<string, unknown> = {}): CalquePlan => ({ type: "compteur", debut, fin, de: 0, a: 45, ...extra }) as CalquePlan;
/** Plan vide de 20 s (fin à 18 s), sans carte, fenêtre ni calque. */
const vide = (): PlanFacecamAnimee => ({ ...copie(planValide()), cartes: [], fenetres: [], calques: [], motions: [], zooms: [], mouvements: [], sons: [], fin: { ...planValide().fin, debut: 18 }, duree: 20 });
const rythme = (p: Partial<PlanRythme>): PlanRythme => ({ cartes: [], fenetres: [], calques: [], groupes: [], duree: 20, fin: { debut: 18 }, prise: {}, ...p });

describe("regles.ts · événements et couverture", () => {
  it("evenementsVisuels : entrées, sorties et sous-éléments ancrés, triés ; plan vide = []", () => {
    const p = copie(planValide());
    const t = evenementsVisuels({ cartes: [], fenetres: [], calques: [etiquette(4, 4.9), etiquette(1, 2)] });
    expect(t).toEqual([1, 2, 4, 4.9]);
    const avecCarte = evenementsVisuels({ cartes: p.cartes, fenetres: [], calques: [] });
    expect(avecCarte[0]).toBe(p.cartes[0].debut);
    expect(avecCarte[avecCarte.length - 1]).toBe(p.cartes[0].fin);
    expect(avecCarte).toEqual([...avecCarte].sort((x, y) => x - y));
    expect(avecCarte.length).toBeGreaterThan(2);
    expect(evenementsVisuels({ cartes: [], fenetres: [], calques: [] })).toEqual([]);
  });

  it("couvertureMouvement : mini-vidéos, cartes et défilement d'un compteur (1,5 s × 0,7) ; photo et compteur immobile exclus", () => {
    const p = copie(planValide());
    const photo = { ...p.fenetres[0], video: false, debut: 9, fin: 10 };
    const r = couvertureMouvement({ cartes: p.cartes, fenetres: [p.fenetres[0], photo], calques: [compteur(3, 6), compteur(7, 8, { a: 0 })] });
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ debut: 6, fin: 7.4 });
    expect(r[1]).toMatchObject({ debut: 8.95, fin: 11.6 });
    expect(r[2].debut).toBe(3);
    expect(r[2].fin).toBeCloseTo(3 + 1.5 * 0.7, 6);
    expect(couvertureMouvement({ cartes: [], fenetres: [], calques: [] })).toEqual([]);
  });

  it("couvertureContinue : mini-vidéo, défilement borné à la fin du calque, écran de fin ; rien si le plan est vide jusqu'à la fin", () => {
    const calques = [compteur(3, 3.5)];
    const r = couvertureContinue({ fenetres: [{ ...planValide().fenetres[0], debut: 6, fin: 7.4 }], calques, duree: 20, fin: { debut: 18 } });
    expect(r[0]).toEqual({ debut: 6, fin: 7.4 });
    expect(r[1]).toEqual({ debut: 3, fin: 3.5 });
    expect(r[r.length - 1]).toEqual({ debut: 18, fin: 20 });
    expect(r).toHaveLength(3);
    expect(couvertureContinue({ fenetres: [], calques: [], duree: 20, fin: { debut: 20 } })).toEqual([]);
  });
});

describe("regles.ts · silences", () => {
  it("silencesHorsCartes : le temps hors carte entre deux instants, la carte ne compte pas", () => {
    const r = silencesHorsCartes({ cartes: [{ debut: 4, fin: 6 }] }, 10, [2, 8]);
    expect(r).toEqual([[2, 0, 2], [4, 2, 8], [2, 8, 10]]);
  });

  it("silencesHorsCartes : un instant posé dans une carte est ignoré ; sans instant = un seul silence jusqu'à l'horizon", () => {
    expect(silencesHorsCartes({ cartes: [{ debut: 4, fin: 6 }] }, 10, [5])).toEqual([[8, 0, 10]]);
    expect(silencesHorsCartes({ cartes: [] }, 10, [])).toEqual([[10, 0, 10]]);
  });

  it("silencesDeCalques : repart de zéro après une carte ; les entrées de calques découpent le moment libre", () => {
    const p = copie(planValide());
    const carte = { ...p.cartes[0], debut: 4, fin: 6 };
    const r = silencesDeCalques({ cartes: [carte], fenetres: [], calques: [etiquette(2, 3)] }, 10);
    expect(r).toEqual([[2, 0, 2], [2, 2, 4], [4, 6, 10]]);
  });

  it("silencesDeCalques : plan vide = un seul silence sur tout l'horizon ; horizon 0 = aucun", () => {
    expect(silencesDeCalques({ cartes: [], fenetres: [], calques: [] }, 12)).toEqual([[12, 0, 12]]);
    expect(silencesDeCalques({ cartes: [], fenetres: [], calques: [] }, 0)).toEqual([]);
  });
});

describe("regles.ts · mots, cadrage, enchaînement", () => {
  it("racinesDe : ne garde que les mots porteurs, sans pluriel, 6 lettres au plus ; texte vide = []", () => {
    expect(racinesDe("Relances à la main")).toEqual(["relanc", "main"]);
    expect(racinesDe("Mains propres")).toEqual(["main", "propre"]);
    expect(racinesDe("")).toEqual([]);
  });

  it("motsSimples : minuscules, sans accents ni élision, coupés aux traits d'union", () => {
    expect(motsSimples("Le temps s'échappe, vite !")).toEqual(["le", "temps", "echappe", "vite"]);
    expect(motsSimples("rendez-vous")).toEqual(["rendez", "vous"]);
    expect(motsSimples("")).toEqual([]);
  });

  it("coupesDuPlan : zooms et mouvements nommés et triés dans le temps ; vide = []", () => {
    const r = coupesDuPlan({ zooms: [[5, 6, 1.2]], mouvements: [{ debut: 2, fin: 3, type: "recul", echelle: 1.4 }] });
    expect(r).toEqual([
      { debut: 2, fin: 3, echelle: 1.4, nom: "mouvement 1 (recul)", mouvement: "recul" },
      { debut: 5, fin: 6, echelle: 1.2, nom: "zoom 1" },
    ]);
    expect(coupesDuPlan({ zooms: [], mouvements: [] })).toEqual([]);
  });

  it("estEnchainee : entrée 0 à 0,3 s après la sortie d'une carte ; refusée au-delà et avant", () => {
    const carte = copie(planValide()).cartes[0];
    const plan = { cartes: [{ ...carte, debut: 1, fin: 3 }], fenetres: [] };
    expect(estEnchainee(plan, { debut: 3.2, fin: 4 })).toBe(true);
    expect(estEnchainee(plan, { debut: 3, fin: 4 })).toBe(true);
    expect(estEnchainee(plan, { debut: 3.5, fin: 4 })).toBe(false);
    expect(estEnchainee(plan, { debut: 2.5, fin: 4 })).toBe(false);
    expect(estEnchainee({ cartes: [], fenetres: [] }, { debut: 3.2, fin: 4 })).toBe(false);
  });
});

describe("regles.ts · mesurerPlan et mesurerDiversite", () => {
  it("mesurerPlan sur le plan de référence : comptes exacts, ruptures bornées, déterministe", () => {
    const p = planValide();
    const m = mesurerPlan(p);
    expect(m).toMatchObject({ cartes: 1, fenetres: 1, calques: 1, zooms: 0, mouvements: 0, motions: 9, fenetresVideo: 1, partFenetresVideo: 1, typesCartes: ["liste"] });
    expect(m.ruptures).toBe(12);
    expect(m.rupturesParMinute).toBeCloseTo((12 / 20) * 60, 1);
    expect(m.pourcentageBande).toBe(12.0);
    expect(m.partSurLeVisage).toBe(0);
    expect(m.sousElements).toBeGreaterThan(10);
    expect(mesurerPlan(planValide())).toEqual(m);
  });

  it("mesurerPlan sur un plan vide : zéros, parts à 0, diversité vide", () => {
    const m = mesurerPlan(vide());
    expect(m).toMatchObject({ ruptures: 0, rupturesParMinute: 0, cartes: 0, fenetres: 0, calques: 0, motions: 0, sousElements: 0, partFenetresVideo: 0, partFenetresEnchainees: 0, pourcentageBande: 0, typesCartes: [] });
    expect(m.diversite.apparitions).toBe(0);
  });

  it("mesurerDiversite : plan de référence = 12 apparitions de 12 familles, jamais deux fois la même de suite", () => {
    const d = mesurerDiversite(planValide());
    expect(d.apparitions).toBe(12);
    expect(d.nombreFamilles).toBe(12);
    expect(d.familles).toHaveLength(12);
    expect(d.repetitionMax).toBe(1);
    expect(d.memeFamilleDeSuite).toBe(0);
    expect(d.partFamilleMax).toBeCloseTo(1 / 12, 3);
    expect(d.premierObjetSec).toBe(0.8);
    expect(mesurerDiversite(planValide())).toEqual(d);
  });

  it("mesurerDiversite : plan vide = mesures neutres, visage entièrement en place", () => {
    const d = mesurerDiversite(vide());
    expect(d).toMatchObject({ apparitions: 0, familles: [], nombreFamilles: 0, partFamilleMax: 0, premierObjetSec: null, premiereCarteSec: null, partVisageCouvert: 0, partVisageEnPlace: 1, sonLePlusFrequent: null });
  });
});

describe("rythme.ts · aire, niveaux de la prise, événements prévus", () => {
  it("aireCalque : positive et finie pour chaque type ; texte plus long = aire plus grande ; proportionnelle au ratio", () => {
    const court = aireCalque(etiquette(0, 1, "Un"), 9 / 16);
    const long = aireCalque(etiquette(0, 1, "Un texte nettement plus long"), 9 / 16);
    expect(court).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(court);
    expect(aireCalque(etiquette(0, 1, "Un"), 1) / court).toBeCloseTo(16 / 9, 6);
    for (const c of [compteur(0, 1), { type: "glisse", debut: 0, fin: 1, texte: "Glisse" }, { type: "logos", debut: 0, fin: 1, logos: [{ nom: "a", a: 0 }, { nom: "b", a: 0.5 }] }, { type: "tuile", debut: 0, fin: 1, icone: "loupe" }] as unknown as CalquePlan[]) {
      const a = aireCalque(c, 9 / 16);
      expect(Number.isFinite(a) && a > 0 && a < 1, c.type).toBe(true);
    }
  });

  it("changementsDeNiveau : plan vide = [] ; une étiquette fait descendre puis remonter la prise", () => {
    expect(changementsDeNiveau(rythme({ fin: { debut: 20 } }))).toEqual([]);
    const r = changementsDeNiveau(rythme({ calques: [etiquette(4, 5)], fin: { debut: 20 } }));
    expect(r).toHaveLength(2);
    expect(r[0].t).toBe(4);
    expect(r[0].de).toBe(0);
    expect(r[0].vers).toBeGreaterThan(0);
    expect(r[1].de).toBe(r[0].vers);
    expect(r[1].vers).toBe(0);
    expect(r[1].t).toBeCloseTo(5 + 1.5 / 25, 6);
    expect(changementsDeNiveau(rythme({ calques: [etiquette(4, 5)], fin: { debut: 20 } }))).toEqual(r);
  });

  it("changementsDeNiveau : deux objets enchaînés (< 0,3 s) = une seule descente et une seule remontée", () => {
    const r = changementsDeNiveau(rythme({ calques: [etiquette(4, 5), etiquette(5.2, 6)], fin: { debut: 20 } }));
    expect(r.filter((c) => c.vers < c.de)).toHaveLength(1);
    expect(r[r.length - 1]).toMatchObject({ vers: 0 });
    expect(r[r.length - 1].t).toBeCloseTo(6 + 1.5 / 25, 6);
  });

  it("evenementsPrevus : plan vide = []; une étiquette donne entrée et sortie, triées, dans la durée", () => {
    expect(evenementsPrevus(rythme({ fin: { debut: 20 } }))).toEqual([]);
    const ev = evenementsPrevus(rythme({ calques: [etiquette(4, 5)], fin: { debut: 20 } }));
    expect(ev.map((e) => e.quoi)).toEqual(expect.arrayContaining(["entrée calque 1 (etiquette)", "sortie calque 1 (etiquette)"]));
    expect(ev.some((e) => e.quoi.startsWith("descente de la prise"))).toBe(true);
    expect(ev.some((e) => e.quoi.startsWith("remontée de la prise"))).toBe(true);
    expect(ev.map((e) => e.t)).toEqual([...ev.map((e) => e.t)].sort((a, b) => a - b));
    for (const e of ev) {
      expect(e.t).toBeGreaterThanOrEqual(0);
      expect(e.t).toBeLessThanOrEqual(20);
      expect(e.surface).toBeGreaterThan(0);
    }
  });

  it("evenementsPrevus : un objet qui débute après l'horizon n'est pas compté", () => {
    const ev = evenementsPrevus(rythme({ calques: [etiquette(19, 19.5)], fin: { debut: 18 } }));
    expect(ev.some((e) => e.quoi.includes("calque 1"))).toBe(false);
  });
});
