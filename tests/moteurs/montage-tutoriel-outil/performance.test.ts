/**
 * T-EXT-48a · lecture pure de la performance du tutoriel : fonctions pures, aucun service, aucun appel payant (0 €).
 */
import { describe, expect, it } from "vitest";
import { estMesuree, tousLesRangs, type ResultatsVideo, type VideoMesuree } from "@/domaine/mesures-rangs";
import { readFileSync } from "node:fs";
import { GABARITS_TUTORIEL, lecturePerformance, relevePourStratege, traitsTutoriel } from "@/moteurs/montage-tutoriel-outil/performance";

let n = 0;
function video(gabarit: string | undefined, resultats: ResultatsVideo, o: { formatId?: string; devient?: string } = {}): VideoMesuree {
  n++;
  const t = o.formatId
    ? { reseau: "instagram" as const, formatId: o.formatId, structure: gabarit }
    : traitsTutoriel({ reseau: "instagram", dureeSec: 45, gabarit: gabarit as never, devient: o.devient ?? "plus-sereine", cas: 1 });
  return { ...t, publicationId: `p${n}`, varianteId: `v${n}`, code: `c${n}`, titre: `Exemple ${n}`, date: `2026-11-${String(10 + (n % 15)).padStart(2, "0")}T08:00:00.000Z`, resultats };
}
const bons = (k: number): ResultatsVideo => ({ vues: 100 + k * 10, tauxAbandon3s: 40 - k });

describe("traitsTutoriel", () => {
  it("lit gabarit, ouverture et cas ; ne devine rien quand ils manquent", () => {
    expect(traitsTutoriel({ reseau: "linkedin", dureeSec: 48, gabarit: "G-Decision", devient: "plus-solide", cas: 2 })).toEqual({
      reseau: "linkedin", formatId: "tutoriel-outil", structure: "G-Decision", ouverture: "plus-solide", pilier: "cas-2", dureeSec: 48,
    });
    const nu = traitsTutoriel({ reseau: "linkedin" });
    expect(nu).toEqual({ reseau: "linkedin", formatId: "tutoriel-outil" });
    expect("structure" in nu || "ouverture" in nu).toBe(false);
  });
});

describe("lecturePerformance", () => {
  const lire = (vs: VideoMesuree[]) => lecturePerformance(tousLesRangs(vs));

  it("2 vidéos G-Flux + 4 G-Décision : G-Flux « trop tôt », G-Décision lisible", () => {
    const l = lire([...[0, 1].map((k) => video("G-Flux", bons(k))), ...[2, 3, 4, 5].map((k) => video("G-Decision", bons(k)))]);
    expect(l.nombre).toBe(6);
    const flux = l.parGabarit.find((g) => g.valeur === "G-Flux")!;
    const dec = l.parGabarit.find((g) => g.valeur === "G-Decision")!;
    expect(flux).toMatchObject({ nombre: 2, tropTot: true });
    expect(flux.positionMediane).toBeUndefined();
    expect(dec).toMatchObject({ nombre: 4, tropTot: false });
    expect(typeof dec.positionMediane).toBe("number");
  });

  it("ignore les vidéos d'autres formats", () => {
    const l = lire([video("G-Decision", bons(1)), video("structure-x", bons(2), { formatId: "avocat-v4" }), video("structure-x", bons(3), { formatId: "avocat-v4" })]);
    expect(l.nombre).toBe(1);
    expect(l.parGabarit.map((g) => g.valeur)).toEqual(["G-Decision"]);
  });

  it("une vidéo sans résultats n'entre pas dans les rangs ; sans gabarit elle est comptée mais non classée", () => {
    const sans = video("G-Decision", {});
    expect(estMesuree(sans)).toBe(false);
    expect(lire([sans]).nombre).toBe(0);
    const l = lire([video(undefined, bons(1)), video("G-Flux", bons(2))]);
    expect(l.nombre).toBe(2);
    expect(l.parGabarit.map((g) => g.valeur)).toEqual(["G-Flux"]);
  });
});

describe("relevePourStratege", () => {
  const lecture = lecturePerformance(
    tousLesRangs([
      ...[0, 1].map((k) => video("G-Flux", bons(k), { devient: "prete-a-grandir" })),
      ...[2, 3, 4, 5].map((k) => video("G-Decision", bons(k), { devient: "plus-sereine" })),
      ...[6, 7, 8].map((k) => video("G-Journee", bons(k), { devient: "plus-solide" })),
      ...[9, 10, 11].map((k) => video("G-Reponse", bons(k), { devient: "plus-maitre-de-ses-decisions" })),
    ]),
  );

  it("5 lignes au plus, factuelles, sans montant, sans promesse, sans futur ni pourcentage", () => {
    const r = relevePourStratege(lecture);
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(5);
    for (const l of r) {
      expect(l).not.toMatch(/€|euro|garanti|%/i);
      expect(l).not.toMatch(/\b(va|vont|fera|feront|sera|seront)\b/i);
    }
    expect(r.some((l) => /G-Flux : trop tôt pour dire \(2 vidéos\)/.test(l))).toBe(true);
    expect(r.some((l) => /G-Décision : 4 vidéos, position médiane (1er|2e|3e) tiers de leur réseau/.test(l))).toBe(true);
  });

  it("même entrée, même sortie ; aucune ligne si rien n'est lisible", () => {
    expect(relevePourStratege(lecture)).toEqual(relevePourStratege(lecture));
    expect(relevePourStratege({ parGabarit: [], parOuverture: [], nombre: 0 })).toEqual([]);
  });
});

describe("T-EXT-48a · aucun appelant de equipe/chef-de-projet", () => {
  it("les deux fichiers de la PR n'importent pas l'équipe ; la liste des gabarits est locale et fermée", () => {
    for (const f of ["src/moteurs/montage-tutoriel-outil/performance.ts", "src/services/tutoriel-performance.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/equipe\/chef-de-projet/);
    }
    expect([...GABARITS_TUTORIEL]).toEqual(["G-Journee", "G-Decision", "G-Reponse", "G-Flux"]);
  });
});
