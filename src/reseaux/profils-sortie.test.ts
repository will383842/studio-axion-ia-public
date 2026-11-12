import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { TYPES_CONTENU } from "@/domaine/taxonomie-contenu";
import { PROFILS_RESEAUX } from "@/briques/visuels/reseaux";
import { ECRITURE_RESEAUX } from "./ecriture";
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
  it("la vidéo lit la durée du registre (sauf Facebook, tranché par décision)", () => {
    for (const r of RESEAUX) if (r.id !== "facebook") expect(profilSortie(r.id, "video").dureeMaxSec).toBe(r.dureeMaxSec);
  });
  it("image et carrousel n'ont pas de durée", () => {
    expect(profilSortie("instagram", "image").dureeMaxSec).toBeNull();
    expect(profilSortie("instagram", "carrousel").dureeMaxSec).toBeNull();
  });
  it("Facebook vidéo : 90 s par décision écrite (valeur en dur), en attente de vérification, à revérifier par L8-01", () => {
    const p = profilSortie("facebook", "video");
    expect(p.dureeMaxSec).toBe(90);
    expect(p.niveauPreuve).toBe("decision-en-attente");
    expect(p.aReverifier).toBe(true);
    expect(p.dureeReelMaxSec).toBe(REEL_FACEBOOK_DUREE_SEC.max);
  });
  it("les deux tables du code divergent sur Facebook (180 s au registre, aucune durée à l'écriture) et la décision l'emporte", () => {
    expect(obtenirReseau("facebook").dureeMaxSec).toBe(180);
    expect(ECRITURE_RESEAUX.facebook.dureeMaxSec.valeur).toBeNull();
    expect(profilSortie("facebook", "video").dureeMaxSec).toBe(90);
  });
  it("YouTube ne publie pas d'image par ce canal", () => {
    for (const id of ["youtube", "youtube-shorts"] as const) {
      const p = profilSortie(id, "image");
      expect(p.pris).toBe(false);
      expect(p.ratios).toEqual([]);
      expect(p.ratioPrefere).toBeNull();
    }
    expect(profilSortie("instagram", "image").pris).toBe(true);
  });
  it("le ratio de carrousel est calculé depuis le format des profils de carrousel", () => {
    for (const id of ["linkedin", "instagram", "facebook"] as const) {
      const { largeur, hauteur } = PROFILS_RESEAUX[id].format;
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      const d = g(largeur, hauteur);
      expect(profilSortie(id, "carrousel").ratios).toEqual([`${largeur / d}:${hauteur / d}`]);
    }
  });
  it("les carrousels des trois réseaux de documents sont en 4:5", () => {
    for (const id of ["linkedin", "instagram", "facebook"] as const) expect(profilSortie(id, "carrousel").ratios).toEqual(["4:5"]);
    expect(profilSortie("youtube", "carrousel").pris).toBe(false);
  });
});

describe("profils de sortie : source sans citation", () => {
  it("le code ne recopie aucune phrase entre guillemets français", () => {
    const code = readFileSync(new URL("./profils-sortie.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/[«»]/);
    expect(code).not.toMatch(/décision écrite/i);
  });
});
