/** ALLUMER-PASTILLE-MANROPE-v21q : la Pastille est mesurée ET dessinée en Manrope Bold par défaut (décision « Manrope partout »). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elementDe, PASTILLE_AXION, PASTILLE_AXION_ARDOISE, PASTILLE_EN_MANROPE, pastilleEnManrope, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres";
import { GABARITS } from "@/briques/sous-titres/style";

const segment = { id: "g1", debutSec: 1, finSec: 2.4, mots: [{ mot: "Voici", debutSec: 1, finSec: 1.4 }, { mot: "comment", debutSec: 1.45, finSec: 1.9 }, { mot: "faire.", debutSec: 1.95, finSec: 2.4 }], style: "base" as const, position: "auto" as const };
const base: DonneesCalque = { largeur: 1080, hauteur: 1920, segments: [segment], base: "karaoke", couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" }, largeurMaxPx: 960, positions: { milieuPct: 48, hautPct: 20, basPct: 80 } };
const racine = process.cwd();

describe("ALLUMER-PASTILLE-MANROPE-v21q", () => {
  it("la constante est allumée ; les deux pastilles suivent ; enManrope:false éteint le style", () => {
    expect(PASTILLE_EN_MANROPE).toBe(true);
    expect(pastilleEnManrope(PASTILLE_AXION)).toBe(true);
    expect(pastilleEnManrope(PASTILLE_AXION_ARDOISE)).toBe(true);
    expect(pastilleEnManrope({ ...PASTILLE_AXION, enManrope: false })).toBe(false);
  });
  it("seul `true` allume quand le champ est posé", () => {
    for (const v of [1, "true", null, {}]) expect(pastilleEnManrope({ ...PASTILLE_AXION, enManrope: v as never })).toBe(false);
  });
  it("la pastille se mesure et se dessine en Manrope Bold 700", () => {
    const el = elementDe({ ...base, pastille: PASTILLE_AXION }, segment, 1.6);
    expect(el.police).toBe("Manrope Bold");
    expect(el.pastille?.poids).toBe(700);
    expect(el.taillePx).toBeGreaterThanOrEqual(52);
  });
  it("le reste du dessin (couleurs du mot dit, pastille) est celui de la police du gabarit", () => {
    const eteint = elementDe({ ...base, pastille: { ...PASTILLE_AXION, enManrope: false } }, segment, 1.6);
    const allume = elementDe({ ...base, pastille: PASTILLE_AXION }, segment, 1.6);
    expect(eteint.police).toBe(GABARITS.karaoke.police);
    expect(allume.mots.map((m) => m.couleur)).toEqual(eteint.mots.map((m) => m.couleur));
    expect(allume.pastille).toEqual(eteint.pastille);
  });
  it("un style sans pastille ne change pas (police du gabarit, scène stable)", () => {
    for (const t of [1.2, 1.6, 2.1]) {
      const a = sceneAuTemps(base, t);
      expect(a?.police).toBe(GABARITS.karaoke.police);
      expect(JSON.stringify(sceneAuTemps(base, t))).toBe(JSON.stringify(a));
    }
  });
  it("garde statique : pastille.ts sans Inter ni Poppins ; le calque charge Manrope Bold quand la pastille la veut", () => {
    expect(readFileSync(join(racine, "src/briques/sous-titres/pastille.ts"), "utf8")).not.toMatch(/\b(Inter|Poppins)\b/);
    const calque = readFileSync(join(racine, "studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx"), "utf8");
    expect(calque).toContain("pastilleEnManrope");
    expect(calque).toContain('"Manrope Bold"');
  });
});
