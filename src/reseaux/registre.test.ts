/** Registre des réseaux complet (AV2.3-1). */
import { describe, expect, it } from "vitest";
import { listerReseaux, obtenirReseau, verifierPourReseau, zoneProtegeeCombinee } from "./index";

const ATTENDUS = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

describe("registre des réseaux", () => {
  const reseaux = listerReseaux();

  it("contient les 6 réseaux, sans doublon", () => {
    expect(reseaux.map((r) => r.id).sort()).toEqual([...ATTENDUS].sort());
  });

  for (const r of reseaux) {
    describe(r.id, () => {
      it("ratios non vides, ratio préféré inclus, résolution d'export pour chaque ratio", () => {
        expect(r.ratios.length).toBeGreaterThan(0);
        expect(r.ratios).toContain(r.ratioPrefere);
        for (const ratio of r.ratios) expect(r.export.resolution[ratio]).toMatch(/^\d+x\d+$/);
      });
      it("durée max, niveau sonore, légende et étiquette IA renseignés", () => {
        expect(r.dureeMaxSec).toBeGreaterThan(0);
        expect(r.niveauSonoreLufs).toBeLessThan(0);
        expect(r.legende.longueurVisible).toBeLessThanOrEqual(r.legende.longueurMax);
        expect(r.legende.motsDieseConseilles).toBeLessThanOrEqual(r.legende.motsDieseMax);
        expect(r.etiquetteIA.length).toBeGreaterThan(5);
        expect(r.nom && r.monogramme).toBeTruthy();
      });
      it("zones protégées : au moins une, sur des ratios du réseau, en pourcentages plausibles", () => {
        const zones = Object.entries(r.zonesProtegees);
        expect(zones.length).toBeGreaterThan(0);
        for (const [ratio, z] of zones) {
          expect(r.ratios).toContain(ratio);
          expect(z!.haut + z!.bas).toBeLessThan(60);
          expect(z!.gauche + z!.droite).toBeLessThan(60);
        }
      });
    });
  }

  it("avertit « Trop longue pour YouTube Shorts » et compte la légende", () => {
    const shorts = obtenirReseau("youtube-shorts");
    const a = verifierPourReseau(shorts, { dureeSec: 600, ratios: ["9:16"], texte: "x".repeat(150), motsDiese: ["a", "b", "c", "d"] });
    expect(a.map((x) => x.code).sort()).toEqual(["legende-trop-longue", "trop-de-mots-diese", "trop-longue"]);
    expect(a.find((x) => x.code === "trop-longue")?.message).toBe("Trop longue pour YouTube Shorts");
  });

  it("la zone combinée prend le maximum de chaque côté", () => {
    const z = zoneProtegeeCombinee("9:16", ["tiktok", "instagram"]);
    // Profil Instagram / Facebook Reels (v3.2) : haut 14 %, bas 30 %, côtés 6 % ; TikTok garde la droite (18 %).
    expect(z).toEqual({ haut: 14, droite: 18, bas: 30, gauche: 6 });
    expect(zoneProtegeeCombinee("1:1", ["tiktok"])).toBeNull();
  });
});
