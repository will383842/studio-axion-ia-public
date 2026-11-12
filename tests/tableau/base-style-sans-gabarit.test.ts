/** GV-ST-08e : le tableau animé lit la base du style de la Bibliothèque, pas un gabarit déjà résolu. */
import { describe, expect, it } from "vitest";
import type { StyleResolu, ValeurStyleSousTitres } from "../../src/domaine/types";
import { sousTitresTableau } from "../../src/moteurs/montage-tableau/sous-titres-tableau";
import { caleeEcritureALHeure } from "./reference-3/fiches";

const { fiche } = caleeEcritureALHeure();
const choix = (valeur: object): StyleResolu<ValeurStyleSousTitres> => ({ id: "st-test", nom: "Test", valeur: { type: "style-sous-titres", ...valeur } as ValeurStyleSousTitres });
const axionPop = { animation: "pop", casse: "majuscules", position: "centre" };

describe("GV-ST-08e : base du tableau animé", () => {
  it("style sans gabarit (« Axion pop ») : base karaoké, gabarit toujours impact", () => {
    const st = sousTitresTableau({ fiche, choisi: choix(axionPop), positionPct: 80 });
    expect(st.base).toBe("karaoke");
    expect(st.gabarit).toBe("impact");
  });
  it("style avec gabarit « impact » écrit : base impact", () => {
    const st = sousTitresTableau({ fiche, choisi: choix({ ...axionPop, gabarit: "impact" }), positionPct: 80 });
    expect(st.base).toBe("impact");
  });
});
