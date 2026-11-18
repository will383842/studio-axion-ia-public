/** T-EXT-02 : calage du scénario sur la voix (pur, 0 €, aucun appel). */
import { describe, expect, it } from "vitest";
import { lireSuiviSourceEcran } from "@/domaine/source-ecran";
import { pistesDepuisSuivi } from "@/moteurs/montage-demo-facecam/suivi-ecran";
import { calerScenario, versMs } from "@/moteurs/montage-tutoriel-outil/calage-scenario";
import type { MotTutoriel } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { VERSION_SCENARIO_MAQUETTE, type ScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";

const mots = (liste: [string, number][]): MotTutoriel[] => liste.map(([mot, debutSec]) => ({ mot, debutSec, finSec: debutSec + 0.3 }));

const VOIX = mots([
  ["Votre", 0.5], ["Stock,", 1], ["c'est", 2], ["Éclair", 3], ["ouvrez", 4], ["la", 5], ["fiche", 6],
  ["puis", 8], ["stock", 9], ["alerte", 11], ["Demain", 13],
]);
const DUREE = 15000;

function scenario(): ScenarioMaquette {
  const zone = (x: number) => ({ x, y: 20, largeur: 20, hauteur: 10 });
  return {
    version: VERSION_SCENARIO_MAQUETTE,
    maquette: "fictive",
    largeur: 1080,
    hauteur: 1350,
    etapes: [
      { id: "a", role: "accroche", aller: "accueil", ancre: { surMot: "stock" } },
      { id: "b", role: "probleme", aller: "liste", ancre: { surMot: "ECLAIR" } },
      { id: "c", role: "parcours", aller: "fiche", zone: zone(10), cible: "#fiche", ancre: { surMot: "fiche" } },
      { id: "d", role: "bonne-pratique", aller: "alertes", zone: zone(50), ancre: { apresEtape: "c", delaiMs: 700 } },
      { id: "e", role: "appel", aller: "fin", ancre: { surMot: "demain" } },
    ],
  };
}

const ok = (r: ReturnType<typeof calerScenario>) => {
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r;
};
const erreurs = (r: ReturnType<typeof calerScenario>) => {
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.erreurs;
};

describe("calerScenario", () => {
  it("donne les instants attendus (secondes → ms, sans casse ni accents)", () => {
    const r = ok(calerScenario(scenario(), VOIX, DUREE));
    expect(r.etapes.map((e) => [e.id, e.debutMs, e.finMs])).toEqual([
      ["a", 1000, 3000],
      ["b", 3000, 6000],
      ["c", 6000, 6700],
      ["d", 6700, 13000],
      ["e", 13000, 15000],
    ]);
    expect(versMs(1.2345)).toBe(1235);
    expect(r.etapes[2]).toMatchObject({ cible: "#fiche", zone: { x: 10, y: 20, largeur: 20, hauteur: 10 } });
    expect(r.remarques).toEqual([]);
  });

  it("deuxième occurrence d'un mot", () => {
    const s = scenario();
    s.etapes[0]!.ancre = { surMot: "stock", occurrence: 2 };
    s.etapes.splice(1, 3);
    s.etapes[0]!.id = "a";
    const r = ok(calerScenario(s, VOIX, DUREE));
    expect(r.etapes[0]!.debutMs).toBe(9000);
  });

  it("ancre apresEtape + délai", () => {
    const r = ok(calerScenario(scenario(), VOIX, DUREE));
    expect(r.etapes[3]!.debutMs).toBe(r.etapes[2]!.debutMs + 700);
  });

  it("mot absent → refus, jamais deviné", () => {
    const s = scenario();
    s.etapes[1]!.ancre = { surMot: "inconnu" };
    expect(erreurs(calerScenario(s, VOIX, DUREE))).toEqual(["Étape b : le mot « inconnu » n'est pas dans la voix."]);
    s.etapes[1]!.ancre = { surMot: "stock", occurrence: 3 };
    expect(erreurs(calerScenario(s, VOIX, DUREE))[0]).toContain("occurrence 3");
  });

  it("étapes non croissantes → refus", () => {
    const s = scenario();
    s.etapes[1]!.ancre = { surMot: "votre" };
    expect(erreurs(calerScenario(s, VOIX, DUREE)).some((e) => e.includes("non croissants"))).toBe(true);
  });

  it("étape après la fin de la voix, durée invalide → refus", () => {
    expect(erreurs(calerScenario(scenario(), VOIX, 12000)).some((e) => e.includes("après la fin"))).toBe(true);
    expect(erreurs(calerScenario(scenario(), VOIX, 0))).toHaveLength(1);
  });

  it("le suivi relu par lireSuiviSourceEcran est identique, sans remarque", () => {
    const r = ok(calerScenario(scenario(), VOIX, DUREE));
    const relu = lireSuiviSourceEcran(JSON.parse(JSON.stringify(r.suivi)));
    expect(relu.remarques).toEqual([]);
    expect(relu.suivi).toEqual(r.suivi);
    expect(r.suivi).toMatchObject({ origine: "fichier", largeur: 1080, hauteur: 1350, curseur: [] });
    expect(r.suivi.zones.map((z) => z.motif)).toEqual(["c", "d"]);
    expect(r.suivi.clics).toEqual([{ tMs: 6000, x: 20, y: 25 }]);
  });

  it("le suivi passé à pistesDepuisSuivi (G15-02) : clics non vides ; les zooms dépendent de la lecture des zones", () => {
    const r = ok(calerScenario(scenario(), VOIX, DUREE));
    const p = pistesDepuisSuivi(r.suivi);
    expect(p.clics).toEqual([{ ms: 6000, x: 20, y: 25 }]);
    // Constat (voir la PR, HORS PERIMETRE) : G15-02 lit TOUTE `ZoneSuivi` comme une zone privée à ne pas zoomer ;
    // le clic tombant au centre d'une zone du même suivi, son zoom est écarté. On le fige ici pour que ce soit visible.
    expect(p.zooms).toEqual([]);
    // Même clic sans zone : le zoom existe, ce qui prouve que le suivi est bien exploitable par G15-02.
    const sansZones = pistesDepuisSuivi({ ...r.suivi, zones: [] });
    expect(sansZones.zooms.length).toBeGreaterThan(0);
  });

  it("sans ecartMaxMs aucune remarque de durée ; avec, remarque « à vérifier » sans refus", () => {
    expect(ok(calerScenario(scenario(), VOIX, DUREE)).remarques).toEqual([]);
    const r = ok(calerScenario(scenario(), VOIX, DUREE, { ecartMaxMs: 1000 }));
    expect(r.remarques).toEqual(["Étape c : 700 ms, plus courte que 1000 ms, à vérifier."]);
  });
});
