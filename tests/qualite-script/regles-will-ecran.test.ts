/**
 * SOCLE QUALITÉ · RÈGLES DE WILL 1-2 (audit du 17/10), toujours en OBSERVATION : « faites-le vous-même », annonce
 * d'outil, interdits permanents et certification Certifexemple sont relevés par le socle, et leurs pastilles « info »
 * arrivent sur l'écran commun « Relire le script » (Écrire et tableau). Rien ne devient bloquant.
 */
import { describe, expect, it } from "vitest";
import { evaluerQualite } from "@/domaine/qualite-script";
import { depuisLignesEcrire } from "@/domaine/qualite-script/adaptateurs/ecrire";
import { depuisLignesTableau } from "@/domaine/qualite-script/adaptateurs/tableau";
import { RECETTE_ECRIRE_AVOCAT, RECETTE_ECRIRE_FACECAM, RECETTE_TABLEAU, recetteQualiteEcrire } from "@/domaine/qualite-script/recettes";
import type { LigneScript } from "@/domaine/relecture-script";

const LIGNES: LigneScript[] = [
  { id: "a", dit: "Vos devis partent en retard chaque vendredi.", groupe: "Début" },
  { id: "b", dit: "Ce nouvel outil vient de sortir et relance seul.", groupe: "Milieu commun" },
  { id: "c", dit: "Nous sommes Certifexemple certifiés.", groupe: "Milieu commun" },
  { id: "d", dit: "Faites-le vous-même ce soir.", groupe: "Fin" },
];

describe("socle : règles 1-2 de Will, en observation, sur l'écran commun", () => {
  it("Écrire : la recette du format est trouvée (avocat, face caméra), aucune pour un autre format", () => {
    expect(recetteQualiteEcrire("avocat")).toBe(RECETTE_ECRIRE_AVOCAT);
    expect(recetteQualiteEcrire("facecam")).toBe(RECETTE_ECRIRE_FACECAM);
    expect(recetteQualiteEcrire("tableau-anime")).toBeUndefined();
    expect(recetteQualiteEcrire(undefined)).toBeUndefined();
  });

  it.each([
    ["Écrire (avocat)", () => evaluerQualite(depuisLignesEcrire(LIGNES), RECETTE_ECRIRE_AVOCAT)],
    ["tableau", () => evaluerQualite(depuisLignesTableau(LIGNES), RECETTE_TABLEAU)],
  ])("%s : PO-01, PO-02 et LG-01 (Certifexemple) sont affichés, tous en « info »", (_nom, rapport) => {
    const { pastilles } = rapport();
    const codes = pastilles.map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(["socle-PO-01", "socle-PO-02", "socle-LG-01"]));
    expect(pastilles.find((p) => p.code === "socle-LG-01" && /Certifexemple/.test(p.texte))?.ligneId).toBe("c");
    expect(pastilles.every((p) => p.niveau === "info")).toBe(true);
  });

  it("une seule cible (PR-05) et l'annonce d'un éditeur (PO-02), en observation", () => {
    const deux = evaluerQualite(depuisLignesEcrire([{ id: "a", dit: "Pour les TPE et les PME, un devis en retard coûte cher.", groupe: "Début" }]), RECETTE_ECRIRE_AVOCAT);
    expect(deux.pastilles.find((p) => p.code === "socle-PR-05")?.texte).toMatch(/TPE, PME/);
    const une = evaluerQualite(depuisLignesEcrire([{ id: "a", dit: "Pour une PME, un devis en retard coûte cher.", groupe: "Début" }]), RECETTE_ECRIRE_AVOCAT);
    expect(une.pastilles.some((p) => p.code === "socle-PR-05")).toBe(false);
    const annonce = evaluerQualite(depuisLignesEcrire([{ id: "a", dit: "L'annonce d'OpenAI change vos devis.", groupe: "Début" }]), RECETTE_ECRIRE_AVOCAT);
    expect(annonce.pastilles.some((p) => p.code === "socle-PO-02")).toBe(true);
  });
});
