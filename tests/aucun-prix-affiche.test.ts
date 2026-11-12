/**
 * Règle de Williams (11/11/2026) : « aucun prix dans le studio ». Aucun écran ne formate un montant d'argent.
 * Le test parcourt les .tsx de `src/app/(studio)` et `src/components` et échoue si, hors commentaires, il trouve
 * un symbole € ou un appel `formaterDollars(` / `formaterMontant(`. Les zones d'autres chantiers sont ignorées.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Zones suivies par d'autres sessions (non vérifiées ici). */
const ZONES_IGNOREES = [
  "src/app/(studio)/calendrier/",
  "src/app/(studio)/a-publier/",
  "src/app/(studio)/sur-le-site/",
  "src/app/(studio)/a-traiter/",
  "src/app/(studio)/mots/",
  "src/app/(studio)/reglages/",
  "src/components/calendrier/",
  "src/components/publication/",
  "src/components/mots/",
  "src/components/a-traiter/",
];

/**
 * Exceptions justifiées (fichier => raison). Pages d'administration des crédits : Williams décide de leur sort.
 * Rien n'est autorisé ici tant qu'aucune de ces pages ne contient de symbole € ni d'appel de formatage.
 */
const LISTE_BLANCHE: Record<string, string> = {};

function fichiersTsx(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiersTsx(chemin, sortie);
    else if (nom.endsWith(".tsx")) sortie.push(chemin);
  }
  return sortie;
}

/** Retire les commentaires (bloc, ligne, et `{/* … *​/}` JSX) pour ne regarder que le code affiché. */
function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

const MOTIFS: { nom: string; re: RegExp }[] = [
  { nom: "symbole €", re: /€/ },
  { nom: "appel formaterDollars(", re: /\bformaterDollars\(/ },
  { nom: "appel formaterMontant(", re: /\bformaterMontant\(/ },
];

describe("aucun prix affiché dans le studio", () => {
  const fichiers = [...fichiersTsx(join(RACINE, "src", "app", "(studio)")), ...fichiersTsx(join(RACINE, "src", "components"))]
    .map((f) => relative(RACINE, f).split(sep).join("/"))
    .filter((f) => !ZONES_IGNOREES.some((z) => f.startsWith(z)))
    .filter((f) => !(f in LISTE_BLANCHE));

  it("parcourt bien des fichiers", () => {
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it("aucun € ni appel de formatage d'argent dans le JSX", () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const code = sansCommentaires(readFileSync(join(RACINE, f), "utf8"));
      for (const m of MOTIFS) if (m.re.test(code)) fautes.push(`${f} : ${m.nom}`);
    }
    expect(fautes).toEqual([]);
  });
});
