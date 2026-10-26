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
  const q05 = (f: FicheImage) => verifierScript(normaliserNombresUnite(f, { carte }), { carte }).manquements.filter((m) => m.regle === "Q05").map((m) => m.message);

  it("règle Q05 : 45 jours accepté, 46 jours refusé, 25 personnes accepté", () => {
    expect(q05(avec("Facturer en douze jours, au lieu de 45 jours.")).filter((m) => m.startsWith("Écran e01"))).toEqual([]);
    expect(q05(avec("Une PME de 25 personnes.")).filter((m) => m.startsWith("Écran e01"))).toEqual([]);
    expect(q05(avec("Facturer en douze jours, au lieu de 46 jours.")).filter((m) => m.startsWith("Écran e01"))).toHaveLength(1);
    // sans la normalisation, le refus de production est bien reproduit
    const brut = verifierScript(avec("Facturer en douze jours, au lieu de 45 jours."), { carte }).manquements.map((m) => m.message);
    expect(brut.some((m) => m.includes("45 jour"))).toBe(true);
  });

  it("le rang des mots surlignés est recalé", () => {
    const f = avec("Avant 45 jours encore payer");
    f.ecrans[0]!.surMot = [{ mot: 3, action: "apparait" }];
    expect(normaliserNombresUnite(f, { carte }).ecrans[0]!.surMot[0]!.mot).toBe(2);
  });

  it("jugerFicheIV renvoie la fiche normalisée", () => {
    const r = jugerFicheIV(avec("Avant, 45 jours."), { carte });
    if (r.ok) expect(r.fiche.ecrans[0]!.texteDit).toContain("Avant, 45.");
    else expect(r.refus.filter((m) => m.includes("Q05") && m.includes("e01"))).toEqual([]);
  });

  const refusE01 = (c: CarteImage, dit: string) => verifierScript(normaliserNombresUnite(avec(dit), { carte: c }), { carte: c }).manquements.filter((m) => m.regle === "Q05" && m.message.startsWith("Écran e01"));

  it("un nombre seul n'efface l'unité que si le titre porte une autre unité de temps", () => {
    const clients: CarteImage = { ...carteD, titre: "45 clients relancés chaque mois", sousTitre: "Une PME de 25 personnes." };
    expect(sansUniteAbsenteDeLImage("Relances en 45 jours.", clients).texte).toBe("Relances en 45 jours.");
    expect(refusE01(clients, "Relances en 45 jours.")).toHaveLength(1);
    const heures: CarteImage = { ...carteD, titre: "45 heures gagnées", sousTitre: "Une PME de 45 salariés." };
    expect(sansUniteAbsenteDeLImage("En 45 jours tout change.", heures).texte).toBe("En 45 jours tout change.");
  });

  it("le mot retiré est celui de l'unité du chiffre", () => {
    expect(sansUniteAbsenteDeLImage("Avant, 12 jours au lieu de 45 heures.", carte).texte).toBe("Avant, 12 jours au lieu de 45 heures.");
    expect(refusE01(carte, "Facturer en 12 jours au lieu de 45 heures.")).toHaveLength(1);
    const minutes: CarteImage = { ...carteD, titre: "Facturer en 12 jours au lieu de 45", sousTitre: "" };
    expect(refusE01(minutes, "Facturer en 45 minutes au lieu de 12 jours.").length).toBeGreaterThan(0);
    expect(sansUniteAbsenteDeLImage("45 minutes au lieu de 12 jours", minutes).texte).toBe("45 minutes au lieu de 12 jours");
  });

  it("le cas exact « 12 jours au lieu de 45 jours » reste accepté, 46 jours refusé", () => {
    expect(sansUniteAbsenteDeLImage("Facturer en 12 jours au lieu de 45 jours.", carte).texte).toBe("Facturer en 12 jours au lieu de 45.");
    expect(refusE01(carte, "Facturer en 12 jours au lieu de 45 jours.")).toEqual([]);
    expect(refusE01(carte, "Facturer en 12 jours au lieu de 46 jours.")).toHaveLength(1);
  });

  it("un « 45 jours » ajouté par Will reste tel quel", () => {
    expect(sansUniteAbsenteDeLImage("Avant, 45 jours.", carte, ["45 jours"]).texte).toBe("Avant, 45 jours.");
    const f = normaliserNombresUnite(avec("Avant, 45 jours."), { carte, ajoutsWill: ["45 jours"] });
    expect(f.ecrans[0]!.texteDit).toBe("Avant, 45 jours.");
  });
});
