/**
 * ESSAI RÉEL des sept listes (P3b) par le vrai Remotion : chaque plaquette est posée seule au milieu d'une toile de 3 pages (couverture X00,
 * liste, appel X02), en 4:5 et en 3:4, avec trois contenus : MOYEN (maquette), MINIMAL (textes courts, nombre minimal d'éléments) et MAXIMAL
 * (budget plein, mots longs, pour chaque nombre d'éléments). Toute mesure non nulle ou police < 26 px : code de sortie 1.
 * Garde `essais-visuels/continu/p3b/<ID>-<format>.jpg` (page de la liste, contenu moyen) et `mesures.json`.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-listes.ts [ID...]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BORNES_LISTES, budgetListe, LISTES, MOT_TITRE_MAX } from "../../src/briques/visuels/continu/familles/listes.js";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { HAUTEURS, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version.js";
import { creerToileContinue, rendreToileAvecRemotion } from "../src/operations/toile-continue.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (navigateur?.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");
if (!navigateur) {
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
}

type Dict = Record<string, unknown>;
const MOTS = ["professionnalisation", "automatiquement", "accompagnement", "organisation", "relances", "commerciales", "devis", "suivi"];

/** Texte d'au plus `max` caractères, fait des mots les plus longs qui tiennent (`motMax` : plus long mot admis). */
function plein(max: number, motMax = 20): string {
  const mots = MOTS.filter((m) => m.length <= motMax).concat(motMax < 20 ? ["Accompagnement", "Organisation", "Professionnels"].filter((m) => m.length <= motMax) : []);
  if (max <= motMax) return "Professionnalisation".slice(0, max);
  let s = "";
  for (let i = 0; i < 40; i++) {
    const m = mots.find((x, j) => j >= i % mots.length && s.length + (s ? 1 : 0) + x.length <= max);
    if (!m) break;
    s += (s ? " " : "") + m;
  }
  return s || "Professionnalisation".slice(0, max);
}

const NOM_LISTE: Record<string, string> = { L01: "items", L02: "items", L03: "etapes", L04: "etapes", L05: "lignes", L06: "points", L07: "items" };

function contenu(type: string, cas: "moyen" | "minimal" | "maximal", n: number): Dict {
  const g = LISTES.find((x) => x.type === type)!;
  const base = g.exemple as Dict;
  if (cas === "moyen") return base;
  const b = budgetListe(type, n);
  const modele = base[NOM_LISTE[type]] as Dict[];
  // Mots les plus longs que le schéma accepte : on réduit le plus long mot jusqu'à ce que le contenu passe.
  for (const motMax of [20, 16, 14, 12, 10, 8]) {
    const valeur = (budget: number | undefined, mot = motMax) => (cas === "minimal" ? "Ok" : plein(budget ?? 10, mot));
    const elements = Array.from({ length: n }, (_, i) => Object.fromEntries(Object.entries(modele[i % modele.length]).map(([k, v]) => [k, typeof v === "string" && k !== "icone" ? valeur(b.element[k]) : v])));
    const c = { ...base, titre: valeur(b.page.titre, Math.min(motMax, MOT_TITRE_MAX)), accent: valeur(b.page.accent, Math.min(motMax, MOT_TITRE_MAX)), [NOM_LISTE[type]]: elements };
    if (g.schema.safeParse(c).success) return c;
  }
  throw new Error(`Contenu maximal impossible pour ${type} (${n})`);
}

function proprietes(format: FormatToile, type: string, page: Dict) {
  const types = ["X00", type, "X02"];
  const pages = types.map((t) => (t === type ? { ...page, rubrique: (page.rubrique as string | undefined) ?? "Rubrique" } : { ...GABARITS.find((g) => g.type === t)!.exemple }));
  return {
    toile: { version: "toile/1", format, pages, raccords: [] },
    versions: { socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(types.map((t) => [t, GABARITS.find((g) => g.type === t)!.version])), parcours: {}, raccords: {} },
  };
}

type Intervalle = [number, number];
/** Largeur de la bande de bord que `bordsLibres` décrit (120 px de chaque bord) et écart de couleur à partir duquel une ligne est occupée. */
const BANDE = 120;
const ECART = 18;

/**
 * Mesure sur le JPEG de la page : intervalles [y1, y2] libres dans la bande de chaque bord (une ligne est libre quand tous ses pixels de la
 * bande valent le pixel de fond de la même ligne, pris à 2 px du bord) et part de la page couverte par l'orange des cartes (tuiles et texte compris).
 */
function mesurerPage(fichier: string, hauteur: number): { gauche: Intervalle[]; droite: Intervalle[]; orange: number } {
  const brut = execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-i", fichier, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1080 * 1440 * 3 + 1024 });
  if (brut.length !== 1080 * hauteur * 3) throw new Error(`page décodée de ${brut.length} octets (attendu ${1080 * hauteur * 3})`);
  const px = (x: number, y: number) => (y * 1080 + x) * 3;
  const libres = (x0: number, xRef: number): Intervalle[] => {
    const res: Intervalle[] = [];
    let debut = -1;
    for (let y = 0; y <= hauteur; y++) {
      let libre = y < hauteur;
      for (let x = x0; libre && x < x0 + BANDE; x++) {
        for (let k = 0; k < 3; k++) if (Math.abs(brut[px(x, y) + k] - brut[px(xRef, y) + k]) > ECART) libre = false;
      }
      if (libre && debut < 0) debut = y;
      if (!libre && debut >= 0) {
        res.push([debut, y]);
        debut = -1;
      }
    }
    return res;
  };
  let orange = 0;
  for (let i = 0; i < 1080 * hauteur; i++) {
    const r = brut[i * 3], g = brut[i * 3 + 1], b = brut[i * 3 + 2];
    if (r > 170 && g > 70 && g < 170 && b < 100 && r - b > 100) orange++;
  }
  return { gauche: libres(0, 2), droite: libres(1080 - BANDE, 1077), orange: orange / (1080 * hauteur) };
}

/** Intersection de deux listes d'intervalles. */
function croiser(a: Intervalle[], b: Intervalle[]): Intervalle[] {
  const res: Intervalle[] = [];
  for (const [a1, a2] of a) for (const [b1, b2] of b) if (Math.max(a1, b1) < Math.min(a2, b2)) res.push([Math.max(a1, b1), Math.min(a2, b2)]);
  return res.sort((x, y) => x[0] - y[0]);
}

const sortie = resolve("essais-visuels", "continu", "p3b");
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-listes-"));
const ADRESSE = "http://127.0.0.1/p3b/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const nom = decodeURIComponent(new URL(url).pathname.slice("/p3b/".length));
    if (nom.endsWith("page-2.jpg") || nom.startsWith("garde/")) copyFileSync(chemin, join(travail, "page-2.jpg"));
    if (nom.startsWith("garde/")) copyFileSync(chemin, join(sortie, nom.slice("garde/".length)));
  },
});

const ids = process.argv.slice(2);
const types = LISTES.map((g) => g.type).filter((t) => !ids.length || ids.includes(t));
const resultats: Record<string, unknown> = {};
/** Par type : intersection des intervalles libres sur tous les contenus et les deux formats (hauteur commune 1350), et part d'orange maximale. */
const bords: Record<string, { gauche: Intervalle[]; droite: Intervalle[]; orangeMax: number; orangeAuNombre: Record<string, number> }> = {};
const echecs: string[] = [];
for (const type of types) {
  const [min, max] = BORNES_LISTES[type];
  const cas: { cas: "moyen" | "minimal" | "maximal"; n: number }[] = [{ cas: "moyen", n: (LISTES.find((g) => g.type === type)!.exemple as Dict)[NOM_LISTE[type]] instanceof Array ? ((LISTES.find((g) => g.type === type)!.exemple as Dict)[NOM_LISTE[type]] as unknown[]).length : min }, { cas: "minimal", n: min }];
  for (let n = min; n <= max; n++) cas.push({ cas: "maximal", n });
  for (const format of ["4:5", "3:4"] as FormatToile[]) {
    for (const c of cas) {
      const nom = `${type}-${c.cas}-${c.n}-${format.replace(":", "x")}`;
      const dossier = mkdtempSync(join(travail, "t-"));
      const garde = c.cas === "moyen" ? `garde/${type}-${format.replace(":", "x")}.jpg` : null;
      const depots = [1, 2, 3].map((i) => ({ cle: `${nom}/page-${i}.jpg`, urlDepot: `${ADRESSE}${i === 2 && garde ? garde : `${nom}/page-${i}.jpg`}` }));
      try {
        const r = await op(
          { idRendu: nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}tmp/${nom}-bande.jpg`, cle: `tmp/${nom}-bande.jpg` }, parametres: { proprietes: proprietes(format, type, contenu(type, c.cas, c.n)), depotsPages: depots } },
          { progression: () => {}, dossier, signal: new AbortController().signal },
        );
        const m = (r.mesures ?? {}) as Record<string, number>;
        const fautes = [
          m.hauteur !== HAUTEURS[format] && `hauteur ${m.hauteur}`,
          m.debordements !== 0 && `${m.debordements} débordement(s)`,
          !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
          m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
          m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
          m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
          m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta`,
          m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
        ].filter(Boolean) as string[];
        const pg = mesurerPage(join(travail, "page-2.jpg"), HAUTEURS[format]);
        const bt = (bords[type] ??= { gauche: [[0, 1350]], droite: [[0, 1350]], orangeMax: 0, orangeAuNombre: {} });
        const borne = (l: Intervalle[]) => l.map(([a, b]) => [Math.min(a, 1350), Math.min(b, 1350)] as Intervalle).filter(([a, b]) => a < b);
        bt.gauche = croiser(bt.gauche, borne(pg.gauche));
        bt.droite = croiser(bt.droite, borne(pg.droite));
        bt.orangeMax = Math.max(bt.orangeMax, pg.orange);
        bt.orangeAuNombre[`${c.cas}-${c.n}-${format}`] = Math.round(pg.orange * 1000) / 10;
        resultats[nom] = { orangePourcent: Math.round(pg.orange * 1000) / 10, debordements: m.debordements, taillePoliceMin: m.taillePoliceMin, textesSurCouture: m.textesSurCouture, textesHorsMarge: m.textesHorsMarge, textesCoinReserve: m.textesCoinReserve, intrusionsMetaP1: m.intrusionsMetaP1, chevauchements: m.chevauchements };
        if (garde) {
          const ko = statSync(join(sortie, garde.slice("garde/".length))).size / 1024;
          if (ko > 400) fautes.push(`JPEG de ${Math.round(ko)} Ko (> 400 Ko)`);
        }
        console.log(`${nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [police min ${m.taillePoliceMin}]`);
        if (fautes.length) echecs.push(`${nom} : ${fautes.join(", ")}`);
      } catch (err) {
        const message = String(err instanceof Error ? err.message : err).slice(0, 300);
        resultats[nom] = { erreur: message };
        console.log(`${nom} : ÉCHEC ${message}`);
        echecs.push(`${nom} : ${message}`);
      }
    }
  }
}
if (!ids.length) writeFileSync(join(sortie, "mesures.json"), `${JSON.stringify({ bordsLibres: Object.fromEntries(Object.entries(bords).map(([t, v]) => [t, { gauche: v.gauche, droite: v.droite }])), orangePartMaxPourcent: Object.fromEntries(Object.entries(bords).map(([t, v]) => [t, Math.round(v.orangeMax * 1000) / 10])), rendus: resultats }, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(bords).map(([t, v]) => [t, { gauche: v.gauche, droite: v.droite, orangeMax: Math.round(v.orangeMax * 1000) / 10 }]))));
if (echecs.length) {
  console.error(`\n${echecs.length} essai(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${Object.keys(resultats).length} rendus, toutes mesures à 0, police ≥ 26 px.`);
process.exit(0);
