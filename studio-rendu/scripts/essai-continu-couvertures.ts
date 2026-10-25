/**
 * ESSAI RÉEL des sept couvertures du carrousel continu (lot P3a), par le vrai Remotion et l'opération `toile-continue` du lot P2.
 * Chaque couverture est posée SEULE au milieu d'une toile de 3 pages (X00, C0x, X02), en 4:5 et en 3:4, avec trois contenus : moyen (la
 * maquette), minimal (un mot par champ) et maximal (chaque champ au budget du schéma, en mots longs). Elle est aussi posée en page 1
 * (C0x, X01, X02) avec le contenu maximal : les zones interdites de Meta ne s'appliquent qu'à la page 1.
 * Fautes : toute mesure non nulle (débordement, couture, marge, coin réservé, Meta page 1, chevauchement), police < 26 px, JPEG > 400 Ko.
 * Sortie : `essais-visuels/continu/p3a/` (JPEG 4:5 de contenu moyen, `mesures.json`) ; les autres rendus restent dans le dossier de travail.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-couvertures.ts [C01 C02 …]
 * Navigateur : le Chrome Headless Shell de Remotion (`ensureBrowser`), ou `STUDIO_RENDU_NAVIGATEUR` s'il désigne ce même binaire.
 */
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { HAUTEURS, LARGEUR_PAGE, RUBRIQUE_MAX, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version.js";
import { creerToileContinue, rendreToileAvecRemotion } from "../src/operations/toile-continue.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (navigateur?.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");
if (!navigateur) {
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
}

const OCTETS_JPEG_MAX = 400 * 1024;
const TYPES = process.argv.slice(2).length ? process.argv.slice(2) : ["C01", "C02", "C03", "C04", "C05", "C06", "C07"];
type Valeur = unknown;
type Gabarit = (typeof GABARITS)[number];

/**
 * Texte MAXIMAL du champ situé à `chemin`, sondé sur le schéma : mots longs (« professionnalisation », « automatiquement ») coupés au plus
 * long mot accepté, puis le plus grand nombre de caractères accepté (budget plein).
 */
function maximal(g: Gabarit, chemin: (string | number)[]): string {
  const passe = (t: string) => g.schema.safeParse(remplacer(g.exemple, chemin, t)).success;
  let motMax = 1;
  while (motMax < 30 && passe("a".repeat(motMax + 1))) motMax++;
  const mots = ["professionnalisation", "automatiquement"].map((m) => m.slice(0, motMax));
  const suite = Array.from({ length: 60 }, (_, i) => mots[i % 2]).join(" ");
  for (let n = 200; n > 0; n--) {
    const t = suite.slice(0, n).trim();
    if (passe(t)) return t;
  }
  throw new Error(`${g.type} ${chemin.join(".")} : aucun texte maximal accepté`);
}

function remplacer(objet: Valeur, chemin: (string | number)[], valeur: Valeur): Valeur {
  const copie = structuredClone(objet) as Record<string | number, Valeur>;
  let cur = copie;
  chemin.slice(0, -1).forEach((k) => (cur = cur[k] as Record<string | number, Valeur>));
  cur[chemin[chemin.length - 1]] = valeur;
  return copie;
}

/** Chemins de tous les textes de l'exemple (hors `type`, `alt`, `rubrique`). */
function textes(valeur: Valeur, chemin: (string | number)[] = []): (string | number)[][] {
  if (typeof valeur === "string") return [chemin];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => textes(v, [...chemin, i]));
  if (valeur && typeof valeur === "object") return Object.entries(valeur).flatMap(([k, v]) => (["type", "alt", "rubrique"].includes(k) ? [] : textes(v, [...chemin, k])));
  return [];
}

const lire = (objet: Valeur, chemin: (string | number)[]) => chemin.reduce<Valeur>((o, k) => (o as Record<string | number, Valeur>)[k], objet) as string;

function contenu(g: Gabarit, variante: "moyen" | "minimal" | "maximal"): Record<string, unknown> {
  let c: Valeur = g.exemple;
  for (const chemin of textes(g.exemple)) {
    if (variante === "minimal") c = remplacer(c, chemin, lire(g.exemple, chemin).split(/\s+/)[0].slice(0, 12));
    if (variante === "maximal") c = remplacer(c, chemin, maximal(g, chemin));
  }
  if (variante === "maximal") c = remplacer(c, ["rubrique"], "Professionnalisation auto".slice(0, RUBRIQUE_MAX));
  const validation = g.schema.safeParse(c);
  if (!validation.success) throw new Error(`${g.type} (${variante}) : contenu refusé par le schéma : ${validation.error.message}`);
  return validation.data as Record<string, unknown>;
}

const sortieRacine = resolve("essais-visuels", "continu", "p3a");
mkdirSync(sortieRacine, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-couvertures-"));
const ADRESSE = "http://127.0.0.1/p3a/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const cible = join(travail, "depots", decodeURIComponent(new URL(url).pathname.slice("/p3a/".length)));
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(chemin, cible);
  },
});

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const type of TYPES) {
  const g = GABARITS.find((x) => x.type === type);
  if (!g) throw new Error(`Couverture inconnue : ${type}`);
  const cas: { nom: string; variante: "moyen" | "minimal" | "maximal"; format: FormatToile; page1: boolean }[] = [];
  for (const format of ["4:5", "3:4"] as const) {
    for (const variante of ["moyen", "minimal", "maximal"] as const) cas.push({ nom: `${type}-${variante}-${format.replace(":", "x")}`, variante, format, page1: false });
    cas.push({ nom: `${type}-page1-maximal-${format.replace(":", "x")}`, variante: "maximal", format, page1: true });
  }
  for (const c of cas) {
    const types = c.page1 ? [type, "X01", "X02"] : ["X00", type, "X02"];
    const index = types.indexOf(type);
    const pages = types.map((t) => {
      const x = GABARITS.find((y) => y.type === t)!;
      return t === type ? { ...contenu(g, c.variante) } : { ...x.exemple, rubrique: "Méthode" };
    });
    const vus = new Set(types);
    const proprietes = {
      toile: { version: "toile/1", format: c.format, pages, raccords: [] },
      versions: { socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(GABARITS.filter((x) => vus.has(x.type)).map((x) => [x.type, x.version])), parcours: {}, raccords: {} },
    };
    const depotsPages = types.map((_, i) => ({ cle: `${c.nom}/page-${i + 1}.jpg`, urlDepot: `${ADRESSE}${c.nom}/page-${i + 1}.jpg` }));
    try {
      const r = await op(
        { idRendu: c.nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}${c.nom}/bande.jpg`, cle: `${c.nom}/bande.jpg` }, parametres: { proprietes, depotsPages } },
        { progression: () => {}, dossier: mkdtempSync(join(travail, `${c.nom}-`)), signal: new AbortController().signal },
      );
      const m = (r.mesures ?? {}) as Record<string, number>;
      const jpeg = join(travail, "depots", depotsPages[index].cle);
      const octets = statSync(jpeg).size;
      const fautes = [
        m.hauteur !== HAUTEURS[c.format] && `hauteur ${m.hauteur}`,
        m.largeur !== 3 * LARGEUR_PAGE && `largeur ${m.largeur}`,
        m.debordements !== 0 && `${m.debordements} débordement(s)`,
        !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
        m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
        m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
        m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
        m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta en page 1`,
        m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
        octets > OCTETS_JPEG_MAX && `${Math.round(octets / 1024)} Ko (> 400 Ko)`,
      ].filter(Boolean) as string[];
      resultats[c.nom] = { mesures: m, octets, fautes };
      console.log(`${c.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [police min ${m.taillePoliceMin}, ${Math.round(octets / 1024)} Ko]`);
      if (fautes.length) echecs.push(`${c.nom} : ${fautes.join(", ")}`);
      // Garde les rendus de contenu moyen (4:5 et 3:4) et le maximal en 3:4 ; les autres restent dans le dossier de travail.
      if (!c.page1 && (c.variante === "moyen" || c.variante === "maximal")) copyFileSync(jpeg, join(sortieRacine, `${c.nom}.jpg`));
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err).slice(0, 400);
      resultats[c.nom] = { erreur: message };
      console.log(`${c.nom} : ÉCHEC ${message}`);
      echecs.push(`${c.nom} : ${message}`);
    }
  }
}
writeFileSync(join(sortieRacine, TYPES.length === 7 ? "mesures.json" : "mesures-partielles.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} cas en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${Object.keys(resultats).length} rendus, toutes les mesures à 0, police ≥ 26. Mesures : essais-visuels/continu/p3a/mesures.json`);
process.exit(0);
