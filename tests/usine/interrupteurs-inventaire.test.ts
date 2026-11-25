/**
 * Inventaire G7-06. Lit des constantes de zones argent et publication SANS les modifier ni les importer. Constate, n'exige pas.
 * C5-5.02 changera `planScenes.facecam` (ligne marquée `// CHANGERA : C5-5.02`, dans tests/usine/inventaire/habillage-et-briques.test.ts).
 *
 * Les tables sont dans `tests/usine/inventaire/<domaine>.test.ts` (12 domaines, liste fermée `DOMAINES`), rangées par la règle
 * `domaineDe` ci-dessous (tables A et B figées par INV-DOMAINES-a-v21p). Ce fichier ne garde que la logique et les tests ; chaque
 * fichier de domaine l'importe en première ligne, donc lancer UN seul domaine rejoue l'inventaire ENTIER sur l'union des 12.
 * Historique du compteur des clés littérales (figé) : 30 sur master 240a0e6 ; 31 avec `retoucheChat.coller`, C7 ; 32 avec
 * `zernio.synchro_etape_visuels`, L5-06 ; 33 avec `mesures.lecture_par_liste`, L8-02b ; 34 avec `mesures.tentatives_lecture`,
 * rotation des lectures ; 35 avec `accueil.bilan_semaine`, L8-04a ; 36 avec `mesures.relecture_automatique`, L5-18b ; 37 avec
 * `tutoriel.finitions`, T-EXT-31 ; 38 avec `tutoriel.suiviCloche`, T-EXT-34 ; 39 avec `videoLongue.actif`, VL-07 ; 40 avec
 * `tutoriel.devisAvantDepense`, T-EXT-42 ; 41 avec `zernio.rapatriement_actif`, RAP-2 ; 42 avec `tutoriel.finCommune`, T-EXT-26a.
 * 42 à a0fc572d, réparties par INV-DOMAINES-a-v21p ; depuis, chaque domaine porte son propre compteur (`nombre`), et la somme
 * des compteurs doit égaler l'union (test « compteurs de domaine »).
 *
 * Trois sources : (1) les tables figées des domaines ; (2) les fichiers purs importés (réglages plan de scènes, retouche chat) ;
 * (3) le texte de `src/**` (clés littérales passées à `lireParametre`). Une clé neuve absente de la table doit être éteinte
 * par défaut (seul `true` allume, R-9). Aucune lecture de la base, aucun import de fichier d'argent.
 *
 * Le filet refuse, pour une clé neuve, un défaut `true` OU un défaut objet allumé (`{ actif: true }`, forme de `site.reglages`,
 * ou `{ allume: true }`, forme de `double.rendu` / `double.looks`),
 * que la clé soit littérale, passée par constante `const NOM = "clé"` ou écrite en gabarit `` `x.${id}` ``.
 *
 * Limites connues du filet : (a) un appel à clé VARIABLE (`lireParametre(cle, true)` où `cle` vient d'une liste, d'un
 * paramètre ou d'une fonction `cleX(id)`) lui échappe : ces listes et gabarits sont donc inventoriés un à un ci-dessous
 * (REGLAGES_CAS_CONCRET, CLES_INTERRUPTEURS_ECRITURE, INTERRUPTEURS_PUBLICATION, INTERRUPTEURS_PRODUCTION, gabarits `moteur.*`,
 * `siteGenerateurs.*`, `siteAuto.*`, `illustrations.economique.*`) ; (b) une lecture par fonction-enveloppe à défaut `null` ou
 * `undefined` dont l'enveloppe décide « allumé si absent » (`motionAllumeeParDefaut` d'avocat-branchements.ts, `bufferGele`,
 * `lireReglageRessemblance`) ou « absent → constante » (`double.looks` : `v === null && LOOKS_HEYGEN_PAR_LE_STUDIO`, constante
 * de src/fournisseurs/heygen/rendus.ts) ne peut pas être jugée par le filet : ces cas sont constatés un à un dans PAR_CONSTANTE,
 * avec le texte de l'enveloppe (et de la constante) ; le test méta « recensement » oblige chaque appel à y figurer ou à être exclu ;
 * (c) les lectures directes `depots().parametres.obtenir(id)` (hors `lireParametre`) ne sont pas vues.
 * Restent volontairement HORS table (listés un à un dans EXCLUS_CLES et PAR_EXPRESSION, avec leur motif ; le test
 * « recensement » refuse tout appel `lireParametre` de src/** ni en table ni exclu), car ce sont des marques de dédoublonnage,
 * des mémoires ou des valeurs, et non des interrupteurs : `credits.*.${id}` (cleRefusee, lancementPret, expiration, epuise, test, rapprochement, alertes),
 * `budget.engage.*`, la `cle` de budget-mensuel.ts:232, autonomie-usine.ts:319 et :326, mode-budget.ts:108,
 * plafond-fournisseur.ts:74, `cleAlerteBudget()` (couts.ts), `paramRepriseDeWill(id)` (drapeau d'un seul tour,
 * generation-claude.ts), et les mémoires/données (`*.validations`, `*.lots`, `parcours.conversations*`, `zernio.bascules`,
 * `zernio.mode_envoi`, `zernio.tests`, etc.).
 */
import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { CLES_REGLAGE_RETOUCHE } from "@/services/retouche-chat/generateurs";

export type Etat = "allume" | "eteint" | "valeur" | "env";

/**
 * Clés passées par constante : lues dans le TEXTE (jamais importé). `appel` : fichier où la clé est lue ; `declare` : fichier
 * de la déclaration de la constante (par défaut `appel`) ; `motif` doit figurer dans `appel` et contient le DÉFAUT constaté.
 */
export type Constante = { cle: string; etat: Etat; appel: string; motif: RegExp; declare?: string; aussi?: [fichier: string, motif: RegExp][] };

/**
 * Gabarits de clés construites (`moteur.${formatId}.…`, src/services/reglages.ts, zone interdite : lecture du texte ;
 * `siteGenerateurs.${formatId}` et `siteAuto.${formatId}`, site-videos.ts ; `illustrations.economique.${videoId}`, choix par
 * vidéo, défaut `null` qui retombe sur le réglage général éteint). `declare` : motif de la fabrique de la clé.
 */
export type Gabarit = { gabarit: string; etat: Etat; appel: string; motif: RegExp; declare?: RegExp };

export type Env = { nom: string; fichier: string };

/**
 * RECENSEMENT (clôture G7-06) : tout appel `lireParametre(` de src/** (grep `lireParametre(<[^()]*>)?\(`, méthode `d.lireParametre(`
 * comprise) est soit EN TABLE (clé, constante, gabarit ou liste), soit EXCLU (`exclusCles`, `parExpression`) avec son motif. Le test
 * « recensement » échoue sur tout appel ni en table ni exclu, et sur toute exclusion devenue sans appel.
 * Motifs : `dedoublonnage` (marque « déjà fait / déjà prévenu », pas un interrupteur), `memoire` (données, journaux, lots,
 * verrous, comptes, connexions), `valeur` (réglage non booléen : nombre, plafond, texte, liste, choix), `relais` (définition
 * de la fonction, ou passe-plat `(id, défaut) => lireParametre(id, défaut)` dont les clés sont inventoriées ailleurs).
 * `exclusCles` : clés (ou gabarits `*`) résolues dans le texte mais HORS table. `parExpression` : appels à clé NON résolue dans
 * le texte (variable, fonction-clé, concaténation), par `fichier:expression` (expression du 1er argument, blancs réduits) : la
 * clé de la table qu'ils lisent, ou leur motif d'exclusion.
 */
export type Motif = "dedoublonnage" | "memoire" | "valeur" | "relais";
export type Couverture = { couvre: string } | { exclu: Motif };

/** Listes de src/** lues par clé variable, comptées par le test « listes lues par clé variable ». */
export type Listes = { REGLAGES_CAS_CONCRET?: number; CLES_INTERRUPTEURS_ECRITURE?: number; INTERRUPTEURS_PRODUCTION?: number; INTERRUPTEURS_PUBLICATION?: string[] };

/** Les 8 tables d'un domaine (ordre fixe). `planScenes` et `retouche` : lues par import (fichiers purs), valeurs constatées. */
export const TABLES = ["litterales", "constantes", "gabarits", "planScenes", "retouche", "exclusCles", "parExpression", "env"] as const;
export type Table = (typeof TABLES)[number];

export type Domaine = {
  nom: string;
  /** Clés littérales de `lireParametre("…", défaut)` dans src/**. */
  litterales: Record<string, Etat>;
  constantes: Constante[];
  gabarits: Gabarit[];
  planScenes: Record<string, Etat>;
  retouche: Record<string, Etat>;
  exclusCles: Record<string, Motif>;
  parExpression: Record<string, Couverture>;
  env: Env[];
  listes?: Listes;
  /** Compteur LOCAL de chaque table (remplace le compteur global `toHaveLength(42)`). */
  nombre: Record<Table, number>;
  /** Clés d'avant le découpage (AVANT_DECOUPAGE) retirées volontairement par une fiche, avec leur ligne. */
  retirees: string[];
};

/** Liste FERMÉE des domaines : un fichier `tests/usine/inventaire/<nom>.test.ts` chacun, aucun autre. */
export const DOMAINES = [
  "argent-et-fournisseurs",
  "cas-concret",
  "divers",
  "facecam-animee",
  "formats",
  "habillage-et-briques",
  "parcours-et-ecriture",
  "publication-et-mesures",
  "retouche-chat",
  "site-et-visuels",
  "tableau",
  "tableau-de-bord",
] as const;
export type NomDomaine = (typeof DOMAINES)[number];

/**
 * RÈGLE DE PLACEMENT (figée). Préfixe d'une clé = le texte avant le premier `.` (la clé entière sans `.`).
 * Table A : préfixe → domaine ; préfixe absent → règle de repli de la table (voir `domaineDe`).
 */
export const TABLE_A_PREFIXES: Record<Exclude<NomDomaine, "divers">, readonly string[]> = {
  "facecam-animee": ["facecamAnimee"],
  tableau: ["tableau", "regardeur"],
  "tableau-de-bord": ["tableauDeBord"],
  "retouche-chat": ["retoucheChat", "retoucheSegments"],
  "cas-concret": ["casConcret", "cas-concret"],
  "habillage-et-briques": ["habillage", "planScenes", "bibliothequeVideo", "varieteCommune", "motion", "decors", "pioche", "illustrations", "couverture", "miniature", "style", "dosageMotion"],
  formats: ["avocat", "imageVideo", "videoLongue", "tutoriel", "demoFacecam", "facecam", "double", "voix", "moteur", "formats", "afficherExemples", "alignement"],
  "publication-et-mesures": ["zernio", "publication", "buffer", "reseaux", "adaptations_reseaux", "hashtags", "republication", "aPublier", "calendrier", "sonde-publication", "push", "notifications", "cadence", "a_traiter", "mesures", "veille", "accueil", "surveillance"],
  "site-et-visuels": ["site", "siteGenerateurs", "siteAuto", "kb_site", "carrousels", "infographies", "visuels", "corbeille-visuels", "corbeille", "partages", "suivi", "cibles"],
  "argent-et-fournisseurs": ["budget", "credits", "claude", "fournisseur", "taux", "optionsPayantes", "limite_appels", "plafond", "fal", "generateur", "usine", "fabrication", "mentionIA"],
  "parcours-et-ecriture": ["parcours", "mots", "ecriture", "sujets", "guides", "matieres", "stock", "commentaires", "googleDrive", "oppositions", "auth", "bases", "idees", "comite", "gardien"],
};

/** Table B : début de chemin (sans le `src/` de tête) → domaine. ORDONNÉE : le premier qui correspond gagne ; sinon `divers`. */
export const TABLE_B_FICHIERS: readonly [debuts: readonly string[], domaine: NomDomaine][] = [
  [["services/facecam-animee", "moteurs/montage-facecam-animee/"], "facecam-animee"],
  [["services/tableau-de-bord"], "tableau-de-bord"],
  [["services/tableau", "moteurs/montage-tableau/"], "tableau"],
  [["services/retouche-chat/", "app/api/retouche-chat/"], "retouche-chat"],
  [["services/cas-concret", "moteurs/montage-cas-concret/"], "cas-concret"],
  [["visuels/", "app/(studio)/carrousels/", "app/(studio)/infographies/", "app/api/usine/visuels/", "services/site-"], "site-et-visuels"],
  [
    ["services/zernio", "services/publication", "services/branchement-envoi-calendrier", "services/garde-creneau-diffuseur", "services/calendrier-", "app/(studio)/reglages/", "services/fabrication-reseaux", "services/notifications", "services/mesures"],
    "publication-et-mesures",
  ],
  [["services/parcours", "services/oppositions-", "services/guides-", "services/serie-ecriture", "services/memoire-"], "parcours-et-ecriture"],
  [
    ["services/boucle", "services/generation-claude", "services/credit", "services/couts", "services/budget-", "services/mode-budget", "services/plafond-fournisseur", "services/source-claude", "services/autonomie-usine", "services/depense-claude-video", "services/apprentissage"],
    "argent-et-fournisseurs",
  ],
  [
    ["services/image-video", "services/video-longue", "services/tutoriel-", "services/zip-tutoriel", "services/avocat-", "services/effet-realiste-ia", "services/monteur-facecam", "services/multicamera", "services/generateur-ecran", "services/express", "services/modifications"],
    "formats",
  ],
  [["services/dosage-motion", "services/decors", "services/illustrations", "services/bibliotheque-video", "services/extraits-de-la-video", "services/variete-commune/"], "habillage-et-briques"],
];

/** Listes de src/** comptées : leur domaine (fixe). */
export const DOMAINE_DES_LISTES: Record<keyof Listes, NomDomaine> = {
  REGLAGES_CAS_CONCRET: "cas-concret",
  CLES_INTERRUPTEURS_ECRITURE: "parcours-et-ecriture",
  INTERRUPTEURS_PRODUCTION: "publication-et-mesures",
  INTERRUPTEURS_PUBLICATION: "publication-et-mesures",
};

const prefixeDe = (cle: string) => (cle.includes(".") ? cle.slice(0, cle.indexOf(".")) : cle);
const domaineDuPrefixe = (cle: string): NomDomaine | null => {
  const p = prefixeDe(cle);
  for (const [d, prefixes] of Object.entries(TABLE_A_PREFIXES)) if (prefixes.includes(p)) return d as NomDomaine;
  return null;
};
const domaineDuFichier = (fichier: string): NomDomaine => {
  const court = fichier.replace(/^src\//, "");
  for (const [debuts, d] of TABLE_B_FICHIERS) if (debuts.some((x) => court.startsWith(x))) return d;
  return "divers";
};

/**
 * Domaine qu'une ligne DOIT avoir (fonction pure). `ligne.cle` : la clé (`gabarit` pour les gabarits, `nom` pour l'env,
 * `fichier:expression` pour parExpression, nom de la liste pour les listes) ; `ligne.appel` (constantes) ; `ligne.valeur` (parExpression).
 * - litterales, gabarits, planScenes, retouche, exclusCles : table A, sinon `divers` ;
 * - constantes : table A, sinon domaine du fichier `appel` (table B) ;
 * - parExpression : `{ couvre: K }` → domaine de K (règle des constantes si K y est, sinon table A puis `divers`) ;
 *   `{ exclu }` → domaine du fichier (texte avant le premier `:`, table B) ;
 * - env → `divers` ; listes → `DOMAINE_DES_LISTES`.
 */
export function domaineDe(table: Table | "listes", ligne: { cle: string; appel?: string; valeur?: Couverture }, constantes: readonly Constante[] = []): NomDomaine {
  switch (table) {
    case "env":
      return "divers";
    case "listes":
      return DOMAINE_DES_LISTES[ligne.cle as keyof Listes] ?? "divers";
    case "constantes":
      return domaineDuPrefixe(ligne.cle) ?? (ligne.appel ? domaineDuFichier(ligne.appel) : "divers");
    case "parExpression": {
      const v = ligne.valeur;
      if (v && "couvre" in v) {
        const c = constantes.find((x) => x.cle === v.couvre);
        return c ? domaineDe("constantes", c) : (domaineDuPrefixe(v.couvre) ?? "divers");
      }
      return domaineDuFichier(ligne.cle.slice(0, ligne.cle.indexOf(":")));
    }
    default:
      return domaineDuPrefixe(ligne.cle) ?? "divers";
  }
}

/** Les 12 fichiers de domaine, chargés PARESSEUSEMENT (dans `beforeAll`), liste écrite en dur. */
const CHARGEURS: Record<NomDomaine, () => Promise<{ DOMAINE?: Domaine }>> = {
  "argent-et-fournisseurs": () => import("./inventaire/argent-et-fournisseurs.test"),
  "cas-concret": () => import("./inventaire/cas-concret.test"),
  divers: () => import("./inventaire/divers.test"),
  "facecam-animee": () => import("./inventaire/facecam-animee.test"),
  formats: () => import("./inventaire/formats.test"),
  "habillage-et-briques": () => import("./inventaire/habillage-et-briques.test"),
  "parcours-et-ecriture": () => import("./inventaire/parcours-et-ecriture.test"),
  "publication-et-mesures": () => import("./inventaire/publication-et-mesures.test"),
  "retouche-chat": () => import("./inventaire/retouche-chat.test"),
  "site-et-visuels": () => import("./inventaire/site-et-visuels.test"),
  tableau: () => import("./inventaire/tableau.test"),
  "tableau-de-bord": () => import("./inventaire/tableau-de-bord.test"),
};

/** Commit de départ du découpage : ses clés doivent toutes rester dans l'union (test « aucune clé d'avant perdue »). */
const AVANT_DECOUPAGE = "a0fc572d3c8832d943eb9b951fc7eefd476c87e7";

// Union des domaines, remplie par `chargerDomaines` (beforeAll) et lue au moment de l'appel.
let CHARGES: { fichier: NomDomaine; module: { DOMAINE?: Domaine } }[] = [];
let LES_DOMAINES: Domaine[] = [];
let LITTERALES: Record<string, Etat> = {};
let PAR_CONSTANTE: Constante[] = [];
let GABARITS: Gabarit[] = [];
let ENV: Env[] = [];
let PLAN_SCENES: Record<string, Etat> = {};
let RETOUCHE: Record<string, Etat> = {};
let EXCLUS_CLES: Record<string, Motif> = {};
let PAR_EXPRESSION: Record<string, Couverture> = {};
let LISTES: Listes = {};

async function chargerDomaines() {
  CHARGES = await Promise.all(DOMAINES.map(async (fichier) => ({ fichier, module: await CHARGEURS[fichier]() })));
  LES_DOMAINES = CHARGES.flatMap((c) => (c.module.DOMAINE ? [c.module.DOMAINE] : []));
  LITTERALES = Object.assign({}, ...LES_DOMAINES.map((d) => d.litterales));
  PAR_CONSTANTE = LES_DOMAINES.flatMap((d) => d.constantes);
  GABARITS = LES_DOMAINES.flatMap((d) => d.gabarits);
  ENV = LES_DOMAINES.flatMap((d) => d.env);
  PLAN_SCENES = Object.assign({}, ...LES_DOMAINES.map((d) => d.planScenes));
  RETOUCHE = Object.assign({}, ...LES_DOMAINES.map((d) => d.retouche));
  EXCLUS_CLES = Object.assign({}, ...LES_DOMAINES.map((d) => d.exclusCles));
  PAR_EXPRESSION = Object.assign({}, ...LES_DOMAINES.map((d) => d.parExpression));
  LISTES = Object.assign({}, ...LES_DOMAINES.map((d) => d.listes ?? {}));
}

/** Les lignes d'une table d'un domaine, sous forme `{ cle, appel?, valeur? }` (clé = identifiant de la ligne). */
function lignesDe(d: Domaine, t: Table): { cle: string; appel?: string; valeur?: Couverture }[] {
  switch (t) {
    case "constantes":
      return d.constantes.map((c) => ({ cle: c.cle, appel: c.appel }));
    case "gabarits":
      return d.gabarits.map((g) => ({ cle: g.gabarit }));
    case "env":
      return d.env.map((e) => ({ cle: e.nom }));
    case "parExpression":
      return Object.entries(d.parExpression).map(([cle, valeur]) => ({ cle, valeur }));
    default:
      return Object.keys(d[t]).map((cle) => ({ cle }));
  }
}

/** Clés de chaque table, extraites du TEXTE de l'ancien fichier (tables encore en place avant le découpage). */
export function clesDuFichierAvant(texte: string): Record<Table, string[]> {
  const lignes = texte.split("\n");
  const bloc = (nom: string) => {
    const i = lignes.findIndex((l) => new RegExp(`^const ${nom}\\b`).test(l));
    if (i < 0) throw new Error(`table ${nom} introuvable dans ${AVANT_DECOUPAGE}`);
    let j = i + 1;
    while (j < lignes.length && !/^[}\]];$/.test(lignes[j])) j++;
    return lignes.slice(i + 1, j).join("\n");
  };
  const par = (nom: string, re: RegExp) => [...bloc(nom).matchAll(re)].map((m) => m[1] ?? m[2]);
  const objet = /^ {2}(?:"([^"]+)"|([A-Za-z_$][\w$]*)):/gm;
  return {
    litterales: par("LITTERALES", objet),
    constantes: par("PAR_CONSTANTE", /\bcle: "([^"]+)"/g),
    gabarits: par("GABARITS", /\bgabarit: "([^"]+)"/g),
    planScenes: par("PLAN_SCENES", objet),
    retouche: par("RETOUCHE", objet),
    exclusCles: par("EXCLUS_CLES", objet),
    parExpression: par("PAR_EXPRESSION", objet),
    env: par("ENV", /\bnom: "([^"]+)"/g),
  };
}

const lire = (f: string) => readFileSync(f, "utf8");

/** Premier argument d'un appel (texte entre la parenthèse ouvrante et la 1re virgule ou parenthèse fermante de niveau 0). */
function argument(t: string, i: number): [texte: string, fin: number] {
  let niveau = 0;
  let guillemet: string | null = null;
  let j = i;
  for (; j < t.length; j++) {
    const c = t[j];
    if (guillemet) {
      if (c === "\\") j++;
      else if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") guillemet = c;
    else if ("([{".includes(c)) niveau++;
    else if (")]}".includes(c)) {
      if (niveau === 0) break;
      niveau--;
    } else if (c === "," && niveau === 0) break;
  }
  return [t.slice(i, j).replace(/\s+/g, " ").trim(), j];
}

export type Appel = { ligne: number; expr: string; defaut: string; cles: string[] | null; suite: string };

/**
 * Tous les appels `lireParametre(` d'un texte (multi-lignes compris). `cles` : clé(s) résolue(s) dans le texte (littérale,
 * gabarit `${…}` → `*` à préfixe littéral, constante `const NOM = "…"` du fichier, ou constante en MAJUSCULES de src/**) ;
 * `null` sinon. `suite` : le texte qui suit l'appel jusqu'à la fin de la ligne suivante (enveloppe éventuelle).
 */
export function appelsDansTexte(texte: string, globales: Map<string, Set<string>> = new Map()): Appel[] {
  const locales = constantesDansTexte(texte);
  const sortie: Appel[] = [];
  for (const m of texte.matchAll(/\blireParametre(?:<[^()]*?>)?\(/g)) {
    const [expr, fin] = argument(texte, m.index + m[0].length);
    const defaut = texte[fin] === "," ? argument(texte, fin + 1)[0] : "";
    let cles: string[] | null = null;
    if (/^"[^"]*"$/.test(expr)) cles = [expr.slice(1, -1)];
    else if (/^`[^`$]+\$\{[^`]*`$|^`[^`$]*`$/.test(expr)) cles = [expr.slice(1, -1).replace(/\$\{[^}]*\}/g, "*")];
    else if (locales.has(expr)) cles = [...locales.get(expr)!];
    else if (/^[A-Z][A-Z0-9_]*$/.test(expr) && globales.has(expr)) cles = [...globales.get(expr)!];
    const finLigne = texte.indexOf("\n", texte.indexOf("\n", fin) + 1);
    sortie.push({ ligne: texte.slice(0, m.index).split("\n").length, expr, defaut, cles, suite: texte.slice(fin, finLigne < 0 ? undefined : finLigne) });
  }
  return sortie;
}

/** Constantes `const NOM = "clé"` (tous fichiers de src/**) : NOM → valeurs possibles. */
export function constantesDansTexte(texte: string, dans = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const x of texte.matchAll(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[^=]+)?\s*=\s*"([^"]+)"/g)) dans.set(x[1], (dans.get(x[1]) ?? new Set()).add(x[2]));
  return dans;
}

/**
 * Extrait { clé → défauts littéraux } des appels `lireParametre("clé", défaut)`, `lireParametre(CONSTANTE, défaut)` ou
 * `` lireParametre(`x.${id}`, défaut) `` (gabarit : chaque `${…}` devient `*`) d'un texte. Un défaut objet est gardé entier.
 */
export function cleDansTexte(texte: string, constantes: Map<string, Set<string>> = new Map()): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const ajoute = (cle: string, d?: string) => m.set(cle, [...(m.get(cle) ?? []), (d ?? "").trim()]);
  const re = /\blireParametre(?:<[^()]*?>)?\(\s*(?:"([^"]+)"|([A-Z][A-Z0-9_]*)|`([^`]+)`)\s*(?:,\s*(\{[^}]*\}|[^,)\n]*(?:\([^)]*\))?))?/g;
  for (const x of texte.matchAll(re)) {
    if (x[1]) ajoute(x[1], x[4]);
    else if (x[3]) ajoute(x[3].replace(/\$\{[^}]*\}/g, "*"), x[4]);
    else for (const cle of constantes.get(x[2]) ?? []) ajoute(cle, x[4]);
  }
  return m;
}

/** Un défaut allume-t-il ? `true`, ou un objet `{ …, actif: true, … }` / `{ …, allume: true, … }`. */
export const defautAllume = (d: string) => d === "true" || (d.startsWith("{") && /\b(?:actif|allume)\s*:\s*true\b/.test(d));

/** Refuse toute clé neuve (hors table) dont un défaut littéral allume (`true` ou `{ actif: true }`). */
export function interrupteursNeufsAllumes(texte: string, connues: Set<string>, constantes?: Map<string, Set<string>>): string[] {
  const refus: string[] = [];
  const cst = constantesDansTexte(texte, new Map([...(constantes ?? new Map())].map(([k, v]) => [k, new Set(v)])));
  for (const [cle, defauts] of cleDansTexte(texte, cst)) {
    if (!connues.has(cle) && defauts.some(defautAllume)) refus.push(`${cle} : interrupteur neuf allumé par défaut : interdit (R-9)`);
  }
  return refus;
}

const fichiersSrc = () => execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
const toutesConstantes = () => {
  const c = new Map<string, Set<string>>();
  for (const f of fichiersSrc()) constantesDansTexte(lire(f), c);
  return c;
};

const toutesCles = () =>
  new Set<string>([
    ...Object.keys(LITTERALES),
    ...PAR_CONSTANTE.map((c) => c.cle),
    ...Object.keys(PLAN_SCENES),
    ...Object.keys(RETOUCHE),
    ...GABARITS.map((g) => g.gabarit),
  ]);

/** Indice d'une enveloppe qui JUGE la valeur lue comme un interrupteur (`.allume`, `.actif`, `=== true`, `!== false`). */
const ENVELOPPE_INTERRUPTEUR = /\.(?:allume|actif)\b|=== true|!== false/;

/**
 * Appels d'un fichier ni en table ni exclus (vide = tout est recensé). `vus` reçoit les entrées d'exclusion rencontrées.
 * Une exclusion `memoire` ou `valeur` dont l'enveloppe juge la valeur comme un interrupteur est aussi refusée.
 */
export function nonRecenses(fichier: string, texte: string, connues: Set<string>, globales?: Map<string, Set<string>>, vus = new Set<string>()): string[] {
  const court = fichier.replace(/^src\//, "");
  const refus: string[] = [];
  for (const a of appelsDansTexte(texte, globales)) {
    const ou = `${court}:${a.ligne}`;
    if (a.cles) {
      for (const cle of a.cles) {
        if (connues.has(cle)) continue;
        const motif = EXCLUS_CLES[cle];
        if (!motif) refus.push(`${ou} : clé « ${cle} » ni en table ni exclue`);
        else {
          vus.add(cle);
          if (motif !== "dedoublonnage" && ENVELOPPE_INTERRUPTEUR.test(a.suite)) refus.push(`${ou} : « ${cle} » exclue (${motif}) mais lue comme un interrupteur`);
        }
      }
      continue;
    }
    const k = `${court}:${a.expr}`;
    const e = PAR_EXPRESSION[k];
    if (!e) refus.push(`${ou} : appel à clé non résolue \`${a.expr}\` ni en table ni exclu`);
    else {
      vus.add(k);
      if ("couvre" in e && !connues.has(e.couvre)) refus.push(`${ou} : \`${a.expr}\` renvoie à « ${e.couvre} », absente de la table`);
      if ("exclu" in e && e.exclu !== "dedoublonnage" && e.exclu !== "relais" && ENVELOPPE_INTERRUPTEUR.test(a.suite)) refus.push(`${ou} : \`${a.expr}\` exclu (${e.exclu}) mais lu comme un interrupteur`);
    }
  }
  return refus;
}

describe("Inventaire des interrupteurs (G7-06)", () => {
  beforeAll(chargerDomaines);

  it("plan de scènes : valeurs par défaut constatées (import du fichier pur)", () => {
    for (const [g, cle] of Object.entries(CLES_REGLAGE_PLAN_SCENES)) {
      expect(PLAN_SCENES[cle], `${cle} absent de la table`).toBe(ALLUME_PAR_DEFAUT[g as keyof typeof ALLUME_PAR_DEFAUT] ? "allume" : "eteint");
    }
    expect(Object.keys(PLAN_SCENES).sort()).toEqual(Object.values(CLES_REGLAGE_PLAN_SCENES).sort());
  });

  it("retouche du chat : les clés de CLES_REGLAGE_RETOUCHE, toutes éteintes (AM-24 / C-7)", () => {
    expect(Object.values(CLES_REGLAGE_RETOUCHE).sort()).toEqual(Object.keys(RETOUCHE).sort());
    expect(Object.values(RETOUCHE).every((e) => e === "eteint")).toBe(true);
    const texte = lire("src/services/retouche-chat/generateurs.ts");
    expect(texte).toMatch(/seulement par la valeur `true`/);
  });

  it("clés littérales : chacune de la table est encore lue dans src/**, avec la valeur constatée", () => {
    const fichiers = fichiersSrc();
    const vues = new Map<string, string[]>();
    for (const f of fichiers) for (const [k, d] of cleDansTexte(lire(f))) vues.set(k, [...(vues.get(k) ?? []), ...d]);
    for (const [cle, etat] of Object.entries(LITTERALES)) {
      const defauts = vues.get(cle);
      expect(defauts, `clé disparue (retirer la ligne) : ${cle}`).toBeDefined();
      if (etat === "allume") expect(defauts).toContain("true");
      if (etat === "eteint") expect(defauts!.every((d) => d === "false")).toBe(true);
    }
  });

  it("toute clé littérale neuve dans src/** est éteinte par défaut", () => {
    const connues = toutesCles();
    const cst = toutesConstantes();
    const refus = fichiersSrc().flatMap((f) => interrupteursNeufsAllumes(lire(f), connues, cst).map((r) => `${f} : ${r}`));
    expect(refus).toEqual([]);
  });

  it("clés par constante : texte lu (sans import) et défaut constaté", () => {
    for (const c of PAR_CONSTANTE) {
      expect(lire(c.appel), `${c.cle} : appel avec son défaut introuvable dans ${c.appel}`).toMatch(c.motif);
      const decl = c.declare ?? c.appel;
      expect(lire(decl), `${c.cle} : clé disparue de ${decl}`).toContain(`"${c.cle}"`);
      for (const [f, m] of c.aussi ?? []) expect(lire(f), `${c.cle} : règle du défaut introuvable dans ${f}`).toMatch(m);
    }
  });

  it("listes lues par clé variable : chaque clé de la liste est dans la table (casConcret, écriture, publication)", () => {
    const cles = toutesCles();
    const cst = toutesConstantes();
    const casConcret = lire("src/services/cas-concret-reglages.ts").match(/REGLAGES_CAS_CONCRET = \{([^}]*)\}/)![1];
    const idsCas = [...casConcret.matchAll(/:\s*"([^"]+)"/g)].map((x) => x[1]);
    expect(idsCas).toHaveLength(LISTES.REGLAGES_CAS_CONCRET ?? -1);
    for (const k of idsCas) expect(cles.has(k), `REGLAGES_CAS_CONCRET : ${k} absente de la table`).toBe(true);
    const ecriture = lire("src/services/interrupteurs-ecriture.ts").match(/CLES_INTERRUPTEURS_ECRITURE = \[([^\]]*)\]/)![1];
    const idsEcr = [...ecriture.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(idsEcr).toHaveLength(LISTES.CLES_INTERRUPTEURS_ECRITURE ?? -1);
    for (const k of idsEcr) expect(cles.has(k), `CLES_INTERRUPTEURS_ECRITURE : ${k} absente de la table`).toBe(true);
    const registre = lire("src/domaine/interrupteurs/registre.ts");
    const idsPub = [...registre.matchAll(/\bcle:\s*([A-Z][A-Z0-9_]*)/g)].flatMap((x) => [...(cst.get(x[1]) ?? [])]);
    expect(idsPub.sort()).toEqual(LISTES.INTERRUPTEURS_PUBLICATION);
    for (const k of idsPub) expect(cles.has(k), `INTERRUPTEURS_PUBLICATION : ${k} absente de la table`).toBe(true);
    expect(lire("src/services/publication-editoriale-interrupteurs.ts")).toMatch(/lireParametre<unknown>\(cle, false\)/);
  });

  it("a_traiter.reseaux_manuels : aussi lue par parcours-mot.ts avec son défaut éteint", () => {
    expect(lire("src/services/parcours-mot.ts")).toMatch(/PARAM_RESEAUX_MANUELS, false\)\) === true/);
  });

  it("site-videos.ts : `siteAuto.*` aussi lu à la mise en ligne automatique avec son défaut éteint", () => {
    expect(lire("src/services/site-videos.ts")).toMatch(/lireParametre<boolean>\(cleSiteAuto\(video\.formatId\), false\)\) !== true/);
  });

  it("interrupteurs d'envoi affichés (INTERRUPTEURS_PRODUCTION, etat-production.ts) : chacun dans la table, même défaut", () => {
    const texte = lire("src/services/etat-production.ts").match(/INTERRUPTEURS_PRODUCTION = \[([\s\S]*?)\] as const/)![1];
    const lignes = [...texte.matchAll(/cle: "([^"]+)"[^}]*parDefaut: (true|false)/g)].map((x) => [x[1], x[2]] as const);
    expect(lignes).toHaveLength(LISTES.INTERRUPTEURS_PRODUCTION ?? -1);
    const etats = new Map(PAR_CONSTANTE.map((c) => [c.cle, c.etat]));
    for (const [cle, d] of lignes) expect(etats.get(cle), `INTERRUPTEURS_PRODUCTION : ${cle}`).toBe(d === "true" ? "allume" : "eteint");
  });

  it("clés par format (gabarits moteur.*, siteGenerateurs.*, siteAuto.*, illustrations.economique.*) : texte lu, défaut constaté", () => {
    for (const g of GABARITS) {
      expect(lire(g.appel), `${g.gabarit} : appel introuvable dans ${g.appel}`).toMatch(g.motif);
      if (g.declare) expect(lire(g.appel), `${g.gabarit} : fabrique de la clé introuvable`).toMatch(g.declare);
    }
  });

  it("variables d'environnement : lues dans le texte", () => {
    for (const e of ENV) expect(lire(e.fichier)).toContain(e.nom);
  });

  it("faux fichier neuf `lireParametre(\"x.actif\", true)` : refusé", () => {
    const faux = `const a = await lireParametre("x.actif", true);`;
    expect(interrupteursNeufsAllumes(faux, toutesCles())).toEqual(["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes(`await lireParametre<boolean>("x.actif", false)`, toutesCles())).toEqual([]);
  });

  it("faux fichier neuf avec clé passée par constante `lireParametre(PARAM_X, true)` : refusé", () => {
    const faux = `const PARAM_X = "x.actif";\nconst a = await lireParametre<boolean>(PARAM_X, true);`;
    expect(interrupteursNeufsAllumes(faux, toutesCles())).toEqual(["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<boolean>(PARAM_X, false)`, toutesCles())).toEqual([]);
    expect(interrupteursNeufsAllumes(`import { PARAM_X } from "./x";\nlireParametre(PARAM_X, true)`, toutesCles(), new Map([["PARAM_X", new Set(["x.actif"])]]))).toEqual([
      "x.actif : interrupteur neuf allumé par défaut : interdit (R-9)",
    ]);
  });

  it("faux fichier neuf à défaut objet allumé `lireParametre(PARAM_X, { actif: true })` ou `{ allume: true }` : refusé", () => {
    const refus = ["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"];
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<R>(PARAM_X, { actif: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`lireParametre("x.actif", { mode: "a", actif: true, n: 2 })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre(PARAM_X, { actif: false })`, toutesCles())).toEqual([]);
    // Champ `allume` (forme de `double.rendu`, `double.looks`) : même règle.
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<R>(PARAM_X, { allume: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`lireParametre("x.actif", { fond: "uni", allume: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre(PARAM_X, { allume: false })`, toutesCles())).toEqual([]);
    // Défaut objet allumé d'une clé constatée allumée (site.reglages) : accepté.
    expect(interrupteursNeufsAllumes(`const PARAM_REGLAGES = "site.reglages";\nlireParametre(PARAM_REGLAGES, { actif: true })`, toutesCles())).toEqual([]);
  });

  it("faux fichier neuf à clé en gabarit `` lireParametre(`x.${id}.actif`, true) `` : refusé", () => {
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`x.${id}.actif`, true)", toutesCles())).toEqual(["x.*.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`siteAuto.${id}`, false)", toutesCles())).toEqual([]);
  });

  it("recensement : chaque appel lireParametre de src/** est en table ou exclu avec son motif (et aucune exclusion morte)", () => {
    const connues = toutesCles();
    const cst = toutesConstantes();
    const vus = new Set<string>();
    let appels = 0;
    const refus: string[] = [];
    for (const f of fichiersSrc()) {
      const t = lire(f);
      appels += appelsDansTexte(t, cst).length;
      refus.push(...nonRecenses(f, t, connues, cst, vus));
    }
    expect(refus).toEqual([]);
    expect(appels, "le recensement doit voir les ≈ 480 appels du grep").toBeGreaterThan(450);
    const mortes = [...Object.keys(EXCLUS_CLES), ...Object.keys(PAR_EXPRESSION)].filter((k) => !vus.has(k));
    expect(mortes, "exclusion sans appel (retirer la ligne)").toEqual([]);
    for (const k of Object.keys(EXCLUS_CLES)) expect(connues.has(k), `${k} : à la fois en table et exclue`).toBe(false);
  });

  it("recensement : un faux fichier neuf dont l'enveloppe lit `.allume` sur un défaut null est refusé tant qu'il n'est ni en table ni exclu", () => {
    const connues = toutesCles();
    const faux = `const CLE_Y = "y.reglage";\nexport async function yAllume() {\n  const v = await lireParametre<{ allume?: boolean } | null>(CLE_Y, null);\n  return v?.allume === true;\n}`;
    expect(nonRecenses("src/services/y.ts", faux, connues)).toEqual(["services/y.ts:3 : clé « y.reglage » ni en table ni exclue"]);
    expect(nonRecenses("src/services/y.ts", "const v = await lireParametre<unknown>(cleY(id), null);", connues)).toEqual(["services/y.ts:1 : appel à clé non résolue `cleY(id)` ni en table ni exclu"]);
    // Exclure en « memoire » une clé dont l'enveloppe juge `.actif` ne suffit pas.
    expect(nonRecenses("src/services/sante.ts", `const v = await lireParametre("bases.empreinte", null);\nif (v?.actif) go();`, connues)).toEqual([
      "services/sante.ts:1 : « bases.empreinte » exclue (memoire) mais lue comme un interrupteur",
    ]);
    // Clé en table : acceptée.
    expect(nonRecenses("src/services/rendu-double.ts", `const CLE = "double.rendu";\nconst v = await lireParametre(CLE, null);\nreturn v?.allume === true;`, connues)).toEqual([]);
  });

  it("clé existante allumée (afficherExemples) : acceptée car constatée dans la table", () => {
    expect(interrupteursNeufsAllumes(`lireParametre("afficherExemples", true)`, toutesCles())).toEqual([]);
  });

  it("les clés littérales de master sont toutes dans la table : compteur LOCAL de chaque domaine, somme = union (historique dans l'en-tête)", () => {
    for (const d of LES_DOMAINES) expect(Object.keys(d.litterales), `${d.nom} : nombre.litterales`).toHaveLength(d.nombre.litterales);
    expect(LES_DOMAINES.reduce((n, d) => n + d.nombre.litterales, 0)).toBe(Object.keys(LITTERALES).length);
  });

  it("domaines : dossier fermé (12 fichiers, un DOMAINE chacun, nom = fichier, compteurs complets)", () => {
    expect(readdirSync("tests/usine/inventaire").sort()).toEqual(DOMAINES.map((d) => `${d}.test.ts`).sort());
    for (const { fichier, module } of CHARGES) {
      expect(module.DOMAINE, `${fichier}.test.ts : export DOMAINE absent`).toBeDefined();
      expect(module.DOMAINE!.nom, `${fichier}.test.ts : nom`).toBe(fichier);
      const nombre = module.DOMAINE!.nombre as Partial<Record<string, unknown>> | undefined;
      expect(Object.keys(nombre ?? {}).sort(), `${fichier} : nombre doit avoir les 8 champs`).toEqual([...TABLES].sort());
      for (const t of TABLES) expect(Number.isInteger(nombre?.[t]), `${fichier} : nombre.${t} entier`).toBe(true);
    }
  });

  it("domaines : une ligne, son domaine (règle domaineDe appliquée à chaque ligne et à chaque liste)", () => {
    const refus: string[] = [];
    for (const d of LES_DOMAINES) {
      for (const t of TABLES)
        for (const l of lignesDe(d, t)) {
          const attendu = domaineDe(t, l, PAR_CONSTANTE);
          if (attendu !== d.nom) refus.push(`${l.cle} : rangée dans ${d.nom}, la règle dit ${attendu}`);
        }
      for (const nom of Object.keys(d.listes ?? {})) {
        const attendu = domaineDe("listes", { cle: nom });
        if (attendu !== d.nom) refus.push(`${nom} : rangée dans ${d.nom}, la règle dit ${attendu}`);
      }
    }
    expect(refus).toEqual([]);
  });

  it("domaines : une clé, un domaine (aucune clé, gabarit, fichier:expression ni liste déclarés deux fois)", () => {
    const refus: string[] = [];
    const parTable: [string, (d: Domaine) => string[]][] = [
      ...TABLES.map((t) => [t, (d: Domaine) => lignesDe(d, t).map((l) => l.cle)] as [string, (d: Domaine) => string[]]),
      ["listes", (d: Domaine) => Object.keys(d.listes ?? {})],
    ];
    for (const [t, cles] of parTable) {
      const ou = new Map<string, string[]>();
      for (const d of LES_DOMAINES) for (const k of cles(d)) ou.set(k, [...(ou.get(k) ?? []), d.nom]);
      for (const [k, ds] of ou) if (ds.length > 1) refus.push(`${t} « ${k} » : déclarée dans ${ds.join(", ")}`);
    }
    expect(refus).toEqual([]);
  });

  it("domaines : compteurs de domaine (chaque table de chaque domaine = son nombre ; somme des nombre = taille de l'union)", () => {
    for (const d of LES_DOMAINES) for (const t of TABLES) expect(lignesDe(d, t), `${d.nom} : nombre.${t}`).toHaveLength(d.nombre[t]);
    const union: Record<Table, number> = {
      litterales: Object.keys(LITTERALES).length,
      constantes: new Set(PAR_CONSTANTE.map((c) => c.cle)).size,
      gabarits: new Set(GABARITS.map((g) => g.gabarit)).size,
      planScenes: Object.keys(PLAN_SCENES).length,
      retouche: Object.keys(RETOUCHE).length,
      exclusCles: Object.keys(EXCLUS_CLES).length,
      parExpression: Object.keys(PAR_EXPRESSION).length,
      env: new Set(ENV.map((e) => e.nom)).size,
    };
    for (const t of TABLES) expect(LES_DOMAINES.reduce((n, d) => n + d.nombre[t], 0), `${t} : somme des nombre ≠ union (doublon caché ?)`).toBe(union[t]);
  });

  it(`domaines : aucune clé d'avant perdue (tables de ${AVANT_DECOUPAGE.slice(0, 8)} toutes dans l'union, sauf retirees)`, () => {
    let texte: string;
    try {
      texte = execSync(`git show ${AVANT_DECOUPAGE}:tests/usine/interrupteurs-inventaire.test.ts`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      throw new Error(`git show ${AVANT_DECOUPAGE} impossible (historique absent ?) : le filet « aucune clé perdue » ne peut pas être vérifié. ${String(e)}`);
    }
    const avant = clesDuFichierAvant(texte);
    const retirees = new Set(LES_DOMAINES.flatMap((d) => d.retirees));
    const maintenant = Object.fromEntries(TABLES.map((t) => [t, new Set(LES_DOMAINES.flatMap((d) => lignesDe(d, t).map((l) => l.cle)))])) as Record<Table, Set<string>>;
    const perdues = TABLES.flatMap((t) => avant[t].filter((k) => !maintenant[t].has(k) && !retirees.has(k)).map((k) => `${t} « ${k} »`));
    expect(perdues, "clé d'avant le découpage absente de l'union (et pas dans retirees)").toEqual([]);
    expect(TABLES.map((t) => avant[t].length)).toEqual([42, 77, 7, 3, 5, 119, 102, 2]);
  });
});
