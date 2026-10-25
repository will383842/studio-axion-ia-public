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
import { ID_COMPOSITION_TOILE } from "../compositions/visuels/continu/mesure/protocole-toile.js";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords.js";
import { HAUTEURS, LARGEUR_PAGE, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version.js";
import { TEXTES_FIXES_L9 } from "../../src/briques/visuels/textes-fixes.js";
import { creerToileContinue, NAVIGATEUR_TOILE } from "../src/operations/toile-continue.js";
import { REGLAGES_RENDU } from "../src/remotion.js";
import { paquetToile } from "../src/paquet-toile.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (navigateur?.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");
if (!navigateur) {
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
}

/** Lecture du DOM réel de la page du milieu (x de 1080 à 2160), exécutée dans le navigateur de Remotion avant la fermeture de la page. */
interface Lecture {
  texteRendu: string;
  etiquette: { x: number; y: number; largeur: number } | null;
  basContenu: number;
  occupes: { gauche: [number, number][]; droite: [number, number][] };
}
/** Fonction sérialisée telle quelle (`new Function` : aucun assistant d'outil de compilation injecté dans le texte envoyé au navigateur). */
const LIRE_DOM = new Function(
  "etiquette",
  "pageX",
  "largeur",
  `
  const racine = document.body;
  const nonChrome = (e) => !e.closest("[data-entete], [data-pied]");
  const tous = [...racine.querySelectorAll("*")].filter(nonChrome);
  const dansPage = (r) => r.right > pageX && r.left < pageX + largeur && r.width > 0 && r.height > 0;
  const plage = document.createRange();
  let etiq = null;
  let bas = 0;
  const bandes = { gauche: [pageX, pageX + 120], droite: [pageX + largeur - 120, pageX + largeur] };
  const occupes = { gauche: [], droite: [] };
  const noter = (r) => {
    if (!dansPage(r)) return;
    for (const c of ["gauche", "droite"]) {
      const [a, b] = bandes[c];
      if (r.right > a && r.left < b) occupes[c].push([r.top, r.bottom]);
    }
  };
  for (const e of tous) {
    const st = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (!dansPage(r)) continue;
    const fond = st.backgroundColor !== "rgba(0, 0, 0, 0)" || st.backgroundImage !== "none" || st.boxShadow !== "none" || parseFloat(st.borderTopWidth) > 0;
    const pleinePage = r.width >= largeur - 2 && r.height >= 1300;
    const objet = ["svg", "img", "canvas"].includes(e.tagName.toLowerCase());
    if ((fond && !pleinePage) || objet) {
      noter(r);
      if (e.closest("[data-decor]") == null && r.width < largeur) bas = Math.max(bas, r.bottom);
    }
    for (const n of e.childNodes) {
      if (n.nodeType !== Node.TEXT_NODE || (n.textContent || "").trim() === "") continue;
      plage.selectNodeContents(n);
      for (const l of plage.getClientRects()) {
        noter(l);
        bas = Math.max(bas, l.bottom);
        if ((n.textContent || "").includes(etiquette)) etiq = { x: l.left, y: l.top, largeur: l.width };
      }
    }
  }
  return { texteRendu: racine.innerText, etiquette: etiq, basContenu: bas, occupes };
`,
) as (etiquette: string, pageX: number, largeur: number) => Lecture;

let derniereLecture: Lecture | null = null;
/** Comme `rendreToileAvecRemotion`, mais le navigateur reste ouvert jusqu'à la lecture du DOM de la toile (même Chrome Headless Shell, mêmes réglages). */
function rendreEtLire(options: { navigateur?: string }) {
  return async ({ inputProps, sortie, surLog }: { inputProps: Record<string, unknown>; sortie: string; surLog: (l: string) => void; signal: AbortSignal }) => {
    const { openBrowser, renderStill, selectComposition } = await import("@remotion/renderer");
    const serveUrl = await paquetToile();
    const navig = options.navigateur ? { browserExecutable: options.navigateur } : {};
    const browser = await openBrowser("chrome", { ...navig, chromiumOptions: NAVIGATEUR_TOILE });
    try {
      const composition = await selectComposition({ serveUrl, id: ID_COMPOSITION_TOILE, inputProps, chromiumOptions: NAVIGATEUR_TOILE, ...navig });
      const nouvellePage = browser.newPage.bind(browser) as (...a: unknown[]) => Promise<{ close: (...a: unknown[]) => Promise<unknown>; evaluate: (f: unknown, ...a: unknown[]) => Promise<unknown> }>;
      (browser as unknown as { newPage: unknown }).newPage = async (...a: unknown[]) => {
        const page = await nouvellePage(...a);
        const fermer = page.close.bind(page);
        page.close = async (...b: unknown[]) => {
          derniereLecture = (await page.evaluate(LIRE_DOM, TEXTES_FIXES_L9.t26Etiquette, LARGEUR_PAGE, LARGEUR_PAGE).catch(() => null)) as Lecture | null;
          return fermer(...b);
        };
        return page;
      };
      const onBrowserLog = (log: { text: string }) => surLog(log.text);
      await renderStill({ ...REGLAGES_RENDU, chromiumOptions: NAVIGATEUR_TOILE, composition, serveUrl, output: sortie, frame: 0, imageFormat: "png", scale: 1, inputProps, onBrowserLog, puppeteerInstance: browser, ...navig } as never);
      return { largeur: composition.width, hauteur: composition.height };
    } finally {
      await browser.close({ silent: true }).catch(() => {});
    }
  };
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
  rendre: rendreEtLire(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const cible = join(sortieRacine, decodeURIComponent(new URL(url).pathname.slice("/p3d/".length)));
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(chemin, cible);
  },
});

const echecs: string[] = [];

/** Intervalles [y1, y2] libres d'une bande, arrondis vers l'intérieur à 10 px ; un intervalle qui touche le bas de la page va jusqu'à 1440 (hauteur maximale). */
function libres(occupes: [number, number][], hauteur: number): [number, number][] {
  const fusion: [number, number][] = [];
  for (const [a, b] of [...occupes].sort((x, y) => x[0] - y[0])) {
    const dernier = fusion[fusion.length - 1];
    if (dernier && a <= dernier[1]) dernier[1] = Math.max(dernier[1], b);
    else fusion.push([a, b]);
  }
  const sortie: [number, number][] = [];
  let y = 0;
  for (const [a, b] of [...fusion, [hauteur, hauteur] as [number, number]]) {
    const y1 = Math.ceil(y / 10) * 10;
    const y2 = (b === hauteur && a === hauteur ? 1440 : Math.floor(a / 10) * 10);
    if (y2 > y1) sortie.push([y1, y2]);
    y = b;
  }
  return sortie;
}
/** Intersection de deux listes d'intervalles. */
function croiser(a: [number, number][], b: [number, number][]): [number, number][] {
  const sortie: [number, number][] = [];
  for (const [a1, a2] of a) for (const [b1, b2] of b) if (Math.min(a2, b2) > Math.max(a1, b1)) sortie.push([Math.max(a1, b1), Math.min(a2, b2)]);
  return sortie;
}
const inclus = (petit: [number, number][], grand: [number, number][]) => petit.every(([a, b]) => grand.some(([c, d]) => a >= c && b <= d));
const mesureBords: Record<string, { gauche: [number, number][]; droite: [number, number][] }> = {};
const filtre = process.env.ESSAI_FILTRE;

const resultats: Record<string, unknown> = {};
for (const e of ESSAIS.filter((x) => !filtre || x.nom.includes(filtre))) {
  const hauteur = HAUTEURS[e.format];
  const dossier = mkdtempSync(join(travail, `${e.nom}-`));
  const cle = (i: number) => (i === 1 ? `${e.nom}/page.jpg` : `_jetables/${e.nom}-${i}.jpg`);
  const depotsPages = [0, 1, 2].map((i) => ({ cle: cle(i), urlDepot: `${ADRESSE}${cle(i)}` }));
  derniereLecture = null;
  try {
    const r = await op(
      { idRendu: e.nom, operation: "toile-continue", file: "courte", entrees: {}, sortie: { urlDepot: `${ADRESSE}_jetables/${e.nom}-bande.jpg`, cle: `_jetables/${e.nom}-bande.jpg` }, parametres: { proprietes: proprietes(e), depotsPages } },
      { progression: () => {}, dossier, signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const octets = statSync(join(sortieRacine, cle(1))).size;
    const lecture = derniereLecture as Lecture | null;
    const bords = lecture ? { gauche: libres(lecture.occupes.gauche, hauteur), droite: libres(lecture.occupes.droite, hauteur) } : null;
    if (bords) mesureBords[e.nom] = bords;
    const def = CARTES_CAS.find((g) => g.type === e.type)!;
    const fautes = [
      !lecture && "lecture du rendu impossible",
      lecture && !lecture.texteRendu.includes(TEXTES_FIXES_L9.t26Etiquette) && `étiquette « ${TEXTES_FIXES_L9.t26Etiquette} » absente du rendu`,
      lecture && lecture.etiquette && !(lecture.etiquette.x >= LARGEUR_PAGE && lecture.etiquette.x < 2 * LARGEUR_PAGE) && "étiquette hors de la page du milieu",
      lecture && lecture.basContenu > hauteur - 150 + 1 && `contenu jusqu'à y = ${Math.round(lecture.basContenu)} (zone utile : ${hauteur - 150})`,
      bords && !(inclus(def.bordsLibres.gauche, bords.gauche) && inclus(def.bordsLibres.droite, bords.droite)) && `bordsLibres du registre non libres dans le rendu (mesuré : gauche ${JSON.stringify(bords.gauche)}, droite ${JSON.stringify(bords.droite)})`,
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
    resultats[e.nom] = { type: e.type, format: e.format, variante: e.variante, mesures: m, etiquette: lecture?.etiquette ?? null, basContenu: lecture ? Math.round(lecture.basContenu) : null, bordsLibresMesures: bords, octetsPage: octets, fautes };
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [police min ${m.taillePoliceMin}, débordements ${m.debordements}, couture ${m.textesSurCouture}, marge ${m.textesHorsMarge}, coin ${m.textesCoinReserve}, chevauchements ${m.chevauchements}, ${Math.round(octets / 1024)} Ko]`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 400);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
// Bords libres retenus pour le registre : intersection de toutes les variantes et des deux formats, par plaquette.
const retenus: Record<string, { gauche: [number, number][]; droite: [number, number][] }> = {};
for (const [nom, b] of Object.entries(mesureBords)) {
  const type = nom.slice(0, 3);
  retenus[type] = retenus[type] ? { gauche: croiser(retenus[type].gauche, b.gauche), droite: croiser(retenus[type].droite, b.droite) } : b;
}
for (const [type, b] of Object.entries(retenus)) console.log(`bordsLibres ${type} : gauche ${JSON.stringify(b.gauche)}, droite ${JSON.stringify(b.droite)}`);
if (!filtre) resultats._bordsLibresRetenus = retenus;
if (!filtre) writeFileSync(join(sortieRacine, "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} échec(s) :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${ESSAIS.length} toiles d'essai, 0 faute. Mesures : essais-visuels/continu/p3d/mesures.json`);
process.exit(0);
