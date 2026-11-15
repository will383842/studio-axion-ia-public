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

/** Clés passées par constante : lues dans le TEXTE du fichier (jamais importé). `motif` doit y figurer. */
const PAR_CONSTANTE: { cle: string; etat: Etat; fichier: string; motif: RegExp }[] = [
  { cle: "aPublier.page", etat: "allume", fichier: "src/services/a-publier.ts", motif: /lireParametre<unknown>\(PARAM_PAGE_A_PUBLIER, true\)\) !== false/ },
  { cle: "zernio.envoi_autorise", etat: "allume", fichier: "src/services/zernio.ts", motif: /PARAM_ARRET_ZERNIO, true\)\) !== false/ },
  { cle: "publication.editoriale_active", etat: "eteint", fichier: "src/services/zernio.ts", motif: /PARAM_EDITORIALE_ACTIVE, false\)\) === true/ },
  { cle: "idees.comite", etat: "eteint", fichier: "src/services/comite-editorial.ts", motif: /PARAM_COMITE, false\)\) === true/ },
  { cle: "gardien.chiffres.actif", etat: "eteint", fichier: "src/services/gardien-chiffres.ts", motif: /REGLAGE_GARDIEN_CHIFFRES, false\)\) === true/ },
  { cle: "comite.source_usine.actif", etat: "eteint", fichier: "src/services/branchement-idees-usine.ts", motif: /comite\.source_usine\.actif/ },
  { cle: "facecamAnimee.calageAuMot", etat: "eteint", fichier: "src/services/facecam-animee.ts", motif: /PARAM_CALAGE_AU_MOT_FA, false\)\) === true/ },
  { cle: "facecamAnimee.finDouce", etat: "eteint", fichier: "src/services/facecam-animee.ts", motif: /PARAM_FIN_DOUCE_FA, false\)\) === true/ },
  { cle: "facecamAnimee.accordEssaiReel", etat: "eteint", fichier: "src/services/facecam-animee.ts", motif: /PARAM_ACCORD_ESSAI_FA = "facecamAnimee\.accordEssaiReel"/ },
  { cle: "facecamAnimee.plafondClaudeUsd", etat: "valeur", fichier: "src/services/facecam-animee.ts", motif: /PARAM_PLAFOND_CLAUDE_FA = "facecamAnimee\.plafondClaudeUsd"/ },
  { cle: "facecamAnimee.plafondVideosUsd", etat: "valeur", fichier: "src/services/depense-claude-video.ts", motif: /PARAM_PLAFOND_VIDEOS_FA = "facecamAnimee\.plafondVideosUsd"/ },
  { cle: "imageVideo.accordEssaiReel", etat: "eteint", fichier: "src/services/image-video-ecran.ts", motif: /PARAM_ACCORD_ESSAI_IV, false\)/ },
  { cle: "imageVideo.relireScript", etat: "eteint", fichier: "src/services/image-video-ecran.ts", motif: /PARAM_RELIRE_SCRIPT_IV = "imageVideo\.relireScript"/ },
  { cle: "usine.autonomie", etat: "eteint", fichier: "src/services/autonomie-usine.ts", motif: /CLE_REGLAGE = "usine\.autonomie"/ },
  { cle: "usine.autonomie.porte", etat: "eteint", fichier: "src/services/autonomie-usine.ts", motif: /CLE_PORTE = "usine\.autonomie\.porte"/ },
  { cle: "carrousels.actif", etat: "eteint", fichier: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
  { cle: "infographies.actif", etat: "eteint", fichier: "src/visuels/interrupteur.ts", motif: /"infographies\.actif"/ },
  { cle: "avocat.multicamera", etat: "eteint", fichier: "src/briques/multicamera/reglage.ts", motif: /PARAM_MULTICAMERA_AVOCAT = "avocat\.multicamera"/ },
  { cle: "facecam.multicamera", etat: "eteint", fichier: "src/briques/multicamera/reglage.ts", motif: /PARAM_MULTICAMERA_FACECAM = "facecam\.multicamera"/ },
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

/** Extrait { clé → défauts littéraux } des appels `lireParametre("clé", défaut)` d'un texte. */
export function cleDansTexte(texte: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const re = /\blireParametre(?:<[^()]*?>)?\(\s*"([^"]+)"\s*(?:,\s*([^,)\n]*(?:\([^)]*\))?))?/g;
  for (const x of texte.matchAll(re)) m.set(x[1], [...(m.get(x[1]) ?? []), (x[2] ?? "").trim()]);
  return m;
}

/** Refuse toute clé neuve (hors table) dont un défaut littéral est `true`. */
export function interrupteursNeufsAllumes(texte: string, connues: Set<string>): string[] {
  const refus: string[] = [];
  for (const [cle, defauts] of cleDansTexte(texte)) {
    if (!connues.has(cle) && defauts.includes("true")) refus.push(`${cle} : interrupteur neuf allumé par défaut : interdit (R-9)`);
  }
  return refus;
}

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
    const fichiers = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
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
    const fichiers = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
    const connues = toutesCles();
    const refus = fichiers.flatMap((f) => interrupteursNeufsAllumes(lire(f), connues).map((r) => `${f} : ${r}`));
    expect(refus).toEqual([]);
  });

  it("clés par constante : texte lu (sans import) et défaut constaté", () => {
    for (const c of PAR_CONSTANTE) {
      const t = lire(c.fichier);
      expect(t, `${c.cle} : motif introuvable dans ${c.fichier}`).toMatch(c.motif);
      expect(t, `${c.cle} : clé disparue de ${c.fichier}`).toContain(`"${c.cle}"`);
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

  it("clé existante allumée (afficherExemples) : acceptée car constatée dans la table", () => {
    expect(interrupteursNeufsAllumes(`lireParametre("afficherExemples", true)`, toutesCles())).toEqual([]);
  });

  it("les 30 clés littérales de master sont toutes dans la table", () => {
    expect(Object.keys(LITTERALES)).toHaveLength(30);
  });
});
