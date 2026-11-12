/**
 * GV-LU-01b : l'aperçu lit le rendu de couleur dans la MÊME table que la fabrication.
 * Ordre : choix de la vidéo > étoile de la Bibliothèque > table (src/briques/charte/rendu-couleur.ts).
 */
import { describe, expect, it } from "vitest";
import { renduCouleurDe } from "@/briques/charte/rendu-couleur";
import { lutApercu } from "@/assistant/express/plateau";
import { listerFormats, obtenirFormat } from "@/formats";

const formats = listerFormats({ inclureMasques: true, inclureReservesAWill: true });

describe("aperçu : rendu de couleur = table", () => {
  it("pour chaque format du registre, sans choix ni étoile : LUT et intensité de la table", () => {
    for (const f of formats) {
      const r = renduCouleurDe(f.id);
      const a = lutApercu(f.id, {}, []);
      expect(a.lutId, f.id).toBe(r.lut ?? undefined);
      expect(a.intensite, f.id).toBe(r.intensite);
    }
  });
  it("les formats dont le rendu a changé avec la table n'affichent plus l'ancienne LUT", () => {
    for (const id of ["podcast", "createur-b", "ecran-partage", "motion", "ugc", "selfie"]) {
      expect(lutApercu(id, {}, []).lutId, id).toBe(renduCouleurDe(id).lut ?? undefined);
    }
    expect(lutApercu("podcast", {}, []).lutId).toBeUndefined();
  });
  it("le choix de la vidéo prime, avec son intensité", () => {
    expect(lutApercu("podcast", { lutId: "lut-x", intensiteLut: 33 }, [])).toEqual({ lutId: "lut-x", intensite: 33 });
  });
  it("une étoile de la Bibliothèque prime sur la table", () => {
    const etoile = { id: "lut-etoile", type: "lut", formatsParDefaut: ["podcast"] };
    expect(lutApercu("podcast", {}, [etoile]).lutId).toBe("lut-etoile");
  });
  it("avocat et face caméra : inchangés (même LUT qu'avant, 70 %)", () => {
    for (const id of ["avocat", "facecam", "facecam-animee", "demo-facecam"]) {
      const avant = obtenirFormat(id).stylesParDefaut;
      const a = lutApercu(id, {}, []);
      expect(a.lutId, id).toBe(avant.lut);
      expect(a.intensite, id).toBe(70);
      expect(avant.intensiteLut ?? 70, id).toBe(70);
    }
  });
});
