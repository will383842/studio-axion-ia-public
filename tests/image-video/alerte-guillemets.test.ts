/**
 * Deux défauts de texte vus à la relecture du 24/10/2026 :
 *  1. Alerte : un émoji DANS des guillemets laissait une espace collée au guillemet (« “ Intervention requise” »).
 *  2. Les liens de la carte ont `part: null` (pas `undefined`) : la chaîne « null % » ne doit jamais être posée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, sourceEtMessageAlerte } from "@/moteurs/montage-image-video/mise-en-scene";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";

describe("sourceEtMessageAlerte · émoji entre guillemets", () => {
  it("retire l'émoji sans laisser d'espace contre le guillemet", () => {
    const r = sourceEtMessageAlerte({ libelle: "Alerte Telegram:", detail: "“\u{1F514} Intervention requise”" });
    expect(r.message).toBe("“Intervention requise”");
    expect(r.messageDit).toBe("“Intervention requise”");
    expect(r.source).toBe("Telegram");
  });
  it("garde les espaces françaises des « » et les espaces normales", () => {
    const r = sourceEtMessageAlerte({ libelle: "Alerte X", detail: "« \u{1F514} Bonjour tout le monde »" });
    expect(r.message).toBe("« Bonjour tout le monde »");
  });
  it("garde une espace insécable contre un « » quand l'émoji est retiré", () => {
    const r = sourceEtMessageAlerte({ libelle: "Alerte X", detail: "« \u{1F514} Bonjour»" });
    expect(r.message).toBe("« Bonjour»");
  });
});

describe("parts de liens à null", () => {
  const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
  const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
  for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
    it(`carte ${nom} : aucune chaîne « null % »`, () => {
      const carte0: CarteImage = JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
      const carte = { ...carte0, liens: carte0.liens.map((l) => ({ ...l, part: null })) } as CarteImage;
      const fiche = FICHES_SIMULEES[IMAGES[nom]];
      const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
      const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: [], variete: RECETTE_REFERENCE_IV, format: "9:16" });
      expect(JSON.stringify(r.ligne)).not.toMatch(/null\s*\|?\s*%/);
    });
  }
});
