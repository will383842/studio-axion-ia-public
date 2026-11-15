import { describe, expect, it } from "vitest";
import { CODES_ERREUR_VISUELS } from "@/domaine/visuels/contrats";
import { phraseDuCode } from "@/visuels/services/production";

const GENERIQUE = "Un souci est survenu. Réessayez dans un instant.";

describe("phrases des codes d'erreur des carrousels", () => {
  it.each(CODES_ERREUR_VISUELS.filter((c) => c !== ("INCONNUE" as string)))("%s a sa propre phrase", (code) => {
    const phrase = phraseDuCode(code);
    expect(phrase).toBeTruthy();
    expect(phrase).not.toBe(GENERIQUE);
  });
  it("les codes des réseaux et de la programmation existent", () => {
    for (const c of ["RESEAUX_MISE_EN_PAGE", "RESEAUX_TROP_DE_PAGES", "RESEAUX_INDISPONIBLE", "RESEAUX_ECHEC", "PROGRAMMER_SANS_RESEAU", "PROGRAMMER_DATE", "PROGRAMMER_REFUSE"]) expect(CODES_ERREUR_VISUELS).toContain(c);
  });
});
