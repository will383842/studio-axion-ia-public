/**
 * ESSAI RÉEL des cas concrets du carrousel continu (P3d) : chaque plaquette S01 à S03 est posée SEULE au milieu d'une toile de 3 pages
 * (couverture d'essai X00, plaquette, appel d'essai X02), en 4:5 et en 3:4, avec quatre contenus : moyen (maquette), minimal, maximal (budget
 * plein) et mot long. Rendu par l'opération `toile-continue` (vrai Remotion), mesures de la toile : toutes à 0, police ≥ 26 px.
 * (L'étiquette `textesFixes.t26Etiquette` dans le rendu est vérifiée par `tests/visuels/continu-p3d.test.ts`.) Dépôt de la page du milieu dans
 * `essais-visuels/continu/p3d/<toile>/page.jpg`. Toute faute : code de sortie 1.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-cas.ts
 */
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BUDGETS_CAS, CARTES_CAS } from "../../src/briques/visuels/continu/familles/cas.js";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
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
const MOTS = ["professionnalisation", "automatiquement", "devis", "relance", "validez", "réponse", "client", "rapidement", "préparée", "chaque"];
type Variante = "moyen" | "minimal" | "maximal" | "mot-long";
const VARIANTES: Variante[] = ["moyen", "minimal", "maximal", "mot-long"];

/** Texte de `n` caractères : mots de la liste mis bout à bout, coupé net au budget. */
function remplir(n: number, depart: number): string {
  let t = "";
  for (let i = depart; t.length < n; i++) t += `${MOTS[i % MOTS.length]} `;
  return t.slice(0, n).trim();
}
/** Mot long qui tient dans le budget (`professionnalisation` = 20, `automatiquement` = 15), coupé sinon. */
const motLong = (n: number) => (n >= 20 ? "professionnalisation" : n >= 15 ? "automatiquement" : "relancer".slice(0, n));

function contenu(type: string, v: Variante): Record<string, unknown> {
  const base = CARTES_CAS.find((g) => g.type === type)!.exemple as Record<string, unknown>;
  if (v === "moyen") return base;
  const budgets = (BUDGETS_CAS as unknown as Record<string, Record<string, number>>)[type];
  const champ = (n: number, i: number) => (v === "minimal" ? ["Oui", "Un", "Ok"][i % 3] : v === "maximal" ? remplir(n, i) : motLong(n));
  const sortie: Record<string, unknown> = { ...base };
  Object.entries(budgets).forEach(([k, n], i) => (sortie[k] = champ(n, i)));
  if (type === "S03") sortie.noeuds = [0, 1, 2].map((j) => ({ titre: champ(BUDGETS_CAS.noeud.titre, j), texte: champ(BUDGETS_CAS.noeud.texte, j + 3) }));
  return sortie;
}

interface Essai {
  nom: string;
  type: string;
  format: FormatToile;
  variante: Variante;
}
const ESSAIS: Essai[] = [];
for (const g of CARTES_CAS) for (const format of ["4:5", "3:4"] as FormatToile[]) for (const variante of VARIANTES) ESSAIS.push({ nom: `${g.type}-${format.replace(":", "x")}-${variante}`, type: g.type, format, variante });

function proprietes(e: Essai) {
  const pages = [
    { ...GABARITS.find((g) => g.type === "X00")!.exemple, rubrique: "IA pour les entreprises" },
    { ...contenu(e.type, e.variante), rubrique: "Cas concret" },
    { ...GABARITS.find((g) => g.type === "X02")!.exemple, rubrique: "Pour y revenir" },
  ];
  const types = new Set(["X00", e.type, "X02"]);
  return {
    toile: { version: "toile/1", format: e.format, pages, raccords: [] },
    versions: { socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(GABARITS.filter((g) => types.has(g.type)).map((g) => [g.type, g.version])), parcours: {}, raccords: Object.fromEntries(RACCORDS.map((r) => [r.type, r.version])) },
  };
}

const sortieRacine = resolve("essais-visuels", "continu", "p3d");
mkdirSync(sortieRacine, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-cas-"));
const ADRESSE = "http://127.0.0.1/p3d/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const cible = join(sortieRacine, decodeURIComponent(new URL(url).pathname.slice("/p3d/".length)));
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(chemin, cible);
  },
});

const echecs: string[] = [];

const resultats: Record<string, unknown> = {};
for (const e of ESSAIS) {
  const hauteur = HAUTEURS[e.format];
  const dossier = mkdtempSync(join(travail, `${e.nom}-`));
  const cle = (i: number) => (i === 1 ? `${e.nom}/page.jpg` : `_jetables/${e.nom}-${i}.jpg`);
  const depotsPages = [0, 1, 2].map((i) => ({ cle: cle(i), urlDepot: `${ADRESSE}${cle(i)}` }));
  try {
    const r = await op(
      { idRendu: e.nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}_jetables/${e.nom}-bande.jpg`, cle: `_jetables/${e.nom}-bande.jpg` }, parametres: { proprietes: proprietes(e), depotsPages } },
      { progression: () => {}, dossier, signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const octets = statSync(join(sortieRacine, cle(1))).size;
    const fautes = [
      m.largeur !== 3 * LARGEUR_PAGE && `largeur ${m.largeur}`,
      m.hauteur !== hauteur && `hauteur ${m.hauteur}`,
      m.debordements !== 0 && `${m.debordements} débordement(s)`,
      !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
      m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
      m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
      m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
      m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta en page 1`,
      m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
      m.traitsFinsSurCouture !== 0 && `${m.traitsFinsSurCouture} trait(s) fin(s) sur une couture`,
      octets > OCTETS_JPEG_MAX && `${Math.round(octets / 1024)} Ko (> 400 Ko)`,
    ].filter(Boolean) as string[];
    resultats[e.nom] = { type: e.type, format: e.format, variante: e.variante, mesures: m, octetsPage: octets, fautes };
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [police min ${m.taillePoliceMin}, débordements ${m.debordements}, couture ${m.textesSurCouture}, marge ${m.textesHorsMarge}, coin ${m.textesCoinReserve}, chevauchements ${m.chevauchements}, ${Math.round(octets / 1024)} Ko]`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 400);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
writeFileSync(join(sortieRacine, "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} échec(s) :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${ESSAIS.length} toiles d'essai, 0 faute. Mesures : essais-visuels/continu/p3d/mesures.json`);
process.exit(0);
