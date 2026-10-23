/**
 * Formats par réseau, T5 (ARGENT, relecture A1) : LinkedIn passe du carré au portrait 4:5 sans la fin au mot
 * (`portrait-linkedin`). Le prix ne bouge pas : l'estimation (`estimerFabrication`) et la réservation de la chaîne
 * sont ÉGALES entre les sorties [portrait, carré] (avant T5) et [portrait, portrait-linkedin] (T5), et la voix est lue
 * autant de fois. Doubles seulement, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS } from "../../../src/briques/fins";
import { estimerFabrication, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { PORTRAIT_LINKEDIN, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { finEtAppelDuTableau, reseauDeLaSortie } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

const ficheAvecAppel = (): FicheTableau => ({ ...ficheFormation(), appelId: "fin-if-mot-envoi" });

/** Fins telles que les services les rendent (table réelle, mot saisi « CINQ »), pour ces sorties. */
const finsPour = (sorties: readonly IdSortie[]) => (appelId: string | null, sortie: IdSortie) => finEtAppelDuTableau(reseauDeLaSortie(sortie, {}, sorties), appelId, TABLE_FINS, { mot: "CINQ" });

async function fabriquer(sorties: IdSortie[]) {
  const fiche = ficheAvecAppel();
  const d = doubles(fiche);
  const reservations: number[] = [];
  const r = await fabriquerTableau({
    ...d.outils,
    contexte: contexteFormation(),
    sorties,
    choisirFin: finsPour(sorties),
    budget: { ...d.outils.budget, verifierEtReserver: async (e) => void reservations.push(e.centimes) },
  });
  const choisir = finsPour(sorties);
  const estimation = estimerFabrication(fiche, 0.03, [], { sorties: sorties.map((id) => ({ id, fin: choisir(fiche.appelId ?? null, id) })) });
  return { r, reservations, lectures: d.lectures(), estimation };
}

describe("T5 · tableau animé : le portrait de LinkedIn coûte exactement ce que coûtait le carré", async () => {
  const carre = await fabriquer(["portrait", "carre"]);
  const linkedin = await fabriquer(["portrait", PORTRAIT_LINKEDIN]);

  it("les deux fabrications vont au bout, avec les fichiers attendus", () => {
    expect(carre.r.sorties.map((s) => s.format)).toEqual(["portrait", "carre"]);
    expect(linkedin.r.sorties.map((s) => s.format).sort()).toEqual(["portrait", PORTRAIT_LINKEDIN].sort());
  });

  it("estimation (`estimerFabrication`) égale, au centime et au caractère", () => {
    expect(linkedin.estimation.centimes).toBe(carre.estimation.centimes);
    expect(linkedin.estimation.caracteres).toBe(carre.estimation.caracteres);
    expect(linkedin.estimation.surcoutCentimes ?? 0).toBe(carre.estimation.surcoutCentimes ?? 0);
  });

  it("réservation de la chaîne égale, et égale à l'estimation de la chaîne", () => {
    const somme = (x: number[]) => x.reduce((a, b) => a + b, 0);
    expect(linkedin.reservations.length).toBeGreaterThan(0);
    expect(somme(linkedin.reservations)).toBe(somme(carre.reservations));
    expect(linkedin.r.estimation.centimes).toBe(carre.r.estimation.centimes);
    expect(somme(linkedin.reservations)).toBe(linkedin.r.estimation.centimes);
  });

  it("réel <= annoncé, et réel égal entre le carré d'avant et le portrait de LinkedIn", () => {
    expect(linkedin.r.coutCentimes).toBeLessThanOrEqual(linkedin.estimation.centimes);
    expect(linkedin.r.coutCentimes).toBeLessThanOrEqual(linkedin.r.estimation.centimes);
    expect(linkedin.r.coutCentimes).toBe(carre.r.coutCentimes);
    expect(linkedin.r.coutCentimes).toBeGreaterThan(0);
  });

  it("la voix est lue autant de fois", () => {
    expect(linkedin.lectures).toBe(carre.lectures);
  });
});
