/**
 * T-EXT-V2-04 · Poste de capture : écrit la maquette créée (constructeur vivant), la contrôle et en prend l'aperçu.
 * T-EXT-V2-04b : un FLUX créé (flux-automatisation.v1) est écrit sur les écrans neutres de ecrans-outils/ (même poste, mêmes codes).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/constructeur/ecrire-maquette.mts --description <fichier.json> --sortie <dossier hors dépôt> [--apercu] [--attendue <empreinte>]
 *
 * Codes de sortie :
 *   0 ok
 *   1 erreur inattendue
 *   3 environnement interdit (ni cloud ni CI, ou Windows) ou « --sortie » dans le dépôt
 *   4 arguments, description ou maquette refusés (erreurs écrites dans `<sortie>/rapport.json`)
 *   7 l'empreinte de la description n'est pas celle que Williams a validée (« --attendue »)
 *   2, 5, 6 (et tout autre code non nul) : renvoyés tels quels par le capteur d'aperçu (T-EXT-03)
 *
 * Le poste ne lit QUE le fichier de description gardé par le Studio (jamais Claude). Aucune voix, aucun film, aucun
 * fournisseur, aucun réseau (le capteur le coupe), rien n'écrit dans le dépôt. Éteint par défaut : jamais appelé par le Studio.
 * Sans « --apercu » : aucun navigateur. Avec : le capteur existant est lancé comme processus, sans calage.
 * Hors `tsconfig.json` (comme `outils/`) : son test est sa seule garde.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lireDescriptionMaquette, type DescriptionMaquette } from "../../../src/moteurs/montage-tutoriel-outil/description-maquette";
import { controlerTextesCrees, empreinteDescription, scenarioApercu, VERSION_APERCU, type ApercuPiece } from "../../../src/moteurs/montage-tutoriel-outil/maquette-creee";
import { controlerFluxCree, empreinteFlux, scenarioApercuFlux } from "../../../src/moteurs/montage-tutoriel-outil/flux-cree";
import { donneesEcransDepuisFlux, lireFluxAutomatisation, MAQUETTE_FLUX, VERSION_FLUX, type FluxAutomatisation } from "../../../src/moteurs/montage-tutoriel-outil/gabarit-flux";
import { empreinteCourte } from "../../../src/domaine/sujets-traites";
import { environnementAutorise } from "../capture/garde";
import { controlerMaquette, type NomsNeutres } from "../charte/controle";
import { construireMaquette, NOMS_FICHIERS, type NomFichier } from "./construire";

const RACINE_DEPOT = fileURLToPath(new URL("../../../", import.meta.url));
const DOSSIER_OUTIL = fileURLToPath(new URL("../", import.meta.url));

export const CODE_OK = 0;
export const CODE_INATTENDU = 1;
export const CODE_ENVIRONNEMENT = 3;
export const CODE_REFUSE = 4;
export const CODE_EMPREINTE = 7;
const CLE_MAQUETTE = "maquette-creee";
export const MESSAGE_EMPREINTE = "La description n'est pas celle que Williams a validée.";

/* ------------------------------------------------------------------ */
/* Fonctions pures (sans disque)                                       */
/* ------------------------------------------------------------------ */

export interface ArgsEcriture {
  description: string;
  sortie: string;
  apercu: boolean;
  attendue?: string;
}

export type PlanEcriture = { ok: true; args: ArgsEcriture } | { ok: false; erreurs: string[] };

/** Lit la ligne de commande : « --description », « --sortie » obligatoires ; « --apercu » seul ; « --attendue » avec valeur. */
export function planEcriture(argv: readonly string[]): PlanEcriture {
  const erreurs: string[] = [];
  const valeurs: Record<string, string> = {};
  let apercu = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--apercu") {
      apercu = true;
      continue;
    }
    if (a !== "--description" && a !== "--sortie" && a !== "--attendue") {
      erreurs.push(`Argument inconnu : « ${a} ».`);
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      erreurs.push(`Argument « ${a} » : valeur manquante.`);
      continue;
    }
    valeurs[a.slice(2)] = v;
    i++;
  }
  for (const k of ["description", "sortie"]) if (!valeurs[k]) erreurs.push(`Argument « --${k} » obligatoire.`);
  if (valeurs.attendue !== undefined && valeurs.attendue.trim() === "") erreurs.push("Argument « --attendue » : empreinte vide.");
  if (erreurs.length > 0) return { ok: false, erreurs };
  return { ok: true, args: { description: valeurs.description!, sortie: valeurs.sortie!, apercu, ...(valeurs.attendue ? { attendue: valeurs.attendue } : {}) } };
}

/** Vrai si `chemin` est le dépôt lui-même ou dedans. */
export function dansLeDepot(chemin: string, racineDepot: string): boolean {
  const v = relative(resolve(racineDepot), resolve(chemin));
  return v === "" || (!v.startsWith("..") && !isAbsolute(v));
}

export interface RapportMaquette {
  version: "rapport-maquette.v1";
  ok: boolean;
  code: number;
  erreurs: string[];
}

export function rapportMaquette(code: number, erreurs: readonly string[]): RapportMaquette {
  return { version: "rapport-maquette.v1", ok: code === CODE_OK, code, erreurs: [...erreurs] };
}

export interface MaqueteCreee {
  empreinteDescription: string;
  fichiers: Record<string, string>;
  controle: { ok: boolean; defauts: string[] };
  apercu?: string[];
}

/** Récapitulatif écrit dans `maquette-creee.json` : mêmes contenus = mêmes empreintes. */
export function recapitulatif(d: DescriptionMaquette, fichiers: Record<NomFichier, string>, defauts: readonly string[], apercu?: readonly string[]): MaqueteCreee {
  const empreintes: Record<string, string> = {};
  for (const nom of NOMS_FICHIERS) empreintes[nom] = empreinteCourte(fichiers[nom]);
  return {
    empreinteDescription: empreinteDescription(d),
    fichiers: empreintes,
    controle: { ok: defauts.length === 0, defauts: [...defauts] },
    ...(apercu ? { apercu: [...apercu] } : {}),
  };
}

/**
 * `apercu-piece.v1` depuis les PNG pris par le capteur (`NN-<étape>.png`) : un par écran (« avant ») et un « maintenant ».
 * Les `cle` sont les chemins locaux, relatifs à `<sortie>` : c'est le dépôt (V2-09) qui les remplace par des clés de stockage.
 */
export function apercuPiece(d: DescriptionMaquette, png: readonly string[], controle: { ok: boolean; defauts: string[] }): ApercuPiece {
  const images: ApercuPiece["images"] = [];
  const cherche = (id: string) => png.find((p) => new RegExp(`^\\d+-${id.replace(/[^A-Za-z0-9_-]+/g, "-")}\\.png$`).test(p.split("/").pop() ?? ""));
  for (const e of d.ecrans) {
    const p = cherche(`ecran-${e.id}`.slice(0, 60));
    if (p) images.push({ ecranId: e.id, etat: "avant", cle: p });
  }
  const m = cherche("maintenant");
  if (m && d.ecrans[0]) images.push({ ecranId: d.ecrans[0].id, etat: "maintenant", cle: m });
  return { version: VERSION_APERCU, empreinteDescription: empreinteDescription(d), images, controle };
}

/**
 * `apercu-piece.v1` d'un FLUX (V2-04b) : une image par écran du scénario d'aperçu (`aller` : « declencheur », id d'étape,
 * « resultat »). « avant » pour le déclencheur, « maintenant » pour les autres. L'empreinte est celle de la pièce « flux ».
 */
export function apercuPieceFlux(flux: FluxAutomatisation, png: readonly string[], controle: { ok: boolean; defauts: string[] }): ApercuPiece {
  const images: ApercuPiece["images"] = [];
  for (const e of scenarioApercuFlux(flux).etapes) {
    const id = e.id.replace(/[^A-Za-z0-9_-]+/g, "-");
    const p = png.find((x) => new RegExp(`^\\d+-${id}\\.png$`).test(x.split("/").pop() ?? ""));
    if (p) images.push({ ecranId: e.aller, etat: e.aller === "declencheur" ? "avant" : "maintenant", cle: p });
  }
  return { version: VERSION_APERCU, empreinteDescription: empreinteFlux(flux), images, controle };
}

/* ------------------------------------------------------------------ */
/* Écriture (disque, dépendances injectables)                          */
/* ------------------------------------------------------------------ */

export interface ResultatCapteur {
  status: number | null;
}

export interface DependancesEcriture {
  env: Record<string, string | undefined>;
  plateforme: string;
  racineDepot: string;
  /** Lance le capteur existant (jamais recopié) ; les tests passent un double. */
  lancerCapteur: (argv: readonly string[]) => ResultatCapteur;
  /** Charte et noms (lus du dépôt par défaut). */
  charteCss?: string;
  nomsNeutres?: NomsNeutres;
  nomsEcransOutils?: unknown;
  journal?: (texte: string) => void;
}

export function lancerCapteurReel(argv: readonly string[]): ResultatCapteur {
  const tsx = join(RACINE_DEPOT, "node_modules/tsx/dist/cli.mjs");
  const r = spawnSync(process.execPath, [tsx, join(DOSSIER_OUTIL, "capture/capturer.mts"), ...argv], { stdio: "inherit", cwd: RACINE_DEPOT });
  return { status: r.status };
}

const lireJsonFichier = (chemin: string): unknown => JSON.parse(readFileSync(chemin, "utf8"));
const jsonJoli = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** Noms permis dans les textes créés : `noms-neutres.json` + `ecrans-outils/noms.json` (produits, organisations, vues). */
export function nomsPermis(neutres: NomsNeutres, ecransOutils: unknown): string[] {
  const noms = new Set<string>();
  const parcourir = (maquettes: unknown) => {
    if (typeof maquettes !== "object" || maquettes === null) return;
    for (const m of Object.values(maquettes as Record<string, unknown>)) {
      if (typeof m !== "object" || m === null) continue;
      const o = m as { produit?: unknown; organisation?: unknown; vues?: unknown };
      for (const t of [o.produit, o.organisation]) if (typeof t === "string" && t.trim()) noms.add(t);
      if (typeof o.vues === "object" && o.vues !== null) for (const t of Object.values(o.vues as Record<string, unknown>)) if (typeof t === "string" && t.trim()) noms.add(t);
    }
  };
  parcourir(neutres.maquettes);
  if (typeof ecransOutils === "object" && ecransOutils !== null) parcourir((ecransOutils as { maquettes?: unknown }).maquettes);
  return [...noms];
}

/**
 * Rend les polices de la charte joignables quand la maquette est écrite HORS du dépôt : la charte les charge par un chemin
 * relatif à `outils/maquettes-tableaux-de-bord/<dossier>/` (`../../../src/app/polices/…`), qui n'existe pas ailleurs.
 * Chaque `url(…)` de ce chemin devient l'URL `file://` absolue de la police du dépôt (déjà dans `RACINES_PAR_DEFAUT`).
 * Le reste du CSS est inchangé ; seul le fichier écrit est réécrit (les empreintes restent celles du contenu de la charte).
 */
export function policesJoignables(css: string, racineDepot: string): string {
  return css.replace(/url\((["']?)(?:\.\.\/)+src\/app\/polices\/([A-Za-z0-9._-]+)\1\)/g, (_m, q: string, nom: string) => {
    return `url(${q}${pathToFileURL(join(resolve(racineDepot), "src/app/polices", nom)).href}${q})`;
  });
}

/** Écrit la maquette créée dans `<sortie>/maquette/` (4 fichiers) et, avec « --apercu », prend l'aperçu. Renvoie le code de sortie. */
export function ecrireMaquette(argv: readonly string[], dep: DependancesEcriture): number {
  const dire = dep.journal ?? ((t: string) => console.error(t));
  const plan = planEcriture(argv);
  if (!plan.ok) {
    dire(plan.erreurs.join("\n"));
    return CODE_REFUSE;
  }
  const { args } = plan;

  const verdict = environnementAutorise(dep.env, dep.plateforme);
  if (!verdict.ok) {
    dire(verdict.raison);
    return CODE_ENVIRONNEMENT;
  }
  const sortie = resolve(args.sortie);
  if (dansLeDepot(sortie, dep.racineDepot)) {
    dire("« --sortie » doit être hors du dépôt.");
    return CODE_ENVIRONNEMENT;
  }

  const refuser = (code: number, erreurs: string[]): number => {
    mkdirSync(sortie, { recursive: true });
    writeFileSync(join(sortie, "rapport.json"), jsonJoli(rapportMaquette(code, erreurs)));
    dire(erreurs.join("\n"));
    return code;
  };

  let neutres: NomsNeutres;
  let ecransOutils: unknown;
  let charteCss: string;
  try {
    neutres = dep.nomsNeutres ?? (lireJsonFichier(join(DOSSIER_OUTIL, "charte/noms-neutres.json")) as NomsNeutres);
    ecransOutils = dep.nomsEcransOutils ?? lireJsonFichier(join(DOSSIER_OUTIL, "ecrans-outils/noms.json"));
    charteCss = dep.charteCss ?? readFileSync(join(DOSSIER_OUTIL, "charte/charte.css"), "utf8");
  } catch {
    return refuser(CODE_REFUSE, ["Charte ou noms neutres illisibles."]);
  }

  // 1. Lecture : forme stricte, puis contrôles propres aux textes créés.
  let brut: unknown;
  try {
    brut = lireJsonFichier(resolve(args.description));
  } catch {
    return refuser(CODE_REFUSE, [`Description illisible : ${args.description}`]);
  }
  if (typeof brut === "object" && brut !== null && (brut as { version?: unknown }).version === VERSION_FLUX) {
    return ecrireFlux(brut, args, { dep, sortie, neutres, ecransOutils, charteCss, refuser, dire });
  }
  const lecture = lireDescriptionMaquette(brut, { interdits: neutres.interdits });
  if (!lecture.ok) return refuser(CODE_REFUSE, lecture.erreurs);
  const d = lecture.description;
  const crees = controlerTextesCrees(d, nomsPermis(neutres, ecransOutils));
  if (crees.length > 0) return refuser(CODE_REFUSE, crees);

  // 2. L'empreinte gardée : ce qui est écrit est ce que Williams a validé.
  if (args.attendue !== undefined && empreinteDescription(d) !== args.attendue) return refuser(CODE_EMPREINTE, [MESSAGE_EMPREINTE]);

  // 3. Écriture (constructeur vivant) puis contrôle de la charte.
  const { fichiers } = construireMaquette(d, { charteCss, ecrans: {} }, { vivant: true });
  // Le nom neutre contrôlé est celui de la description elle-même (déjà passée par les noms interdits et les textes créés).
  const nomsDeLaMaquette: NomsNeutres = { ...neutres, maquettes: { ...neutres.maquettes, [CLE_MAQUETTE]: { produit: d.nom, organisation: d.entreprise } } };
  const controle = controlerMaquette(NOMS_FICHIERS.map((chemin) => ({ chemin, contenu: fichiers[chemin] })), nomsDeLaMaquette, CLE_MAQUETTE);
  if (!controle.ok) return refuser(CODE_REFUSE, controle.defauts.map((x) => `${x.chemin}:${x.ligne} · ${x.regle}`));
  const dossierMaquette = join(sortie, "maquette");
  mkdirSync(dossierMaquette, { recursive: true });
  for (const nom of NOMS_FICHIERS) writeFileSync(join(dossierMaquette, nom), nom === "styles.css" ? policesJoignables(fichiers[nom], dep.racineDepot) : fichiers[nom]);

  // 4. Aperçu : le capteur existant, sans calage (images de contrôle, ni voix ni film).
  let pngs: string[] | undefined;
  if (args.apercu) {
    const scenario = join(sortie, "apercu-scenario.json");
    writeFileSync(scenario, jsonJoli(scenarioApercu(d, d.nom)));
    const dossierApercu = join(sortie, "apercu");
    const r = dep.lancerCapteur(["--maquette", dossierMaquette, "--scenario", scenario, "--sortie", dossierApercu]);
    if (r.status !== 0) {
      const code = r.status ?? CODE_INATTENDU;
      dire(`Le capteur d'aperçu a échoué (code ${code}).`);
      return code;
    }
    pngs = listerPng(dossierApercu).map((p) => relative(sortie, p).split(sep).join("/"));
  }

  const defauts: string[] = [];
  writeFileSync(join(sortie, "maquette-creee.json"), jsonJoli(recapitulatif(d, fichiers, defauts, pngs)));
  if (pngs) writeFileSync(join(sortie, "apercu-piece.json"), jsonJoli(apercuPiece(d, pngs, { ok: true, defauts })));
  writeFileSync(join(sortie, "rapport.json"), jsonJoli(rapportMaquette(CODE_OK, [])));
  dire(`Maquette écrite dans ${dossierMaquette}${pngs ? ` (aperçu : ${pngs.length} image(s))` : ""}.`);
  return CODE_OK;
}

interface ContexteFlux {
  dep: DependancesEcriture;
  sortie: string;
  neutres: NomsNeutres;
  ecransOutils: unknown;
  charteCss: string;
  refuser: (code: number, erreurs: string[]) => number;
  dire: (texte: string) => void;
}

const FICHIERS_ECRANS = ["index.html", "styles.css", "etats.js", "app.js"] as const;

/** Cas 3 (V2-04b) : écrit un flux créé sur les écrans neutres du bureau exemple (`ecrans-outils/`), le contrôle et, avec « --apercu », en prend l'aperçu. */
function ecrireFlux(brut: unknown, args: ArgsEcriture, c: ContexteFlux): number {
  const { dep, sortie, neutres, ecransOutils, charteCss, refuser, dire } = c;
  const lu = lireFluxAutomatisation(brut);
  if (!lu.ok) return refuser(CODE_REFUSE, lu.erreurs);
  const flux = lu.flux;
  const crees = controlerFluxCree(flux, nomsPermis(neutres, ecransOutils));
  if (crees.length > 0) return refuser(CODE_REFUSE, crees);
  if (args.attendue !== undefined && empreinteFlux(flux) !== args.attendue) return refuser(CODE_EMPREINTE, [MESSAGE_EMPREINTE]);

  const dossierEcrans = join(DOSSIER_OUTIL, "ecrans-outils");
  let fichiers: Record<string, string>;
  try {
    fichiers = Object.fromEntries(FICHIERS_ECRANS.map((nom) => [nom, readFileSync(join(dossierEcrans, nom), "utf8")]));
  } catch {
    return refuser(CODE_REFUSE, ["Écrans du bureau exemple illisibles."]);
  }
  fichiers["demo-data.js"] = donneesEcransDepuisFlux(flux);

  const noms: NomsNeutres = { ...neutres, maquettes: { ...neutres.maquettes, ...((ecransOutils as { maquettes?: NomsNeutres["maquettes"] } | null)?.maquettes ?? {}) } };
  const controle = controlerMaquette(Object.entries(fichiers).map(([chemin, contenu]) => ({ chemin, contenu })), noms, MAQUETTE_FLUX);
  if (!controle.ok) return refuser(CODE_REFUSE, controle.defauts.map((x) => `${x.chemin}:${x.ligne} · ${x.regle}`));

  const dossierMaquette = join(sortie, "maquette");
  mkdirSync(dossierMaquette, { recursive: true });
  for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(join(dossierMaquette, nom), nom === "styles.css" ? policesJoignables(contenu, dep.racineDepot) : contenu);
  mkdirSync(join(sortie, "charte"), { recursive: true });
  writeFileSync(join(sortie, "charte", "charte.css"), policesJoignables(charteCss, dep.racineDepot));

  let pngs: string[] | undefined;
  if (args.apercu) {
    const scenario = join(sortie, "apercu-scenario.json");
    writeFileSync(scenario, jsonJoli(scenarioApercuFlux(flux)));
    const dossierApercu = join(sortie, "apercu");
    const r = dep.lancerCapteur(["--maquette", dossierMaquette, "--scenario", scenario, "--sortie", dossierApercu]);
    if (r.status !== 0) {
      const code = r.status ?? CODE_INATTENDU;
      dire(`Le capteur d'aperçu a échoué (code ${code}).`);
      return code;
    }
    pngs = listerPng(dossierApercu).map((p) => relative(sortie, p).split(sep).join("/"));
    writeFileSync(join(sortie, "apercu-piece.json"), jsonJoli(apercuPieceFlux(flux, pngs, { ok: true, defauts: [] })));
  }
  writeFileSync(join(sortie, "rapport.json"), jsonJoli(rapportMaquette(CODE_OK, [])));
  dire(`Flux écrit dans ${dossierMaquette}${pngs ? ` (aperçu : ${pngs.length} image(s))` : ""}.`);
  return CODE_OK;
}

function listerPng(dossier: string): string[] {
  const trouves: string[] = [];
  const marche = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) marche(p);
      else if (e.name.endsWith(".png")) trouves.push(p);
    }
  };
  try {
    marche(dossier);
  } catch {
    return [];
  }
  return trouves.sort();
}

/* ------------------------------------------------------------------ */
/* Point d'entrée (seulement quand le fichier est lancé, jamais à l'import) */
/* ------------------------------------------------------------------ */

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let code: number;
  try {
    code = ecrireMaquette(process.argv.slice(2), { env: process.env, plateforme: process.platform, racineDepot: RACINE_DEPOT, lancerCapteur: lancerCapteurReel });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    code = CODE_INATTENDU;
  }
  process.exit(code);
}
