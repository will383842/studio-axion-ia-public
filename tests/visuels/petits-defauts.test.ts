/** Petits défauts (carrousels) : listes numérotées voisines, grande surface orange, phrase DESSIN_DOUBLE des maquettes. */
import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte";
import { controlesStructure, pageNumerotee } from "../../src/domaine/controles-visuel/rythme";
import { noterCarrousel } from "../../src/domaine/controles-visuel/note";
import { CarrouselSpec } from "../../src/domaine/visuels/schema";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";
import type { CarrouselSpecType } from "../../src/domaine/visuels/types";
import { FIXTURES_AXION } from "../../src/visuels/texte/fixtures";
import { FIXTURES_TRAMES } from "../../src/visuels/texte/fixtures-trames";
import { creerFournisseurSimulation } from "../../src/visuels/texte/simulation";
import { INTENTIONS } from "../../src/briques/visuels/trames";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: true };
const couverture = { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" };
const liste = { type: "T06", titre: "Ce qu'on entend", points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] };
const etapes = { type: "T20", titre: "Le déroulé", etapes: [{ titre: "Noter", corps: "Écrire l'essentiel." }, { titre: "Trier", corps: "Garder le principal." }, { titre: "Agir", corps: "Avancer pas à pas." }] };
const grille = { type: "T02", titre: "Ce qui compte", cartes: [{ titre: "Planifier", corps: "Poser ses priorités.", mini: "W02" }, { titre: "Déléguer", corps: "Confier ce qui peut l’être.", mini: "W03" }] };
const questions = { type: "T23", titre: "Les questions à se poser", questions: [{ question: "Quelle tâche revient souvent ?", aide: "Celle qui pèse le plus." }, { question: "Qui veut essayer ?", aide: "Une personne curieuse suffit." }], annotation: "Le besoin d’abord." };
const avantApres = { type: "T08", titre: "Avant et après", avant: "Des journées qui débordent", apres: "Des journées plus calmes" };
const message = { type: "T10", message: "Le calme se prépare" };
const fin = { type: "T21" };
const lu = (...pages: unknown[]) => CarrouselSpec.parse({ version: "carrousel/1", alt: "Carrousel exemple type sur l’organisation", pages }) as CarrouselSpecType;
const de = (code: string, s: CarrouselSpecType) => controlesStructure(s).filter((c) => c.code === code);

describe("défaut 1 : deux listes numérotées (01 02 03) à la suite", () => {
  it("pages numérotées : T06, T20, T23 ; pas T02, T10 ni T08", () => {
    expect([liste, etapes, questions].every((p) => pageNumerotee(p))).toBe(true);
    expect([grille, message, avantApres].some((p) => pageNumerotee(p))).toBe(false);
  });
  it.each([
    ["T06 puis T20", liste, etapes],
    ["T20 puis T06", etapes, liste],
    ["T20 puis T23", etapes, questions],
  ])("%s : rouge", (_, a, b) => {
    const s = lu(couverture, a, b, avantApres, message, fin);
    const r = de("FAMILLE", s);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ niveau: "rouge", page: 3 });
    expect(r[0].phrase).toContain("numérotées");
    expect(controlerCarrousel(s, ctx).rapport.verdict).toBe("rouge");
    expect(noterCarrousel(s).criteres.find((c) => c.id === 7)?.niveau).toBe("rouge");
  });
  it("familles différentes, non numérotées : aucune alerte", () => {
    expect(de("FAMILLE", lu(couverture, liste, grille, avantApres, etapes, message, fin))).toEqual([]);
    expect(de("FAMILLE", lu(couverture, liste, message, etapes, avantApres, grille, fin))).toEqual([]);
  });
  it("la série T26 numérotée reste orange", () => {
    const cas = (titre: string) => ({ type: "T26", titre, avant: ["Tout à la main", "Des oublis"], avec: ["Un rappel posé", "Rien d’oublié"], vous: "Vous gagnez en calme" });
    const r = controlesStructure(lu(couverture, cas("Scénario 1"), cas("Scénario 2"), cas("Scénario 3"), liste, message, fin));
    expect(r.filter((c) => c.code === "SERIE_NUMEROTEE").every((c) => c.niveau === "orange")).toBe(true);
    expect(r.filter((c) => c.niveau === "rouge")).toEqual([]);
  });
  it("fixtures et trames : aucune liste numérotée à la suite", async () => {
    const specs = [...FIXTURES_AXION, ...Object.values(FIXTURES_TRAMES)].map((f) => f.spec);
    for (const s of specs) expect(de("FAMILLE", s)).toEqual([]);
    const f = creerFournisseurSimulation();
    for (const intention of INTENTIONS) {
      for (const version of [1, 2, 3]) {
        const r = await f.ecrire({ type: "sujet", sujet: "Mieux organiser sa semaine", intention, version });
        expect(controlerCarrousel(r.spec, ctx).rapport.verdict).toBe("vert");
      }
    }
    for (const version of [1, 2, 3, 4, 5]) {
      const r = await f.ecrire({ type: "sujet", sujet: "Mieux organiser sa semaine", version });
      expect(controlerCarrousel(r.spec, ctx).rapport.verdict).toBe("vert");
    }
  });
});

describe("défaut 4 : DESSIN_DOUBLE d'une mini-maquette (T20 variante maquettes)", () => {
  const ETAPES = [{ titre: "Noter", corps: "Écrire l'essentiel." }, { titre: "Trier", corps: "Garder le principal." }, { titre: "Agir", corps: "Avancer pas à pas." }];
  const maquettes = (titre: string) => ({ type: "T20", titre, etapes: ETAPES, variante: "maquettes" });
  it("la maquette est choisie par le code : reformuler les étapes ou retirer la variante", () => {
    const r = de("DESSIN_DOUBLE", lu(couverture, maquettes("Le parcours"), grille, avantApres, maquettes("Le retour"), message, fin));
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) {
      expect(c.phrase).toMatch(/la mini-maquette « [a-z]+ » est déjà dessinée page 2 ; un même dessin ne revient jamais dans un carrousel, reformulez les étapes ou retirez la variante\.$/u);
      expect(c.phrase).not.toContain("choisissez-en un autre");
    }
  });
  it("une illustration ou une icône garde « choisissez-en un autre »", () => {
    const icones = { type: "T28", titre: "Le trajet", noeuds: [{ texte: "Arrive", icone: "courrier" }, { texte: "Triée", icone: "courrier" }, { texte: "Validée", icone: "coche-cercle" }] };
    const r = de("DESSIN_DOUBLE", lu(couverture, icones, grille, avantApres, message, fin));
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].phrase).toMatch(/l'icône « courrier » .*choisissez-en un autre\.$/u);
  });
});
