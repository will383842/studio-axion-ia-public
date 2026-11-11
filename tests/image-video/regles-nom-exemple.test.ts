/**
 * 11/11/2026 : « Un », « Par », « Le » (mots outils, début de phrase) ne sont pas des noms d'exemple (37 refus à tort).
 * Un vrai prénom d'exemple reste refusé sans « exemple » à l'écran.
 */
import { describe, expect, it } from "vitest";
import { regleInterdits } from "@/moteurs/montage-image-video/regles";

const ctx = (libelle: string) => ({ carte: { noeuds: [{ id: "n1", libelle, exemple: true }] }, interdits: [] }) as never;
const fiche = (texteDit: string, textesEcran: string[]) =>
  ({
    ecrans: [{ id: "e01", partie: "explication", texteDit, textesEcran }],
    accroches: [],
    questionCommentaire: { texteDit: "Votre avis ?", texteEcran: "Votre avis ?" },
  }) as never;
const nomsExemple = (r: { regle: string; message: string }[]) => r.filter((m) => m.regle === "Q08" && /nom d'exemple/.test(m.message));

describe("regleInterdits · nom d'exemple", () => {
  it("« Relance envoyée. Un client paie. » + écran « Un message part » : aucun Q08", () => {
    expect(nomsExemple(regleInterdits(fiche("Un message part.", ["Un message part"]), ctx("Relance envoyée. Un client paie."), []))).toHaveLength(0);
  });
  it("« Par » ou « Le » en début de phrase ne sont pas des noms d'exemple", () => {
    expect(nomsExemple(regleInterdits(fiche("Par ici.", ["Le tri est fait"]), ctx("Tri fait. Par la suite. Le client paie."), []))).toHaveLength(0);
  });
  it("« Martin paie » sans « exemple » : toujours Q08", () => {
    expect(nomsExemple(regleInterdits(fiche("Martin paie.", ["Martin paie"]), ctx("Facture de Martin payée"), [])).length).toBeGreaterThan(0);
  });
});
