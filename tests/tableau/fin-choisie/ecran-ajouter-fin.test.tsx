/** FIX-TABLEAU-FIN-CHOISIE-b : l'écran de création propose « Ajouter cette fin à mon texte », sur clic seulement. Calcul réel (`finAAjouterDe`) + lecture du .tsx. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { finAAjouterDe } from "@/components/formats/tableau-anime/NouvelleVideoTableau";
import { texteAvecFin } from "@/moteurs/montage-tableau/fin-choisie";

const src = readFileSync(join(process.cwd(), "src", "components", "formats", "tableau-anime", "NouvelleVideoTableau.tsx"), "utf8");
const DITE = "Écrivez PLAN en commentaire. Je vous l'envoie.";

describe("écran de création : ajouter la fin choisie (calcul réel)", () => {
  it("(b) fin-if-mot-envoi, mot « plan », texte sans la fin : la phrase DITE (mot en capitales) est proposée", () => {
    const r = finAAjouterDe("fin-if-mot-envoi", "Voilà le texte.", "plan");
    expect(r?.phrase).toContain("PLAN");
    expect(r?.phrase).not.toContain("{MOT}");
    expect(texteAvecFin("Voilà le texte.", r!.phrase!)).toBe(`Voilà le texte. ${r!.phrase}`);
  });
  it("(b) texte qui contient déjà la fin : rien à proposer", () => {
    const r = finAAjouterDe("fin-if-mot-envoi", "Voilà. " + finAAjouterDe("fin-if-mot-envoi", "x", "plan")!.phrase, "plan");
    expect(r).toBeNull();
    expect(finAAjouterDe("fin-if-mot-envoi", "Voilà. Écrivez PLAN en commentaire", "plan")).toBeNull();
  });
  it("(b) fin « Aucune » ou texte vide : rien", () => {
    expect(finAAjouterDe("aucune", "Voilà le texte.", "plan")).toBeNull();
    expect(finAAjouterDe(undefined, "Voilà le texte.", "plan")).toBeNull();
    expect(finAAjouterDe("fin-if-mot-envoi", "  ", "plan")).toBeNull();
  });
  it("(b) mot vide : phrase absente (bouton désactivé)", () => {
    expect(finAAjouterDe("fin-if-mot-envoi", "Voilà le texte.", "  ")).toEqual({ phrase: null });
  });
  it("la phrase ajoutée est la phrase dite de la fiche (cas a)", () => {
    expect(DITE).toContain("Écrivez PLAN");
  });
});

describe("écran de création : lecture du .tsx", () => {
  it("l'avertissement et le bouton existent, sous le choix de la fin", () => {
    expect(src).toContain("Cette fin n'est pas dans votre texte : elle ne sera ni dite ni écrite.");
    expect(src).toContain("Ajouter cette fin à mon texte");
    expect(src.indexOf("valeur={saisie.finId}")).toBeLessThan(src.indexOf("Ajouter cette fin à mon texte"));
    expect(src).toContain("disabled={!finAAjouter.phrase}");
    expect(src).toContain("Écrivez d'abord le mot à commenter.");
  });
  it("rien n'est ajouté sans clic : le texte ne change que dans le onClick du bouton", () => {
    expect(src.split("changer({ texte: texteAvecFin(").length - 1).toBe(1);
    expect(src).toMatch(/onClick=\{\(\) => finAAjouter\.phrase && changer\(\{ texte: texteAvecFin\(saisie\.texte, finAAjouter\.phrase\) \}\)\}/);
  });
});
