import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "../..");
const CSS = readFileSync(join(RACINE, "src/app/globals.css"), "utf-8");

/** Les couleurs du thème, lues dans globals.css (`--color-xxx:` du bloc @theme), jamais recopiées. */
export function couleursTheme(css: string): Set<string> {
  const noms = new Set<string>();
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) if (m[1] !== undefined) noms.add(m[1]);
  return noms;
}

const PREFIXES = "bg|text|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|from|to|via|divide|outline|decoration|accent|caret|placeholder|shadow";
const SPECIAUX = new Set(["transparent", "current", "inherit"]);
/** Noms de la palette Tailwind par défaut (supprimée par `--color-*: initial`) + black/white. */
const PALETTE = "black|white|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone";
const CLASSE = new RegExp(`(?<![\\w-])(?:[a-z0-9\\[\\]:_-]+:)?(?:${PREFIXES})-((?:${PALETTE})(?:-\\d{2,3})?)(?:/\\d+)?(?![\\w-])`, "g");

/** Valeurs qui suivent ces préfixes sans être des couleurs (tailles, alignements, styles, utilitaires). */
const PAS_COULEUR = new Set([
  "xs", "sm", "base", "lg", "xl", "left", "center", "right", "justify", "start", "end", "wrap", "nowrap", "balance", "pretty", "ellipsis", "clip",
  "t", "r", "b", "l", "x", "y", "s", "e", "solid", "dashed", "dotted", "double", "hidden", "none", "collapse", "separate", "spacing", "opacity", "offset",
  "cover", "contain", "auto", "fixed", "local", "scroll", "repeat", "no-repeat", "bottom", "top", "left-top", "clip-text", "origin", "blend", "linear", "radial", "conic", "gradient",
  "inherit", "underline", "overline", "line-through", "no-underline", "from-font", "wavy", "uppercase", "lowercase", "capitalize", "normal-case", "truncate", "break", "balance",
  "color", "dashoffset", "width", "inset", "sizing", "foreground", "background", "current", "transparent", "mono", "sans", "serif", "titre", "texte", "carte", "champ", "orange", "ease", "studio",
]);
const CLASSE_INCONNUE = new RegExp(`(?<![\\w-])(?:[a-z0-9\\[\\]:_-]+:)?(?:bg|text|border|ring|fill|stroke|divide|outline|accent|caret|placeholder)-((?!\\[)[a-z][a-z-]*)(?:/\\d+)?(?![\\w[(-])`, "g");

/** Classes de couleur dont le nom est absent du thème. `orange` seul est un jeton ; `orange-500` n'en est pas un. */
export function classesHorsTheme(source: string, theme: Set<string>): string[] {
  const fautes: string[] = [];
  for (const m of source.matchAll(CLASSE)) {
    const nom = m[1]!;
    if (SPECIAUX.has(nom) || theme.has(nom)) continue;
    fautes.push(m[0]);
  }
  for (const m of source.matchAll(CLASSE_INCONNUE)) {
    // « border-t-orange », « ring-offset-fond », « bg-linear-to-t » : on retire le côté, le décalage ou la direction avant de comparer.
    const nom = m[1]!.replace(/^(?:linear-to-[a-z]+|(?:[trblxyse]|offset)-)/, "");
    if (nom === "" || SPECIAUX.has(nom) || theme.has(nom) || PAS_COULEUR.has(nom) || PALETTE.split("|").includes(nom)) continue;
    fautes.push(m[0]);
  }
  return fautes;
}

const PREFIXES_COULEUR = "bg|text|border(?:-[trblxyse])?|ring|fill|stroke|from|to|via|divide|outline|decoration|accent|caret|placeholder|shadow";
const CLASSE_CROCHETS = new RegExp(`(?<![\\w-])(?:[a-z0-9\\[\\]:_-]+:)?(?:${PREFIXES_COULEUR})-\\[(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\\(|${PALETTE}\\b)[^\\]]*\\]`, "gi");
const STYLE_LITTERAL = /\b(?:color|background(?:Color)?|(?:border|outline|caret|fill|stroke)(?:Color)?)\s*:\s*["'`]\s*(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch|oklab)\(|(?:black|white|red|green|blue|yellow|orange|gray|grey|pink|purple)\b)/gi;

/** Couleurs écrites en dur : valeur entre crochets (`bg-[#fff]`, `text-[rgb(…)]`) ou `style={{ color: "white" }}`. */
export function couleursEnDur(source: string): string[] {
  return [...source.matchAll(CLASSE_CROCHETS), ...source.matchAll(STYLE_LITTERAL)].map((m) => m[0]);
}

function fichiers(dossier: string, extensions = /\.tsx$/): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin, extensions) : extensions.test(nom) && !/\.(?:d|test)\.ts$/.test(nom) ? [chemin] : [];
  });
}

/** Périmètre des carrousels : écrans, composants, services et domaine, .ts comme .tsx (une classe peut vivre dans un .ts). */
const PERIMETRE_CARROUSELS = ["src/components/visuels", "src/app/(studio)/carrousels", "src/visuels", "src/domaine/visuels", "src/domaine/controles-visuel"];
const sourcesCarrousels = () => PERIMETRE_CARROUSELS.flatMap((d) => fichiers(join(RACINE, d), /\.tsx?$/));

describe("couleurs : seulement les jetons du thème (globals.css)", () => {
  const theme = couleursTheme(CSS);
  it("la liste du thème est lue dans le fichier", () => {
    expect(theme.has("fond")).toBe(true);
    expect(theme.has("voile")).toBe(true);
    expect(theme.has("white")).toBe(false);
  });
  it("aucune classe src/**/*.tsx n'emploie une couleur absente du thème", () => {
    const fautes: string[] = [];
    for (const f of fichiers(join(RACINE, "src"))) {
      readFileSync(f, "utf-8").split("\n").forEach((ligne, i) => {
        for (const c of classesHorsTheme(ligne, theme)) fautes.push(`${relative(RACINE, f)}:${i + 1}: ${c}`);
      });
    }
    expect(fautes).toEqual([]);
  });
  it("carrousels (.ts et .tsx) : ni couleur hors thème, ni couleur en dur (crochets, style en ligne)", () => {
    const fautes: string[] = [];
    const sources = sourcesCarrousels();
    expect(sources.length).toBeGreaterThan(20);
    for (const f of sources) {
      readFileSync(f, "utf-8").split("\n").forEach((ligne, i) => {
        for (const c of [...classesHorsTheme(ligne, theme), ...couleursEnDur(ligne)]) fautes.push(`${relative(RACINE, f)}:${i + 1}: ${c}`);
      });
    }
    expect(fautes).toEqual([]);
  });
  it.each(['className="bg-[#fff]"', 'className="text-[rgb(10,20,30)]"', 'className="hover:border-[#a1b2c3]"', "style={{ color: 'white' }}", 'style={{ backgroundColor: "#fff" }}', 'const c = "from-[hsl(10,10%,10%)]"'])("détecte en dur : %s", (src) => {
    expect(couleursEnDur(src)).toHaveLength(1);
  });
  it.each(['className="text-[14px] bg-[length:10px] w-[calc(100%-2px)]"', 'className="bg-fond text-[var(--texte)]"', "style={{ width: 'auto' }}"])("laisse passer : %s", (src) => {
    expect(couleursEnDur(src)).toEqual([]);
  });
  it.each(["bg-black/90", "text-white", "border-white", "bg-white", "bg-red-500", "text-yellow-300", "hover:bg-gray-100", "bg-black"])("détecte %s", (c) => {
    expect(classesHorsTheme(`className="${c}"`, theme)).toHaveLength(1);
  });
  it("détecte un nom inventé (border-bordure)", () => {
    expect(classesHorsTheme('className="border border-bordure"', theme)).toEqual(["border-bordure"]);
  });
  it.each(["bg-fond", "text-texte-doux", "bg-orange text-sur-orange", "border-trait-fort", "bg-voile", "bg-transparent", "text-sm", "border-t", "print:bg-fond"])("accepte %s", (c) => {
    expect(classesHorsTheme(`className="${c}"`, theme)).toEqual([]);
  });
});

describe("visionneuse : fond opaque aux jetons du thème", () => {
  it("fond bg-fond opaque, compteur en text-texte, image contenue", () => {
    const src = readFileSync(join(RACINE, "src/components/visuels/VisionneusePages.tsx"), "utf-8");
    expect(src).toMatch(/fixed inset-0[^"]*\bbg-fond\b/);
    expect(src).toMatch(/aria-live="polite" className="[^"]*text-texte/);
    expect(src).toMatch(/min-h-0 flex-1[^"]*overflow-hidden/);
  });
});
