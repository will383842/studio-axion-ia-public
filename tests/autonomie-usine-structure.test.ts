/**
 * AUT-A — structure : le réglage `usine.autonomie` n'a qu'un seul point d'écriture (`reglerAutonomieUsine`, session du fondateur) et
 * n'est joignable ni par la porte de l'Usine ni par ses modules. Depuis le 15/11 (S1), le plafond reçu de l'Usine a son propre point
 * d'écriture, `recevoirAutonomieUsine`, qui n'écrit QUE `usine.autonomie.porte` et n'est appelé que par `budget-mensuel.ts` (derrière
 * la garde de la porte) ; `reglerAutonomieUsine` reste injoignable depuis la porte. Lecture de fichiers seulement, aucun réseau, 0 €.
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
    // Exception : la porte de LECTURE (POST /api/usine/reglages/autonomie) importe lireReglageEnVigueur et usageDuMoisUsine, jamais une écriture.
    const LECTURE = "src/app/api/usine/reglages/autonomie/route.ts";
    const fautifs = [...fichiers("src/app/api"), ...fichiers("src/usine")].filter((f) => f !== LECTURE).filter((f) => /reglerAutonomieUsine|autonomie-usine/.test(sansCommentaires(lire(f))));
    expect(fautifs).toEqual([]);
    expect(sansCommentaires(lire(LECTURE)).match(/import \{([^}]*)\} from "@\/services\/autonomie-usine"/)?.[1].split(",").map((x) => x.trim()).sort()).toEqual(["lireReglageEnVigueur", "usageDuMoisUsine"]);
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
    expect(fonctions.sort()).toEqual(["alerterPlafondUsine", "eteindreDepuisStudio", "inscrireAccordUsine", "recevoirAutonomieUsine", "reglerAutonomieUsine"].sort());
  });

  it("`usine.autonomie.porte` n'est écrite que dans recevoirAutonomieUsine, qui n'a pas de session et n'écrit pas l'ancienne clé", () => {
    const t = sansCommentaires(lire(FICHIER));
    const debut = t.indexOf("export async function recevoirAutonomieUsine");
    expect(debut).toBeGreaterThan(-1);
    const fin = t.indexOf("export async function reglerAutonomieUsine", debut);
    const corps = t.slice(debut, fin);
    // eteindreDepuisStudio (bouton d'urgence, session, éteint seulement) est le seul autre écrivain de la clé de la porte.
    const dEteindre = t.indexOf("export async function eteindreDepuisStudio");
    const fEteindre = t.indexOf("\nexport ", dEteindre + 10);
    expect(dEteindre).toBeGreaterThan(-1);
    const eteindre = t.slice(dEteindre, fEteindre);
    expect(eteindre).toMatch(/exigerSession\(\)/);
    expect(eteindre).toMatch(/ecrireParametre\(CLE_PORTE, valeur\)/);
    expect(eteindre).not.toMatch(/ecrireParametre\(CLE_REGLAGE|actif\s*:\s*true/);
    const hors = t.slice(0, debut) + t.slice(fin, dEteindre) + t.slice(fEteindre);
    expect(corps).toMatch(/ecrireParametre\(CLE_PORTE,/);
    expect(corps).not.toMatch(/ecrireParametre\(CLE_REGLAGE/);
    expect(corps).not.toMatch(/exigerSession/);
    expect(corps).not.toMatch(/reglerAutonomieUsine/);
    // nulle part ailleurs dans le fichier : ni écriture de la clé de la porte, ni suppression
    expect(hors).not.toMatch(/ecrireParametre\(CLE_PORTE/);
    expect(t).not.toMatch(/supprimer|effacer|\.retirer\(/);
    // aucun autre fichier de src ne cite la clé (elle n'y est donc jamais écrite)
    const citent = fichiers("src").filter((f) => f !== FICHIER).filter((f) => /usine\.autonomie\.porte/.test(sansCommentaires(lire(f))));
    expect(citent).toEqual([]);
  });

  it("recevoirAutonomieUsine n'est appelée que depuis budget-mensuel.ts ; reglerAutonomieUsine n'est joignable ni depuis src/app/api/** ni depuis budget-mensuel.ts", () => {
    const appelants = fichiers("src").filter((f) => f !== FICHIER).filter((f) => /recevoirAutonomieUsine/.test(sansCommentaires(lire(f))));
    expect(appelants).toEqual(["src/services/budget-mensuel.ts"]);
    const budget = sansCommentaires(lire("src/services/budget-mensuel.ts"));
    expect(budget).not.toMatch(/reglerAutonomieUsine|actions-autonomie-usine/);
    const portes = fichiers("src/app/api").filter((f) => /reglerAutonomieUsine|actions-autonomie-usine/.test(sansCommentaires(lire(f))));
    expect(portes).toEqual([]);
    // seuls la définition et l'écran (session) peuvent citer reglerAutonomieUsine (une liste de permis : le retrait de l'écran, S2, la laisse verte)
    const permis = new Set(["src/app/(studio)/reglages/actions-autonomie-usine.ts", "src/components/reglages/AutonomieUsine.tsx", FICHIER]);
    const intrus = fichiers("src").filter((f) => /reglerAutonomieUsine/.test(sansCommentaires(lire(f)))).filter((f) => !permis.has(f));
    expect(intrus).toEqual([]);
  });

  it("`dansVerrouCredits(` n'est appelé que dans src/services/credits.ts (le marqueur seul n'est pas un verrou)", () => {
    const fautifs = fichiers("src")
      .filter((f) => f !== FICHIER && f !== "src/services/credits.ts")
      .filter((f) => /dansVerrouCredits\s*\(/.test(sansCommentaires(lire(f))));
    expect(fautifs).toEqual([]);
  });

  it("le fichier ne fait aucun appel réseau", () => {
    expect(sansCommentaires(lire(FICHIER))).not.toMatch(/\bfetch\(|https?:\/\//);
  });
});
