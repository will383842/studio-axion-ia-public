/**
 * E2E-1 n° 10 (MINEUR, 03/10) — plus de reste du format avocat dans le commun : valeurs par défaut NEUTRES dans la brique
 * composition (l'avocat garde les siennes dans SA recette), briques simulées sans la vidéo d'essai de l'avocat,
 * empreinte de l'audio maître dans une brique commune (le service de fabrication ne lit plus le moteur avocat).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT, REDUCTION_LARGE_PAR_DEFAUT } from "@/briques/composition";
import { briqueComposition, briqueVisage } from "@/briques";
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import { empreinteAudioMaitre as ancienChemin } from "@/moteurs/montage-avocat/empreinte";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";

describe("E2E-1 n° 10 · briques communes neutres", () => {
  it("défauts neutres ; la recette avocat garde 85 % / 72 %, bande 52 %, montant 118 px, objet 35 %", () => {
    expect(REDUCTION_LARGE_PAR_DEFAUT).toEqual({ "9:16": 1, "4:5": 1, "1:1": 1 });
    expect(GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT.montantTaillePx).not.toBe(118);
    expect(RECETTE_COMPOSITION_AVOCAT.reductionLarge).toEqual({ "9:16": 1, "4:5": 0.85, "1:1": 0.72 });
    expect(RECETTE_COMPOSITION_AVOCAT.incrustations).toEqual({ hautPct: 52, montantTaillePx: 118, objetLargeurPct: 35, dureeMinSec: 0.4 });
  });

  it("briques simulées : aucun fichier propre à l'avocat", async () => {
    const v = await briqueVisage.executer({} as never);
    const c = await briqueComposition.executer({} as never);
    expect(JSON.stringify([v, c])).not.toMatch(/avocat/);
  });

  it("empreinte de l'audio maître : brique commune, ancien chemin identique ; le service ne lit plus le moteur avocat", () => {
    expect(ancienChemin).toBe(empreinteAudioMaitre);
    const service = readFileSync(new URL("../src/services/fabrication.ts", import.meta.url), "utf8");
    expect(service).not.toMatch(/@\/moteurs\/montage-avocat/);
  });
});
