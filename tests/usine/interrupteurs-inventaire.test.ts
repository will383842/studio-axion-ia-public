/**
 * Inventaire G7-06. Lit des constantes de zones argent et publication SANS les modifier ni les importer. Constate, n'exige pas.
 * C5-5.02 changera `planScenes.facecam` (ligne marquée `// CHANGERA : C5-5.02`).
 *
 * Trois sources : (1) la table figée ci-dessous ; (2) les fichiers purs importés (réglages plan de scènes, retouche chat) ;
 * (3) le texte de `src/**` (clés littérales passées à `lireParametre`). Une clé neuve absente de la table doit être éteinte
 * par défaut (seul `true` allume, R-9). Aucune lecture de la base, aucun import de fichier d'argent.
 *
 * Le filet refuse, pour une clé neuve, un défaut `true` OU un défaut objet allumé (`{ actif: true }`, forme de `site.reglages`),
 * que la clé soit littérale, passée par constante `const NOM = "clé"` ou écrite en gabarit `` `x.${id}` ``.
 *
 * Limites connues du filet : (a) un appel à clé VARIABLE (`lireParametre(cle, true)` où `cle` vient d'une liste, d'un
 * paramètre ou d'une fonction `cleX(id)`) lui échappe : ces listes et gabarits sont donc inventoriés un à un ci-dessous
 * (REGLAGES_CAS_CONCRET, CLES_INTERRUPTEURS_ECRITURE, INTERRUPTEURS_PUBLICATION, INTERRUPTEURS_PRODUCTION, gabarits `moteur.*`,
 * `siteGenerateurs.*`, `siteAuto.*`, `illustrations.economique.*`) ; (b) une lecture par fonction-enveloppe à défaut `null` ou
 * `undefined` dont l'enveloppe décide « allumé si absent » (`motionAllumeeParDefaut` d'avocat-branchements.ts, `bufferGele`,
 * `lireReglageRessemblance`) ne peut pas être jugée par le filet : ces cas sont constatés un à un dans PAR_CONSTANTE ;
 * (c) les lectures directes `depots().parametres.obtenir(id)` (hors `lireParametre`) ne sont pas vues.
 * Restent volontairement HORS table, car ce sont des marques de dédoublonnage, des mémoires ou des valeurs, et non des
 * interrupteurs : `credits.*.${id}` (cleRefusee, lancementPret, expiration, epuise, test, rapprochement, alertes),
 * `budget.engage.*`, la `cle` de budget-mensuel.ts:232, autonomie-usine.ts:319 et :326, mode-budget.ts:108,
 * plafond-fournisseur.ts:74, `cleAlerteBudget()` (couts.ts), `paramRepriseDeWill(id)` (drapeau d'un seul tour,
 * generation-claude.ts), et les mémoires/données (`*.validations`, `*.lots`, `parcours.conversations*`, `zernio.bascules`,
 * `zernio.mode_envoi`, `zernio.tests`, etc.).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { CLES_REGLAGE_RETOUCHE } from "@/services/retouche-chat/generateurs";

type Etat = "allume" | "eteint" | "valeur" | "env";

/** Clés littérales de `lireParametre("…", défaut)` dans src/** (30 sur master 240a0e6 ; 31 avec `retoucheChat.coller`, C7). */
const LITTERALES: Record<string, Etat> = {
  afficherExemples: "allume",
  "alignement.voixSynthese": "eteint",
  "budget.mensuel": "valeur",
  "budget.seuilConfirmation": "valeur",
  "casConcret.catalogueEtendu": "eteint",
  "casConcret.stockMetiers": "eteint",
  "fabrication.concurrence": "valeur",
  "formats.prevenir": "valeur",
  "fournisseur.alignement": "valeur",
  "fournisseur.illustration": "valeur",
  "fournisseur.montage": "valeur",
  "fournisseur.notification": "valeur",
  "fournisseur.stockage": "valeur",
  "illustrations.economique": "eteint",
  "mentionIA.parDefaut": "valeur",
  "miniature.gabarit": "valeur",
  "mots.registre": "valeur",
  notifications: "valeur",
  "parcours.oppositions.file": "valeur",
  "publication.heureParReseau": "valeur",
  "publication.ordreParDefaut": "valeur",
  "publication.pageSuivie": "valeur",
  "publication.routage": "valeur",
  "push.abonnements": "valeur",
  "retoucheChat.coller": "eteint",
  "reseaux.parDefaut": "valeur",
  "site.lienDansYoutube": "eteint",
  "style.faconDeParler": "valeur",
  "taux.usdEur": "valeur",
  "veille.derniereLecture": "valeur",
  "veille.resumeSemaine": "valeur",
};

/**
 * Clés passées par constante : lues dans le TEXTE (jamais importé). `appel` : fichier où la clé est lue ; `declare` : fichier
 * de la déclaration de la constante (par défaut `appel`) ; `motif` doit figurer dans `appel` et contient le DÉFAUT constaté.
 */
type Constante = { cle: string; etat: Etat; appel: string; motif: RegExp; declare?: string; aussi?: [fichier: string, motif: RegExp][] };
const PAR_CONSTANTE: Constante[] = [
  { cle: "aPublier.page", etat: "allume", appel: "src/services/a-publier.ts", motif: /lireParametre<unknown>\(PARAM_PAGE_A_PUBLIER, true\)\) !== false/ },
  { cle: "zernio.envoi_autorise", etat: "allume", appel: "src/services/zernio.ts", motif: /PARAM_ARRET_ZERNIO, true\)\) !== false/ },
  { cle: "facecam.aligneur.reel", etat: "allume", appel: "src/services/fabrication.ts", motif: /lireParametre<boolean>\(PARAM_FACECAM_REEL, true\)\) === true/ },
  { cle: "publication.editoriale_active", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_EDITORIALE_ACTIVE, false\)\) === true/ },
  { cle: "idees.comite", etat: "eteint", appel: "src/services/comite-editorial.ts", motif: /PARAM_COMITE, false\)\) === true/ },
  { cle: "gardien.chiffres.actif", etat: "eteint", appel: "src/services/gardien-chiffres.ts", motif: /REGLAGE_GARDIEN_CHIFFRES, false\)\) === true/ },
  { cle: "comite.source_usine.actif", etat: "eteint", appel: "src/services/branchement-idees-usine.ts", motif: /REGLAGE_SOURCE_USINE, false\)\) === true/ },
  { cle: "facecamAnimee.calageAuMot", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /PARAM_CALAGE_AU_MOT_FA, false\)\) === true/ },
  { cle: "facecamAnimee.finDouce", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /PARAM_FIN_DOUCE_FA, false\)\) === true/ },
  { cle: "facecamAnimee.accordEssaiReel", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /lireParametre<boolean>\(PARAM_ACCORD_ESSAI_FA, false\)/ },
  { cle: "facecamAnimee.plafondClaudeUsd", etat: "valeur", appel: "src/services/facecam-animee.ts", motif: /lireParametre<number>\(PARAM_PLAFOND_CLAUDE_FA, PLAFOND_CLAUDE_FA_USD\)/ },
  { cle: "facecamAnimee.plafondVideosUsd", etat: "valeur", appel: "src/services/depense-claude-video.ts", motif: /parametre: PARAM_PLAFOND_VIDEOS_FA, defautUsd: PLAFOND_VIDEOS_FA_USD/ },
  { cle: "imageVideo.accordEssaiReel", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /PARAM_ACCORD_ESSAI_IV, false\)/ },
  { cle: "imageVideo.relireScript", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /lireParametre<boolean>\(PARAM_RELIRE_SCRIPT_IV, false\)/ },
  { cle: "usine.autonomie", etat: "eteint", appel: "src/services/autonomie-usine.ts", motif: /lireParametre<unknown>\(CLE_REGLAGE, null\)/ },
  { cle: "usine.autonomie.porte", etat: "eteint", appel: "src/services/autonomie-usine.ts", motif: /lireParametre<unknown>\(CLE_PORTE, null\)/ },
  { cle: "carrousels.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
  { cle: "infographies.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
  { cle: "avocat.multicamera", etat: "eteint", appel: "src/services/multicamera-avocat.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(PARAM_MULTICAMERA_AVOCAT, null\)/ },
  { cle: "facecam.multicamera", etat: "eteint", appel: "src/services/multicamera.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(paramMulticamera\(format\), null\)/ },
  { cle: "zernio.youtube_actif", etat: "eteint", appel: "src/services/youtube-zernio.ts", declare: "src/fournisseurs/publication/zernio-youtube.ts", motif: /lireParametre<unknown>\(CLE_YOUTUBE_ACTIF, false\)/ },
  { cle: "limite_appels.active", etat: "eteint", appel: "src/services/limite-appels.ts", motif: /lireParametre<boolean>\(PARAM_LIMITE_ACTIVE, false\)\) !== true/ },
  { cle: "kb_site.lecture.actif", etat: "eteint", appel: "src/services/kb-site.ts", motif: /REGLAGE_LECTURE_SITE, false\)\) === true/ },
  { cle: "ecriture.memoireCasConcret", etat: "eteint", appel: "src/services/memoire-cas-concret.ts", motif: /REGLAGE_MEMOIRE_CAS_CONCRET, false\)\) === true/ },
  { cle: "ecriture.memoireCentrale", etat: "eteint", appel: "src/services/memoire-centrale.ts", motif: /REGLAGE_MEMOIRE_CENTRALE, false\)\) === true/ },
  { cle: "site.passeportParClaude", etat: "eteint", appel: "src/services/site-videos.ts", motif: /PARAM_PASSEPORT_PAR_CLAUDE, false\)\) === true/ },
  { cle: "parcours.instagram_suivre", etat: "eteint", appel: "src/services/parcours-instagram.ts", motif: /lireParametre<unknown>\(PARAM_INSTAGRAM_SUIVRE, false\)/ },
  { cle: "parcours.mots_multiples", etat: "eteint", appel: "src/services/parcours-mots-multiples.ts", motif: /lireParametre<unknown>\(PARAM_MOTS_MULTIPLES, false\)/ },
  { cle: "couverture.titreParDefaut", etat: "eteint", appel: "src/services/miniatures.ts", declare: "src/domaine/vignettes.ts", motif: /lireParametre<boolean>\(REGLAGE_TITRE_COUVERTURE, false\)\) !== true/ },
  { cle: "generateur.apprentissage", etat: "eteint", appel: "src/services/apprentissage.ts", declare: "src/domaine/apprentissage.ts", motif: /lireParametre<boolean>\(PARAM_APPRENTISSAGE, false\)\) === true/ },
  { cle: "sujets.garde", etat: "valeur", appel: "src/services/sujets-traites.ts", motif: /lireParametre<unknown>\(REGLAGE_GARDE_SUJETS, "bloquant"\)/ },
  { cle: "zernio.envoi_calendrier_autorise", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_ENVOI_CALENDRIER, false\)\) === true/ },
  { cle: "publication.premier_commentaire_coupe", etat: "eteint", appel: "src/fournisseurs/publication/zernio.ts", declare: "src/domaine/interrupteurs/registre.ts", motif: /CLE_PREMIER_COMMENTAIRE_COUPE, false\)/ },
  { cle: "ecriture.memoireTableau", etat: "eteint", appel: "src/services/tableau-scripts/memoire.ts", motif: /PARAM_MEMOIRE_TABLEAU, false\)\) === true/ },
  { cle: "adaptations_reseaux.actif", etat: "eteint", appel: "src/services/interrupteurs-ecriture.ts", motif: /lireParametre<unknown>\(cle, false\)\) === true/ },
  { cle: "casConcret.porteB", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.retouches", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.documentPromis", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.ecranFourni", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.releves", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "optionsPayantes.coupees", etat: "eteint", appel: "src/services/options-payantes.ts", motif: /PARAM_OPTIONS_COUPEES, false\)\) === true/ },
  { cle: "a_traiter.reseaux_manuels", etat: "eteint", appel: "src/services/a-traiter-manuel.ts", motif: /PARAM_RESEAUX_MANUELS, false\)\) === true/ },
  // Montage avocat (voisin de zone interdite) : lecture du texte seulement, jamais d'import.
  {
    cle: "avocat.motionCommune",
    etat: "allume",
    appel: "src/services/avocat-branchements.ts",
    declare: "src/moteurs/montage-avocat/motion.ts",
    motif: /motionAllumeeParDefaut\(PARAM_MOTION_AVOCAT\)/,
    aussi: [["src/services/avocat-branchements.ts", /async function motionAllumeeParDefaut[\s\S]*?lireParametre<unknown>\(param, null\);\s*if \(v === false\) return null;/]],
  },
  {
    cle: "avocat.monteur",
    etat: "eteint",
    appel: "src/services/avocat-branchements.ts",
    declare: "src/moteurs/montage-avocat/monteur.ts",
    motif: /await allume\(PARAM_MONTEUR_AVOCAT\)/,
    aussi: [["src/services/avocat-branchements.ts", /async function allume\(param: string\)[\s\S]*?lireParametre<unknown>\(param, null\);\s*if \(v === true\) return \{\};/]],
  },
  { cle: "site.reglages", etat: "allume", appel: "src/services/source-axion.ts", motif: /lireParametre<ReglagesSite>\(PARAM_REGLAGES, \{ actif: true \}\)/ },
  { cle: "matieres.rappelHebdo", etat: "eteint", appel: "src/services/matieres.ts", motif: /lireParametre\(CLE_RAPPEL, \{ actif: false \}\)/ },
  { cle: "retoucheChat.sansGenerateur", etat: "eteint", appel: "src/services/retouche-chat/garde-acces.ts", motif: /lire\(CLE_REGLAGE_SANS_GENERATEUR, false\)\) === true/ },
  {
    cle: "buffer.gele",
    etat: "allume",
    appel: "src/services/buffer-gel.ts",
    motif: /lireParametre<unknown>\(PARAM_GELE, undefined\);\s*if \(v === false\) return false;/,
  },
  {
    cle: "voix.ressemblance",
    etat: "allume",
    appel: "src/services/voix-ressemblance.ts",
    declare: "src/briques/voix-maitre/reference.ts",
    motif: /lireReglageRessemblance\(await lireParametre<unknown>\(PARAM_RESSEMBLANCE_VOIX, null\)\)/,
    aussi: [["src/briques/voix-maitre/reference.ts", /RESSEMBLANCE_VOIX_PAR_DEFAUT[^=]*= Object\.freeze\(\{ actif: true/]],
  },
  {
    cle: "facecam.decorIa",
    etat: "eteint",
    appel: "src/services/decor-ia.ts",
    motif: /lireReglageBrut\(await lireParametre<unknown>\(PARAM_DECOR_IA, null\)\)/,
    aussi: [["src/services/decor-ia.ts", /actif: o\.actif === true/]],
  },
  {
    cle: "facecam.effetRealiste",
    etat: "eteint",
    appel: "src/services/effet-realiste-ia.ts",
    motif: /lireParametre<\{ reel\?: unknown \}>\(PARAM_REGLAGE_EFFET, \{\}\);\s*return \{ reel: r\?\.reel === true \}/,
  },
];

/**
 * Gabarits de clés construites (`moteur.${formatId}.…`, src/services/reglages.ts, zone interdite : lecture du texte ;
 * `siteGenerateurs.${formatId}` et `siteAuto.${formatId}`, site-videos.ts ; `illustrations.economique.${videoId}`, choix par
 * vidéo, défaut `null` qui retombe sur le réglage général éteint). `declare` : motif de la fabrique de la clé.
 */
const GABARITS: { gabarit: string; etat: Etat; appel: string; motif: RegExp; declare?: RegExp }[] = [
  { gabarit: "moteur.*.jeLis", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.jeLis`, false\)\) === true/ },
  { gabarit: "moteur.*.montageReel", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.montageReel`, false\)\) === true/ },
  {
    gabarit: "siteGenerateurs.*",
    etat: "eteint",
    appel: "src/services/site-videos.ts",
    motif: /lireParametre<boolean>\(cleSiteGenerateur\(formatId\), false\)\) === true/,
    declare: /cleSiteGenerateur = \(formatId: string\) => `siteGenerateurs\.\$\{formatId\}`/,
  },
  {
    gabarit: "siteAuto.*",
    etat: "eteint",
    appel: "src/services/site-videos.ts",
    motif: /lireParametre<boolean>\(cleSiteAuto\(f\.id\), false\)\) === true/,
    declare: /cleSiteAuto = \(formatId: string\) => `siteAuto\.\$\{formatId\}`/,
  },
  {
    gabarit: "illustrations.economique.*",
    etat: "eteint",
    appel: "src/services/illustrations.ts",
    motif: /lireParametre<boolean \| null>\(cleEconomique\(videoId\), null\);\s*return v \?\? \(await lireParametre<boolean>\("illustrations\.economique", false\)\)/,
    declare: /cleEconomique = \(videoId: Id\) => `illustrations\.economique\.\$\{videoId\}`/,
  },
];

const ENV: { nom: string; fichier: string }[] = [
  { nom: "USINE_TOUT_ARRETER", fichier: "src/app/api/usine/commandes/route.ts" },
  { nom: "STUDIO_PORTE_SECRET", fichier: "src/usine/garde-porte.ts" },
];

/** Planscènes et retouche : lus par import (fichiers purs), valeurs constatées. */
const PLAN_SCENES: Record<string, Etat> = {
  "planScenes.casConcret": "allume",
  "planScenes.facecam": "allume", // CHANGERA : C5-5.02
  "planScenes.facecamAnimee": "eteint",
};
const RETOUCHE: Record<string, Etat> = {
  "retoucheChat.avocat": "eteint",
  "retoucheChat.imageVideo": "eteint",
  "retoucheChat.facecamAnimee": "eteint",
};

const lire = (f: string) => readFileSync(f, "utf8");

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

/** Un défaut allume-t-il ? `true`, ou un objet `{ …, actif: true, … }`. */
export const defautAllume = (d: string) => d === "true" || (d.startsWith("{") && /\bactif\s*:\s*true\b/.test(d));

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

describe("Inventaire des interrupteurs (G7-06)", () => {
  it("plan de scènes : valeurs par défaut constatées (import du fichier pur)", () => {
    for (const [g, cle] of Object.entries(CLES_REGLAGE_PLAN_SCENES)) {
      expect(PLAN_SCENES[cle], `${cle} absent de la table`).toBe(ALLUME_PAR_DEFAUT[g as keyof typeof ALLUME_PAR_DEFAUT] ? "allume" : "eteint");
    }
    expect(Object.keys(PLAN_SCENES).sort()).toEqual(Object.values(CLES_REGLAGE_PLAN_SCENES).sort());
  });

  it("retouche du chat : trois clés, toutes éteintes (AM-24 / C-7)", () => {
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
    expect(idsCas).toHaveLength(7);
    for (const k of idsCas) expect(cles.has(k), `REGLAGES_CAS_CONCRET : ${k} absente de la table`).toBe(true);
    const ecriture = lire("src/services/interrupteurs-ecriture.ts").match(/CLES_INTERRUPTEURS_ECRITURE = \[([^\]]*)\]/)![1];
    const idsEcr = [...ecriture.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(idsEcr).toHaveLength(4);
    for (const k of idsEcr) expect(cles.has(k), `CLES_INTERRUPTEURS_ECRITURE : ${k} absente de la table`).toBe(true);
    const registre = lire("src/domaine/interrupteurs/registre.ts");
    const idsPub = [...registre.matchAll(/\bcle:\s*([A-Z][A-Z0-9_]*)/g)].flatMap((x) => [...(cst.get(x[1]) ?? [])]);
    expect(idsPub.sort()).toEqual(["publication.editoriale_active", "publication.premier_commentaire_coupe"]);
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
    expect(lignes).toHaveLength(3);
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

  it("faux fichier neuf à défaut objet allumé `lireParametre(PARAM_X, { actif: true })` : refusé", () => {
    const refus = ["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"];
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<R>(PARAM_X, { actif: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`lireParametre("x.actif", { mode: "a", actif: true, n: 2 })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre(PARAM_X, { actif: false })`, toutesCles())).toEqual([]);
    // Défaut objet allumé d'une clé constatée allumée (site.reglages) : accepté.
    expect(interrupteursNeufsAllumes(`const PARAM_REGLAGES = "site.reglages";\nlireParametre(PARAM_REGLAGES, { actif: true })`, toutesCles())).toEqual([]);
  });

  it("faux fichier neuf à clé en gabarit `` lireParametre(`x.${id}.actif`, true) `` : refusé", () => {
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`x.${id}.actif`, true)", toutesCles())).toEqual(["x.*.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`siteAuto.${id}`, false)", toutesCles())).toEqual([]);
  });

  it("clé existante allumée (afficherExemples) : acceptée car constatée dans la table", () => {
    expect(interrupteursNeufsAllumes(`lireParametre("afficherExemples", true)`, toutesCles())).toEqual([]);
  });

  it("les clés littérales de master sont toutes dans la table (30 sur 240a0e6, + retoucheChat.coller)", () => {
    expect(Object.keys(LITTERALES)).toHaveLength(31);
  });
});
