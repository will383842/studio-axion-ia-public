/**
 * FACE CAMÉRA ANIMÉE v4 — sous-titres dans la ZONE SÛRE 9:16 (TikTok + Reels + Shorts), jamais sur les yeux.
 * Une même vidéo verticale part sur les trois réseaux : la zone sûre est le plus strict de chaque côté (`zoneProtegeeCombinee`).
 * AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { obtenirReseau, zoneProtegeeCombinee } from "@/reseaux";
import {
  BANDE_YEUX_V4, bordGaucheSousTitresV4, CATALOGUE_V4, DEMI_HAUTEUR_SOUS_TITRES_V4, DESCENTE_V4, placerDansZoneSureV4, sousTitresSurLesYeuxV4, X_SOUS_TITRES_MAX_V4,
  X_SOUS_TITRES_MIN_V4, ySousTitresV4, Y_SOUS_TITRES_MAX_V4, Y_SOUS_TITRES_MIN_V4, ZONE_SURE_916_V4,
} from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { erreursSousTitresV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import { bordGaucheSousTitres, BANDE_YEUX, DEMI_HAUTEUR_ST, largeurMaxSousTitres, placerDansZoneSure, X_ST_MAX, X_ST_MIN, Y_ST_MAX, Y_ST_MIN, ZONE_SURE_916 } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/zone-sure-v4";

const EPS = 1e-9;
const RESEAUX_916 = ["tiktok", "instagram", "facebook", "youtube-shorts"] as const;
const descentes = (max: number) => Array.from({ length: Math.round(max * 100) + 1 }, (_, k) => k / 100);
const V4 = join(process.cwd(), "studio-rendu/compositions/interface-claire/motion-v4");

describe("zone sûre 9:16 des sous-titres v4", () => {
  it("elle est le plus strict de chaque côté des zones protégées des réseaux (TikTok 10/18/26/4, Instagram 14/16/30/6, Shorts 10/16/20/4)", () => {
    const z = zoneProtegeeCombinee("9:16", [...RESEAUX_916])!;
    expect(z).toEqual({ haut: 14, droite: 18, bas: 30, gauche: 6 });
    for (const id of RESEAUX_916) {
      const r = obtenirReseau(id).zonesProtegees["9:16"]!;
      expect(z.haut).toBeGreaterThanOrEqual(r.haut);
      expect(z.droite).toBeGreaterThanOrEqual(r.droite);
      expect(z.bas).toBeGreaterThanOrEqual(r.bas);
      expect(z.gauche).toBeGreaterThanOrEqual(r.gauche);
    }
    expect(ZONE_SURE_916_V4).toEqual({ haut: z.haut / 100, droite: z.droite / 100, bas: z.bas / 100, gauche: z.gauche / 100 });
    expect(Y_SOUS_TITRES_MAX_V4 + DEMI_HAUTEUR_SOUS_TITRES_V4).toBeCloseTo(0.7, 9);
    expect(Y_SOUS_TITRES_MIN_V4 - DEMI_HAUTEUR_SOUS_TITRES_V4).toBeCloseTo(0.14, 9);
  });

  it("le rendu (copie pure) a exactement les mêmes chiffres et le même calcul que le studio", () => {
    expect(ZONE_SURE_916).toEqual(ZONE_SURE_916_V4);
    expect(DEMI_HAUTEUR_ST).toBe(DEMI_HAUTEUR_SOUS_TITRES_V4);
    expect([...BANDE_YEUX]).toEqual([...BANDE_YEUX_V4]);
    expect(Y_ST_MAX).toBeCloseTo(Y_SOUS_TITRES_MAX_V4, 12);
    expect(Y_ST_MIN).toBeCloseTo(Y_SOUS_TITRES_MIN_V4, 12);
    expect(X_ST_MIN).toBe(X_SOUS_TITRES_MIN_V4);
    expect(X_ST_MAX).toBeCloseTo(X_SOUS_TITRES_MAX_V4, 12);
    for (let voulu = 0; voulu <= 1; voulu += 0.025) for (const d of descentes(0.32)) expect(placerDansZoneSure(voulu, d)).toBeCloseTo(placerDansZoneSureV4(voulu, d), 12);
    for (let l = 100; l <= 820; l += 20) expect(bordGaucheSousTitres(l, 1080) / 1080).toBeCloseTo(bordGaucheSousTitresV4(l / 1080), 12);
    // Le registre et le composant de rendu appellent bien ce calcul.
    const registre = readFileSync(join(V4, "registre-v4.tsx"), "utf8");
    expect(registre).toContain("return placerDansZoneSure(voulu, d);");
    const briques = readFileSync(join(V4, "communs/briques-v4.tsx"), "utf8");
    expect(briques).toContain("largeurMaxSousTitres(W)");
    expect(briques).toContain("bordGaucheSousTitres(largeur, W)");
  });

  it("chaque fiche active × chaque descente possible : la boîte reste dans la zone sûre et hors de la bande des yeux", () => {
    let n = 0;
    for (const f of CATALOGUE_V4) {
      const max = Math.max(f.descente, f.sousTitres === "carte" ? DESCENTE_V4.D2 : 0);
      for (const d of descentes(max)) {
        const y = ySousTitresV4(f, d);
        if (y === null) continue;
        n++;
        expect(y + DEMI_HAUTEUR_SOUS_TITRES_V4, `${f.id} d=${d} bas`).toBeLessThanOrEqual(1 - ZONE_SURE_916_V4.bas + EPS);
        expect(y - DEMI_HAUTEUR_SOUS_TITRES_V4, `${f.id} d=${d} haut`).toBeGreaterThanOrEqual(ZONE_SURE_916_V4.haut - EPS);
        expect(sousTitresSurLesYeuxV4(y, d), `${f.id} d=${d} yeux`).toBe(false);
      }
      expect(erreursSousTitresV4(f), f.id).toEqual([]);
    }
    expect(n).toBeGreaterThan(100);
  });

  it("avant / après : base 0,66 + d plafonné à 0,666 ; fenêtres et plein cadre (0,72 / 0,78 / 0,76 / 0,82) → 0,666 ; pile de notifications 0,075 → 0,174", () => {
    expect(ySousTitresV4({ sousTitres: "base" }, 0)).toBeCloseTo(0.66, 9);
    expect(ySousTitresV4({ sousTitres: "base" }, DESCENTE_V4.D1)).toBeCloseTo(0.666, 9);
    expect(ySousTitresV4({ sousTitres: "carte" }, DESCENTE_V4.D2)).toBeCloseTo(0.375, 9);
    for (const id of ["FenetreTelephone", "FenetreDouble", "AvantApres", "CarrouselFeuillete", "MosaiqueVideos", "duel-video"]) {
      expect(ySousTitresV4(CATALOGUE_V4.find((f) => f.id === id)!, 0), id).toBeCloseTo(0.666, 9);
    }
    expect(ySousTitresV4(CATALOGUE_V4.find((f) => f.id === "PileNotifications")!, 0)).toBeCloseTo(0.174, 9);
  });

  it("prise très descendue (le bornage tomberait sur les yeux) : juste AU-DESSUS de la bande des yeux, dans la zone sûre", () => {
    const y = placerDansZoneSureV4(0.7, DESCENTE_V4.D3); // yeux à 0,59 → 0,68 H : le bas autorisé (0,666) tomberait dessus
    expect(sousTitresSurLesYeuxV4(y, DESCENTE_V4.D3)).toBe(false);
    expect(y + DEMI_HAUTEUR_SOUS_TITRES_V4).toBeLessThanOrEqual(BANDE_YEUX_V4[0] + DESCENTE_V4.D3 + EPS);
    for (const d of descentes(0.4)) for (let voulu = 0; voulu <= 1; voulu += 0.05) {
      const p = placerDansZoneSureV4(voulu, d);
      expect(p).toBeGreaterThanOrEqual(Y_SOUS_TITRES_MIN_V4 - EPS);
      expect(p).toBeLessThanOrEqual(Y_SOUS_TITRES_MAX_V4 + EPS);
    }
  });

  it("la règle V5b refuse une fiche dont la position fixe sort de la zone sûre (ancien 0,82 ou 0,075), accepte la nouvelle", () => {
    const f = CATALOGUE_V4.find((x) => x.id === "MosaiqueVideos")!;
    expect(erreursSousTitresV4({ ...f, sousTitres: 0.82 }).join(" ")).toContain("V5b");
    expect(erreursSousTitresV4({ ...f, sousTitres: 0.075 }).join(" ")).toContain("V5b");
    expect(erreursSousTitresV4({ ...f, sousTitres: 0.66 })).toEqual([]);
  });

  it("largeur : centré (0,5 L) si la boîte tient entre 0,18 et 0,82 L, sinon décalé à gauche sans passer sous 0,06 L ni dépasser 0,82 L", () => {
    for (let l = 0.05; l <= 0.76 + EPS; l += 0.01) {
      const x0 = bordGaucheSousTitresV4(l);
      expect(x0, `l=${l}`).toBeGreaterThanOrEqual(X_SOUS_TITRES_MIN_V4 - EPS);
      expect(x0 + l, `l=${l}`).toBeLessThanOrEqual(X_SOUS_TITRES_MAX_V4 + EPS);
      if (l <= 0.64) expect(x0 + l / 2).toBeCloseTo(0.5, 9);
    }
    expect(largeurMaxSousTitres(1080)).toBeCloseTo(0.76 * 1080, 6);
  });
});
