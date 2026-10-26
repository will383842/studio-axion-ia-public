/** Nombre écrit seul sur l'image, dit avec une unité dans le script : l'unité est retirée, jamais un chiffre changé. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { jugerFicheIV, normaliserNombresUnite, sansUniteAbsenteDeLImage } from "@/moteurs/montage-image-video/ecriture";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { verifierScript } from "@/moteurs/montage-image-video/regles";
import type { FicheImage } from "@/domaine/image-video/fiche";

const carteD = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/D.json"), "utf8")) as CarteImage;
const carte: CarteImage = { ...carteD, titre: "Facturer en 12 jours au lieu de 45", sousTitre: "Une PME de 25 personnes automatise ses relances." };

describe("nombre sans unité sur l'image", () => {
  it("45 jours / 45 jour → 45 ; 12 jours reste intact", () => {
    expect(sansUniteAbsenteDeLImage("Avant, 45 jours.", carte)).toEqual({ texte: "Avant, 45.", retires: [2] });
    expect(sansUniteAbsenteDeLImage("Avant, 45 jour", carte).texte).toBe("Avant, 45");
    expect(sansUniteAbsenteDeLImage("Avant, quarante-cinq jours pour être payé", carte).texte).toBe("Avant, quarante-cinq pour être payé");
    expect(sansUniteAbsenteDeLImage("Douze jours au lieu de 45 jours.", carte).texte).toBe("Douze jours au lieu de 45.");
  });
  it("un chiffre absent de l'image n'est jamais touché (46 jours reste)", () => {
    expect(sansUniteAbsenteDeLImage("Avant, 46 jours.", carte)).toEqual({ texte: "Avant, 46 jours.", retires: [] });
    expect(sansUniteAbsenteDeLImage("25 personnes", carte).texte).toBe("25 personnes");
  });

  const base = structuredClone(FICHES_SIMULEES["essai-d"]!) as FicheImage;
  const avec = (dit: string) => {
    const f = structuredClone(base);
    f.ecrans[0]!.texteDit = dit;
    f.ecrans[0]!.surMot = [{ mot: 0, action: "apparait" }];
    return f;
  };
  const q05 = (f: FicheImage) => verifierScript(normaliserNombresUnite(f, carte), { carte }).manquements.filter((m) => m.regle === "Q05").map((m) => m.message);
  const ecran1 = "Écran e01 : « 45 jour » n'est pas sur l'image.";

  it("règle Q05 : 45 jours accepté, 46 jours refusé, 25 personnes accepté", () => {
    expect(q05(avec("Facturer en douze jours, au lieu de 45 jours.")).filter((m) => m.startsWith("Écran e01"))).toEqual([]);
    expect(q05(avec("Une PME de 25 personnes.")).filter((m) => m.startsWith("Écran e01"))).toEqual([]);
    expect(q05(avec("Facturer en douze jours, au lieu de 46 jours.")).filter((m) => m.startsWith("Écran e01"))).toHaveLength(1);
    // sans la normalisation, le refus de production est bien reproduit
    const brut = verifierScript(avec("Facturer en douze jours, au lieu de 45 jours."), { carte }).manquements.map((m) => m.message);
    expect(brut.some((m) => m.includes("45 jour"))).toBe(true);
    expect(ecran1).toContain("45 jour");
  });

  it("le rang des mots surlignés est recalé", () => {
    const f = avec("Avant 45 jours encore payer");
    f.ecrans[0]!.surMot = [{ mot: 3, action: "apparait" }];
    expect(normaliserNombresUnite(f, carte).ecrans[0]!.surMot[0]!.mot).toBe(2);
  });

  it("jugerFicheIV renvoie la fiche normalisée", () => {
    const r = jugerFicheIV(avec("Avant, 45 jours."), { carte });
    const dit = r.ok ? r.fiche.ecrans[0]!.texteDit : (r.refus.join("|"));
    expect(dit.includes("45 jours") || dit.includes("45 jour")).toBe(false);
  });
});
