/**
 * RELECTURE FINALE — petits défauts d'affichage, vérifiés dans le code de l'écran (aucun réseau).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("« Fabriquer les N » : « rien n'est payé » se décide sur le format des versions", () => {
  it("la feuille passe le format au résumé de dépense, et la page le lui donne", () => {
    const ecran = readFileSync("src/components/generateur/FabricationReseaux.tsx", "utf8");
    expect(ecran).toMatch(/resumeDepenseAction\(centimes, plan\.formatId \? \[plan\.formatId\] : undefined\)/);
    const page = readFileSync("src/app/(studio)/ecrire/sujets/[id]/page.tsx", "utf8");
    expect(page).toMatch(/formatId: planN\.formatId/);
  });
});

describe("« Reprendre l'écriture » (G1) : le supplément est sur le bouton et passe par la feuille de prix", () => {
  it("les deux boutons montrent le montant et utilisent la confirmation de prix", () => {
    for (const f of ["src/components/generateur/EcritureEnCours.tsx", "src/components/generateur/FicheSujet.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/Reprendre l'écriture \(jusqu'à \$\{[^}]+\} de plus\)/);
      expect(src).toMatch(/avecConfirmationPrix\(await reprendreEcritureArreteeAction\(id\), \(accord\) => reprendreEcritureArreteeAction\(id, accord\)\)/);
    }
  });
});
