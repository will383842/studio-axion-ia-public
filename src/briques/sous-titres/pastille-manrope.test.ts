import { describe, expect, it } from "vitest";
import { GABARITS } from "./style";
import { elementDe, PASTILLE_AXION, PASTILLE_EN_MANROPE, pastilleEnManrope, sceneAuTemps, type DonneesCalque } from "./index";

const segment = { id: "g1", debutSec: 1, finSec: 2.4, mots: [{ mot: "Voici", debutSec: 1, finSec: 1.4 }, { mot: "comment", debutSec: 1.45, finSec: 1.9 }, { mot: "faire.", debutSec: 1.95, finSec: 2.4 }], style: "base" as const, position: "auto" as const };
const base: DonneesCalque = { largeur: 1080, hauteur: 1920, segments: [segment], base: "karaoke", couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" }, largeurMaxPx: 960, positions: { milieuPct: 48, hautPct: 20, basPct: 80 } };

describe("C2-U14 · Pastille en Manrope Bold (éteinte par défaut)", () => {
  it("la constante est éteinte et rien ne la lit comme allumée", () => {
    expect(PASTILLE_EN_MANROPE).toBe(false);
    expect(pastilleEnManrope(PASTILLE_AXION)).toBe(false);
  });

  it("éteint = identique : le style de la charte, tel quel, donne la même scène qu'avant (police du gabarit)", () => {
    const d = { ...base, pastille: PASTILLE_AXION };
    const el = sceneAuTemps(d, 1.6)!;
    expect(el.police).toBe(GABARITS.karaoke.police);
    expect(JSON.stringify(sceneAuTemps({ ...d, pastille: { ...PASTILLE_AXION, enManrope: false } }, 1.6))).toBe(JSON.stringify(el));
  });

  it("seul `true` allume : la pastille se mesure et se dessine en Manrope Bold 700", () => {
    expect(pastilleEnManrope({ ...PASTILLE_AXION, enManrope: true })).toBe(true);
    expect(pastilleEnManrope(PASTILLE_AXION, true)).toBe(true);
    for (const v of [1, "true", null, undefined, {}]) expect(pastilleEnManrope({ ...PASTILLE_AXION, enManrope: v as never })).toBe(false);
    const el = elementDe({ ...base, pastille: { ...PASTILLE_AXION, enManrope: true } }, segment, 1.6);
    expect(el.police).toBe("Manrope Bold");
    expect(el.pastille?.poids).toBe(700);
    expect(el.taillePx).toBeGreaterThanOrEqual(52);
  });

  it("allumée : le reste du dessin (couleurs, marges, mot dit) ne change pas", () => {
    const off = elementDe({ ...base, pastille: PASTILLE_AXION }, segment, 1.6);
    const on = elementDe({ ...base, pastille: { ...PASTILLE_AXION, enManrope: true } }, segment, 1.6);
    expect(on.mots.map((m) => m.couleur)).toEqual(off.mots.map((m) => m.couleur));
    expect(on.pastille).toEqual(off.pastille);
  });
});
