/**
 * L7-07 · Aucun texte MONTRÉ à l'écran ne nomme l'ancien outil, le diffuseur, ni ne dit « kit », « variante » ou « API ».
 * Lecture de sources uniquement (arbre syntaxique) : seules les chaînes affichées comptent, jamais un identifiant de code,
 * un commentaire, un nom de fonction ou une valeur enregistrée. Aucun appel réel, aucune donnée de personne.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const FICHIERS = [
  "src/services/mesures.ts",
  "src/domaine/mesures.ts",
  "src/components/generateur/FicheSujet.tsx",
  "src/services/a-publier.ts",
  "src/domaine/buffer.ts",
];

const INTERDIT = /buffer|zernio|\bkits?\b|variante|\bapi\b/i;

/**
 * Textes encore tolérés, car des tests existants HORS de la liste de la fiche les comparent mot pour mot
 * (ils sont dans le rapport de la fiche) : à retirer quand ces tests suivront.
 */
const TOLERES: Record<string, string[]> = {
  "src/domaine/buffer.ts": [
    "Brouillon dans Buffer", // tests/r1-buffer-client.test.ts
    "Buffer", // noms d'outils de « Déjà envoyée par … » : tests/zernio/z2e-*.test.ts, e2e-04-service.test.ts
    "Zernio",
  ],
};

/** Une chaîne est « affichée » si c'est une phrase (espace) ou un mot qui commence par une majuscule. */
const estAffichee = (t: string) => /\s/.test(t.trim()) || /^\p{Lu}/u.test(t.trim());

function chainesAffichees(fichier: string): string[] {
  const source = ts.createSourceFile(fichier, readFileSync(fichier, "utf8"), ts.ScriptTarget.Latest, true, fichier.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sortie: string[] = [];
  const visiter = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) sortie.push(n.text);
    else if (ts.isTemplateExpression(n)) sortie.push(n.head.text + n.templateSpans.map((s) => "${}" + s.literal.text).join(""));
    else if (ts.isJsxText(n)) sortie.push(n.text.replace(/\s+/g, " ").trim());
    if (ts.isTemplateExpression(n)) {
      n.templateSpans.forEach((s) => visiter(s.expression));
      return;
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return sortie.filter((t) => t && estAffichee(t));
}

describe("L7-07 · libellés neutres de programmation", () => {
  for (const f of FICHIERS) {
    it(`${f} : aucun texte affiché ne contient un mot interdit`, () => {
      const trouves = chainesAffichees(f).filter((t) => INTERDIT.test(t) && !(TOLERES[f] ?? []).includes(t));
      expect(trouves).toEqual([]);
    });
  }

  it("le détecteur voit bien les textes affichés et ignore les identifiants de code", () => {
    const vus = chainesAffichees("src/components/generateur/FicheSujet.tsx");
    expect(vus.length).toBeGreaterThan(20);
    expect(vus).toContain("Programmer la version");
    expect(vus.some((t) => /^\/api\/telechargements/.test(t))).toBe(false);
    expect(vus).not.toContain("secondaire");
  });
});
