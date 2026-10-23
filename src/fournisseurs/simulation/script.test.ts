import { describe, expect, it } from "vitest";
import { formatAvocat } from "@/formats/avocat";
import { formatPodcast } from "@/formats/podcast";
import { fournisseurScriptSimulation, raccourcir, scriptSimuleSync, titreCourt } from "./script";

describe("générateur de scripts simulé", () => {
  it.each([30, 45, 60, 90])("format à durée choisie : le texte suit la durée choisie (%i s), note Durée ≥ 80", (duree) => {
    for (const variante of [0, 1, 2]) {
      const s = scriptSimuleSync(formatPodcast.recetteScript, "Peut-on refuser une mutation ?", variante, duree);
      expect(s.notes.criteres.duree).toBeGreaterThanOrEqual(80);
    }
  });

  it("format avocat (durée depuis le texte) : la durée est notée par zones — vert 25-40 s, orange 40-50 s, faible au-delà (B.9 bis)", () => {
    const note = (duree: number) => scriptSimuleSync(formatAvocat.recetteScript, "Peut-on refuser une mutation ?", 0, duree).notes.criteres.duree;
    expect(note(30)).toBe(100);
    expect(note(90)).toBe(40);
  });

  it("« Plus court » retire une phrase entière, jamais un bout de phrase", async () => {
    expect(raccourcir("Vérif bureau B : congés payés et arrêt maladie ? On me pose la question chaque semaine.")).toBe(
      "Vérif bureau B : congés payés et arrêt maladie ?",
    );
    const bloc = { id: "b", blocRecette: "explication", segments: [{ id: "1", texte: "Un." }, { id: "2", texte: "Deux." }] };
    const court = await fournisseurScriptSimulation.ameliorerBloc(bloc, "plus-court", formatAvocat.recetteScript);
    expect(court.segments.map((s) => s.texte)).toEqual(["Un."]);
  });

  it("le titre à l'écran ne finit jamais sur un petit mot ni ne compte la ponctuation", () => {
    expect(titreCourt("Vérif mobile : peut-on refuser une mutation ?")).toBe("VÉRIF MOBILE : PEUT-ON REFUSER UNE MUTATION" + String.fromCharCode(0xa0) + "?");
    expect(titreCourt("Atelier mobile : arrêt maladie pendant les congés payés")).toBe("ATELIER MOBILE : ARRÊT MALADIE");
  });
});
