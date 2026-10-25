/**
 * ESSAI RÉEL des sept listes (P3b) par le vrai Remotion : chaque plaquette est posée seule au milieu d'une toile de 3 pages (couverture X00,
 * liste, appel X02), en 4:5 et en 3:4, avec trois contenus : MOYEN (maquette), MINIMAL (textes courts, nombre minimal d'éléments) et MAXIMAL
 * (budget plein, mots longs, pour chaque nombre d'éléments). Toute mesure non nulle ou police < 26 px : code de sortie 1.
 * Garde `essais-visuels/continu/p3b/<ID>-<format>.jpg` (page de la liste, contenu moyen) et `mesures.json`.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-listes.ts [ID...]
 */
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

const sortie = resolve("essais-visuels", "continu", "p3b");
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-listes-"));
const ADRESSE = "http://127.0.0.1/p3b/";
let courant = "";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const nom = decodeURIComponent(new URL(url).pathname.slice("/p3b/".length));
    if (nom.endsWith("page-2.jpg")) copyFileSync(chemin, join(travail, `${nom.replace("/", "-")}`));
    if (nom.startsWith("garde/")) copyFileSync(chemin, join(sortie, nom.slice("garde/".length)));
  },
});

const ids = process.argv.slice(2);
const types = LISTES.map((g) => g.type).filter((t) => !ids.length || ids.includes(t));
const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const type of types) {
  const [min, max] = BORNES_LISTES[type];
  const cas: { cas: "moyen" | "minimal" | "maximal"; n: number }[] = [{ cas: "moyen", n: (LISTES.find((g) => g.type === type)!.exemple as Dict)[NOM_LISTE[type]] instanceof Array ? ((LISTES.find((g) => g.type === type)!.exemple as Dict)[NOM_LISTE[type]] as unknown[]).length : min }, { cas: "minimal", n: min }];
  for (let n = min; n <= max; n++) cas.push({ cas: "maximal", n });
  for (const format of ["4:5", "3:4"] as FormatToile[]) {
    for (const c of cas) {
      const nom = `${type}-${c.cas}-${c.n}-${format.replace(":", "x")}`;
      courant = nom;
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
        resultats[nom] = { debordements: m.debordements, taillePoliceMin: m.taillePoliceMin, textesSurCouture: m.textesSurCouture, textesHorsMarge: m.textesHorsMarge, textesCoinReserve: m.textesCoinReserve, intrusionsMetaP1: m.intrusionsMetaP1, chevauchements: m.chevauchements };
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
void courant;
if (!ids.length) writeFileSync(join(sortie, "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} essai(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${Object.keys(resultats).length} rendus, toutes mesures à 0, police ≥ 26 px.`);
process.exit(0);
