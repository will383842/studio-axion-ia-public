/**
 * GARDE « une règle écrite une seule fois » (légère).
 *
 * Refuse une constante numérique de premier niveau définie avec le MÊME NOM et la MÊME VALEUR dans deux fichiers
 * de src/ (ex. `const JOUR_MS = 86_400_000` recopié trois fois) : la règle doit vivre dans un seul module et être
 * importée ailleurs, sinon on en corrige une copie et pas l'autre.
 *
 * Pourquoi « même nom ET même valeur » : deux constantes de même nom mais de valeurs différentes sont, dans ce dépôt,
 * des règles distinctes et locales (TAILLE_MAX d'un envoi de voix ≠ TAILLE_MAX d'un fichier envoyé ; LARGEUR de deux
 * aperçus différents). Les refuser donnerait des faux positifs ; elles ne sont pas contrôlées.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");

/**
 * REGISTRE DES EXCEPTIONS RM-01 (« une règle, une source ») : doubles admis, chacun avec sa raison et le test qui
 * garde l'égalité des deux copies. Un double hors de ce registre est une faute.
 */
export const EXCEPTIONS_RM01 = [
  {
    copie: "src/briques/schema-motion/courbes.ts",
    source: "studio-rendu/compositions/cas-concret/plans/commun.ts",
    raison: "src/ ne peut pas importer studio-rendu ; commun.ts est un fichier du cas concret. À terme commun.ts pourra ré-exporter courbes.ts (à voir avec la session cas concret).",
    garde: "tests/image-video/mise-en-page-partagee.test.ts (« courbes du plan des objets : mêmes valeurs »)",
  },
] as const;

function lister(dossier: string): string[] {
  const res: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) res.push(...lister(p));
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) res.push(p);
  }
  return res;
}

/** Valeur numérique constante (littéral, signe, produit de littéraux…) ou null. */
function valeur(e: ts.Expression | undefined): number | null {
  if (!e) return null;
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) return valeur(e.expression);
  if (ts.isNumericLiteral(e)) return Number(e.text);
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    const v = valeur(e.operand);
    return v === null ? null : -v;
  }
  if (ts.isBinaryExpression(e)) {
    const a = valeur(e.left);
    const b = valeur(e.right);
    if (a === null || b === null) return null;
    switch (e.operatorToken.kind) {
      case ts.SyntaxKind.AsteriskToken:
        return a * b;
      case ts.SyntaxKind.PlusToken:
        return a + b;
      case ts.SyntaxKind.MinusToken:
        return a - b;
      case ts.SyntaxKind.SlashToken:
        return a / b;
    }
  }
  return null;
}

type Definition = { fichier: string; ligne: number; nom: string; valeur: number };

function constantesNumeriques(fichier: string, source: string): Definition[] {
  const sf = ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true);
  const res: Definition[] = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !(st.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const d of st.declarationList.declarations) {
      const v = valeur(d.initializer);
      if (!ts.isIdentifier(d.name) || v === null) continue;
      res.push({ fichier, ligne: sf.getLineAndCharacterOfPosition(d.getStart(sf)).line + 1, nom: d.name.text, valeur: v });
    }
  }
  return res;
}

function doublons(defs: Definition[]): Definition[][] {
  const groupes = new Map<string, Definition[]>();
  for (const d of defs) {
    const cle = `${d.nom}=${d.valeur}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), d]);
  }
  return [...groupes.values()].filter((g) => new Set(g.map((d) => d.fichier)).size > 1);
}

describe("Garde · une règle chiffrée écrite une seule fois", () => {
  it("aucune constante numérique (même nom, même valeur) n'est recopiée dans deux fichiers de src/", () => {
    const defs = lister(join(RACINE, "src")).flatMap((f) => constantesNumeriques(relative(RACINE, f), readFileSync(f, "utf8")));
    const trouves = doublons(defs);
    if (trouves.length) {
      const texte = trouves
        .map((g) => `${g[0].nom} = ${g[0].valeur}, défini ${g.length} fois :\n${g.map((d) => `    ${d.fichier}:${d.ligne}`).join("\n")}`)
        .join("\n");
      throw new Error(`Règle recopiée : gardez une seule définition (exportée) et importez-la ailleurs.\n${texte}\n`);
    }
    expect(trouves).toEqual([]);
  });

  it("chaque exception RM-01 du registre existe, avec sa source, sa raison et son test d'égalité", () => {
    for (const e of EXCEPTIONS_RM01) {
      expect(existsSync(join(RACINE, e.copie)), e.copie).toBe(true);
      expect(existsSync(join(RACINE, e.source)), e.source).toBe(true);
      expect(existsSync(join(RACINE, e.garde.split(" ")[0])), e.garde).toBe(true);
      expect(e.raison.length).toBeGreaterThan(20);
    }
  });

  it("rougit sur une recopie, pas sur deux règles locales de même nom", () => {
    const a = constantesNumeriques("a.ts", "export const JOUR_MS = 86_400_000;\nconst TAILLE_MAX = 25 * 1024 * 1024;");
    const b = constantesNumeriques("b.ts", "const JOUR_MS = 24 * 60 * 60 * 1000;\nconst TAILLE_MAX = 4 * 1024;\nfunction f() { const JOUR_MS = 86_400_000; return JOUR_MS; }");
    expect(doublons([...a, ...b]).map((g) => g[0].nom)).toEqual(["JOUR_MS"]);
  });
});
