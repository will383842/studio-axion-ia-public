/**
 * Essai réel du 11/10, défaut n° 1 : sous-titres crème à ombre sombre sur la page ivoire, presque illisibles. Le
 * tableau animé pose le style « Encre » : écriture de la charte, ni contour ni ombre, contraste ≥ 7:1 sur la page.
 * Mesuré sur la demande RÉELLEMENT envoyée à la composition `complet` (couleurs du calque, CSS de la ligne).
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ParametresDemandeComposition } from "../../../src/briques/composition/scene";
import { COULEURS_VIDEO, CONTRASTE_TEXTE_MIN } from "../../../src/briques/habillage/charte-video";
import { rapportContraste } from "../../../src/briques/habillage/contraste";
import { cssElement, sceneAuTemps } from "../../../src/briques/sous-titres/scene";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "./doubles";

async function demandeComplet() {
  const d = doubles(ficheDemonstration, { fin: "Enregistrez cette vidéo pour la refaire" });
  await fabriquerTableau(d.outils);
  return d.compositionsSoumises()[0].parametres as unknown as Extract<ParametresDemandeComposition, { mode: "complet" }>;
}

describe("sous-titres du tableau : style « Encre »", () => {
  it("texte en écriture de la charte, contraste ≥ 7:1 sur la couleur de la page", async () => {
    const p = await demandeComplet();
    const st = p.texte.sousTitres!;
    expect(st.couleurs.texte).toBe(COULEURS_VIDEO.ecriture);
    const page = p.image.decor.teinte;
    expect(page).toBe(COULEURS_VIDEO.page);
    expect(CONTRASTE_TEXTE_MIN).toBeGreaterThanOrEqual(7);
    expect(rapportContraste(st.couleurs.texte, page)).toBeGreaterThanOrEqual(7);
    // Aucun mot d'une autre couleur (ni crème ni orange) : l'emphase reste l'écriture.
    expect(rapportContraste(st.couleurs.accent, page)).toBeGreaterThanOrEqual(7);
  });

  it("ni ombre ni contour sur la ligne dessinée, police de la charte, ligne dans la bande réservée", async () => {
    const p = await demandeComplet();
    const st = p.texte.sousTitres!;
    expect(st.encre).toBe(true);
    expect(st.facteurOmbre ?? 1).toBe(1);
    for (const s of st.segments) {
      const el = sceneAuTemps(st, (s.debutSec + s.finSec) / 2);
      expect(el).not.toBeNull();
      const css = cssElement(el!, st, "x");
      expect(css.ligne.textShadow).toBeUndefined();
      expect(css.ligne.WebkitTextStroke).toBeUndefined();
      expect(el!.fond).toBeUndefined();
      for (let i = 0; i < el!.mots.length; i++) expect(css.mot(i).color).toBe(COULEURS_VIDEO.ecriture);
    }
  });
});
