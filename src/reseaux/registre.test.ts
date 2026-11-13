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

describe("Facebook : durée maximale (11/11/2026)", () => {
  it("90 s : durée du Reel selon le relevé L8-01 (facebook.reseau.format_video), comme le profil de sortie", () => {
    expect(obtenirReseau("facebook").dureeMaxSec).toBe(90);
  });
});

/* L3-03 : limites de texte par réseau et par champ (lues dans la table d'écriture, jamais en dur ailleurs). */
import { readFileSync } from "node:fs";
import { ALT_MAX_REFERENCE } from "./index";
import { ECRITURE_RESEAUX, verifierLimitesTexte } from "./ecriture";
import { REGLES_DATEES_SEMEES } from "@/donnees/generateur/regles-datees";

describe("limites de texte par réseau (L3-03)", () => {
  it("un commentaire Instagram trop long renvoie l'erreur « commentaire-trop-long »", () => {
    const max = ECRITURE_RESEAUX.instagram.commentaireCaracteresMax!.valeur;
    expect(verifierLimitesTexte("instagram", { commentaire: "a".repeat(max) })).toEqual([]);
    const e = verifierLimitesTexte("instagram", { commentaire: "a".repeat(max + 1) });
    expect(e.map((x) => x.code)).toEqual(["commentaire-trop-long"]);
    expect(e[0].regleId).toBe(ECRITURE_RESEAUX.instagram.commentaireCaracteresMax!.regleId);
  });

  it("un titre trop long renvoie « titre-trop-long »", () => {
    const max = ECRITURE_RESEAUX["youtube-shorts"].titreCaracteresMax!.valeur;
    expect(max).toBe(100);
    expect(verifierLimitesTexte("youtube-shorts", { titre: "t".repeat(max) })).toEqual([]);
    expect(verifierLimitesTexte("youtube-shorts", { titre: "t".repeat(max + 1) }).map((x) => x.code)).toEqual(["titre-trop-long"]);
  });

  it("un nombre de mots-dièse hors bornes sur LinkedIn renvoie « mots-diese-hors-bornes »", () => {
    const [min, max] = ECRITURE_RESEAUX.linkedin.motsDiese.valeur;
    expect(verifierLimitesTexte("linkedin", { motsDiese: min })).toEqual([]);
    expect(verifierLimitesTexte("linkedin", { motsDiese: max })).toEqual([]);
    expect(verifierLimitesTexte("linkedin", { motsDiese: max + 1 }).map((x) => x.code)).toEqual(["mots-diese-hors-bornes"]);
    expect(verifierLimitesTexte("linkedin", { motsDiese: min - 1 }).map((x) => x.code)).toEqual(["mots-diese-hors-bornes"]);
  });

  it("un réseau sans limite pour un champ n'en refuse rien ; aucun cas YouTube", () => {
    expect(verifierLimitesTexte("tiktok", { commentaire: "a".repeat(10000) })).toEqual([]);
    expect(Object.keys(ECRITURE_RESEAUX)).not.toContain("youtube");
  });

  it("chaque limite porte un regleId semé ; « hyp-* » tant qu'elle n'est pas sourcée", () => {
    const ids = REGLES_DATEES_SEMEES.map((r) => r.id);
    for (const e of Object.values(ECRITURE_RESEAUX)) {
      for (const v of [e.commentaireCaracteresMax, e.titreCaracteresMax, e.motsDiese]) {
        if (!v) continue;
        expect(ids).toContain(v.regleId);
        const niveau = REGLES_DATEES_SEMEES.find((r) => r.id === v.regleId)!.niveau;
        if (v.regleId.startsWith("hyp-")) expect(niveau).toBe("hypothese");
      }
    }
    expect(ALT_MAX_REFERENCE.regleId).toMatch(/^hyp-/);
    expect(ids).toContain(ALT_MAX_REFERENCE.regleId);
  });

  it("non-divergence : ALT_MAX de zernio-corps.ts et de buffer.ts égale la référence (lecture seule)", () => {
    for (const f of ["src/fournisseurs/publication/zernio-corps.ts", "src/fournisseurs/publication/buffer.ts"]) {
      const m = /export const ALT_MAX = (\d+);/.exec(readFileSync(f, "utf8"));
      expect(m, f).not.toBeNull();
      expect(Number(m![1]), f).toBe(ALT_MAX_REFERENCE.valeur);
    }
  });
});
