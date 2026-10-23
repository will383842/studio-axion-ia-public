/**
 * Rapport sécurité de la vérification E2E n° 1 : une écriture bloquée par le crédit ou la limite du mois ne repart pas
 * forcément seule (au mois suivant, elle attend l'accord de Will). Les textes de l'écran ne promettent donc plus une
 * reprise « toute seule » / « automatique », et l'écran d'écriture porte un bouton « Reprendre l'écriture ».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEXIQUE_GENERATEUR } from "@/domaine/libelles";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

describe("E2E-1 sécurité · reprise d'une écriture bloquée", () => {
  it("aucune promesse de reprise seule sur la fiche sujet ni dans le lexique", () => {
    expect(LEXIQUE_GENERATEUR["en-attente-credit"]).not.toMatch(/automatique|tout seul/i);
    const page = lire("src/app/(studio)/ecrire/sujets/[id]/page.tsx");
    expect(page).not.toMatch(/reprendra tout seul|reprise automatique/i);
    // Garde-fous budget (15/10) : le bouton s'appelle « Reprendre (≈ X €) ».
    expect(page).toMatch(/« Reprendre »/);
  });

  it("l'écran d'écriture propose « Reprendre (≈ X €) », branché sur l'action qui exige la session", () => {
    const ecran = lire("src/components/generateur/EcritureEnCours.tsx");
    expect(ecran).toMatch(/Reprendre \(≈ \$\{etat\.reprise\.prix\}\)/);
    expect(ecran).toMatch(/reprendreEcrituresAction\(/);
    const actions = lire("src/app/(studio)/ecrire/sujets/actions.ts");
    expect(actions).toMatch(/export async function reprendreEcrituresAction[\s\S]{0,120}exigerSession\(\)/);
    // Correctif après relecture : le serveur fait confirmer le prix (`reprendreEcriture`, puis `relancerEcrituresEnAttente`).
    expect(actions).toMatch(/reprendreEcriture\(id, accordPropre\(accord\)\)/);
  });
});
