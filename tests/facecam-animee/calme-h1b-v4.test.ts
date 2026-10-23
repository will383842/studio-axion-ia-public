/**
 * FACE CAMÉRA ANIMÉE v4 — H1b (v-8cc4d7703179, 18/10) : le message de calme nomme la plaquette fautive et dit quoi faire ;
 * le catalogue donne les durées sans calme. AUCUN appel réseau.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE_V4, dureesSansCalmeV4, plusLongCalmeInterneV4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { conseilCalmeV4, controlerSuiteV4, evenementsDuPlanV4, plusLongCalmeV4, type ElementResoluV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const fiche = (id: string) => CATALOGUE_V4.find((f) => f.id === id)!;
const el = (id: string, debut: number, duree: number, f = fiche(id)): ElementResoluV4 =>
  ({ fiche: f, debut, fin: debut + duree, mots: [], lignes: [], instants: [], recherches: [], illustre: "x", rang: 1 });
/** Le carrousel TEL QU'IL ÉTAIT dans le catalogue avant la correction : il oublie la sortie, 4 images avant la fin. */
const ancienCarrousel = { ...fiche("CarrouselFeuillete"), evts: [0, 3, 12, 22, 32, 42, 52, 62, 72] };
const calmeDe = (els: ElementResoluV4[], horizon: number) => plusLongCalmeV4(evenementsDuPlanV4(els), horizon);

describe("H1b · message de calme", () => {
  it("calme à l'INTÉRIEUR d'une plaquette : elle est nommée, avec ses durées sans calme, et le conseil « ajoutez des lignes » a disparu", () => {
    const els = [el("CarrouselFeuillete", 0, 3.2, ancienCarrousel), el("EtiquetteTete", 3.2, 1.2)];
    const calme = calmeDe(els, 4.4);
    expect(calme.duree).toBeGreaterThan(0.75);
    const m = conseilCalmeV4(calme, els, 4.4);
    expect(m).toContain("CarrouselFeuillete");
    expect(m).toMatch(/durée sans calme \(/);
    expect(m).not.toContain("ajoutez-lui des lignes");
  });
  it("trou ENTRE deux plaquettes : les deux sont nommées", () => {
    const els = [el("EtiquetteTete", 0, 1.2), el("EtiquetteTete", 2.5, 1.2)];
    const calme = calmeDe(els, 3.7);
    const m = conseilCalmeV4(calme, els, 3.7);
    expect(m).toMatch(/EtiquetteTete.*finit à 1,20 s.*EtiquetteTete.*n'entre qu'à 2,50 s/);
  });
  it("calme AVANT la première plaquette : pas de « précédente » inventée", () => {
    const els = [el("EtiquetteTete", 2, 1.2)];
    const m = conseilCalmeV4(calmeDe(els, 3.2), els, 3.2);
    expect(m).toMatch(/aucune plaquette avant 2,00 s/);
    expect(m).not.toContain("la prise seule");
    expect(m).not.toContain("précédente");
  });
  it("aucune plaquette jusqu'à la fin : le message le dit", () => {
    const els = [el("EtiquetteTete", 0, 1.2)];
    const m = conseilCalmeV4(calmeDe(els, 8), els, 8);
    expect(m).toMatch(/plus aucune plaquette.*ajoutez-en une/);
  });
  it("`controlerSuiteV4` : l'erreur H1b garde son code et porte le conseil", () => {
    const els = [el("EtiquetteTete", 0, 1.2), el("CarrouselFeuillete", 6.0, 3.2, ancienCarrousel), el("EtiquetteTete", 9.2, 1.2)];
    const h1b = controlerSuiteV4(els, { duree: 12, finDebut: 12 }).erreurs.filter((e) => e.startsWith("H1b — "));
    expect(h1b.length).toBeGreaterThan(0);
    expect(h1b.join(" ")).not.toContain("ajoutez-lui des lignes");
  });
});

describe("catalogue · durées sans calme", () => {
  it("l'ancien carrousel avait des durées en défaut (3,17 s, 3,20 s…), le catalogue corrigé n'en a aucune", () => {
    expect(plusLongCalmeInterneV4(ancienCarrousel, 96)).toBe(24);
    expect(plusLongCalmeInterneV4(fiche("CarrouselFeuillete"), 96)).toBeLessThanOrEqual(22);
    expect(dureesSansCalmeV4(ancienCarrousel).length).toBeGreaterThan(1);
    const f = fiche("CarrouselFeuillete");
    expect(dureesSansCalmeV4(f)).toEqual([[f.dureeSec[0], f.dureeSec[1]]]);
    // BadgeProfil : sa sortie dépend du nombre de lignes (pas = (D-12)/n, borné à 66 images) : au-delà de 2,6 s le rendu peut rester calme 0,9 s.
    expect(fiche("BadgeProfil").dureeSec[1]).toBe(2.6);
  });
});
