/** Lot D · étape 5 : sous-titres et encadré placés hors de la zone recouverte par le réseau. */
import { describe, expect, it } from "vitest";
import { obtenirReseau } from "@/reseaux";
import { habillageReseau } from "@/reseaux/adaptations";

describe("habillageReseau", () => {
  it("réglage coupé : aucune adaptation (null)", () => {
    expect(habillageReseau({ actif: false, origine: "machine", reseau: "tiktok", ratio: "9:16" })).toBeNull();
  });
  it("actif : sous-titres au-dessus de la zone basse, encadré sous la zone haute, marge de 2 points", () => {
    const h = habillageReseau({ actif: true, origine: "machine", reseau: "tiktok", ratio: "9:16" });
    const z = obtenirReseau("tiktok").zonesProtegees["9:16"]!;
    expect(h?.sousTitres.margeBasPct).toBe(z.bas + 2);
    expect(h?.encadre.margeHautPct).toBe(z.haut + 2);
    expect(h?.sousTitres.margeGauchePct).toBe(z.gauche + 2);
    expect(h?.sousTitres.margeDroitePct).toBe(z.droite + 2);
    expect(h?.encadre.margeGauchePct).toBe(z.gauche + 2);
    expect(h?.encadre.margeDroitePct).toBe(z.droite + 2);
  });
  it("marges gauche et droite SÉPARÉES : TikTok est asymétrique, pas le côté le plus large des deux", () => {
    const h = habillageReseau({ actif: true, origine: "machine", reseau: "tiktok", ratio: "9:16" })!;
    expect(h.sousTitres.margeDroitePct).toBeGreaterThan(h.sousTitres.margeGauchePct);
    expect(h.sousTitres).not.toHaveProperty("margeLateralePct");
    expect(h.encadre).not.toHaveProperty("margeLateralePct");
  });
  it("chaque réseau a sa propre marge (la zone basse de TikTok n'est pas celle d'Instagram)", () => {
    const m = (r: "tiktok" | "instagram" | "facebook" | "linkedin" | "youtube-shorts") => habillageReseau({ actif: true, origine: "machine", reseau: r, ratio: "9:16" })!.sousTitres.margeBasPct;
    expect(new Set([m("tiktok"), m("instagram"), m("facebook"), m("youtube-shorts")]).size).toBeGreaterThan(1);
  });
  it("LinkedIn : lisible sans le son, règle citée", () => {
    const h = habillageReseau({ actif: true, origine: "machine", reseau: "linkedin", ratio: "9:16" });
    expect(h?.sousTitres.obligatoire).toBe(true);
    expect(h?.sousTitres.regleId).toBe("li-sous-titres");
  });
  it("ratio sans zone connue : null (rien d'inventé)", () => {
    expect(habillageReseau({ actif: true, origine: "machine", reseau: "tiktok", ratio: "16:9" })).toBeNull();
  });
});
