/**
 * Inventaire G7-06. Lit des constantes de zones argent et publication SANS les modifier ni les importer. Constate, n'exige pas.
 * C5-5.02 changera `planScenes.facecam` (ligne marquée `// CHANGERA : C5-5.02`).
 *
 * Trois sources : (1) la table figée ci-dessous ; (2) les fichiers purs importés (réglages plan de scènes, retouche chat) ;
 * (3) le texte de `src/**` (clés littérales passées à `lireParametre`). Une clé neuve absente de la table doit être éteinte
 * par défaut (seul `true` allume, R-9). Aucune lecture de la base, aucun import de fichier d'argent.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { CLES_REGLAGE_RETOUCHE } from "@/services/retouche-chat/generateurs";

type Etat = "allume" | "eteint" | "valeur" | "env";

/** Clés littérales de `lireParametre("…", défaut)` dans src/** (30 sur master 240a0e6). */
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
type Constante = { cle: string; etat: Etat; appel: string; motif: RegExp; declare?: string };
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

/** Extrait { clé → défauts littéraux } des appels `lireParametre("clé", défaut)` ou `lireParametre(CONSTANTE, défaut)` d'un texte. */
export function cleDansTexte(texte: string, constantes: Map<string, Set<string>> = new Map()): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const ajoute = (cle: string, d?: string) => m.set(cle, [...(m.get(cle) ?? []), (d ?? "").trim()]);
  const re = /\blireParametre(?:<[^()]*?>)?\(\s*(?:"([^"]+)"|([A-Z][A-Z0-9_]*))\s*(?:,\s*([^,)\n]*(?:\([^)]*\))?))?/g;
  for (const x of texte.matchAll(re)) {
    if (x[1]) ajoute(x[1], x[3]);
    else for (const cle of constantes.get(x[2]) ?? []) ajoute(cle, x[3]);
  }
  return m;
}

/** Refuse toute clé neuve (hors table) dont un défaut littéral est `true` (clé littérale ou passée par constante). */
export function interrupteursNeufsAllumes(texte: string, connues: Set<string>, constantes?: Map<string, Set<string>>): string[] {
  const refus: string[] = [];
  const cst = constantesDansTexte(texte, new Map([...(constantes ?? new Map())].map(([k, v]) => [k, new Set(v)])));
  for (const [cle, defauts] of cleDansTexte(texte, cst)) {
    if (!connues.has(cle) && defauts.includes("true")) refus.push(`${cle} : interrupteur neuf allumé par défaut : interdit (R-9)`);
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

  it("clé existante allumée (afficherExemples) : acceptée car constatée dans la table", () => {
    expect(interrupteursNeufsAllumes(`lireParametre("afficherExemples", true)`, toutesCles())).toEqual([]);
  });

  it("les 30 clés littérales de master sont toutes dans la table", () => {
    expect(Object.keys(LITTERALES)).toHaveLength(30);
  });
});
