/**
 * Essai réel du 14/10 (v-e99a49ee86cb) : sous-titres clairs à ombre sur les écrans ivoire, presque illisibles. La v4
 * les écrit en #15100c sur l'ivoire, sans ombre. Mesuré sur la demande RÉELLEMENT envoyée à la composition `complet`.
 */
import { describe, expect, it } from "vitest";
import { cssElement, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { ENCRE_SOUS_TITRES_IVOIRE, fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "./doubles";

describe("sous-titres du cas concret sur les écrans ivoire", () => {
  it("pendant un écran ivoire : texte #15100c, ni ombre ni contour ; ailleurs : inchangé", async () => {
    const d = doubles();
    await fabriquerCasConcret(d.options);
    const st = (d.compositionsSoumises()[0].parametres as { texte: { sousTitres: DonneesCalque } }).texte.sousTitres;
    const clairs = st.passagesClairs ?? [];
    expect(clairs.length).toBeGreaterThan(0);
    expect(clairs.every((p) => p.texte === ENCRE_SOUS_TITRES_IVOIRE)).toBe(true);
    let dansIvoire = 0;
    let ailleurs = 0;
    for (const s of st.segments) {
      const t = (s.debutSec + s.finSec) / 2;
      const el = sceneAuTemps(st, t);
      if (!el) continue;
      const css = cssElement(el, st, "x");
      const ivoire = clairs.some((p) => t >= p.debutSec && t < p.finSec);
      if (ivoire) {
        dansIvoire++;
        expect(css.ligne.textShadow).toBeUndefined();
        expect(css.ligne.WebkitTextStroke).toBeUndefined();
        // Chaque mot est à l'encre, sauf un mot en valeur (accent orange, comme la v4). Un bandeau garde ses mots foncés
        // sur sa bande (déjà lisible).
        const attendues = el.fond ? [st.couleurs.contour, st.couleurs.accent] : [ENCRE_SOUS_TITRES_IVOIRE, st.couleurs.accent];
        expect(el.mots.every((m) => attendues.includes(m.couleur))).toBe(true);
      } else {
        ailleurs++;
        expect(el.clair).toBeUndefined();
        expect(el.mots.some((m) => m.couleur === ENCRE_SOUS_TITRES_IVOIRE)).toBe(false);
      }
    }
    expect(dansIvoire).toBeGreaterThan(0);
    expect(ailleurs).toBeGreaterThan(0);
  });

  it("sans passages clairs (les autres formats) : la scène est identique", () => {
    const base = { largeur: 1080, hauteur: 1920, segments: [{ id: "s", debutSec: 0, finSec: 2, mots: [{ mot: "Bonjour", debutSec: 0, finSec: 1 }] }], base: "minimal", couleurs: { texte: "#fff", accent: "#f60", contour: "#000" }, largeurMaxPx: 960, positions: { milieuPct: 48, hautPct: 20, basPct: 80 } } as unknown as DonneesCalque;
    expect(sceneAuTemps({ ...base, passagesClairs: [] }, 1)).toEqual(sceneAuTemps(base, 1));
  });
});
