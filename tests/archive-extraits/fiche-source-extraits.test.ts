import { describe, expect, it } from "vitest";
import { valeurParDefaut } from "@/components/bibliotheque/outils";
import { PLAGES_MAX_PAR_FICHE, TAILLE_MAX_FICHE_CARACTERES, type FicheSourceExtraits, type PlageExtrait } from "@/domaine/archive-extraits";
import type { TypeElement } from "@/domaine/types";

function plagePleine(i: number): PlageExtrait {
  return {
    id: `plage-${String(i).padStart(3, "0")}-xxxxxxxx`,
    debutSec: i * 10,
    finSec: i * 10 + 9.5,
    texte: "Une phrase d'extrait assez longue pour remplir la plage, avec ses mots, ses virgules et sa ponctuation finale.",
    motsCles: ["avocat", "droit", "expatrié", "contrat", "visa"],
    avecVisage: true,
    texteIncruste: true,
    etat: "a_verifier",
    raisonExclusion: "Raison d'exclusion détaillée, écrite en une phrase de longueur moyenne pour le test.",
  };
}

describe("fiche source-extraits (types seuls)", () => {
  it("valeurParDefaut(\"source-extraits\") lève : une fiche d'extraits ne se crée jamais à la main", () => {
    expect(() => valeurParDefaut("source-extraits")).toThrow();
  });

  it("une fiche de 30 plages pleines, sérialisée, tient sous la taille maximale", () => {
    expect(PLAGES_MAX_PAR_FICHE).toBe(30);
    expect(TAILLE_MAX_FICHE_CARACTERES).toBe(30000);
    const fiche: FicheSourceExtraits = {
      videoId: "video-0123456789abcdef",
      versionId: "version-0123456789abcdef",
      sortieId: "sortie-0123456789abcdef",
      ratio: "9:16",
      licence: { type: "propriete", usageCommercial: true, reseaux: [] },
      famille: ["video-a", "video-b", "video-c"],
      plages: Array.from({ length: PLAGES_MAX_PAR_FICHE }, (_, i) => plagePleine(i)),
      rangee: true,
      sourcePreferee: true,
    };
    expect(fiche.plages).toHaveLength(30);
    expect(JSON.stringify(fiche).length).toBeLessThan(TAILLE_MAX_FICHE_CARACTERES);
  });

  it("n'a ni mémoire d'usage ni découpes (P-3)", () => {
    const p = plagePleine(0) as unknown as Record<string, unknown>;
    for (const cle of ["derniereVideoId", "dernierRangVideo", "utilisations", "decoupes"]) expect(cle in p).toBe(false);
  });

  it("éteint = identique : valeurParDefaut est stable pour tous les autres types", () => {
    const types: Exclude<TypeElement, "source-extraits">[] = [
      "couleurs", "logo", "police", "lut", "style-sous-titres", "illustration-image", "illustration-video", "musique",
      "bruitage", "habillage", "style-montage", "profil-son", "decor", "accessoire", "fond",
    ];
    for (const t of types) {
      const a = valeurParDefaut(t);
      expect(a.type).toBe(t);
      expect(valeurParDefaut(t)).toEqual(a);
    }
  });
});
