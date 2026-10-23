/** Fiche « tableau animé » (TB-10) : inscrite, invisible, structures en données. */
import { describe, expect, it } from "vitest";
import { formatGenerateur, listerFormats, listerFormatsActifs, trouverFormat } from "../index";
import { codeDuFormat } from "../registre-codes";
import { formatTableauAnime, STRUCTURES_TABLEAU_ANIME } from "./index";

describe("format tableau-anime", () => {
  it("est inscrit avec le code TB et visible des menus (actif)", () => {
    expect(trouverFormat("tableau-anime")).toBe(formatTableauAnime);
    expect(codeDuFormat("tableau-anime")).toBe("TB");
    expect(formatTableauAnime.codeClassement).toBe("TB");
    expect(formatTableauAnime.statut).toBe("actif");
    expect(listerFormats().some((f) => f.id === "tableau-anime")).toBe(true);
    expect(listerFormatsActifs().some((f) => f.id === "tableau-anime")).toBe(true);
    expect(listerFormats({ inclureMasques: true }).some((f) => f.id === "tableau-anime")).toBe(true);
  });

  it("déclare ses différences sans toucher à la famille motion", () => {
    const f = formatGenerateur("tableau-anime");
    expect(f.recette.declinaison).toBe("aucune");
    expect(f.recette.partiesDeclinaison).toEqual({ ouverture: [], fin: [] });
    expect(f.recette.blocs.map((b) => b.id)).not.toContain("appel");
    expect(f.recette.blocs.map((b) => b.id)).not.toContain("boucle");
    expect(formatTableauAnime.moteur).toBe("montage-tableau");
    expect(formatTableauAnime.ratios).toEqual(["9:16"]);
    expect(formatTableauAnime.sansPrix).toBe(true);
    expect(formatTableauAnime.capacitesRequises).not.toContain("visage");
  });

  it("déclare les quatre structures avec la preuve exigée, au vouvoiement, sans numéro d'épisode", () => {
    expect(f4().map((s) => s.id)).toEqual(["TB.erreur-corrigee", "TB.avant-apres", "TB.demonstration", "TB.question-abonne"]);
    for (const s of STRUCTURES_TABLEAU_ANIME) {
      expect(s.exigences).toEqual({ appui: ["preuve"] });
      expect(s.enchainement.length).toBeGreaterThanOrEqual(4);
    }
    const textes = JSON.stringify([formatTableauAnime.recetteScript, formatTableauAnime.description, formatTableauAnime.accroche]);
    expect(textes).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
    expect(textes).not.toMatch(/épisode|n°\s*\d|#\d/i);
  });
});

const f4 = () => formatTableauAnime.recetteScript.structures ?? [];
