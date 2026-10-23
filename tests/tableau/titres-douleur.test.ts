/**
 * Titres coupés au mot (jamais « … toutes s ») et douleur du tableau : raccourcie sans refus, tirée de ce qui est dit,
 * et mots de la douleur contrôlés en code (essai réel du 12/10).
 */
import { describe, expect, it } from "vitest";
import { couperAuMot, defautsMotsDouleur, douleurDepuisScript, nettoyerMotsDouleur, positionDite, raccourcirDouleur } from "@/domaine/douleur-tableau";
import { titreAffiche } from "@/domaine/titres";
import { controlerMotsDouleur } from "@/domaine/scripts-tableau-controles";
import { ecritureCasReel } from "../tableau-scripts/cas-reel-audit";

const ACCROCHE = "Vous finissez à dix-neuf heures sans savoir où est passée la journée.";

describe("titres", () => {
  it("coupe au mot, avec des points de suspension", () => {
    expect(couperAuMot("Trouver en une semaine les trois tâches qui vous coûtent le plus de temps, toutes semaines confondues", 80)).toBe("Trouver en une semaine les trois tâches qui vous coûtent le plus de temps…");
    expect(couperAuMot("Court", 80)).toBe("Court");
  });
  it("un titre coupé à 80 caractères par l'ancien code perd son mot coupé à l'affichage", () => {
    const ancien = "Le dirigeant de petite entreprise sent qu'il perd du temps, mais ne sait pas dire où. Toutes ses journées".slice(0, 80);
    expect(ancien.length).toBe(80);
    expect(titreAffiche(ancien)).toBe("Le dirigeant de petite entreprise sent qu'il perd du temps, mais ne sait pas…");
    expect(titreAffiche("Apprendre l'IA en cinq jours")).toBe("Apprendre l'IA en cinq jours");
  });
});

describe("douleur", () => {
  it("raccourcie aux phrases entières qui tiennent, sinon au mot", () => {
    expect(raccourcirDouleur(`${ACCROCHE} ${"Vous avez recopié des adresses, relancé des factures, répondu trois fois à la même question."}`)).toBe(ACCROCHE);
    const uneSeule = `Vous ${"perdez encore du temps ".repeat(8)}chaque jour.`;
    const r = raccourcirDouleur(uneSeule);
    expect(r.length).toBeLessThanOrEqual(140);
    expect(r.endsWith("…")).toBe(true);
    expect(uneSeule.startsWith(r.slice(0, -1))).toBe(true);
  });
  it("tirée de l'accroche puis du bloc « douleur » du script", () => {
    expect(douleurDepuisScript(ecritureCasReel().script)).toBe(ACCROCHE);
    expect(douleurDepuisScript({ accroche: [{ dit: "Vous avez essayé l'IA trois fois." }], douleur: [{ dit: "Des réponses plates." }] })).toBe("Vous avez essayé l'IA trois fois. Des réponses plates.");
  });
});

describe("mots de la douleur", () => {
  it("nettoyés : liste ou texte à virgules, sans doublon ni ponctuation autour", () => {
    expect(nettoyerMotsDouleur(" passée, « journée » ,passée,, ")).toEqual(["passée", "journée"]);
  });
  it("position dite, mot entier", () => {
    expect(positionDite(ACCROCHE, "dix-neuf heures")).toBe(16);
    expect(positionDite(ACCROCHE, "journée")).toBe(61);
    expect(positionDite(ACCROCHE, "jour")).toBeNull();
  });
  it("2 à 4, présents mot pour mot dans l'accroche, l'un d'eux dans les 3 premières secondes", () => {
    expect(defautsMotsDouleur(["dix-neuf heures", "passée", "journée"], ACCROCHE)).toEqual([]);
    expect(defautsMotsDouleur(["journée"], ACCROCHE)[0]).toMatch(/il en faut 2 à 4/);
    expect(defautsMotsDouleur(["temps perdu", "journée"], ACCROCHE)[0]).toMatch(/« temps perdu » n'est pas dit mot pour mot dans l'accroche/);
    expect(defautsMotsDouleur(["où", "journée"], ACCROCHE)[0]).toMatch(/ne porte aucun sens/);
    // « passée » et « journée » arrivent après les 3 premières secondes (marge comprise).
    expect(defautsMotsDouleur(["passée", "journée"], ACCROCHE)[0]).toMatch(/Aucun mot de la douleur n'est dit dans les 3 premières secondes/);
  });
  it("contrôle éliminatoire du générateur", () => {
    const e = ecritureCasReel();
    expect(controlerMotsDouleur(e)).toEqual([]);
    expect(controlerMotsDouleur({ ...e, motsDouleur: [] })).toMatchObject([{ code: "mots-douleur", eliminatoire: true }]);
  });
});
