import { afterEach, describe, expect, it, vi } from "vitest";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { FIXTURES } from "@/visuels/texte/fixtures";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";

const SUJETS = [
  "Ranger un atelier sans y passer la journée",
  "Préparer une réunion calme",
  "Classer des dossiers sans stress",
  "Entretenir ses outils de bricolage",
  "Écrire un message clair",
  "Organiser un établi",
  "Accueillir un visiteur",
  "Tenir un carnet de bord",
  "Réparer une chaise bancale",
  "Ranger son bureau le matin",
];

afterEach(() => vi.restoreAllMocks());

describe("banc de la tranche en simulation", () => {
  const fournisseur = creerFournisseurSimulation();

  const contextes = [
    ["interditsDans vide", () => [] as string[]],
    ["interditsDans contenant « motinterdit »", (t: string) => (t.toLowerCase().includes("motinterdit") ? ["motinterdit"] : [])],
  ] as const;

  for (const [nom, interditsDans] of contextes) {
    it(`10 sujets : aucun rouge, 6 à 8 pages, au moins 3 plans distincts, 0 appel réseau (${nom})`, async () => {
      const espion = vi.spyOn(globalThis, "fetch");
      const plans = new Set<string>();
      for (const sujet of SUJETS) {
        const r = await fournisseur.ecrire({ type: "sujet", sujet });
        const { rapport } = controlerCarrousel(r.spec, { faitsDisponibles: false, interditsDans });
        expect(rapport.verdict, `${sujet} : ${rapport.controles.map((c) => c.phrase).join(" | ")}`).not.toBe("rouge");
        const pages = (r.spec as { pages: { type: string }[] }).pages;
        expect(pages.length, sujet).toBeGreaterThanOrEqual(6);
        expect(pages.length, sujet).toBeLessThanOrEqual(8);
        plans.add(pages.map((p) => p.type).join("-"));
      }
      expect(plans.size).toBeGreaterThanOrEqual(3);
      expect(espion).toHaveBeenCalledTimes(0);
    });
  }

  it("un mot réellement présent dans une fixture (« atelier ») rend la porte rouge", () => {
    const interditsDans = (t: string) => (t.toLowerCase().includes("atelier") ? ["atelier"] : []);
    const avecMot = FIXTURES.filter((f) => JSON.stringify(f.spec).toLowerCase().includes("atelier"));
    expect(avecMot.length).toBeGreaterThan(0);
    for (const f of avecMot) {
      const { rapport } = controlerCarrousel(f.spec, { faitsDisponibles: false, interditsDans });
      expect(rapport.verdict, f.id).toBe("rouge");
    }
    const sans = FIXTURES.find((f) => !JSON.stringify(f.spec).toLowerCase().includes("atelier"));
    expect(sans).toBeDefined();
    expect(controlerCarrousel(sans!.spec, { faitsDisponibles: false, interditsDans }).rapport.verdict).not.toBe("rouge");
  });
});
