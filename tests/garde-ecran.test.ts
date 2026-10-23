/**
 * GARDE AUTOMATIQUE « rien de technique à l'écran ».
 *
 * Will (chef d'entreprise, non technicien) ne doit jamais lire, ni à l'écran ni dans le Journal des Réglages :
 * un nom de variable d'environnement (MAJUSCULES_AVEC_SOULIGNÉS), un code HTTP ou d'erreur (503, PUB-12…),
 * de l'anglais technique, le mot « Simulation » (on dit « Essai »), un identifiant interne.
 * Le détail technique va seulement en console serveur (console.warn).
 *
 * Analyse statique avec le compilateur TypeScript : on extrait les textes qui partent vers l'écran.
 *  1. Fichiers d'écran (src/components/**, src/app/**\/page.tsx et layout.tsx, src/assistant/**) :
 *     textes JSX, attributs lisibles (title, placeholder, aria-label…), chaînes « phrases » et chaînes
 *     affichées dans une expression JSX.
 *  2. Partout dans src/ : les chaînes passées à notifier.*() (bulles), à notifier({ titre, message })
 *     (cloche), au 2e argument de journaliser() (Journal des Réglages), aux messages d'ErreurStudio et des
 *     autres erreurs « Erreur* » (fournisseurs : leur message finit dans le Journal), aux résultats
 *     { ok: false, message } renvoyés aux actions, et à toute propriété `messagePourWill`.
 *
 * ÉTENDRE : ajouter un motif dans REGLES, un attribut dans ATTRIBUTS_LISIBLES, un appel dans
 * `estAppelMessage`, ou un dossier dans `estFichierEcran`. Voir docs/controles/GARDE-ECRAN.md.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");
const SRC = join(RACINE, "src");

// ─── Règles ────────────────────────────────────────────────────────────────────────────────────────────────

type Regle = { nom: string; motif: RegExp; correction: string };

const REGLES: Regle[] = [
  {
    nom: "variable d'environnement",
    motif: /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/,
    correction: "Dites ce que Will doit faire (« ajoutez la clé dans Réglages > Connexions ») ; le nom de la variable va en console.warn.",
  },
  {
    nom: "code d'erreur interne",
    motif: /\b[A-Z]{2,5}-\d{1,3}\b/,
    correction: "Retirez le code (ex. PUB-12) du texte affiché ; gardez-le pour console.warn.",
  },
  {
    nom: "code HTTP écrit en clair",
    motif: /\(\s*[1-5]\d\d\s*\)|\bHTTP\b|\b(?:code|erreur|réponse|statut)\s*:?\s*[1-5]\d\d\b/i,
    correction: "Retirez le code (« (429) », « réponse 503 ») ; dites « … ne répond pas pour l'instant » et gardez le code pour console.warn.",
  },
  {
    nom: "mot « Simulation »",
    motif: /\bsimulations?\b/i,
    correction: "À l'écran on dit « Essai » (ou « mode essai »), jamais « Simulation ».",
  },
  {
    nom: "anglais technique",
    motif: /\b(error|errors|failed|timeout|token|api key|undefined|null)\b/i,
    correction: "Écrivez une phrase simple en français (« … ne répond pas », « … a refusé la demande »).",
  },
];

const CORRECTION_STATUT =
  "N'affichez pas le code HTTP : phrase simple pour Will, et console.warn(`… ${r.status}`) côté serveur.";

/** Interpolations interdites dans un message : statut / code HTTP. */
const EXPRESSION_STATUT = /(^|[.\s(])(status|statusCode|statut)\)?$/;

/** Interpolations interdites : message brut d'une exception ou corps brut d'une réponse (souvent en anglais). */
const EXPRESSION_BRUTE = /\(\w+ as Error\)\.message|^(e|err|erreur|error)\.message$|\.text\(\)/;
/**
 * Interpolations interdites : identifiant ou nom interne (type de service, identifiant du registre, rôle, modèle,
 * mode…). Ex. `Service « ${type} » : ${propre} choisi` → « Service « son » : studio-rendu choisi ».
 */
const EXPRESSION_INTERNE = /(^|\.)(type|id|ids|role|modele|replis|mode|fournisseur|formatId|structure|propre|etape|motif)$/;
const CORRECTION_INTERNE =
  "N'insérez pas un identifiant ou un nom interne : passez par un libellé lisible (titre du service, nom du catalogue, nom du réseau…).";

const CORRECTION_BRUTE =
  "N'insérez pas le message brut d'une exception ou d'une réponse : phrase simple pour Will, détail en console.warn côté serveur.";

/**
 * EXCEPTIONS (courtes, commentées).
 * Marques : retirées du texte avant contrôle (on a le droit d'écrire « Buffer », « HeyGen »…).
 */
const MARQUES = ["Buffer", "HeyGen", "Claude", "LinkedIn", "ElevenLabs", "fal.ai", "Pexels", "Pixabay", "YouTube", "TikTok", "Instagram", "Facebook", "Coolify"];

/**
 * Exceptions précises : { fichier, extrait, raison }. Toute entrée doit dire POURQUOI le texte n'atteint
 * pas Will (ou pourquoi il est acceptable). À garder la plus courte possible.
 */
const EXCEPTIONS: { fichier: string; extrait: string; raison: string }[] = [
  { fichier: "src/assistant/etapes/Distribution.tsx", extrait: "Qui joue : ", raison: "`slot.role` est le libellé français du rôle tiré du format (« Face caméra »), pas un identifiant." },
  { fichier: "src/fournisseurs/claude/client.ts", extrait: "réponse ${statut}", raison: "Message d'ErreurClaude : détail technique lu seulement par `traiterEchec` (generation-claude, depense-claude-video), qui l'envoie en console.warn et montre une phrase fixe à Will (vu par le suivi des constantes, paquet 4)." },
  { fichier: "src/services/fabrication-reseaux.ts", extrait: "Elle partira dès que le crédit le permettra.", raison: "`e` y est une ErreurStudio (contrôlé juste avant) : son message est une phrase pour Will, vérifiée par cette garde." },
];

// ─── Collecte des fichiers ─────────────────────────────────────────────────────────────────────────────────

function lister(dossier: string): string[] {
  const res: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) res.push(...lister(p));
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) res.push(p);
  }
  return res;
}

function estFichierEcran(rel: string): boolean {
  const r = rel.split(sep).join("/");
  return (
    r.startsWith("src/components/") ||
    r.startsWith("src/assistant/") ||
    (r.startsWith("src/app/") && /\/(page|layout|not-found|global-error|error|loading)\.tsx$/.test(r)) ||
    r === "src/app/global-error.tsx" ||
    r === "src/app/not-found.tsx"
  );
}

// ─── Analyse ───────────────────────────────────────────────────────────────────────────────────────────────

type Constat = { fichier: string; ligne: number; texte: string; regle: string; correction: string };

/** Attributs JSX dont la valeur est lue par Will (ou son lecteur d'écran). */
const ATTRIBUTS_LISIBLES = new Set(["title", "placeholder", "aria-label", "alt", "label", "titre", "description", "message", "texte", "aide", "libelle", "sousTitre", "confirmation"]);

/** Une chaîne « phrase » : contient une espace, ou commence par une majuscule suivie de minuscules. */
function ressemblePhrase(s: string): boolean {
  return /\s/.test(s.trim()) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s);
}

function nomAppel(e: ts.Expression): string {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return `${nomAppel(e.expression)}.${e.name.text}`;
  return "";
}

/** Appels dont les arguments partent à l'écran. Renvoie les indices d'arguments à contrôler (null = tous). */
function argumentsMessage(appel: ts.CallExpression | ts.NewExpression): number[] | null | undefined {
  const nom = nomAppel(appel.expression);
  if (/^notifier\.\w+$/.test(nom)) return null; // bulles (Toast)
  if (nom === "notifier") return null; // cloche (objet { titre, message })
  if (nom === "journaliser") return [1]; // Journal des Réglages
  if (/notifications\.enregistrer$/.test(nom)) return null;
  if (nom === "creerNotification") return [0]; // cloche + téléphone + e-mail (objet { titre, message })
  if (/evenements\.enregistrer$/.test(nom)) return [0]; // ligne du Journal écrite directement (migrations)
  if (nom === "NextResponse.json" || nom === "Response.json") return [0]; // { erreur } lu par l'écran
  if (ts.isNewExpression(appel) && /^Erreur\w*$/.test(nom)) {
    // new ErreurStudio(code, message, …) : le code (1er) et le détail technique (ErreurBuffer, 4e) ne sont
    // jamais affichés → seul le message (2e) compte. Forme objet ({ code, message }) : propriétés lisibles.
    return (appel.arguments?.length ?? 0) >= 2 ? [1] : null;
  }
  return undefined;
}

const PROPRIETES_MESSAGE = new Set(["message", "titre", "messagePourWill", "description", "erreur"]);

function estObjetEchec(o: ts.ObjectLiteralExpression): boolean {
  return o.properties.some(
    (p) => ts.isPropertyAssignment(p) && p.name.getText() === "ok" && p.initializer.kind === ts.SyntaxKind.FalseKeyword,
  );
}

/**
 * Intégration paquet 4 : une phrase rangée dans une constante (`const PHOTOS_EN_PREPARATION = "…"`, ou importée :
 * `MESSAGE_VOIX_ESSAI`, `RAPPEL_VOTRE_MARQUE`) puis passée à un message est contrôlée comme si elle était écrite là.
 * Constantes du même fichier, et `export const` d'un module `@/…` importé (un seul niveau).
 */
const estTexte = (e: ts.Expression) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e);

function constantesTexte(sf: ts.SourceFile, exporteesSeulement: boolean): Map<string, ts.Expression> {
  const res = new Map<string, ts.Expression>();
  const visiter = (n: ts.Node) => {
    if (ts.isVariableStatement(n) && (n.declarationList.flags & ts.NodeFlags.Const) !== 0) {
      const exportee = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (!exporteesSeulement || exportee) {
        for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer && estTexte(d.initializer) && !res.has(d.name.text)) res.set(d.name.text, d.initializer);
      }
    }
    if (!exporteesSeulement) ts.forEachChild(n, visiter);
  };
  if (exporteesSeulement) sf.statements.forEach(visiter);
  else visiter(sf);
  return res;
}

const cacheModules = new Map<string, Map<string, ts.Expression> | null>();
function constantesExporteesDe(module: string): Map<string, ts.Expression> | null {
  if (!module.startsWith("@/")) return null;
  if (cacheModules.has(module)) return cacheModules.get(module)!;
  const base = join(SRC, module.slice(2));
  let trouve: Map<string, ts.Expression> | null = null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    try {
      const texte = readFileSync(c, "utf8");
      trouve = constantesTexte(ts.createSourceFile(c, texte, ts.ScriptTarget.Latest, true, c.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS), true);
      break;
    } catch {
      /* fichier suivant */
    }
  }
  cacheModules.set(module, trouve);
  return trouve;
}

function analyser(fichier: string, source: string, ecran: boolean): Constat[] {
  const sf = ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true, fichier.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const constats: Constat[] = [];
  const vus = new Set<ts.Node>();
  const locales = constantesTexte(sf, false);
  const importees = new Map<string, { module: string; nom: string }>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.importClause?.isTypeOnly) continue;
    const liaisons = st.importClause?.namedBindings;
    if (liaisons && ts.isNamedImports(liaisons)) for (const el of liaisons.elements) importees.set(el.name.text, { module: st.moduleSpecifier.text, nom: (el.propertyName ?? el.name).text });
  }
  /** Phrase d'une constante passée à un message (même fichier, ou exportée d'un module importé). */
  function constanteDe(e: ts.Identifier): ts.Expression | undefined {
    const locale = locales.get(e.text);
    if (locale) return locale;
    const imp = importees.get(e.text);
    return imp ? constantesExporteesDe(imp.module)?.get(imp.nom) : undefined;
  }

  const ligne = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  function controlerTexte(n: ts.Node, texte: string) {
    let propre = texte;
    for (const m of MARQUES) propre = propre.split(m).join(" ");
    for (const r of REGLES) {
      if (!r.motif.test(propre)) continue;
      if (EXCEPTIONS.some((x) => fichier.endsWith(x.fichier) && texte.includes(x.extrait))) continue;
      constats.push({ fichier, ligne: ligne(n), texte: texte.trim().slice(0, 160), regle: r.nom, correction: r.correction });
    }
  }

  /** Contrôle une expression « message » : littéraux, gabarits, concaténations, ternaires. */
  function controlerMessage(e: ts.Node | undefined, force: boolean) {
    if (!e || vus.has(e)) return;
    if (force && ts.isIdentifier(e)) {
      const c = constanteDe(e);
      if (!c) return;
      if (c.getSourceFile() === sf) return controlerMessage(c, true);
      if (vus.has(c)) return;
      vus.add(c);
      controlerTexte(e, ts.isTemplateExpression(c) ? c.head.text + c.templateSpans.map((x) => `…${x.literal.text}`).join("") : (c as ts.StringLiteral).text);
      return;
    }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return controlerMessage(e.expression, force);
    if (force && ts.isConditionalExpression(e) && /instanceof Error\b/.test(e.condition.getText(sf)) && /\.message$/.test(e.whenTrue.getText(sf).trim())) {
      // message brut recopié tel quel : `notifier.erreur(e instanceof Error ? e.message : "…")` (« Failed to fetch »…).
      constats.push({ fichier, ligne: ligne(e), texte: e.getText(sf).slice(0, 160), regle: "message technique brut", correction: CORRECTION_BRUTE });
      return controlerMessage(e.whenFalse, force);
    }
    if (force && ts.isPropertyAccessExpression(e) && /^\(\w+ as Error\)\.message$/.test(e.getText(sf).trim())) {
      constats.push({ fichier, ligne: ligne(e), texte: e.getText(sf).slice(0, 160), regle: "message technique brut", correction: CORRECTION_BRUTE });
      return;
    }
    if (ts.isConditionalExpression(e)) {
      controlerMessage(e.whenTrue, force);
      controlerMessage(e.whenFalse, force);
      return;
    }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) {
      controlerMessage(e.left, force);
      controlerMessage(e.right, force);
      return;
    }
    if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        if (ts.isPropertyAssignment(p) && PROPRIETES_MESSAGE.has(p.name.getText())) controlerMessage(p.initializer, true);
      }
      return;
    }
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      vus.add(e);
      if (force || ressemblePhrase(e.text)) controlerTexte(e, e.text);
      return;
    }
    if (ts.isTemplateExpression(e)) {
      vus.add(e);
      const texte = e.head.text + e.templateSpans.map((s) => `…${s.literal.text}`).join("");
      if (force || ressemblePhrase(texte)) controlerTexte(e, texte);
      for (const s of e.templateSpans) {
        const expr = s.expression.getText(sf).trim();
        if (EXPRESSION_STATUT.test(expr)) {
          constats.push({ fichier, ligne: ligne(s.expression), texte: e.getText(sf).slice(0, 160), regle: "code HTTP interpolé", correction: CORRECTION_STATUT });
        }
        if (force && EXPRESSION_INTERNE.test(expr.replace(/\.join\([^)]*\)$/, ""))) {
          constats.push({ fichier, ligne: ligne(s.expression), texte: e.getText(sf).slice(0, 160), regle: "identifiant interne interpolé", correction: CORRECTION_INTERNE });
        }
        if (force && EXPRESSION_BRUTE.test(expr)) {
          constats.push({ fichier, ligne: ligne(s.expression), texte: e.getText(sf).slice(0, 160), regle: "message technique brut", correction: CORRECTION_BRUTE });
        }
        controlerMessage(s.expression, force);
      }
    }
  }

  /** Nœuds jamais affichés : console.*, imports, types, comparaisons, clés d'objet… */
  function ignore(n: ts.Node): boolean {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n) || ts.isImportTypeNode(n)) return true;
    if (ts.isCallExpression(n) && /^(console\.\w+|require|import)$/.test(nomAppel(n.expression))) return true;
    if (ts.isExpressionStatement(n) && ts.isStringLiteral(n.expression)) return true; // "use client"
    if (ts.isCaseClause(n)) return true;
    if (ts.isElementAccessExpression(n)) return true;
    return false;
  }

  function visiter(n: ts.Node) {
    if (ignore(n)) return;

    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const indices = argumentsMessage(n);
      if (indices !== undefined) {
        (n.arguments ?? []).forEach((a, i) => {
          if (indices === null || indices.includes(i)) controlerMessage(a, true);
        });
      }
    }
    if (ts.isObjectLiteralExpression(n)) {
      if (estObjetEchec(n)) controlerMessage(n, true);
      for (const p of n.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText() === "messagePourWill") controlerMessage(p.initializer, true);
      }
    }

    if (ecran) {
      if (ts.isJsxText(n)) {
        if (n.text.trim()) controlerTexte(n, n.text);
      } else if (ts.isJsxAttribute(n)) {
        const nom = n.name.getText(sf);
        const init = n.initializer;
        if (init && ATTRIBUTS_LISIBLES.has(nom)) {
          controlerMessage(ts.isJsxExpression(init) ? init.expression : init, true);
        } else if (init && !ts.isJsxExpression(init)) {
          return; // className, href, type… : jamais lus.
        }
      } else if (ts.isJsxExpression(n) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
        controlerMessage(n.expression, true);
      } else if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)) {
        return; // comparaisons : valeurs internes.
      } else if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isIdentifier(n.name))) {
        // la clé n'est jamais affichée ; la valeur l'est peut-être.
        visiter(n.initializer);
        return;
      } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
        controlerMessage(n, false);
        return;
      }
    }
    ts.forEachChild(n, visiter);
  }

  visiter(sf);
  return constats.filter((c) => !EXCEPTIONS.some((x) => fichier.endsWith(x.fichier) && c.texte.includes(x.extrait)));
}

function analyserDepot(): Constat[] {
  const tous: Constat[] = [];
  for (const chemin of lister(SRC)) {
    const rel = relative(RACINE, chemin);
    tous.push(...analyser(rel.split(sep).join("/"), readFileSync(chemin, "utf8"), estFichierEcran(rel)));
  }
  return tous;
}

function rapport(constats: Constat[]): string {
  return constats.map((c) => `${c.fichier}:${c.ligne}  [${c.regle}]\n    texte : ${c.texte}\n    à faire : ${c.correction}`).join("\n");
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────────────────────────────

describe("Garde écran · rien de technique sous les yeux de Will", () => {
  it("aucun texte affiché (écran, bulles, cloche, Journal, erreurs) ne contient de jargon technique", () => {
    const constats = analyserDepot();
    if (constats.length) {
      throw new Error(`${constats.length} texte(s) technique(s) visible(s) par Will :\n\n${rapport(constats)}\n`);
    }
    expect(constats).toEqual([]);
  });

  it("la garde rougit bien sur chaque faute type (preuve permanente)", () => {
    const faux = `
      "use client";
      import { notifier } from "@/components/ui/Toast";
      export function Ecran({ r }: { r: Response }) {
        notifier.erreur("Ajoutez HEYGEN_API_KEY dans Coolify");
        notifier.info(\`Réponse \${r.status}\`);
        return <div title="Refus PUB-12">Mode Simulation : error</div>;
      }
    `;
    const c = analyser("src/components/Faux.tsx", faux, true);
    expect(c.map((x) => x.regle).sort()).toEqual(
      ["anglais technique", "code HTTP interpolé", "code d'erreur interne", "mot « Simulation »", "variable d'environnement"].sort(),
    );
    const service = `
      import { journaliser, ErreurStudio } from "./_commun";
      export async function f(res: Response) {
        await journaliser("echec", \`Buffer : réponse \${res.status}\`);
        throw new ErreurStudio("introuvable", "Request failed");
      }
      export const g = () => ({ ok: false, message: "Timeout chez l'outil" });
    `;
    const s = analyser("src/services/faux.ts", service, false);
    expect(s.map((x) => x.regle).sort()).toEqual(["anglais technique", "anglais technique", "code HTTP interpolé"]);
  });

  it("rougit aussi sur un identifiant interne au Journal, une notification brute et un message d'exception recopié (audit C)", () => {
    const service = `
      import { journaliser } from "./_commun";
      import { creerNotification } from "./notifications";
      export async function f(type: string, propre: string, e: unknown) {
        await journaliser("connexion", \`Service « \${type} » : \${propre} choisi\`);
        await creerNotification({ type: "echec", titre: "Échec", message: e instanceof Error ? e.message : "Réessayez." });
        await creerNotification({ type: "echec", titre: "Simulation terminée", message: "ok" });
      }
    `;
    const s = analyser("src/services/faux.ts", service, false);
    expect(s.map((x) => x.regle).sort()).toEqual(["identifiant interne interpolé", "identifiant interne interpolé", "message technique brut", "mot « Simulation »"].sort());
    const ecran = `
      "use client";
      import { notifier } from "@/components/ui/Toast";
      export function f(e: unknown) {
        notifier.erreur(e instanceof Error ? e.message : "La prise n'est pas partie.");
      }
    `;
    expect(analyser("src/components/Faux.tsx", ecran, true).map((x) => x.regle)).toEqual(["message technique brut"]);
  });

  it("paquet 4 : une phrase rangée dans une constante (même fichier ou importée) est contrôlée là où elle part", () => {
    const service = `
      import { journaliser, ErreurStudio } from "./_commun";
      import { MESSAGE_VOIX_ESSAI } from "@/moteurs/montage-avocat";
      const PHRASE = "Réessayez (HTTP 503).";
      export async function f() {
        await journaliser("echec", PHRASE);
        throw new ErreurStudio("X", MESSAGE_VOIX_ESSAI);
      }
    `;
    // Constante locale fautive : vue ; constante importée saine (« Reliez d'abord votre voix HeyGen… ») : rien.
    expect(analyser("src/services/faux.ts", service, false).map((x) => x.regle)).toEqual(["code HTTP écrit en clair"]);
  });

  /**
   * JONCTION paquet 4 : les nouveaux textes des équipes 3 à 7 (garde argent, scripts, avatar, série, TikTok) et des
   * notifications persistées (équipe 2) passent bien par la garde étendue par l'équipe 1. On injecte une faute dans
   * le VRAI fichier, à l'endroit du texte : la garde doit la voir. Rouge si un texte sort de son champ (appel renommé,
   * message passé par un chemin que la garde ne lit pas) ou si le texte a changé (mettre l'extrait à jour).
   */
  it("jonction paquet 4 : les textes ajoutés par les équipes 2 à 7 sont bien contrôlés (faute injectée vue)", () => {
    const points: { fichier: string; extrait: string; equipe: string }[] = [
      { fichier: "src/services/serie-ecriture.ts", extrait: "Choisissez au moins une idée.", equipe: "6 · série (erreur)" },
      { fichier: "src/services/serie-ecriture.ts", extrait: " en écriture", equipe: "6 · série (Journal)" },
      { fichier: "src/services/serie-ecriture.ts", extrait: "Confirmez ce prix pour continuer.", equipe: "intégration · confirmation du total de la série" },
      { fichier: "src/services/publications.ts", extrait: "avant de publier le brouillon.", equipe: "7 · rappel « Votre marque » (notification persistée)" },
      { fichier: "src/services/series.ts", extrait: "Cette série existe déjà.", equipe: "7 · séries" },
      { fichier: "src/services/decors.ts", extrait: "elles arriveront sans nouveau paiement.", equipe: "3 · décors (constante)" },
      { fichier: "src/services/fabrication.ts", extrait: "Votre vidéo reste telle quelle.", equipe: "3 · retouche refusée (constante)" },
      { fichier: "src/services/personnages.ts", extrait: "Ce visage n'est pas encore prêt.", equipe: "5 · avatar par format" },
      { fichier: "src/services/notifications.ts", extrait: "Essai de notification par e-mail envoyé", equipe: "2 · notifications" },
      { fichier: "src/components/generateur/FeuilleSerie.tsx", extrait: "Calcul du prix", equipe: "6 · feuille de série (écran)" },
      { fichier: "src/components/personnages/OngletVisages.tsx", extrait: "Visage par défaut", equipe: "5 · avatar (écran)" },
    ];
    const manques: string[] = [];
    for (const p of points) {
      const source = readFileSync(join(RACINE, p.fichier), "utf8");
      expect(source.includes(p.extrait), `${p.fichier} : extrait « ${p.extrait} » introuvable (texte changé ?)`).toBe(true);
      expect(analyser(p.fichier, source, estFichierEcran(p.fichier)), p.fichier).toEqual([]);
      const fautif = source.replace(p.extrait, `${p.extrait} Simulation HTTP 503`);
      if (!analyser(p.fichier, fautif, estFichierEcran(p.fichier)).length) manques.push(`${p.equipe} — ${p.fichier} : « ${p.extrait} » n'est plus contrôlé`);
    }
    expect(manques).toEqual([]);
  });

  it("ne crie pas au loup : comparaisons, console, classes CSS et codes internes sont ignorés", () => {
    const sain = `
      "use client";
      export function Ecran({ r }: { r: { code: string } }) {
        console.warn("HEYGEN_API_KEY absente : error 503");
        if (r.code === "CONFIRMATION_REQUISE") return null;
        return <div className="flex items-center" data-etat="error">Envoyé à Buffer et HeyGen.</div>;
      }
    `;
    expect(analyser("src/components/Sain.tsx", sain, true)).toEqual([]);
  });
});
