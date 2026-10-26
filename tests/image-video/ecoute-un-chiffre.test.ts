/**
 * Écoute : la voix écrite « 1 » pour le mot français « un » / « une » n'est pas un chiffre inventé ;
 * tout autre nombre absent du script reste refusé.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { comparerAuScript } from "@/moteurs/montage-image-video/ecoute";

const mots = (texte: string): MotHorodate[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

describe("chiffres inventés : « 1 » dit pour « un » / « une »", () => {
  it("transcription « 1 » et script avec « un » : aucun défaut", () => {
    const c = comparerAuScript("Je vous montre un seul outil pour gagner du temps.", mots("Je vous montre 1 seul outil pour gagner du temps."));
    expect(c.chiffresInventes).toEqual([]);
  });

  it("transcription « 1 » et script avec « une » : aucun défaut", () => {
    const c = comparerAuScript("Voici une idée simple pour vos clients.", mots("Voici 1 idée simple pour vos clients."));
    expect(c.chiffresInventes).toEqual([]);
  });

  it("transcription « 1 » et script sans un/une/1 : défaut conservé", () => {
    const c = comparerAuScript("Voici le seul outil pour vos clients.", mots("Voici le 1 outil pour vos clients."));
    expect(c.chiffresInventes).toEqual(["1"]);
  });

  it("transcription « 12 » absent du script : défaut conservé, même si le script a un « un »", () => {
    const c = comparerAuScript("Je vous montre un outil pour vos clients.", mots("Je vous montre 12 outils pour vos clients."));
    expect(c.chiffresInventes).toEqual(["12"]);
  });
});
