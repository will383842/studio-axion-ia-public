/**
 * COUL-01 (refonte du Studio, lot R1) : les jetons de couleur.
 * - contrastes WCAG des paires texte/fond clés (≥ 4,5:1) ;
 * - chaque nom de :root existe aussi dans .theme-sombre ;
 * - aucun jeton ancien n'a été renommé ni retiré ;
 * - garde de l'orange : le nombre d'usages d'orange d'accent ne peut que BAISSER.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lireJeton } from "@/components/bibliotheque/outils";

const RACINE = join(__dirname, "../..");
const CSS = readFileSync(join(RACINE, "src/app/globals.css"), "utf-8");

function bloc(sel: string): string {
  const i = CSS.indexOf(`\n${sel} {`);
  expect(i, `bloc ${sel}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(i, CSS.indexOf("\n}", i));
}
const racine = bloc(":root");
const sombre = bloc(".theme-sombre");
const barre = bloc(".theme-barre");

const noms = (b: string) => new Set([...b.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!));

/** Valeur d'un jeton dans un bloc, en suivant les var(--autre) (cherchés dans le bloc, puis dans :root). */
function valeur(b: string, nom: string, profondeur = 0): string {
  const m = new RegExp(`^\\s*--${nom}:\\s*([^;]+);`, "m").exec(b) ?? new RegExp(`^\\s*--${nom}:\\s*([^;]+);`, "m").exec(racine);
  expect(m, `jeton --${nom}`).not.toBeNull();
  const v = m![1]!.trim();
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(v);
  if (ref && profondeur < 5) return valeur(b, ref[1]!, profondeur + 1);
  return v;
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Paires [texte, fond] à 4,5:1 au moins, dans :root puis dans .theme-sombre. */
const SURFACES = ["fond", "surface-1", "surface-2", "surface-3"];
const PAIRES: Array<[string, string]> = [
  ...["texte", "texte-doux", "texte-faible"].flatMap((t) => SURFACES.map((f): [string, string] => [t, f])),
  ["orange-vif", "fond"], ["orange-vif", "surface-1"],
  ["sur-orange", "orange"], ["sur-orange", "orange-vif"],
  ["accent", "fond"], ["accent", "surface-1"], ["accent", "accent-doux"], ["sur-accent", "accent"],
  ["sauge", "fond"], ["sauge", "surface-1"], ["sauge", "sauge-doux"],
  ["ambre", "fond"], ["ambre", "surface-1"], ["ambre", "ambre-doux"],
  ["brique", "fond"], ["brique", "surface-1"], ["brique", "brique-doux"],
  ["fam-video", "fam-video-doux"], ["fam-carrousel", "fam-carrousel-doux"], ["fam-infographie", "fam-infographie-doux"],
  ["fam-video", "surface-1"], ["fam-carrousel", "surface-1"], ["fam-infographie", "surface-1"],
  ["barre-texte", "barre-fond"], ["barre-doux", "barre-fond"], ["barre-faible", "barre-fond"], ["barre-accent", "barre-fond"],
  ["barre-texte", "barre-actif"], ["barre-doux", "barre-actif"], ["barre-faible", "barre-actif"],
  ["toast-texte", "toast"], ["toast-accent", "toast"], ["toast-ok", "toast"], ["toast-erreur", "toast"], ["toast-alerte", "toast"], ["ecran-texte", "ecran"],
  ...["brouillon", "fabrication", "valider", "retouche", "accepte", "programme", "publie", "corriger"].map((s): [string, string] => [`statut-${s}-texte`, `statut-${s}-fond`]),
  ["statut-refuse-texte", "fond"],
];

describe("COUL-01 : contrastes ≥ 4,5:1", () => {
  it.each(PAIRES)("clair : %s sur %s", (t, f) => {
    expect(ratio(valeur(racine, t), valeur(racine, f)), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
  });
  // Dans la zone sombre, seules les paires qui y servent (aperçus de vidéo, écran caméra) : pas la barre claire.
  const SANS_BARRE = PAIRES.filter(([t]) => !t.startsWith("barre-"));
  it.each(SANS_BARRE.filter(([t, f]) => !(t === "sur-orange" && f === "orange-vif")))("sombre : %s sur %s", (t, f) => {
    expect(ratio(valeur(sombre, t), valeur(sombre, f)), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
  });
  it("barre-ok : au moins 4,5:1 sur le fond de la barre", () => {
    expect(ratio(valeur(racine, "barre-ok"), valeur(racine, "barre-fond"))).toBeGreaterThanOrEqual(4.5);
  });
  it("bord des champs : ≥ 3:1 sur blanc", () => {
    expect(ratio(valeur(racine, "trait-champ"), valeur(racine, "surface-1"))).toBeGreaterThanOrEqual(3);
  });
  it(".theme-barre : le texte reprend les couleurs de la barre", () => {
    expect(valeur(barre, "texte")).toBe(valeur(racine, "barre-texte"));
    for (const t of ["texte", "texte-doux", "texte-faible"])
      for (const f of ["fond", "surface-1", "surface-2", "surface-3"]) expect(ratio(valeur(barre, t), valeur(barre, f)), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("COUL-01 : les noms", () => {
  it("chaque nom de :root existe aussi dans .theme-sombre (sauf tailles de barres)", () => {
    const attendu = [...noms(racine)].filter((n) => n !== "--hauteur-onglets-bas" && !n.startsWith("--largeur-barre") && n !== "--police-titre");
    const manquants = attendu.filter((n) => !noms(sombre).has(n));
    expect(manquants).toEqual([]);
  });
  it("aucun jeton ancien n'est renommé ni retiré", () => {
    const ANCIENS = [
      "fond", "surface-1", "surface-2", "surface-3", "trait", "trait-fort", "texte", "texte-doux", "texte-faible",
      "orange", "orange-vif", "orange-doux", "sur-orange", "sauge", "sauge-doux", "ambre", "ambre-doux", "brique", "brique-doux",
      "voile", "lueur", "lueur-forte", "ombre-carte", "ombre-orange", "hauteur-onglets-bas", "largeur-barre", "largeur-barre-repliee", "largeur-barre-courante",
    ];
    for (const n of ANCIENS) expect(noms(racine).has(`--${n}`), `--${n}`).toBe(true);
    for (const c of ["fond", "surface-1", "surface-2", "surface-3", "trait", "trait-fort", "texte", "texte-doux", "texte-faible", "orange", "orange-vif", "orange-doux", "sur-orange", "sauge", "sauge-doux", "ambre", "ambre-doux", "brique", "brique-doux", "voile"])
      expect(CSS, `--color-${c}`).toMatch(new RegExp(`--color-${c}:\\s*var\\(--${c}\\)`));
    expect(CSS).toMatch(/--font-titre:/);
    expect(CSS).toMatch(/--radius-carte:\s*12px/);
    expect(CSS).toMatch(/--radius-champ:\s*10px/);
  });
  it("les nouveaux jetons sont là", () => {
    for (const n of ["accent", "accent-doux", "trait-champ", "squelette", "ombre", "ecran", "toast", "barre-fond", "barre-texte", "fam-video", "fam-carrousel", "fam-infographie", "statut-valider-fond", "statut-refuse-texte", "charte-orange", "charte-ivoire", "charte-noir"])
      expect(noms(racine).has(`--${n}`), `--${n}`).toBe(true);
  });
  it("la charte figée ne change pas", () => {
    expect(valeur(racine, "charte-orange").toLowerCase()).toBe("#b23f16");
    expect(valeur(racine, "charte-ivoire").toLowerCase()).toBe("#faf9f5");
    expect(valeur(racine, "charte-noir").toLowerCase()).toBe("#141413");
    expect(valeur(racine, "charte-orange-vif").toLowerCase()).toBe("#9a3412");
    for (const n of ["charte-orange", "charte-orange-vif", "charte-ivoire", "charte-noir"]) expect(valeur(sombre, n)).toBe(valeur(racine, n));
  });
  it("les halos orange sont neutralisés", () => {
    for (const n of ["lueur", "lueur-forte"]) expect(racine, n).toContain(`--${n}: linear-gradient(transparent, transparent);`);
    expect(racine).toMatch(/--ombre-orange:\s*var\(--ombre\)/);
  });
  it("focus et surlignage en accent", () => {
    expect(CSS).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\)/);
    expect(CSS).toMatch(/::selection\s*\{\s*background:\s*var\(--accent\)/);
  });
});

describe("COUL-01 : le contenu lit la charte figée", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("lireJeton renvoie la charte pour orange, orange-vif, fond et texte (pas les couleurs d'interface)", () => {
    const jetons: Record<string, string> = { "--orange": "#b4512a", "--charte-orange": "#b23f16", "--orange-vif": "#a54623", "--charte-orange-vif": "#9a3412", "--fond": "#f3f7fb", "--charte-ivoire": "#faf9f5", "--texte": "#14212e", "--charte-noir": "#141413", "--sauge": "#2a6234" };
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (n: string) => ` ${jetons[n] ?? ""} ` }));
    expect(lireJeton("orange")).toBe("#b23f16");
    expect(lireJeton("orange-vif")).toBe("#9a3412");
    expect(lireJeton("fond")).toBe("#faf9f5");
    expect(lireJeton("texte")).toBe("#141413");
    expect(lireJeton("sauge")).toBe("#2a6234");
  });
  it("les surfaces sombres vont en s'éclaircissant à partir du fond", () => {
    const l = ["fond", "surface-1", "surface-2", "surface-3"].map((n) => lum(valeur(sombre, n)));
    expect(l[1]! > l[0]! && l[2]! > l[1]! && l[3]! > l[2]!).toBe(true);
  });
});

/** Usages de classes d'orange d'accent + halos, dans src/. Ce nombre ne peut que baisser (chaque lot remplace l'orange d'accent par --accent). */
const ORANGE_MAX = 518; // mesuré après R5 (540) et R8a (Résultats, Ressources, Sur le site, mots-clés à l'accent) ; ne peut que baisser
const CLASSE_ORANGE = /(?<![\w-])(?:[a-z0-9[\]:_-]+:)?(?:bg|text|border(?:-[trblxy])?|shadow|ring|from|to|via|outline|decoration|fill|stroke|divide)-orange(?:-vif|-doux)?(?:\/\d+)?(?![\w-])|(?<![\w-])lueur(?:-forte)?(?![\w-])/g;

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

describe("COUL-01 : garde de l'orange", () => {
  it(`au plus ${ORANGE_MAX} usages de classes orange / lueur dans src/ (il ne peut que baisser)`, () => {
    let total = 0;
    for (const f of fichiers(join(RACINE, "src"))) total += (readFileSync(f, "utf-8").match(CLASSE_ORANGE) ?? []).length;
    expect(total).toBeLessThanOrEqual(ORANGE_MAX);
  }, 60_000);
});
