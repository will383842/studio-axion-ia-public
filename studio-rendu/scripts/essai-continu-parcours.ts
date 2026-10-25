/**
 * ESSAI RÉEL des huit parcours continus (lot P3h) par le vrai Remotion, via l'opération `toile-continue`. Pour chaque parcours : la toile
 * qui le contient seul (ou suivi de l'appel d'essai X02 quand il ne ferme pas la toile), en 4:5 et en 3:4, avec les textes de la maquette
 * (« moyen »), au budget MAXIMAL de chaque champ (mots longs) et au budget MINIMAL (1 caractère). Toutes les mesures doivent valoir 0, la
 * police au moins 26 px, et `debordCouture1` au moins 1 (le parcours commence). Les pages sont déposées dans
 * `essais-visuels/continu/p3h/<toile>/` ; `mesures.json` rassemble les mesures. Toute faute : code de sortie 1.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-parcours.ts [PA PB …] ; `ESSAI_RAPIDE=1` : contenu moyen en 4:5 seulement.
 * Navigateur : le Chrome Headless Shell de Remotion (`ensureBrowser`), ou `STUDIO_RENDU_NAVIGATEUR` s'il désigne ce même binaire.
 */
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { PARCOURS, PARCOURS_PRODUCTION } from "../../src/briques/visuels/continu/registre-parcours.js";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords.js";
import { HAUTEURS, LARGEUR_PAGE, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
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
type Contenu = "moyen" | "maximal" | "minimal";
// Mots longs courants (14 et 15 lettres) : « professionnalisation » (20) ne tient dans aucune des boîtes étroites, les budgets les en écartent.
const MOTS_LONGS = "accompagnement automatiquement ";
/** Boîtes étroites : plus long mot (lettres) qui y tient. Au-delà, la mesure du rendu refuse la page (elle est faite pour ça). */
const MOT_MAX: Record<string, number> = { "PE2.doc": 11 };
const gabarit = (type: string) => GABARITS.find((g) => g.type === type)!;

/** Plus grand nombre de caractères accepté par le champ (le schéma est la seule source des budgets). */
function budget(type: string, cle: string): number {
  const g = gabarit(type);
  let max = 0;
  for (let n = 1; n <= 200; n++) if (g.schema.safeParse({ ...g.exemple, [cle]: "a".repeat(n) }).success) max = n;
  return max;
}

/** Texte de `n` caractères fait de mots longs (les champs très courts, les « grands mots », prennent des lettres courantes). */
function remplir(n: number, motMax = 15): string {
  if (n <= 4) return "nuel".slice(0, n);
  let t = "";
  while (t.length < n) t += MOTS_LONGS.split(" ").map((m) => m.slice(0, motMax)).join(" ");
  return t.slice(0, n).trimEnd();
}

function page(type: string, contenu: Contenu): Record<string, unknown> {
  const exemple = { ...gabarit(type).exemple } as Record<string, unknown>;
  // La page d'appel d'essai n'est pas à éprouver : seul le parcours l'est.
  if (contenu === "moyen" || !PARCOURS_PRODUCTION.some((p) => p.pagesTypes.includes(type))) return exemple;
  for (const cle of Object.keys(exemple)) {
    if (["type", "alt", "rubrique"].includes(cle)) continue;
    exemple[cle] = contenu === "minimal" ? "A" : remplir(budget(type, cle), MOT_MAX[`${type}.${cle}`]);
  }
  if (contenu === "maximal" && exemple.rubrique) exemple.rubrique = "accompagnement automatiq";
  return exemple;
}

interface Essai {
  nom: string;
  format: FormatToile;
  types: string[];
  contenu: Contenu;
}

const filtre = process.argv.slice(2);
const ESSAIS: Essai[] = [];
for (const p of PARCOURS_PRODUCTION) {
  if (filtre.length && !filtre.includes(p.id)) continue;
  const types = [...p.pagesTypes, ...(p.termine ? [] : ["X02"])];
  const formats: [FormatToile, Contenu][] = process.env.ESSAI_RAPIDE ? [["4:5", "moyen"]] : [["4:5", "moyen"], ["3:4", "moyen"], ["4:5", "maximal"], ["3:4", "maximal"], ["4:5", "minimal"]];
  for (const [format, contenu] of formats) ESSAIS.push({ nom: `${p.id}-${format.replace(":", "x")}-${contenu}`, format, types, contenu });
}

function proprietes(e: Essai) {
  const pages = e.types.map((t) => page(t, e.contenu));
  const types = new Set(e.types);
  return {
    toile: { version: "toile/1", format: e.format, pages, raccords: [] },
    versions: {
      socle: VERSION_TOILE_SOCLE,
      gabarits: Object.fromEntries(GABARITS.filter((g) => types.has(g.type)).map((g) => [g.type, g.version])),
      parcours: Object.fromEntries(PARCOURS.filter((p) => p.pagesTypes.some((t) => types.has(t))).map((p) => [p.id, p.version])),
      raccords: Object.fromEntries(RACCORDS.map((r) => [r.type, r.version])),
    },
  };
}

const sortieRacine = resolve("essais-visuels", "continu", "p3h");
mkdirSync(sortieRacine, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-parcours-"));
const ADRESSE = "http://127.0.0.1/p3h/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const cible = join(sortieRacine, decodeURIComponent(new URL(url).pathname.slice("/p3h/".length)));
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(chemin, cible);
  },
});

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const e of ESSAIS) {
  const n = e.types.length;
  const hauteur = HAUTEURS[e.format];
  const dossier = mkdtempSync(join(travail, `${e.nom}-`));
  const depotsPages = e.types.map((_, i) => ({ cle: `${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg`, urlDepot: `${ADRESSE}${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg` }));
  try {
    const r = await op(
      { idRendu: e.nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}${e.nom}/bande.jpg`, cle: `${e.nom}/bande.jpg` }, parametres: { proprietes: proprietes(e), depotsPages } },
      { progression: () => {}, dossier, signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const octets = depotsPages.map((d) => statSync(join(sortieRacine, d.cle)).size);
    const fautes = [
      m.largeur !== n * LARGEUR_PAGE && `largeur ${m.largeur}`,
      m.hauteur !== hauteur && `hauteur ${m.hauteur}`,
      m.debordements !== 0 && `${m.debordements} débordement(s)`,
      !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
      m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
      m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
      m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
      m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta en page 1`,
      m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
      m.traitsFinsSurCouture !== 0 && `${m.traitsFinsSurCouture} trait(s) fin(s) sur une couture`,
      !(m.debordCouture1 >= 1) && "aucun objet à cheval sur la couture 1",
      ...octets.map((o, i) => o > OCTETS_JPEG_MAX && `page ${i + 1} : ${Math.round(o / 1024)} Ko (> 400 Ko)`),
    ].filter(Boolean) as string[];
    resultats[e.nom] = { format: e.format, contenu: e.contenu, pages: n, types: e.types, mesures: m, octetsParPage: octets, fautes };
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [${n} pages, police min ${m.taillePoliceMin}, à cheval c1 ${m.debordCouture1}, JPEG ${octets.map((o) => Math.round(o / 1024)).join("/")} Ko]`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 400);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
writeFileSync(join(sortieRacine, filtre.length ? `mesures-${filtre.join("-")}.json` : "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} toile(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${ESSAIS.length} toiles, toutes mesures à 0. Mesures : essais-visuels/continu/p3h/mesures.json`);
process.exit(0);
