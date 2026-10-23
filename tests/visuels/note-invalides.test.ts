import { describe, expect, it } from "vitest";
import { FIXTURES_AXION } from "../../src/visuels/texte/fixtures";
import { CHARTE_CARROUSEL } from "../../src/briques/visuels/charte-carrousel";
import { noterCarrousel, type MesuresRendu } from "../../src/domaine/controles-visuel/note";

const { encre, creme } = CHARTE_CARROUSEL.couleurs;
const spec = FIXTURES_AXION[0].spec;
const n = spec.pages.length;
const saine = (): Record<string, unknown> => ({
  plusPetitTextePx: 28, signesParLigneMax: 40, zoneVidePct: 15,
  contrastes: [{ avantPlan: encre, fond: creme, px: 30 }],
  zoneInterdite: false, photos: 0, logosHorsListe: [], couleurs: [encre, creme], polices: ["Archivo Black", "Inter"],
});
const mesures = (surcharge: Record<string, unknown>): MesuresRendu => ({ pages: Array.from({ length: n }, () => ({ ...saine(), ...surcharge })) as MesuresRendu["pages"] });

const INVALIDES: [string, unknown][] = [["NaN", NaN], ["-1", -1], ["null", null], ["undefined", undefined], ["Infinity", Infinity], ["'12'", "12"]];
const CHAMPS_NOMBRE = ["plusPetitTextePx", "signesParLigneMax", "zoneVidePct", "photos"];

describe("note : mesures invalides = non mesurées", () => {
  it("référence : mesures saines + valeur humaine 8 → présenté", () => {
    expect(noterCarrousel(spec, mesures({}), { valeurHumaine: 8 }).verdict).toBe("presente");
  });

  for (const champ of CHAMPS_NOMBRE) {
    for (const [nom, v] of INVALIDES) {
      it(`${champ} = ${nom} : jamais présenté, aucune exception`, () => {
        const r = noterCarrousel(spec, mesures({ [champ]: v }), { valeurHumaine: 8 });
        expect(r.verdict).not.toBe("presente");
        expect(Number.isFinite(r.total)).toBe(true);
      });
    }
  }

  for (const [nom, v] of [["null", null], ["undefined", undefined], ["0", 0], ["'false'", "false"], ["NaN", NaN]] as [string, unknown][]) {
    it(`zoneInterdite = ${nom} : jamais présenté`, () => {
      expect(noterCarrousel(spec, mesures({ zoneInterdite: v }), { valeurHumaine: 8 }).verdict).not.toBe("presente");
    });
  }

  for (const [nom, v] of [["null", null], ["undefined", undefined], ["chaîne", "x"], ["objet", {}], ["[null]", [null]], ["[1]", [1]]] as [string, unknown][]) {
    for (const champ of ["logosHorsListe", "couleurs", "polices"]) {
      it(`${champ} = ${nom} : jamais présenté, aucune exception`, () => {
        const r = noterCarrousel(spec, mesures({ [champ]: v }), { valeurHumaine: 8 });
        expect(r.verdict).not.toBe("presente");
      });
    }
  }

  const paires: [string, unknown][] = [
    ["null", null], ["chaîne", "x"], ["[null]", [null]],
    ["px NaN", [{ avantPlan: encre, fond: creme, px: NaN }]],
    ["px 0", [{ avantPlan: encre, fond: creme, px: 0 }]],
    ["px '30'", [{ avantPlan: encre, fond: creme, px: "30" }]],
    ["px Infinity", [{ avantPlan: encre, fond: creme, px: Infinity }]],
    ["avantPlan nombre", [{ avantPlan: 5, fond: creme, px: 30 }]],
    ["fond null", [{ avantPlan: encre, fond: null, px: 30 }]],
  ];
  for (const [nom, v] of paires) {
    it(`contrastes ${nom} : jamais présenté, aucune exception`, () => {
      expect(noterCarrousel(spec, mesures({ contrastes: v }), { valeurHumaine: 8 }).verdict).not.toBe("presente");
    });
  }

  it("pages de mesure nulles ou pages non tableau : aucune exception, jamais présenté", () => {
    expect(noterCarrousel(spec, { pages: Array(n).fill(null) } as unknown as MesuresRendu, { valeurHumaine: 8 }).verdict).not.toBe("presente");
    expect(noterCarrousel(spec, { pages: "x" } as unknown as MesuresRendu, { valeurHumaine: 8 }).verdict).not.toBe("presente");
    expect(noterCarrousel(spec, null as unknown as MesuresRendu, { valeurHumaine: 8 }).verdict).not.toBe("presente");
  });
});

describe("note : valeur humaine invalide", () => {
  for (const [nom, v] of [["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["-5", -5], ["500", 500], ["'8'", "8"], ["null", null]] as [string, unknown][]) {
    it(`valeurHumaine = ${nom} : total fini, hors 0-8 = non mesurée, jamais présenté`, () => {
      const r = noterCarrousel(spec, mesures({}), { valeurHumaine: v as number });
      expect(Number.isFinite(r.total)).toBe(true);
      expect(r.criteres.find((c) => c.id === 9)!.nonMesure).toBe(true);
      expect(r.verdict).not.toBe("presente");
    });
  }
  it("valeur humaine absente = non mesurée : au mieux « retouche »", () => {
    const r = noterCarrousel(spec, mesures({}));
    expect(r.criteres.find((c) => c.id === 9)!.nonMesure).toBe(true);
    expect(r.verdict).toBe("retouche");
  });
});
