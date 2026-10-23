/**
 * FACE CAMÉRA ANIMÉE v4 — les copies des lots 1 à 5 de `motion-v4` (planches de répétition) suivent la même zone sûre TikTok / Reels / Shorts
 * que le chemin de production : centre des sous-titres dans [0,174 ; 0,666] H. AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPRISE_V4, ZONE_SURE_916_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { describe, expect, it } from "vitest";
import { placerDansZoneSure, Y_ST_MAX, Y_ST_MIN } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/zone-sure-v4";

const V4 = join(process.cwd(), "studio-rendu/compositions/interface-claire/motion-v4");
const src = (f: string) => readFileSync(join(V4, f), "utf8");
const descentes = Array.from({ length: 33 }, (_, k) => k / 100);

describe("lots 1 à 5 : placement des sous-titres dans la zone sûre", () => {
  it.each(["lot1/commun-lot1.tsx", "lot2/commun-lot2.tsx", "lot4/commun-lot4.tsx", "lot5/position-st.ts"])("%s importe et applique la zone sûre commune", (f) => {
    const s = src(f);
    expect(s).toContain("../communs/zone-sure-v4");
    expect(s).toContain("placerDansZoneSure");
  });
  it("lot3 borne le centre et refuse l'ancien plancher 0,86", () => {
    const s = src("lot3/commun-lot3.tsx");
    expect(s).toContain("Y_ST_MAX");
    expect(s).not.toContain("<= 0.86");
  });
  it("lot2 ne garde plus le plafond 0,86 H", () => {
    expect(src("lot2/commun-lot2.tsx")).not.toContain("Math.min(0.66 + D, 0.86)");
  });
  it("les valeurs historiques des lots (0,66 + d ; 0,72 ; 0,76 ; 0,82 ; 0,84) sont ramenées dans [0,174 ; 0,666]", () => {
    for (const d of descentes) for (const v of [0.66 + d, 0.72, 0.76, 0.78, 0.82, 0.84]) {
      const y = placerDansZoneSure(v, d);
      expect(y).toBeLessThanOrEqual(Y_ST_MAX + 1e-9);
      expect(y).toBeGreaterThanOrEqual(Y_ST_MIN - 1e-9);
    }
  });
});

describe("mots très longs : jamais plus large que la zone sûre, jamais coupés", () => {
  // Largeurs MESURÉES (Montserrat 900, Chromium) à corps 84 par `docs/facecam-animee-v4/sous-titres-zones/mesurer-mots-longs.mjs`.
  const L84 = { accompagnement: 923 - 0, administratives: 852 };
  const MAX = 0.76 * 1080;
  it("chaque mot seul tient à un corps réduit ≥ 48 (mesure réelle : 74 et 80)", () => {
    for (const l84 of Object.values(L84)) {
      let corps = 84;
      while (corps > 48 && (l84 * corps) / 84 > MAX) corps -= 2;
      expect(corps).toBeGreaterThanOrEqual(48);
      expect((l84 * corps) / 84).toBeLessThanOrEqual(MAX);
    }
  });
  it("deux mots longs ensemble ne tiennent pas à 48 : le rendu les empile (un mot par ligne) au lieu de déborder", () => {
    const deux = (L84.accompagnement + L84.administratives) * (48 / 84) + 0.32 * 48;
    expect(deux).toBeGreaterThan(MAX);
    const s = src("communs/briques-v4.tsx");
    expect(s).toContain("const empile =");
    expect(s).toContain("(1 - ZONE_SURE_916.bas) * H - demiBloc");
  });
});

describe("PileNotifications : bulles dans la zone sûre", () => {
  const s = src("lot3/PileNotifications.tsx");
  it("bord bas ≤ 0,70 H et haut ≥ 0,52 H (sous le visage entier), pour 1, 2 et 3 bulles", () => {
    const BH = Number(/BH = (\d+)/.exec(s)![1]);
    const DECAL = Number(/DECAL = ([\d.]+) \* H/.exec(s)![1]) * 1920;
    const Y_BAS = (1 - 0.3) * 1920 - BH - 5 - 6;
    for (const n of [1, 2, 3]) {
      expect((Y_BAS + BH + 5 + 6) / 1920).toBeLessThanOrEqual(0.7 + 1e-9);
      expect((Y_BAS - DECAL * (n - 1) - 5) / 1920).toBeGreaterThanOrEqual(0.52 - 1e-9);
    }
    expect(s).not.toContain("0.84 * H");
  });
  it("l'emprise M7 du catalogue suit la zone sûre (bas 0,70) et laisse le visage entier", () => {
    expect(EMPRISE_V4.M7.y1).toBeLessThanOrEqual(1 - ZONE_SURE_916_V4.bas + 1e-9);
    expect(EMPRISE_V4.M7.y0).toBeGreaterThanOrEqual(0.52);
  });
});
