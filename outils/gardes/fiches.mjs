#!/usr/bin/env node
// [L0-15] Garde des fiches de pilotage + production de la copie publique expurgée. Sans IA, sans réseau.
//
//   node outils/gardes/fiches.mjs                       vérifie pilotage/ (fiches, lots, copie publique)
//   node outils/gardes/fiches.mjs --generer-lots        régénère pilotage/lots/*.json depuis les fiches publiées
//   node outils/gardes/fiches.mjs --expurger <dossier>  produit pilotage/fiches/*.md et pilotage/lots/ depuis un
//                                                       dossier de fiches sources (hors de ce dépôt)
// Options : --racine <dossier> (défaut : pilotage), --depot <dossier> (racine du dépôt public, défaut : dossier courant),
// --interdits <fichier> (sinon la variable FICHES_INTERDITS_FICHIER).
//
// Ce fichier ne contient AUCUN mot refusé, ni en clair ni en empreinte. Les motifs refusés (un par ligne, syntaxe
// « grep -E », sans casse) sont lus à l'exécution dans un fichier tenu hors du dépôt public. Sans ce fichier, le garde
// fait tous ses autres contrôles et le dit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ZONE_ZERNIO = /(^|\/)(parcours-|mots-|zernio|crochet-zernio)[^/]*|(^|\/)tests\/zernio\//i;
const ZONE_INTERFACE = /(^|\/)(src\/components\/ui\/|libelles\.ts$|globals\.css$)/;
const CODE = /\.(?:[cm]?[jt]sx?|sql|ps1|sh|py)$/i;
const VERSIONS = { V1: 1, V2: 2, V3: 3 };
const DEPOT_STUDIO = "studio-axion-ia-public";

// Règles génériques de la copie publique (aucune donnée privée ici).
const MONTANT = /\d[\d   ]*(?:[.,]\d+)?[   ]?(?:€|euros?\b|EUR\b)/giu;
const CHAMP_VALIDATION = /\bvalidation_(?!fondateur(?![\p{L}\p{N}]))[\p{L}\p{N}]+/giu;
const JETON = /\.?[\p{L}\p{N}_@*<>~/-]+(?:\.[\p{L}\p{N}_*<>-]+)*(?::\d+)?/gu;
const MAJUSCULES = /^[A-Z][A-Z0-9]+(?:[-_][A-Z0-9<>*]+)*\.(?:md|json)(?::\d+)?$/;
const AVEC_EXTENSION = /\.[A-Za-z]{1,5}(?::\d+)?$/;
const CODE_PUBLIC = /\.(?:[jt]sx?|css|ya?ml|sql|py|sh)(?::\d+)?$/i;
export const REMPLACE = {
  personne: "le fondateur",
  depot: "le dépôt privé",
  fichier: "un fichier du dépôt privé",
  adresse: "une adresse privée",
  montant: "un montant",
  champ: "validation_fondateur",
  reste: "[retiré]",
};

const oui = (v) => v === true || /^(oui|true)$/i.test(String(v ?? "").trim());
const norm = (s) => String(s).replace(/^[a-z-]+:\s+(?=\S+[/.])/i, "").replace(/\s*\((?:nouveau|nouveaux)\)\s*$/i, "").trim();
const estGitkeep = (f) => /(^|\/)\.gitkeep$/.test(f);

// ------------------------------------------------------------------------------------------ motifs refusés
/** Lit les motifs refusés (un par ligne, « grep -E », sans casse). Lignes vides et « # » ignorées. */
export function lireMotifs(texte) {
  return String(texte ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => new RegExp(l, "gi"));
}
const copie = (re) => new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
const touche = (texte, motifs) => motifs.some((m) => copie(m).test(texte));

// ---------------------------------------------------------------------------------------------- analyse d'une fiche
export function analyserFiche(texte) {
  const m = String(texte).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  /** @type {Record<string, any>} */
  const fiche = { corps: m ? m[2] : "" };
  for (const l of (m ? m[1] : "").split(/\r?\n/)) {
    const k = l.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!k) continue;
    let v = k[2].trim();
    if (/^[[{"]/.test(v)) { try { v = JSON.parse(v); } catch { /* texte brut */ } }
    else if (/^-?\d+$/.test(v)) v = Number(v);
    fiche[k[1]] = v;
  }
  return fiche;
}

// ------------------------------------------------------------------------------------------------ vérification
function globVersRegex(g) {
  let r = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") { if (g[i + 1] === "*") { r += ".*"; i++; } else r += "[^/]*"; }
    else r += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}
const estMotif = (f) => /\*/.test(f);
function seRecoupent(a, b) {
  if (a === b) return true;
  if (estMotif(a) && globVersRegex(a).test(b)) return true;
  if (estMotif(b) && globVersRegex(b).test(a)) return true;
  if (estMotif(a) && estMotif(b)) { const pa = a.split("*")[0], pb = b.split("*")[0]; return pa.startsWith(pb) || pb.startsWith(pa); }
  return false;
}
const listeFichiers = (f) => (Array.isArray(f.fichiers_autorises) ? f.fichiers_autorises : []).map(norm).filter(Boolean);

/** Retourne la liste des défauts [{regle, id, message, avec?}] ; vide = vert. */
export function verifierFiches(fiches, lots = [], opt = {}) {
  const err = [];
  const ajoute = (regle, id, message, avec) => err.push({ regle, id, message, ...(avec ? { avec } : {}) });
  const par = new Map(fiches.map((f) => [f.id, f]));
  const connus = new Set([...par.keys(), ...(opt.externes ?? [])]);
  const motifs = opt.motifs ?? [];
  const vivantes = fiches.filter((f) => f.statut !== "remplacee");

  for (const f of fiches) {
    const fichiers = listeFichiers(f);
    if (!f.depot || /^\s*$/.test(String(f.depot))) ajoute("depot", f.id, "dépôt vide");
    else if (!String(f.depot).endsWith("-public") && f.depot !== "aucun" && fichiers.some((x) => /(^|\/)\.github\/workflows\//.test(x)))
      ajoute("workflow-prive", f.id, `workflow dans un dépôt privé (${f.depot})`);
    if (/haiku/i.test(String(f.modele ?? ""))) ajoute("modele", f.id, "modèle haiku interdit");
    if (fichiers.filter((x) => !estGitkeep(x)).length > 6) ajoute("taille", f.id, "plus de 6 fichiers autorisés");
    for (const d of [].concat(f.depend_de ?? [])) {
      if (!connus.has(d)) ajoute("depend-inconnu", f.id, `depend_de inconnu : ${d}`);
      else if (par.has(d) && (VERSIONS[par.get(d).version] ?? 0) > (VERSIONS[f.version] ?? 0)) ajoute("version", f.id, `${f.version} dépend de ${par.get(d).version} (${d})`);
    }
    if (fichiers.some((x) => ZONE_ZERNIO.test(x)) && !["zernio", "partagee"].includes(f.zone)) ajoute("zone", f.id, "touche la zone zernio sans drapeau de zone");
    if (fichiers.some((x) => ZONE_INTERFACE.test(x)) && !["interface", "partagee"].includes(f.zone)) ajoute("zone", f.id, "touche la zone interface sans drapeau de zone");
    if (f.zone === "zernio" && !oui(f.zone_interdite)) ajoute("zone", f.id, "zone zernio sans zone_interdite");
    if (String(f.ci ?? "") === "aucune" && fichiers.some((x) => CODE.test(x))
      && !/script node sans ia/i.test([].concat(f.criteres ?? []).join(" ")))
      ajoute("ci-aucune", f.id, "fiche de code sans CI : critère « script node sans IA lancé par l'auteur, résultat collé dans la PR » absent");
    if (motifs.length && touche(JSON.stringify(f), motifs)) ajoute("mots-interdits", f.id, "motif de la liste privée présent");
  }

  // cycle (parcours en profondeur)
  const etat = new Map();
  const visite = (id, pile) => {
    if (etat.get(id) === 2) return;
    if (etat.get(id) === 1) { ajoute("cycle", id, `cycle : ${[...pile.slice(pile.indexOf(id)), id].join(" > ")}`); return; }
    etat.set(id, 1);
    for (const d of [].concat(par.get(id)?.depend_de ?? [])) if (par.has(d)) visite(d, [...pile, id]);
    etat.set(id, 2);
  };
  for (const f of fiches) visite(f.id, []);

  // recoupement non ordonné
  const ancetres = (id, vus = new Set()) => {
    for (const d of [].concat(par.get(id)?.depend_de ?? [])) if (par.has(d) && !vus.has(d)) { vus.add(d); ancetres(d, vus); }
    return vus;
  };
  const anc = new Map(fiches.map((f) => [f.id, ancetres(f.id)]));
  const actives = vivantes.filter((f) => f.statut !== "fait");
  for (let i = 0; i < actives.length; i++) for (let j = i + 1; j < actives.length; j++) {
    const a = actives[i], b = actives[j];
    if (anc.get(a.id).has(b.id) || anc.get(b.id).has(a.id)) continue;
    const fa = listeFichiers(a).filter((x) => !estGitkeep(x) && !/^pilotage\/journal\//.test(x));
    const fb = listeFichiers(b).filter((x) => !estGitkeep(x) && !/^pilotage\/journal\//.test(x));
    const commun = fa.find((x) => fb.some((y) => seRecoupent(x, y)));
    if (commun) ajoute("recoupement", a.id, `${a.id} et ${b.id} partagent ${commun} sans ordre de dépendance`, b.id);
  }

  // fiche a_faire dans aucun lot
  const dansLot = new Set(lots.flatMap((l) => l.fiches ?? []));
  for (const f of fiches) if (f.statut === "a_faire" && !dansLot.has(f.id)) ajoute("lot", f.id, "fiche a_faire dans aucun lot");
  return err;
}

// --------------------------------------------------------------------------------------------------------- lots
/** Lots régénérés depuis les fiches : par lot, identifiants par ordre croissant ; les remplacées n'y sont pas. */
export function genererLots(fiches) {
  const lots = new Map();
  for (const f of fiches) { if (f.statut === "remplacee") continue; if (!lots.has(f.lot)) lots.set(f.lot, []); lots.get(f.lot).push(f); }
  return [...lots].map(([lot, fs_]) => ({ lot, fiches: fs_.sort((a, b) => (Number(a.ordre) || 1e9) - (Number(b.ordre) || 1e9)).map((f) => f.id) }));
}

/**
 * Ne garde que les fiches qui passent le garde. Une fiche en défaut (taille, zone, cycle, recoupement…) est RETENUE :
 * elle n'est pas publiée tant que la source n'est pas corrigée ; son identifiant reste connu pour les dépendances.
 * Pour un recoupement, la fiche retenue est celle dont l'ordre est le plus grand.
 */
export function retenirFichesEnDefaut(fiches, opt = {}) {
  const retenues = [];
  let publiees = [...fiches];
  for (;;) {
    const externes = [...(opt.externes ?? []), ...retenues.map((r) => r.id)];
    const defauts = verifierFiches(publiees, genererLots(publiees), { ...opt, externes })
      .filter((e) => !["lot", "depend-inconnu"].includes(e.regle));
    if (!defauts.length) return { publiees, retenues };
    const e = defauts[0];
    let id = e.id;
    if (e.regle === "recoupement" && e.avec) {
      const a = publiees.find((f) => f.id === e.id), b = publiees.find((f) => f.id === e.avec);
      id = (Number(b?.ordre) || 1e9) >= (Number(a?.ordre) || 1e9) ? e.avec : e.id;
    }
    retenues.push({ id, regle: e.regle });
    publiees = publiees.filter((f) => f.id !== id);
  }
}

// -------------------------------------------------------------------------------------------- copie publique
/** Ce qui existe déjà dans le dépôt public : dossiers de tête (racine et pilotage/), dossiers à toute profondeur, fichiers. */
export function inventairePublic(depot) {
  const dossiers = new Set(), fichiers = new Set(), racine = new Set();
  const ignore = new Set(["node_modules", ".git", ".next", "coverage", "dist"]);
  for (const base of [depot, path.join(depot, "pilotage")]) if (fs.existsSync(base))
    for (const e of fs.readdirSync(base, { withFileTypes: true })) if (e.isDirectory() && !ignore.has(e.name)) racine.add(e.name);
  const marche = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (ignore.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { dossiers.add(e.name); marche(p); } else fichiers.add(e.name);
  } };
  if (fs.existsSync(depot)) marche(depot);
  return { dossiers, fichiers, racine };
}

/** Noms de fichiers cités dans les textes sous un dossier public (ex. docs/NOM.md) : ils sont publics, pas privés. */
export function nomsCitesSousDossierPublic(textes, inv) {
  const noms = new Set();
  for (const t of textes) for (const [j] of String(t).matchAll(JETON)) {
    const p = j.replace(/:\d+$/, "").split("/");
    if (p.length > 1 && inv.dossiers.has(p[0])) noms.add(p[p.length - 1]);
  }
  return noms;
}

/** Jeton qui désigne un fichier du dépôt privé, par règle générique (sans liste de noms). */
function cheminPriveGenerique(jeton, inv) {
  if (!inv) return false;
  const nu = jeton.replace(/:\d+$/, "");
  const parties = nu.split("/");
  const dernier = parties[parties.length - 1];
  // Nom en MAJUSCULES (.md, .json) absent du dépôt public et jamais cité sous un dossier public.
  if (MAJUSCULES.test(dernier) && !inv.fichiers.has(dernier) && !(inv.cites?.has(dernier))
    && (parties.length === 1 || !(inv.racine ?? inv.dossiers).has(parties[0]))) return true;
  // Chemin vers un fichier non-code dont le premier dossier n'existe nulle part dans le dépôt public.
  if (parties.length < 2 || !AVEC_EXTENSION.test(nu) || CODE_PUBLIC.test(nu)) return false;
  if (!/\p{L}/u.test(parties[0]) || /^\d/.test(parties[0])) return false;
  return !inv.dossiers.has(parties[0]);
}

/** Défauts [{fichier, message}] de la copie publique. Les mots trouvés ne sont jamais repris dans le message. */
export function verifierCopiePublique(fichiers, opt = {}) {
  const err = [];
  const motifs = opt.motifs ?? [];
  for (const [nom, texte] of Object.entries(fichiers)) {
    if (motifs.length && touche(texte, motifs)) err.push({ fichier: nom, message: "motif de la liste privée" });
    if (copie(MONTANT).test(texte)) err.push({ fichier: nom, message: "montant" });
    if (copie(CHAMP_VALIDATION).test(texte)) err.push({ fichier: nom, message: "champ de validation autre que validation_fondateur" });
    if ([...texte.matchAll(JETON)].some(([j]) => cheminPriveGenerique(j, opt.public))) err.push({ fichier: nom, message: "chemin privé" });
  }
  return err;
}

const majuscule = (s) => s === s.toUpperCase() && s !== s.toLowerCase();

/** Remplace dans un texte brut tout ce que le garde refuse. Ordre : champ, montants, jetons entiers, élisions, reste. */
export function expurger(texte, opt = {}) {
  const motifs = opt.motifs ?? [];
  let t = String(texte).replace(CHAMP_VALIDATION, REMPLACE.champ).replace(MONTANT, REMPLACE.montant);
  t = t.replace(JETON, (jeton) => {
    const trouves = motifs.flatMap((m) => [...jeton.matchAll(copie(m))].map((x) => x[0])).filter(Boolean);
    if (!trouves.length) return cheminPriveGenerique(jeton, opt.public) ? REMPLACE.fichier : jeton;
    if (jeton.includes("@")) return REMPLACE.adresse;
    if (AVEC_EXTENSION.test(jeton)) return REMPLACE.fichier;
    const nomDeDepot = trouves.some((x) => /[-_]/.test(x) && !x.includes("/") && jeton.toLowerCase().startsWith(x.toLowerCase()));
    if (nomDeDepot) return REMPLACE.depot;
    if (jeton.includes("/")) return REMPLACE.fichier;
    if (trouves.some((x) => /[-_]/.test(x))) return REMPLACE.depot;
    const seul = trouves.some((x) => x.toLowerCase() === jeton.toLowerCase());
    if (seul) return majuscule(jeton) ? REMPLACE.personne.toUpperCase() : REMPLACE.personne;
    let r = jeton;
    for (const m of motifs) r = r.replace(copie(m), (x) => (majuscule(x) ? "FONDATEUR" : "fondateur"));
    return r;
  });
  // Élisions françaises.
  t = t.replace(/\b([Dd])e le fondateur/g, "$1u fondateur").replace(/\bDE LE FONDATEUR/g, "DU FONDATEUR")
    .replace(/(^|[^\p{L}])([Àà]) le fondateur/gu, (_, a, b) => `${a}${b === "À" ? "Au" : "au"} fondateur`)
    .replace(/(^|[^\p{L}])À LE FONDATEUR/gu, "$1AU FONDATEUR")
    .replace(/\b([Dd])e un montant/g, "$1'un montant")
    .replace(/\b([Dd])e le dépôt privé/g, "$1u dépôt privé").replace(/(^|[^\p{L}])([Àà]) le dépôt privé/gu, (_, a, b) => `${a}${b === "À" ? "Au" : "au"} dépôt privé`);
  // Filet : tout motif restant (à cheval sur deux jetons) est retiré.
  for (const m of motifs) t = t.replace(copie(m), REMPLACE.reste);
  return t;
}

// ----------------------------------------------------------------------------------------------------- CLI
function lireDossier(dossier, ext) {
  const sortie = {};
  const marche = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) marche(p, r); else if (ext.some((x) => e.name.endsWith(x))) sortie[r] = fs.readFileSync(p, "utf8");
  } };
  if (fs.existsSync(dossier)) marche(dossier, "");
  return sortie;
}
const ecrireJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1) + "\n");
const ecrireLots = (racine, lots, externes, retenues) => {
  const d = path.join(racine, "lots");
  fs.mkdirSync(d, { recursive: true });
  const noms = new Set();
  for (const l of lots) { const n = `${l.lot}.json`; noms.add(n); ecrireJson(path.join(d, n), { lot: l.lot, genere_depuis: "fiches/*.md", fiches: l.fiches }); }
  if (externes) { noms.add("externes.json"); ecrireJson(path.join(d, "externes.json"), { commentaire: "Identifiants connus pour les dépendances mais non publiés ici (autres dépôts, ou fiches retenues).", externes }); }
  if (retenues) { noms.add("retenues.json"); ecrireJson(path.join(d, "retenues.json"), { commentaire: "Fiches non publiées tant que leur source n'est pas corrigée (règle du garde en défaut). Jamais lancées.", retenues }); }
  for (const f of fs.readdirSync(d)) if (f.endsWith(".json") && !noms.has(f)) fs.unlinkSync(path.join(d, f));
};
const lireJson = (p, defaut) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : defaut);

/**
 * @param {string[]} argv
 * @param {{log:(...a:any[])=>unknown,error:(...a:any[])=>unknown}} [sortie]
 */
export function principal(argv, sortie = console) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const racine = arg("--racine") ?? "pilotage";
  const depot = arg("--depot") ?? process.cwd();
  const fichierMotifs = arg("--interdits") ?? process.env.FICHES_INTERDITS_FICHIER;
  const motifs = fichierMotifs && fs.existsSync(fichierMotifs) ? lireMotifs(fs.readFileSync(fichierMotifs, "utf8")) : [];
  const inv = inventairePublic(depot);

  const src = arg("--expurger");
  if (src) {
    if (!motifs.length) { sortie.error("refus : --expurger exige la liste des motifs refusés (--interdits ou FICHES_INTERDITS_FICHIER)."); return 2; }
    const dossierFiches = fs.existsSync(path.join(src, "fiches")) ? path.join(src, "fiches") : src;
    const brutes = Object.entries(lireDossier(dossierFiches, [".md"])).filter(([n]) => !n.includes("/")).map(([, t]) => t);
    const choisies = brutes.filter((t) => { const f = analyserFiche(t); return f.depot === DEPOT_STUDIO && f.statut !== "remplacee"; });
    inv.cites = nomsCitesSousDossierPublic(choisies, inv);
    const opt = { motifs, public: inv };
    const nettes = choisies.map((t) => expurger(t, opt));
    const parId = new Map(nettes.map((t) => [analyserFiche(t).id, t]));
    const toutes = [...parId.values()].map(analyserFiche);
    const ids = new Set(toutes.map((f) => f.id));
    const externesAutres = [...new Set(toutes.flatMap((f) => [].concat(f.depend_de ?? [])).filter((d) => !ids.has(d)))];
    const { publiees, retenues } = retenirFichesEnDefaut(toutes, { motifs, externes: externesAutres });
    const dest = path.join(racine, "fiches");
    fs.mkdirSync(dest, { recursive: true });
    const ecrites = new Set();
    for (const f of publiees) { fs.writeFileSync(path.join(dest, `${f.id}.md`), parId.get(f.id)); ecrites.add(`${f.id}.md`); }
    for (const f of fs.readdirSync(dest)) if (f.endsWith(".md") && !ecrites.has(f)) fs.unlinkSync(path.join(dest, f));
    const externes = [...new Set([...externesAutres, ...retenues.map((r) => r.id)])].sort();
    ecrireLots(racine, genererLots(publiees), externes, retenues.sort((a, b) => a.id.localeCompare(b.id)));
    sortie.log(`copie publique : ${publiees.length} fiches publiées, ${retenues.length} retenues, ${externes.length} identifiants externes`);
    return 0;
  }

  const fiches = Object.entries(lireDossier(path.join(racine, "fiches"), [".md"])).map(([, t]) => analyserFiche(t));
  if (argv.includes("--generer-lots")) {
    ecrireLots(racine, genererLots(fiches), lireJson(path.join(racine, "lots/externes.json"), {}).externes, lireJson(path.join(racine, "lots/retenues.json"), {}).retenues);
    sortie.log("lots régénérés"); return 0;
  }

  const lotsBruts = Object.entries(lireDossier(path.join(racine, "lots"), [".json"])).map(([, t]) => JSON.parse(t));
  const lots = lotsBruts.filter((l) => Array.isArray(l.fiches));
  const externes = lotsBruts.flatMap((l) => l.externes ?? []);
  const defauts = verifierFiches(fiches, lots, { motifs, externes });
  const textes = lireDossier(racine, [".md", ".json", ".mjs"]);
  inv.cites = nomsCitesSousDossierPublic(Object.values(textes), inv);
  const copiePub = verifierCopiePublique(textes, { motifs, public: inv });
  for (const e of defauts) sortie.error(`[${e.regle}] ${e.id} : ${e.message}`);
  for (const e of copiePub) sortie.error(`[copie-publique] ${e.fichier} : ${e.message}`);
  if (!motifs.length) sortie.error("avertissement : liste des motifs refusés absente (--interdits ou FICHES_INTERDITS_FICHIER) : contrôle des mots privés NON fait ; les autres contrôles (règles des fiches, montants, champ de validation, chemins privés génériques) sont faits.");
  sortie.log(`${fiches.length} fiches contrôlées, ${defauts.length + copiePub.length} défaut(s)`);
  return defauts.length + copiePub.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(principal(process.argv.slice(2)));
