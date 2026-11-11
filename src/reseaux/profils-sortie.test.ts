import { describe, expect, it } from "vitest";
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { TYPES_CONTENU } from "@/domaine/taxonomie-contenu";
import { RESEAUX, obtenirReseau } from "./index";
import { profilSortie } from "./profils-sortie";

describe("profils de sortie", () => {
  for (const r of RESEAUX) {
    for (const type of TYPES_CONTENU) {
      it(`${r.id} × ${type} renvoie ratios et durée max`, () => {
        const p = profilSortie(r.id, type);
        expect(Array.isArray(p.ratios)).toBe(true);
        expect(p.dureeMaxSec === null || p.dureeMaxSec > 0).toBe(true);
        if (p.pris) expect(p.ratios).toContain(p.ratioPrefere);
        expect(motsInterditsEnvoi(p.source)).toEqual([]);
      });
    }
  }
  it("la vidéo lit la durée du registre", () => {
    for (const r of RESEAUX) expect(profilSortie(r.id, "video").dureeMaxSec).toBe(r.dureeMaxSec);
  });
  it("image et carrousel n'ont pas de durée", () => {
    expect(profilSortie("instagram", "image").dureeMaxSec).toBeNull();
    expect(profilSortie("instagram", "carrousel").dureeMaxSec).toBeNull();
  });
  it("Facebook : durée de la table, niveau de preuve, Reel à 60 s à revérifier", () => {
    const p = profilSortie("facebook", "video");
    expect(p.dureeMaxSec).toBe(obtenirReseau("facebook").dureeMaxSec);
    expect(p.niveauPreuve).toBe("table-registre");
    expect(p.aReverifier).toBe(true);
    expect(p.dureeReelMaxSec).toBe(REEL_FACEBOOK_DUREE_SEC.max);
  });
  it("les carrousels des trois réseaux de documents sont en 4:5", () => {
    for (const id of ["linkedin", "instagram", "facebook"] as const) expect(profilSortie(id, "carrousel").ratios).toEqual(["4:5"]);
    expect(profilSortie("youtube", "carrousel").pris).toBe(false);
  });
});
