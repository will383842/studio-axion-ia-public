/**
 * G7b : RANGS ET « LES 5 PLUS PROCHES » (plan v5 B.8 §3 et §8). PUR.
 * Critère de la ligne G7b : rangs calculés sur 20 vidéos ; AUCUNE PRÉDICTION.
 * Données : 20 vidéos de TEST (codes « TEST-… »), ici seulement.
 */
import { describe, expect, it } from "vitest";
import {
  cinqPlusProches,
  FENETRE_RANGS,
  fenetreReseau,
  mediane,
  ordinal,
  rangsParReseau,
  rangsReseau,
  regrouper,
  ressemblance,
  tousLesRangs,
  valeurIndicateur,
  visitesParCode,
  type VideoMesuree,
} from "@/domaine/mesures-rangs";
import type { ReseauDeclinaison } from "@/domaine/types";

/** 20 vidéos TEST sur TikTok : la vidéo i a un abandon à 3 s de (20 + i) % et une durée de (30 − i) s → i = 0 est la meilleure. */
function vingtVideosTest(reseau: ReseauDeclinaison = "tiktok", decalage = 0): VideoMesuree[] {
  return Array.from({ length: 20 }, (_, i) => ({
    publicationId: `TEST-pub-${reseau}-${i}`,
    varianteId: `TEST-var-${reseau}-${i}`,
    code: `TEST-${String(i).padStart(2, "0")}-${reseau}`,
    titre: `TEST ${i}`,
    reseau,
    formatId: i % 2 ? "avocat" : "ecran-partage",
    structure: i < 10 ? "AV.S2" : "AV.S1",
    ouverture: i % 4 === 0 ? "situation-spectateur" : "question",
    objectifSujet: "notoriete",
    dureeSec: 40,
    date: new Date(Date.UTC(2026, 8, 1 + i + decalage)).toISOString(),
    resultats: { tauxAbandon3s: 20 + i, dureeMoyenneVueSec: 30 - i },
  }));
}

describe("rangs sur 20 vidéos (B.8 §3)", () => {
  const videos = vingtVideosTest();

  it("chaque vidéo reçoit un rang de 1 à 20 parmi les 20 ; la meilleure est 1re, la moins bonne 20e", () => {
    const r = rangsReseau(videos, "tiktok");
    expect(r).toHaveLength(20);
    expect(r.every((x) => x.sur === 20)).toBe(true);
    expect(r.map((x) => x.rang)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(r[0].video.code).toBe("TEST-00-tiktok");
    expect(r[19].video.code).toBe("TEST-19-tiktok");
    expect(r[0].position).toBe(1);
    expect(r[19].position).toBe(0);
    expect(r[0].parIndicateur.tenue3s).toEqual({ rang: 1, sur: 20 });
    expect(r[0].parIndicateur.duree).toEqual({ rang: 1, sur: 20 });
  });

  it("abandon à 3 s : plus bas = mieux (lu comme « restés après 3 s »)", () => {
    expect(valeurIndicateur({ tauxAbandon3s: 35 }, "tenue3s")).toBe(65);
    expect(valeurIndicateur({}, "tenue3s")).toBeUndefined();
  });

  it("fenêtre = les 20 DERNIÈRES vidéos du réseau : une 21e plus ancienne n'entre pas", () => {
    const ancienne: VideoMesuree = { ...videos[0], publicationId: "TEST-ancienne", varianteId: "TEST-v-anc", code: "TEST-ANC", date: "2026-01-01T00:00:00.000Z", resultats: { tauxAbandon3s: 1 } };
    const f = fenetreReseau([...videos, ancienne], "tiktok");
    expect(f).toHaveLength(FENETRE_RANGS);
    expect(f.some((v) => v.code === "TEST-ANC")).toBe(false);
  });

  it("chaque réseau est rangé à part ; une vidéo sans aucune mesure n'est pas rangée", () => {
    const li = vingtVideosTest("linkedin", 3).slice(0, 7);
    const vide: VideoMesuree = { ...videos[0], publicationId: "TEST-vide", varianteId: "TEST-v-vide", code: "TEST-VIDE", resultats: {} };
    const parReseau = rangsParReseau([...videos, ...li, vide]);
    expect(parReseau.tiktok).toHaveLength(20);
    expect(parReseau.linkedin).toHaveLength(7);
    expect(parReseau.linkedin!.every((x) => x.sur === 7)).toBe(true);
    expect(tousLesRangs([...videos, vide]).some((x) => x.video.code === "TEST-VIDE")).toBe(false);
  });

  it("ex aequo : même rang", () => {
    const deux = vingtVideosTest().slice(0, 2).map((v) => ({ ...v, resultats: { tauxAbandon3s: 30 } }));
    expect(rangsReseau(deux, "tiktok").map((x) => x.rang)).toEqual([1, 1]);
  });

  it("un indicateur absent pour une vidéo ne la pénalise pas (rang sur ses indicateurs mesurés)", () => {
    const v = vingtVideosTest().slice(0, 3);
    v[2] = { ...v[2], resultats: { tauxAbandon3s: 10 } }; // meilleure tenue, pas de durée
    const r = rangsReseau(v, "tiktok");
    expect(r[0].video.code).toBe("TEST-02-tiktok");
    expect(r[0].parIndicateur.duree).toBeUndefined();
  });
});

describe("regroupements par réseau, format, structure, type d'ouverture", () => {
  const rangs = tousLesRangs([...vingtVideosTest(), ...vingtVideosTest("instagram", 1).slice(0, 2)]);

  it("structure : AV.S2 (les 10 meilleures) passe devant AV.S1, position médiane", () => {
    const g = regrouper(rangs, "structure");
    expect(g[0].valeur).toBe("AV.S2");
    expect(g[0].nombre).toBeGreaterThanOrEqual(10);
    expect(g[0].positionMediane!).toBeGreaterThan(g[1].positionMediane!);
  });

  it("type d'ouverture et format : un groupe par valeur, avec son meilleur rang", () => {
    const o = regrouper(rangs, "ouverture");
    expect(o.map((x) => x.valeur).sort()).toEqual(["question", "situation-spectateur"]);
    expect(o.find((x) => x.valeur === "situation-spectateur")!.meilleur).toMatchObject({ rang: 1, sur: 20 });
    expect(regrouper(rangs, "format").map((x) => x.valeur).sort()).toEqual(["avocat", "ecran-partage"]);
  });

  it("réseau : moins de 3 vidéos = « trop tôt », sans position, en fin de liste", () => {
    const g = regrouper(rangs, "reseau");
    expect(g.at(-1)).toMatchObject({ valeur: "instagram", nombre: 2, tropTot: true, positionMediane: undefined });
    expect(g[0]).toMatchObject({ valeur: "tiktok", tropTot: false });
  });

  it("médiane", () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("avis « les 5 plus proches » (B.8 §8)", () => {
  const rangs = tousLesRangs([...vingtVideosTest(), ...vingtVideosTest("linkedin", 2).slice(0, 5)]);
  const cible = { reseau: "tiktok" as const, formatId: "avocat", structure: "AV.S2", ouverture: "question", objectifSujet: "notoriete" as const, dureeSec: 40, varianteId: "TEST-nouvelle" };

  it("5 vidéos, les plus semblables d'abord, avec LEUR rang mesuré et ce qu'elles ont en commun", () => {
    const a = cinqPlusProches(cible, rangs);
    expect(a.proches).toHaveLength(5);
    expect(a.comparees).toBe(25);
    for (const p of a.proches) {
      expect(p.reseau).toBe("tiktok");
      expect(p.enCommun).toEqual(expect.arrayContaining(["reseau", "format", "structure", "ouverture"]));
      expect(p.rang).toBeGreaterThanOrEqual(1);
      expect(p.sur).toBe(20);
    }
    const s = a.proches.map((p) => p.ressemblance);
    expect([...s].sort((x, y) => y - x)).toEqual(s);
  });

  it("la version elle-même n'est jamais sa propre voisine", () => {
    const soi = rangs[0].video;
    expect(cinqPlusProches({ ...soi }, rangs).proches.some((p) => p.code === soi.code)).toBe(false);
  });

  it("ressemblance : identique = 1, trait inconnu ignoré, durée proportionnelle", () => {
    expect(ressemblance(cible, cible)).toBe(1);
    expect(ressemblance(cible, { ...cible, structure: undefined })).toBe(1);
    expect(ressemblance({ reseau: "tiktok", formatId: "a", dureeSec: 30 }, { reseau: "tiktok", formatId: "a", dureeSec: 60 })).toBeCloseTo(5 / 6, 3);
    expect(ressemblance({ reseau: "tiktok", formatId: "a" }, { reseau: "linkedin", formatId: "b" })).toBe(0);
  });

  it("moins de 5 vidéos mesurées : on montre ce qu'il y a, sans compléter", () => {
    expect(cinqPlusProches(cible, rangs.slice(0, 2)).proches).toHaveLength(2);
    expect(cinqPlusProches(cible, []).proches).toEqual([]);
  });
});

describe("aucune prédiction", () => {
  it("l'avis ne contient que des vidéos passées et leurs rangs : aucun champ chiffré pour la vidéo à venir", () => {
    const a = cinqPlusProches({ reseau: "tiktok", formatId: "avocat" }, tousLesRangs(vingtVideosTest()));
    expect(Object.keys(a).sort()).toEqual(["comparees", "proches"]);
    for (const p of a.proches) expect(Object.keys(p).sort()).toEqual(["code", "date", "enCommun", "rang", "reseau", "ressemblance", "sur", "titre"]);
    expect(JSON.stringify(a)).not.toMatch(/predi|prevu|prevision|attendu|estim|probab|projection/i);
  });

  it("les rangs ne portent que des positions mesurées, jamais une valeur projetée", () => {
    const r = rangsReseau(vingtVideosTest(), "tiktok")[0];
    expect(Object.keys(r).sort()).toEqual(["parIndicateur", "position", "rang", "sur", "video"]);
  });
});

describe("liens suivis : visites et rendez-vous par code", () => {
  it("regroupe par code de version, ignore « (not set) », additionne les sources", () => {
    const m = visitesParCode([
      { campagne: "TEST-01", source: "tiktok", visites: 4, rendezVous: 1 },
      { campagne: "TEST-01", source: "ig", visites: 2, rendezVous: 0 },
      { campagne: "(not set)", visites: 50, rendezVous: 3 },
    ]);
    expect(m.get("TEST-01")).toEqual({ visites: 6, rendezVous: 1 });
    expect(m.has("(not set)")).toBe(false);
  });

  it("ordinal au féminin (la vidéo) : 1re, 2e", () => {
    expect(ordinal(1)).toBe("1re");
    expect(ordinal(12)).toBe("12e");
  });
});
