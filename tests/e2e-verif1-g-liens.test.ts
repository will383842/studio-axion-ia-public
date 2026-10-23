/**
 * VÉRIFICATION E2E n° 1 — AGENT g — AUCUN LIEN INTERNE VERS UN ÉCRAN MORT.
 *
 * Analyse statique (compilateur TypeScript) de tout `src/` : chaque adresse interne écrite dans un `href`, une
 * propriété `href`/`lien` (navigation, tuiles, notifications, recherche), `router.push/replace`, `redirect`,
 * `permanentRedirect` et `revalidatePath` doit mener à une page qui EXISTE dans `src/app` (groupes `(studio)` retirés,
 * segments dynamiques `[id]` acceptés). Un gabarit `` `/videos/${id}` `` vaut « /videos/<quelque chose> ».
 * Contrôles en plus, là où la page refuse les valeurs inconnues (notFound) :
 *  - `/bibliotheque/<type>` : un type de la bibliothèque (TYPES_BIBLIOTHEQUE, ou « rushs ») ;
 *  - `/formats/<id>` et `/nouvelle/<id>` : un format du registre ;
 *  - `/reglages#<ancre>` : une section qui porte cet `id` ;
 *  - `/ecrire?onglet=` et `/videos?vue=` : une valeur lue par la page ;
 *  - les maquettes (`/maquettes-generateur`, `/styleguide`, fermées en production par src/proxy.ts) ne sont liées que
 *    depuis elles-mêmes ;
 *  - les identifiants de la démonstration (`/videos/v-03`, `/personnages/p-will`…) ne sont écrits en dur que dans la
 *    démonstration ou les maquettes.
 * Vérifié aussi en vrai (agent g, 04/10) : `next build` + serveur autonome, connexion, environ 200 pages distinctes visitées par Chromium (réglages d'essai, puis réglages de production à clés factices)
 * en suivant tous les liens : aucune 404 ni 500 hors des maquettes fermées.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { TYPES_BIBLIOTHEQUE } from "@/domaine/libelles";
import { trouverFormat } from "@/formats";

const RACINE = join(__dirname, "..");
const SRC = join(RACINE, "src");
const APP = join(SRC, "app");
const JOKER = "\u0000";

function fichiers(dossier: string, filtre: (f: string) => boolean): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? (n === "node_modules" ? [] : fichiers(p, filtre)) : filtre(p) ? [p] : [];
  });
}

// ─── Les pages qui existent ────────────────────────────────────────────────────────────────────────────────

type Route = { segments: string[]; fichier: string };
const ROUTES: Route[] = fichiers(APP, (f) => /[\\/]page\.tsx$/.test(f)).map((f) => ({
  fichier: relative(RACINE, f),
  segments: relative(APP, f)
    .split(sep)
    .slice(0, -1)
    .filter((s) => !/^\(.*\)$/.test(s)),
}));

const estDynamique = (s: string) => /^\[.+\]$/.test(s);
const estAttrapeTout = (s: string) => /^\[\[?\.\.\./.test(s);

function routePour(chemin: string): Route | undefined {
  const segs = chemin.split("/").filter(Boolean);
  const candidates = ROUTES.filter((r) => {
    if (r.segments.some(estAttrapeTout)) return segs.length >= r.segments.length - 1;
    if (r.segments.length !== segs.length) return false;
    return r.segments.every((rs, i) => estDynamique(rs) || segs[i].includes(JOKER) || rs === segs[i]);
  });
  // Une page statique passe avant une page dynamique (/videos/a-ranger avant /videos/[id]).
  return candidates.sort((a, b) => a.segments.filter(estDynamique).length - b.segments.filter(estDynamique).length)[0];
}

// ─── Les adresses écrites dans le code ───────────────────────────────────────────────────────────────────────

type Lien = { brut: string; chemin: string; requete: string; ancre: string; fichier: string; ligne: number; contexte: string };

const PROPRIETES_LIEN = new Set(["href", "lien"]);
const APPELS_NAVIGATION = new Set(["redirect", "permanentRedirect", "router.push", "router.replace", "revalidatePath"]);

function texteDe(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => JOKER + s.literal.text).join("");
  return null;
}

/** Les textes possibles d'une expression : littéral, gabarit, `a ? "x" : "y"`, `x ?? "y"`, parenthèses. */
function textesPossibles(n: ts.Node): string[] {
  const t = texteDe(n);
  if (t !== null) return [t];
  if (ts.isParenthesizedExpression(n) || ts.isJsxExpression(n)) return n.expression ? textesPossibles(n.expression) : [];
  if (ts.isConditionalExpression(n)) return [...textesPossibles(n.whenTrue), ...textesPossibles(n.whenFalse)];
  if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) return [...textesPossibles(n.left), ...textesPossibles(n.right)];
  return [];
}

function decouper(brut: string): Pick<Lien, "chemin" | "requete" | "ancre"> {
  const ancre = brut.includes("#") ? brut.slice(brut.indexOf("#") + 1) : "";
  const sansAncre = brut.split("#")[0];
  const requete = sansAncre.includes("?") ? sansAncre.slice(sansAncre.indexOf("?") + 1) : "";
  return { chemin: sansAncre.split("?")[0], requete, ancre };
}

const LIENS: Lien[] = [];
for (const f of fichiers(SRC, (x) => /\.(ts|tsx)$/.test(x) && !/\.test\.ts$/.test(x))) {
  const rel = relative(RACINE, f);
  const source = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const noter = (expr: ts.Node, contexte: string) => {
    for (const brut of textesPossibles(expr)) {
      if (!brut.startsWith("/") || brut.startsWith("//") || brut.startsWith("/api/")) continue;
      const ligne = source.getLineAndCharacterOfPosition(expr.getStart()).line + 1;
      LIENS.push({ brut, ...decouper(brut), fichier: rel, ligne, contexte });
    }
  };
  const visiter = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.name.getText() === "href" && n.initializer) noter(n.initializer, "href");
    if (ts.isPropertyAssignment(n) && PROPRIETES_LIEN.has(n.name.getText())) noter(n.initializer, n.name.getText());
    if (ts.isCallExpression(n) && APPELS_NAVIGATION.has(n.expression.getText()) && n.arguments[0]) noter(n.arguments[0], n.expression.getText());
    ts.forEachChild(n, visiter);
  };
  visiter(source);
}

const EN_MAQUETTE = (fichier: string) => /src[\\/]app[\\/]\(studio\)[\\/](maquettes-generateur|styleguide)[\\/]/.test(fichier);
const montrer = (l: Lien) => `${l.fichier}:${l.ligne} [${l.contexte}] ${l.brut.replaceAll(JOKER, "${…}")}`;

describe("agent g — liens internes", () => {
  it("le relevé est complet (navigation, tuiles, notifications, redirections)", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(38);
    expect(LIENS.length).toBeGreaterThan(150);
    for (const attendu of ["/reglages", "/calendrier", "/ecrire/matieres", "/videos/a-ranger", "/connexion"]) expect(LIENS.some((l) => l.chemin === attendu)).toBe(true);
    // Les liens des notifications et de la recherche (services) sont relevés aussi.
    expect(LIENS.some((l) => l.fichier.includes("services") && l.contexte === "lien")).toBe(true);
  });

  it("le contrôle sait rougir : une adresse inventée n'a pas de page", () => {
    expect(routePour("/videos-perdues")).toBeUndefined();
    expect(routePour("/ecrire/sujets/x/lire")).toBeUndefined();
    expect(routePour(`/scripts/${JOKER}/versions`)).toBeUndefined();
    expect(routePour("/videos/a-ranger")?.fichier).toMatch(/a-ranger/);
    expect(routePour(`/personnages/${JOKER}`)?.fichier).toMatch(/\[id\]/);
  });

  it("toute adresse interne mène à une page qui existe", () => {
    const morts = LIENS.filter((l) => !routePour(l.chemin)).map(montrer);
    expect(morts, `Liens vers une page inexistante :\n${morts.join("\n")}`).toEqual([]);
  });

  it("les maquettes fermées en production ne sont liées que depuis les maquettes", () => {
    const fautifs = LIENS.filter((l) => /^\/(maquettes-generateur|styleguide)(\/|$)/.test(l.chemin) && !EN_MAQUETTE(l.fichier)).map(montrer);
    expect(fautifs).toEqual([]);
    // Et elles sont bien fermées en production par le proxy.
    expect(readFileSync(join(SRC, "proxy.ts"), "utf8")).toMatch(/FERMEES_EN_PRODUCTION = \/\^\\\/\(maquettes-generateur\|styleguide\)/);
  });

  it("/bibliotheque/<type>, /formats/<id>, /nouvelle/<id> : valeurs écrites en dur toutes connues", () => {
    const types = new Set<string>([...TYPES_BIBLIOTHEQUE.map((t) => t.type), "rushs"]);
    const fautifs: string[] = [];
    for (const l of LIENS) {
      const m = /^\/(bibliotheque|formats|nouvelle)\/([^/]+)$/.exec(l.chemin);
      if (!m || m[2].includes(JOKER)) continue;
      if (m[1] === "bibliotheque" ? !types.has(m[2]) : !trouverFormat(m[2])) fautifs.push(montrer(l));
    }
    expect(fautifs).toEqual([]);
  });

  it("/reglages#<ancre> : la section existe", () => {
    const page = readFileSync(join(APP, "(studio)", "reglages", "page.tsx"), "utf8");
    const ancres = new Set([...page.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
    const fautifs = LIENS.filter((l) => l.chemin === "/reglages" && l.ancre && !ancres.has(l.ancre)).map(montrer);
    expect(fautifs).toEqual([]);
  });

  it("/ecrire?onglet= et /videos?vue= : la page lit cette valeur", () => {
    const ecrire = readFileSync(join(APP, "(studio)", "ecrire", "page.tsx"), "utf8");
    const onglets = new Set([...(/const ONGLETS = \[([^\]]+)\]/.exec(ecrire)?.[1].matchAll(/"([a-z-]+)"/g) ?? [])].map((m) => m[1]));
    for (const ancien of ecrire.matchAll(/sp\.onglet === "([a-z-]+)"/g)) onglets.add(ancien[1]);
    expect(onglets.size).toBeGreaterThanOrEqual(4);
    const fautifs: string[] = [];
    for (const l of LIENS) {
      const p = new URLSearchParams(l.requete.replaceAll(JOKER, "x"));
      if (l.chemin === "/ecrire" && p.get("onglet") && !onglets.has(p.get("onglet")!)) fautifs.push(montrer(l));
      if (l.chemin === "/videos" && p.get("vue") && !["brouillons", "archivees"].includes(p.get("vue")!)) fautifs.push(montrer(l));
    }
    expect(fautifs).toEqual([]);
  });

  it("aucun identifiant de la démonstration écrit en dur hors démonstration et maquettes", () => {
    const fautifs = LIENS.filter((l) => /^\/(videos|personnages|scripts)\/(v|p|script)-[a-z0-9-]+$/.test(l.chemin) && !EN_MAQUETTE(l.fichier) && !l.fichier.includes(`donnees${sep}memoire${sep}demo`)).map(montrer);
    expect(fautifs).toEqual([]);
  });
});
