/**
 * C8-X01-b-v20j : « zoom gratuit v4 » passe de « absent » à « eteint » (livré, branché, éteint).
 * Aucune vidéo ne change : aucun profil ne cite la capacité, le zoom ne s'allume que par `facecamAnimee.zoomGratuit`.
 * Les logos d'outils et l'avis client ne sont PAS finis par cette fiche : ils restent « prevu ».
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { PROFILS_DU_CODE, profilDuFormat } from "@/briques/bibliotheque-video/profils";

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("C8-X01-b-v20j : zoom gratuit v4 « eteint »", () => {
  it("(a) cadrage.zoom-v4 est « eteint » ; logos et avis restent « prevu » ; les 4 zooms classiques restent « prod »", () => {
    expect(etatCapacite(ID.cadrageZoomV4)).toBe("eteint");
    expect(etatCapacite(ID.texteLogoOutil)).toBe("prevu");
    expect(etatCapacite(ID.motionAvisClient)).toBe("prevu");
    for (const id of [ID.cadrageZoomClassique, ID.cadrageZoomAvocat, ID.cadrageZoomDemo, ID.cadrageCameraCasConcret]) {
      expect(etatCapacite(id)).toBe("prod");
    }
  });

  it("(b) aucun profil du code ne cite cadrage.zoom-v4 (permissions inchangées, face caméra animée comprise)", () => {
    for (const [format, profil] of Object.entries(PROFILS_DU_CODE)) {
      expect(JSON.stringify(profil), format).not.toContain("cadrage.zoom-v4");
    }
    expect(JSON.stringify(profilDuFormat("facecam-animee"))).not.toContain("zoom-v4");
  });

  it("(c) le branchement existe : le service lit PARAM_ZOOM_GRATUIT_FA avec le défaut false", () => {
    const src = lire("src/services/facecam-animee.ts");
    expect(src).toMatch(/lireParametre<unknown>\(PARAM_ZOOM_GRATUIT_FA, false\)\) === true/);
  });
});
