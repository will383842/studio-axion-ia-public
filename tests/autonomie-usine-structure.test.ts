/**
 * AUT-A — structure : le réglage `usine.autonomie` n'a qu'un seul point d'écriture et n'est joignable ni par la porte de
 * l'Usine ni par ses modules ; il exige la session du fondateur. Lecture de fichiers seulement, aucun réseau, 0 €.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const FICHIER = "src/services/autonomie-usine.ts";

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  let entrees: string[] = [];
  try {
    entrees = readdirSync(join(RACINE, dossier));
  } catch {
    return sortie;
  }
  for (const nom of entrees) {
    const chemin = `${dossier}/${nom}`;
    if (statSync(join(RACINE, chemin)).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("structure de l'autonomie de l'Usine", () => {
  it("le fichier du registre existe", () => {
    expect(lire(FICHIER).length).toBeGreaterThan(0);
  });

  it("la chaîne `usine.autonomie` n'est écrite (ecrireParametre) que dans autonomie-usine.ts", () => {
    const fautifs = fichiers("src").filter((f) => f !== FICHIER).filter((f) => {
      const t = sansCommentaires(lire(f));
      return /ecrireParametre/.test(t) && /["'`]usine\.autonomie/.test(t);
    });
    expect(fautifs).toEqual([]);
    // et dans ce fichier : elle y est bien écrite
    expect(sansCommentaires(lire(FICHIER))).toMatch(/ecrireParametre\(/);
  });

  it("aucun autre fichier de src ne cite la clé `usine.autonomie` dans du code (hors commentaires)", () => {
    const citent = fichiers("src").filter((f) => f !== FICHIER).filter((f) => /["'`]usine\.autonomie/.test(sansCommentaires(lire(f))));
    expect(citent).toEqual([]);
  });

  it("reglerAutonomieUsine n'est importé par aucun fichier de src/app/api/** ni de src/usine/**", () => {
    const fautifs = [...fichiers("src/app/api"), ...fichiers("src/usine")].filter((f) => /reglerAutonomieUsine|autonomie-usine/.test(sansCommentaires(lire(f))));
    expect(fautifs).toEqual([]);
  });

  it("reglerAutonomieUsine appelle exigerSession, avant toute écriture", () => {
    const t = sansCommentaires(lire(FICHIER));
    const debut = t.indexOf("export async function reglerAutonomieUsine");
    expect(debut).toBeGreaterThan(-1);
    const corps = t.slice(debut);
    const session = corps.indexOf("exigerSession()");
    const ecriture = corps.indexOf("ecrireParametre(");
    expect(session).toBeGreaterThan(-1);
    expect(ecriture).toBeGreaterThan(session);
  });

  it("aucune écriture de `usine.autonomie` hors reglerAutonomieUsine ; le registre n'est écrit que par inscrireAccordUsine et l'alerte", () => {
    const t = sansCommentaires(lire(FICHIER));
    // chaque fonction qui écrit : une liste fermée
    const fonctions = [...t.matchAll(/export (?:async )?function (\w+)[\s\S]*?(?=\nexport |\n(?:async )?function |$)/g)]
      .filter((m) => /ecrireParametre\(/.test(m[0]))
      .map((m) => m[1]);
    expect(fonctions.sort()).toEqual(["alerterPlafondUsine", "inscrireAccordUsine", "reglerAutonomieUsine"].sort());
  });

  it("le fichier ne fait aucun appel réseau", () => {
    expect(sansCommentaires(lire(FICHIER))).not.toMatch(/\bfetch\(|https?:\/\//);
  });
});
