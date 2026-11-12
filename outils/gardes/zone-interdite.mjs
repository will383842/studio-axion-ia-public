#!/usr/bin/env node
// [L0-17] Garde de zone et de fichiers autorisés d'une PR. Sans IA, sans réseau, sans secret.
//
//   node outils/gardes/zone-interdite.mjs --base <ref> [--branche usine/<ID>] [--autorises <fichier.json|.md>]
//        [--annonces <dossier>] [--accords RC-40,...] [--fichiers <liste.txt>]
//        [--listes <dossier>] [--corps <fichier>] [--fiches A,B]
//
// Sources publiques (à lire sur la BASE de la PR, jamais sur la tête : une PR ne s'autorise pas elle-même) :
//  - <listes>/<ID>.json : soit un tableau de fichiers autorisés, soit { "fichiers": [...], "accords": ["RC-40"] } ;
//    l'accord est donc rattaché à l'identifiant de la fiche ;
//  - <annonces>/ANNONCE-<ID>-*.md ;
//  - les fiches d'une PR : la branche usine/<ID>, les lignes « Fiche: <ID> » du corps (--corps, PR « lot »), --fiches.
//
// Trois contrôles, rouge (sortie 1) au moindre défaut :
//  1. liste INTERDITE (sans aucune exception, sauf l'accord écrit RC-40 pour zernio-client.ts et zernio.ts, et seulement
//     si la fiche autorise ce fichier) ;
//  2. liste PARTAGÉE : verte seulement si un fichier ANNONCE-<fiche>-*.md (dossier --annonces) contient le mot « libre » ;
//  3. fichiers autorisés de la fiche (branche usine/<ID>) : tout fichier hors liste est rouge.
// Une PR sans fiche identifiée est rouge (« sans-fiche »), sauf si elle ne touche que pilotage/autorises/** et
// pilotage/annonces/** (voie pour publier les listes et les annonces). La liste d'une fiche absente de --listes est
// rouge (« liste-introuvable ») : aucun repli sur la tête de la PR. Un joker « * » dans une liste est refusé.
//
// Second mode : --differentiel (comparaison eslint et tsc contre la base), voir plus bas.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const INTERDITS = [
  "src/fournisseurs/**/zernio*",
  "src/services/parcours-*",
  "src/services/mots-*",
  "src/domaine/guide-reseau/**",
  "src/components/mots/**",
  "src/app/(studio)/mots/**",
  "tests/zernio/**",
  "docs/zernio/**",
  "**/parcours-conversation.ts",
];
export const PARTAGES = ["src/components/ui/**", "**/libelles.ts", "**/globals.css"];

// Fichiers que l'accord écrit RC-40 peut ouvrir (jamais zernio-inbox ni le reste de la zone).
const ACCORD = "RC-40";
const COUVERTS_PAR_ACCORD = [/^src\/fournisseurs\/(?:[^/]+\/)*zernio-client\.ts$/, /^src\/fournisseurs\/(?:[^/]+\/)*zernio\.ts$/];

export function motifVersRegex(motif) {
  let r = "";
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === "*" && motif[i + 1] === "*") {
      if (motif[i + 2] === "/") { r += "(?:.*/)?"; i += 2; } else { r += ".*"; i += 1; }
    } else if (c === "*") r += "[^/]*";
    else r += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}
// Un motif interdit couvre aussi ce qui se trouve SOUS un dossier qu'il nomme (src/fournisseurs/zernio/a.ts).
const REGEX_INTERDITS = INTERDITS.map((m) => new RegExp(`${motifVersRegex(m).source.slice(0, -1)}(?:/.*)?$`));
const REGEX_PARTAGES = PARTAGES.map(motifVersRegex);
// Seuls fichiers qu'une PR sans fiche peut toucher : publier les listes et les annonces.
const PUBLICATION_LISTES = ["pilotage/autorises/**", "pilotage/annonces/**"].map(motifVersRegex);

const normaliser = (f) => String(f).trim().replaceAll("\\", "/").replace(/^(?:\.\/)+/, "").replace(/^\/+/, "");

export function classer(fichier) {
  const f = normaliser(fichier);
  if (REGEX_INTERDITS.some((r) => r.test(f))) return "interdit";
  if (REGEX_PARTAGES.some((r) => r.test(f))) return "partage";
  return null;
}

export function extraireAutorises(markdown) {
  const m = /^fichiers_autorises:\s*(\[.*\])\s*$/m.exec(String(markdown));
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]);
    return Array.isArray(v) ? v.map(String) : null;
  } catch { return null; }
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// « libre » dit sans négation (« pas libre », « non libre », « jamais libre »).
export function annonceLibre(annonces, fiche) {
  if (!fiche) return false;
  const nom = new RegExp(`^ANNONCE-${echapper(fiche)}-.+\\.md$`);
  return (annonces ?? []).some((a) => nom.test(a.nom) && /(?<!\b(?:pas|non|jamais|plus)\s)\blibre\b/i.test(a.contenu));
}

const sansMention = (e) => normaliser(String(e).replace(/\s*\((?:nouveau|modifié|modifie|nouvelle)[^)]*\)\s*$/i, ""));
const correspond = (autorise, fichier) => !autorise.includes("*") && autorise === fichier;

const ID_FICHE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const clean = (liste) => (Array.isArray(liste) ? liste.map(sansMention).filter(Boolean) : null);

/**
 * `fiches` : [{ id, autorises, accords }] (une PR « lot » peut en porter plusieurs). Ancienne forme : `fiche` + `autorises`
 * (+ `accords` global). Un fichier autorisé par UNE des fiches suffit ; l'accord ne vaut que pour la fiche qui le porte.
 * Une fiche sans liste donne un avertissement (pas un rouge) : le relecteur contrôle alors ses fichiers.
 * `branche` : zernio/* est dispensée de la liste interdite ; usine/LOT-* sans fiche est rouge ; toute autre branche sans
 * fiche n'a que les contrôles de zone.
 * @param {object} [entree]
 * @param {string[]} [entree.fichiers]
 * @param {string[]|null} [entree.autorises]
 * @param {string|null} [entree.fiche]
 * @param {{id:string,autorises:string[]|null,accords?:string[]}[]|null} [entree.fiches]
 * @param {{nom:string,contenu:string}[]} [entree.annonces]
 * @param {string[]} [entree.accords]
 * @param {string} [entree.branche]
 */
export function controler({ fichiers = [], autorises = null, fiche = null, fiches = null, annonces = [], accords = [], branche = "" } = {}) {
  const defauts = [];
  const avertissements = [];
  const deZernio = /^zernio\//.test(String(branche ?? ""));
  const lot = /^usine\/LOT-/.test(String(branche ?? ""));
  const globaux = (accords ?? []).map((a) => String(a).trim().toUpperCase());
  const entrees = (fiches ?? (fiche ? [{ id: fiche, autorises }] : [])).map((e) => ({
    id: e.id,
    liste: clean(e.autorises),
    accords: [...globaux, ...(e.accords ?? []).map((a) => String(a).trim().toUpperCase())],
  }));
  for (const e of entrees) if (!ID_FICHE.test(String(e.id))) defauts.push({ regle: "identifiant-fiche", fichier: String(e.id), detail: "identifiant de fiche invalide" });
  const sains = entrees.filter((e) => ID_FICHE.test(String(e.id)));
  for (const e of sains) for (const a of e.liste ?? []) if (a.includes("*")) defauts.push({ regle: "joker-refuse", fichier: a, detail: `joker interdit dans les fichiers autorisés de ${e.id}` });
  const dans = (e, f) => !!e.liste && e.liste.some((a) => correspond(a, f));

  for (const brut of fichiers) {
    const f = normaliser(brut);
    if (!f) continue;
    const zone = classer(f);
    if (zone === "interdit" && deZernio) {
      // branche zernio/* : c'est leur zone, la liste interdite ne s'applique pas
    } else if (zone === "interdit") {
      const exception = COUVERTS_PAR_ACCORD.some((r) => r.test(f)) && sains.some((e) => e.accords.includes(ACCORD) && dans(e, f));
      if (!exception) defauts.push({ regle: "zone-interdite", fichier: f, detail: "zone de l'autre poste : interdite sans exception" });
    } else if (zone === "partage" && !sains.some((e) => annonceLibre(annonces, e.id))) {
      defauts.push({ regle: "zone-partagee", fichier: f, detail: `zone partagée : il faut ANNONCE-${sains[0]?.id ?? "<fiche>"}-*.md avec le mot « libre »` });
    }
    if (!sains.length) {
      if (!lot) continue;
      if (f.split("/").includes("..") || !PUBLICATION_LISTES.some((r) => r.test(f))) defauts.push({ regle: "sans-fiche", fichier: f, detail: "aucune fiche identifiée (branche usine/<ID> ou ligne « Fiche: <ID> »)" });
    } else {
      const sansListe = sains.filter((e) => !e.liste);
      if (sansListe.length) {
        for (const e of sansListe) if (!avertissements.some((d) => d.detail.includes(e.id))) avertissements.push({ regle: "avertissement-liste", fichier: f, detail: `fichiers autorisés de ${e.id} introuvables (pilotage/autorises/${e.id}.json sur la base) : le relecteur contrôle ces fichiers` });
      } else if (!sains.some((e) => f === `pilotage/journal/${e.id}.md` || dans(e, f))) {
        defauts.push({ regle: "hors-fiche", fichier: f, detail: `hors des fichiers autorisés de ${sains.map((e) => e.id).join(", ")}` });
      }
    }
  }
  return { ok: defauts.length === 0, defauts, avertissements };
}

// --- ligne de commande -----------------------------------------------------------------------------------------
function option(argv, nom) {
  const i = argv.indexOf(nom);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

/** Lit la liste d'une fiche : `--autorises` (ancienne forme), puis `<listes>/<ID>.json`. Avec `--listes`, jamais de repli
 *  sur la tête de la PR (une PR ne s'autorise pas elle-même) ; sans `--listes`, repli local sur `pilotage/fiches/<ID>.md`. */
function lireFiche(argv, id, unique) {
  const chemin = unique ? option(argv, "--autorises") : null;
  const dossier = option(argv, "--listes");
  const candidats = [chemin, dossier ? path.join(dossier, `${id}.json`) : null, dossier ? null : `pilotage/fiches/${id}.md`].filter(Boolean);
  for (const c of candidats) {
    if (!fs.existsSync(c)) continue;
    const texte = fs.readFileSync(c, "utf8");
    if (c.endsWith(".json")) {
      try {
        const v = JSON.parse(texte);
        if (Array.isArray(v)) return { id, autorises: v.map(String), accords: [] };
        if (v && Array.isArray(v.fichiers)) return { id, autorises: v.fichiers.map(String), accords: Array.isArray(v.accords) ? v.accords.map(String) : [] };
      } catch { /* illisible : liste introuvable */ }
      return { id, autorises: null, accords: [] };
    }
    return { id, autorises: extraireAutorises(texte), accords: [] };
  }
  return { id, autorises: null, accords: [] };
}

/** Identifiants des lignes « Fiche: <ID> » d'un corps de PR. */
export function fichesDuCorps(texte) {
  return [...String(texte ?? "").matchAll(/^\s*Fiche\s*:\s*(\S+)\s*$/gim)].map((m) => m[1]);
}

/**
 * Fiches d'une PR : la branche usine/<ID> (suffixe -propre retiré ; usine/LOT-* n'est pas une fiche) plus les lignes
 * « Fiche: <ID> » du corps.
 * @param {string} branche
 * @param {string} corps
 * @returns {string[]}
 */
export function fichesDeLaPR(branche, corps) {
  const ids = new Set();
  const deBranche = /^usine\/(?!LOT-)(.+?)(?:-propre)?$/.exec(String(branche ?? ""))?.[1];
  if (deBranche) ids.add(deBranche);
  for (const i of fichesDuCorps(corps)) ids.add(i);
  return [...ids];
}

function lireAnnonces(dossier) {
  if (!dossier || !fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter((n) => /^ANNONCE-.+\.md$/.test(n))
    .map((nom) => ({ nom, contenu: fs.readFileSync(path.join(dossier, nom), "utf8") }));
}

export function main(argv = process.argv.slice(2)) {
  const branche = option(argv, "--branche") ?? process.env.GITHUB_HEAD_REF ?? "";
  const corps = option(argv, "--corps");
  const ids = new Set(fichesDeLaPR(branche, corps && fs.existsSync(corps) ? fs.readFileSync(corps, "utf8") : ""));
  for (const i of (option(argv, "--fiches") ?? "").split(",").filter(Boolean)) ids.add(i);
  const fiches = [...ids].map((id) => (ID_FICHE.test(id) ? lireFiche(argv, id, ids.size === 1) : { id, autorises: null, accords: [] }));
  let fichiers;
  const liste = option(argv, "--fichiers");
  if (liste) fichiers = fs.readFileSync(liste, "utf8").split(/\r?\n/).filter(Boolean);
  else {
    const base = option(argv, "--base");
    if (!base) { console.error("zone-interdite : --base <ref> ou --fichiers <liste> requis"); return 2; }
    fichiers = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...HEAD`], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  }
  const accords = (option(argv, "--accords") ?? process.env.ZONE_ACCORDS ?? "").split(",").filter(Boolean);
  const res = controler({ fichiers, fiches, annonces: lireAnnonces(option(argv, "--annonces")), accords, branche });
  console.log(`${fichiers.length} fichier(s) contrôlé(s)${fiches.length ? ` pour ${fiches.length > 1 ? "les fiches" : "la fiche"} ${fiches.map((e) => e.id).join(", ")}` : ""}`);
  for (const d of res.avertissements) console.log(`AVERTISSEMENT [${d.regle}] ${d.fichier} : ${d.detail}`);
  for (const d of res.defauts) console.log(`ROUGE [${d.regle}] ${d.fichier} : ${d.detail}`);
  if (res.ok) console.log("vert : zone et fichiers autorisés respectés");
  return res.ok ? 0 : 1;
}

// --- comparaison différentielle eslint et tsc (mode --differentiel) ------------------------------------------------
// Seules les erreurs absentes de la base (et de la liste facultative des erreurs connues, clés « tsc » et « eslint » de
// scripts/echecs-connus.json) sont rouges.
//   node outils/gardes/zone-interdite.mjs --differentiel --dossier <dir> --racine-tete <dir> [--racine-base <dir>] [--connus <json>]
// Le dossier contient tsc-tete.txt, eslint-tete.json et, si une base existe, tsc-base.txt et eslint-base.json.
const LIGNE_TSC = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/;

export function clesTsc(texte) {
  return new Set(
    String(texte ?? "").split(/\r?\n/).map((l) => LIGNE_TSC.exec(l)).filter(Boolean)
      .map((m) => `${m[1].replaceAll("\\", "/")} ${m[2]} ${m[3].slice(0, 80)}`),
  );
}

export function clesEslint(json, racine) {
  if (!json) return new Set();
  const base = path.resolve(racine).replaceAll("\\", "/").replace(/\/+$/, "");
  const relatif = (p) => {
    const f = String(p).replaceAll("\\", "/");
    return (f.startsWith(`${base}/`) ? f.slice(base.length + 1) : f).replace(/^\/+/, "");
  };
  return new Set(
    JSON.parse(json).flatMap((f) => f.messages.filter((m) => m.severity === 2)
      .map((m) => `${relatif(f.filePath)} ${m.ruleId ?? "parse"} ${String(m.message).slice(0, 80)}`)),
  );
}

/** `base` nul : pas de base, seules les erreurs connues sont tolérées. */
export function comparer({ tete, base, connus = {} }) {
  const nouveaux = {};
  for (const outil of ["tsc", "eslint"]) {
    const tolere = new Set([...(connus[outil] ?? []), ...(base?.[outil] ?? [])]);
    nouveaux[outil] = [...(tete[outil] ?? [])].filter((c) => !tolere.has(c));
  }
  return { nouveaux };
}

const lire = (d, n) => (fs.existsSync(path.join(d, n)) ? fs.readFileSync(path.join(d, n), "utf8") : null);

export function mainDifferentiel(argv = process.argv.slice(2)) {
  const dossier = option(argv, "--dossier");
  const racineTete = option(argv, "--racine-tete");
  if (!dossier || !racineTete) { console.error("zone-interdite --differentiel : --dossier et --racine-tete requis"); return 2; }
  const racineBase = option(argv, "--racine-base");
  const cheminConnus = option(argv, "--connus");
  const connus = cheminConnus && fs.existsSync(cheminConnus) ? JSON.parse(fs.readFileSync(cheminConnus, "utf8")) : {};
  const tete = { tsc: clesTsc(lire(dossier, "tsc-tete.txt")), eslint: clesEslint(lire(dossier, "eslint-tete.json"), racineTete) };
  const aBase = lire(dossier, "tsc-base.txt") !== null && lire(dossier, "eslint-base.json") !== null && !!racineBase;
  const base = aBase ? { tsc: clesTsc(lire(dossier, "tsc-base.txt")), eslint: clesEslint(lire(dossier, "eslint-base.json"), racineBase) } : null;
  const { nouveaux } = comparer({ tete, base, connus });
  let rouge = false;
  for (const outil of ["tsc", "eslint"]) {
    console.log(`${outil} : ${tete[outil].size} erreur(s) au total, ${nouveaux[outil].length} nouvelle(s)${base ? "" : " (sans base)"}`);
    for (const c of nouveaux[outil]) { console.log(`ROUGE ${outil} : ${c}`); rouge = true; }
  }
  return rouge ? 1 : 0;
}


// --- tsconfig du job « next build » ----------------------------------------------------------------------------------
// Le contrôle de types complet (docs/, studio-rendu/, tests/) est déjà couvert par le différentiel tsc : le build ne
// type-vérifie que l'application (src/), sinon des erreurs héritées (module absent, tests) le rendent rouge sur master.
export function tsconfigDeBuild(t) {
  return {
    ...t,
    include: ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
}

export function mainTsconfigBuild(argv = process.argv.slice(2)) {
  const f = option(argv, "--tsconfig-build");
  if (!f || !fs.existsSync(f)) { console.error("zone-interdite --tsconfig-build : fichier tsconfig absent"); return 2; }
  fs.writeFileSync(f, JSON.stringify(tsconfigDeBuild(JSON.parse(fs.readFileSync(f, "utf8"))), null, 2) + "\n");
  console.log(`${f} : contrôle de types du build limité à src/`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = process.argv.includes("--differentiel") ? mainDifferentiel()
    : process.argv.includes("--tsconfig-build") ? mainTsconfigBuild() : main();
}
