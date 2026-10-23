/** `src/reseaux/sorties.ts` (plan « formats par réseau », tâche T1) : fonctions pures lues dans le registre. */
import { describe, expect, it } from "vitest";
import type { IdReseau, Ratio } from "@/domaine/types";
import { DIMENSIONS_FACECAM, RATIOS_FACECAM } from "@/briques/formats-facecam/ratios";
import { zoneSure as zoneSureFacecam } from "@/briques/formats-facecam/zones";
import { FORMATS_SORTIE } from "@/moteurs/montage-tableau/formats-sortie";
import { RESEAUX } from "@/reseaux";
import { dimensions, finPermise, meilleureSortie, sortiesVoulues, zoneDuReseau, zoneSure } from "@/reseaux/sorties";

const RATIOS: Ratio[] = ["9:16", "4:5", "1:1", "16:9"];

describe("dimensions", () => {
  it("lit la résolution d'export du registre", () => {
    expect(Object.fromEntries(RATIOS.map((r) => [r, dimensions(r)]))).toEqual({
      "9:16": { largeur: 1080, hauteur: 1920 },
      "4:5": { largeur: 1080, hauteur: 1350 },
      "1:1": { largeur: 1080, hauteur: 1080 },
      "16:9": { largeur: 1920, hauteur: 1080 },
    });
  });

  it("concorde avec DIMENSIONS_FACECAM et la table du tableau", () => {
    for (const r of RATIOS_FACECAM) expect(dimensions(r)).toEqual(DIMENSIONS_FACECAM[r]);
    for (const f of Object.values(FORMATS_SORTIE)) expect(dimensions(f.ratio)).toEqual({ largeur: f.largeur, hauteur: f.hauteur });
  });

  it("refuse un format inconnu", () => {
    expect(() => dimensions("3:2" as Ratio)).toThrow(/3:2/);
  });
});

describe("zoneDuReseau", () => {
  it("prend la zone protégée, la zone complémentaire et les emplacements du format", () => {
    expect(zoneDuReseau("facebook", "4:5")).toEqual({ haut: 5, droite: 5, bas: 12, gauche: 5 });
    expect(zoneDuReseau("linkedin", "16:9")).toEqual({ haut: 6, droite: 4, bas: 12, gauche: 4 });
    // Instagram 9:16 : Reels (14/16/30/6) ∪ stories (14/6/20/6).
    expect(zoneDuReseau("instagram", "9:16")).toEqual({ haut: 14, droite: 16, bas: 30, gauche: 6 });
  });

  it("rien pour un format que le réseau n'accepte pas", () => {
    expect(zoneDuReseau("tiktok", "4:5")).toBeNull();
    expect(zoneDuReseau("youtube", "9:16")).toBeNull();
  });
});

describe("zoneSure", () => {
  it("union des réseaux et du plancher de la charte motion, en pourcentages", () => {
    expect(zoneSure("4:5", ["linkedin", "instagram", "facebook"])).toEqual({ haut: 6, droite: 6, bas: 12, gauche: 6 });
    expect(zoneSure("9:16", ["tiktok"])).toEqual({ haut: 14, droite: 18, bas: 30, gauche: 7 });
    expect(zoneSure("16:9", ["youtube"])).toEqual({ haut: 6, droite: 5, bas: 12, gauche: 5 });
  });

  it("sans réseau donné : tous les réseaux qui acceptent ce format", () => {
    expect(zoneSure("1:1")).toEqual({ haut: 6, droite: 6, bas: 12, gauche: 6 });
  });

  it("donne la même zone que le face caméra d'aujourd'hui (règle reprise, en pourcentages)", () => {
    const listes: IdReseau[][] = [[], ...RESEAUX.map((r) => [r.id])];
    for (const ratio of RATIOS_FACECAM) {
      for (const reseaux of listes) {
        const a = zoneSure(ratio, reseaux);
        const b = zoneSureFacecam(ratio, reseaux);
        for (const bord of ["haut", "droite", "bas", "gauche"] as const) {
          expect(a[bord] / 100, `${ratio} [${reseaux.join(",")}] ${bord}`).toBeCloseTo(b[bord], 10);
        }
      }
    }
  });
});

describe("sortiesVoulues", () => {
  it("aucun réseau : aucun fichier", () => {
    expect(sortiesVoulues([])).toEqual([]);
  });

  it("un fichier = un format et une variante de fin ; regroupe les réseaux qui le partagent", () => {
    expect(sortiesVoulues(["tiktok", "instagram", "youtube-shorts", "facebook", "linkedin", "youtube"])).toEqual([
      { ratio: "9:16", appelAuMot: true, reseaux: ["instagram", "facebook"], libelle: "9:16" },
      { ratio: "9:16", appelAuMot: false, reseaux: ["linkedin", "tiktok", "youtube-shorts"], libelle: "9:16 · sans appel au mot" },
      { ratio: "16:9", appelAuMot: true, reseaux: ["youtube"], libelle: "16:9" },
    ]);
  });

  it("doublons ignorés ; LinkedIn reçoit le format préféré du registre (9:16, décision de Will du 19/10)", () => {
    expect(sortiesVoulues(["linkedin", "linkedin"])).toEqual([{ ratio: "9:16", appelAuMot: false, reseaux: ["linkedin"], libelle: "9:16 · sans appel au mot" }]);
  });

  it("décision de Will : YouTube garde par défaut le fichier au mot — il le veut au mot, et le 16:9 au mot passe avant le 16:9 propre", () => {
    expect(sortiesVoulues(["youtube"])).toEqual([{ ratio: "16:9", appelAuMot: true, reseaux: ["youtube"], libelle: "16:9" }]);
    const propre = { ratio: "16:9" as const, appelAuMot: false };
    const auMot = { ratio: "16:9" as const, appelAuMot: true };
    expect(meilleureSortie("youtube", [propre, auMot])).toBe(auMot);
    expect(meilleureSortie("youtube", [auMot, propre])).toBe(auMot);
    expect(meilleureSortie("youtube", [propre])).toBe(propre);
    // Les autres réseaux sans fin au mot gardent la fin propre.
    expect(meilleureSortie("linkedin", [{ ratio: "4:5" as const, appelAuMot: true }, { ratio: "4:5" as const, appelAuMot: false }])?.appelAuMot).toBe(false);
  });

  it("chaque réseau seul : son format préféré, avec une fin permise sur lui", () => {
    for (const r of RESEAUX) {
      const [s, ...reste] = sortiesVoulues([r.id]);
      expect(reste).toEqual([]);
      expect(s.ratio).toBe(r.ratioPrefere);
      expect(finPermise(r.id, s)).toBe(true);
    }
  });
});

describe("finPermise", () => {
  it("jamais la fin au mot sur TikTok, Shorts, LinkedIn ; permise sur Instagram et Facebook", () => {
    expect(finPermise("tiktok", { appelAuMot: true })).toBe(false);
    expect(finPermise("youtube-shorts", { appelAuMot: true })).toBe(false);
    expect(finPermise("linkedin", { appelAuMot: true })).toBe(false);
    expect(finPermise("instagram", { appelAuMot: true })).toBe(true);
    expect(finPermise("facebook", { appelAuMot: true })).toBe(true);
    expect(finPermise("tiktok", { appelAuMot: false })).toBe(true);
  });

  it("fin inconnue (fichier d'avant) : permise, comme aujourd'hui", () => {
    expect(finPermise("tiktok", {})).toBe(true);
  });
});

describe("meilleureSortie", () => {
  const v916 = { id: "a", ratio: "9:16" as Ratio, appelAuMot: true };
  const v916Liens = { id: "b", ratio: "9:16" as Ratio, appelAuMot: false };
  const p45 = { id: "c", ratio: "4:5" as Ratio, appelAuMot: true };
  const p45Sans = { id: "d", ratio: "4:5" as Ratio, appelAuMot: false };
  const c11 = { id: "e", ratio: "1:1" as Ratio, appelAuMot: false };
  const h169 = { id: "f", ratio: "16:9" as Ratio };

  it("rien : aucun fichier", () => {
    expect(meilleureSortie("linkedin", [])).toBeNull();
  });

  it("TikTok prend le vertical sans appel, jamais celui avec la fin au mot", () => {
    expect(meilleureSortie("tiktok", [v916, v916Liens])).toBe(v916Liens);
    expect(meilleureSortie("tiktok", [v916])).toBeNull();
  });

  it("Instagram préfère le vertical avec la fin au mot, sinon prend l'autre", () => {
    expect(meilleureSortie("instagram", [v916Liens, v916])).toBe(v916);
    expect(meilleureSortie("instagram", [v916Liens])).toBe(v916Liens);
  });

  it("LinkedIn : le 9:16 sans appel, sinon un autre format accepté dans l'ordre du registre (les anciens 4:5 restent livrables)", () => {
    expect(meilleureSortie("linkedin", [v916Liens, c11, p45, p45Sans])).toBe(v916Liens);
    expect(meilleureSortie("linkedin", [c11, p45, p45Sans])).toBe(c11);
    expect(meilleureSortie("linkedin", [p45Sans])).toBe(p45Sans);
    expect(meilleureSortie("linkedin", [v916Liens])).toBe(v916Liens);
    expect(meilleureSortie("linkedin", [v916])).toBeNull();
  });

  it("YouTube : seulement le 16:9 ; une fin inconnue est acceptée", () => {
    expect(meilleureSortie("youtube", [v916Liens, h169])).toBe(h169);
    expect(meilleureSortie("youtube", [v916Liens, c11])).toBeNull();
  });

  it("un fichier marqué pour ce réseau passe d'abord, s'il est d'un format accepté et d'une fin permise", () => {
    const carreLinkedin = { ...c11, id: "g", reseaux: ["linkedin"] as IdReseau[] };
    expect(meilleureSortie("linkedin", [p45Sans, carreLinkedin])).toBe(carreLinkedin);
    const verticalAuMotPourTiktok = { ...v916, id: "h", reseaux: ["tiktok"] as IdReseau[] };
    expect(meilleureSortie("tiktok", [verticalAuMotPourTiktok, v916Liens])).toBe(v916Liens);
    const horizontalPourTiktok = { ...h169, id: "i", reseaux: ["tiktok"] as IdReseau[] };
    expect(meilleureSortie("tiktok", [horizontalPourTiktok])).toBeNull();
  });

  it("à égalité, garde l'ordre des fichiers reçus", () => {
    const autre = { ...v916Liens, id: "z" };
    expect(meilleureSortie("tiktok", [v916Liens, autre])).toBe(v916Liens);
    expect(meilleureSortie("tiktok", [autre, v916Liens])).toBe(autre);
  });
});
