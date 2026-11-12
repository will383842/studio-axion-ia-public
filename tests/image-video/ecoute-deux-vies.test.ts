/**
 * Écoute : la transcription entend « deux vies » pour « devis » (27/10/2026) : ce « deux » est un son pris pour un mot de nombre,
 * pas un chiffre inventé. Un vrai nombre absent du script reste refusé.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { comparerAuScript } from "@/moteurs/montage-image-video/ecoute";

const mots = (texte: string): MotHorodate[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

describe("chiffres inventés : « deux vies » entendu pour « devis »", () => {
  it("script « devis », transcription « deux vies » : aucun chiffre inventé", () => {
    const c = comparerAuScript("Le soir, vous rédigez encore vos devis à la main.", mots("Le soir, vous rédigez encore vos deux vies à la main."));
    expect(c.chiffresInventes).toEqual([]);
  });

  it("un vrai « deux » ajouté à la voix, sans rapport avec un mot du script : refusé comme avant", () => {
    const c = comparerAuScript("Le soir, vous rédigez encore vos devis à la main.", mots("Le soir, vous rédigez encore vos devis à la main, deux fois."));
    expect(c.chiffresInventes).toEqual(["2"]);
  });

  it("un « 2 » écrit en chiffre à la place d'un mot du script : refusé comme avant", () => {
    const c = comparerAuScript("Le soir, vous rédigez encore vos devis à la main.", mots("Le soir, vous rédigez encore vos 2 vies à la main."));
    expect(c.chiffresInventes).toEqual(["2"]);
  });
});
