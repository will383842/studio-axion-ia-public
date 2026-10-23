import { describe, expect, it } from "vitest";
import { cssElement, elementDe, PASTILLE_AXION, sceneAuTemps, type DonneesCalque } from "./index";
import { GABARITS } from "./style";

const segment = { id: "g1", debutSec: 1, finSec: 2.4, mots: [{ mot: "Voici", debutSec: 1, finSec: 1.4 }, { mot: "comment", debutSec: 1.45, finSec: 1.9 }, { mot: "faire.", debutSec: 1.95, finSec: 2.4 }], style: "base" as const, position: "auto" as const };
const base: DonneesCalque = { largeur: 1080, hauteur: 1920, segments: [segment], base: "karaoke", couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" }, largeurMaxPx: 960, positions: { milieuPct: 48, hautPct: 20, basPct: 80 } };

describe("style nommé « Pastille Axion » (ajout pur)", () => {
  it("les styles du catalogue sont inchangés : sans `pastille`, aucun champ nouveau, karaoké comme avant", () => {
    const el = elementDe(base, segment, 1.2);
    expect(el.pastille).toBeUndefined();
    expect(el.gabarit).toBe(GABARITS.karaoke);
    expect(el.mots[0].couleur).toBe("#E07040");
    expect(el.mots.every((m) => m.echelle === undefined && m.monteePx === undefined)).toBe(true);
    const css = cssElement(el, base, "X");
    expect(css.ligne.background).toBeUndefined();
    expect(css.mot(0).transform).toBeUndefined();
  });

  it("pastille pleine, texte ivoire, mot dit en orange clair qui grossit (≤ 6 %) et monte, fondu court, ≥ 52 px", () => {
    const d = { ...base, pastille: PASTILLE_AXION };
    expect(sceneAuTemps(d, 1.0)!.opacite).toBe(0);
    const el = sceneAuTemps(d, 1.6)!;
    expect(el.opacite).toBe(1);
    expect(el.taillePx).toBeGreaterThanOrEqual(52);
    expect(el.mots.map((m) => m.couleur)).toEqual(["#F6F1E8", "#E8A27F", "#F6F1E8"]);
    expect(el.mots[1].echelle!).toBeGreaterThan(1.02);
    expect(el.mots[1].echelle!).toBeLessThanOrEqual(1.06);
    expect(el.mots[1].monteePx!).toBeLessThan(0);
    const css = cssElement(el, d, "Inter");
    expect(css.ligne).toMatchObject({ background: "#110A05", borderRadius: 9999, color: "#F6F1E8" });
    expect(css.ligne.textShadow).toBeUndefined();
    expect(css.ligne.WebkitTextStroke).toBeUndefined();
    expect(String(css.mot(1).transform)).toMatch(/scale\(1\.0[1-5]/);
    // Un mot long grossit moins : il ne mange pas l'espace avec son voisin.
    const long = { ...segment, id: "g3", mots: [{ mot: "l'entraînement", debutSec: 1, finSec: 2.4 }] };
    const elLong = elementDe({ ...d, segments: [long] }, long, 1.5);
    expect(elLong.mots[0].echelle!).toBeLessThan(1.05);
    expect(elLong.mots[0].echelle!).toBeGreaterThan(1);
    // Un groupe qui suit directement le précédent ne refait pas de fondu (la pastille ne clignote pas).
    const suivant = { ...segment, id: "g2", debutSec: 2.4, finSec: 3, mots: [{ mot: "Ensuite", debutSec: 2.4, finSec: 3 }] };
    const deux = { ...d, segments: [segment, suivant] };
    expect(sceneAuTemps(deux, 2.41)!.opacite).toBe(1);
    // Le mot d'avant redescend sans saut : au tout début du mot suivant, il est encore presque à sa taille.
    const juste = sceneAuTemps(d, 1.451)!;
    expect(juste.mots[0].echelle!).toBeGreaterThan(1.04);
  });
});
