/**
 * Écoute : la transcription entend « 8 sec » pour « 8 séances » (28/10/2026). Le « 8 » du script devient « 8 sec » côté voix :
 * c'est un chiffre entendu hors script, jamais un blocage (les contrôles signalent). Le défaut reste signalé.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { comparerAuScript } from "@/moteurs/montage-image-video/ecoute";

const mots = (texte: string): MotHorodate[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

describe("chiffres inventés : « 8 sec » entendu pour « 8 séances »", () => {
  it("script « 8 séances », transcription « 8 sec » : le chiffre entendu hors script est signalé", () => {
    const c = comparerAuScript("Près de 8 séances par semaine.", mots("Près de 8 sec par semaine."));
    expect(c.chiffresInventes).toEqual(["8 sec"]);
  });
});
