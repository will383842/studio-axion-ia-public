#!/usr/bin/env node
// [NEW-ARG-02] Garde « règles de fer » du Studio public. Sans IA, sans secret, sans réseau (seulement `git ls-files`).
//
//   node outils/gardes/regles-de-fer.mjs [--json] [--strict]
//
// Sept règles, rouge (sortie 1) au moindre défaut hors exception :
//  montant · workflow-externe · haiku · purge · date-buffer · push · nom-fondateur.
// Les mots de la règle « nom-fondateur » ne sont JAMAIS écrits ici : ils se lisent à l'exécution dans la variable
// d'environnement MOTS_FONDATEUR (liste séparée par des virgules) ou dans le fichier désigné par MOTS_FONDATEUR_FICHIER
// (hors dépôt). Sans liste, cette règle est dite « non vérifiée » (rouge avec --strict).
// « push » : choix de départ, à confirmer par le fondateur (la fiche ne dit pas lequel) : `git push` dans un workflow
// ET bibliothèque/appel de notification push dans le code.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REGLES = ["montant", "workflow-externe", "haiku", "purge", "date-buffer", "push", "nom-fondateur"];

// Exceptions de départ : fichiers existants qui contiennent déjà le motif, avec le NOMBRE d'occurrences (lignes)
// tolérées ; ce nombre ne peut que baisser (un dépassement est rouge), la liste ne doit que se vider.
// Celle du nom du fondateur doit être VIDE (aucune exception admise).
export const EXCEPTIONS = {
  "nom-fondateur": {},
  "montant": {
    "src/app/(studio)/ecrire/sujets/[id]/page.tsx": 1,
    "src/app/(studio)/ecrire/sujets/actions.ts": 3,
    "src/app/(studio)/reglages/actions-credit-claude.ts": 1,
    "src/app/(studio)/reglages/actions.ts": 1,
    "src/app/(studio)/reglages/page.tsx": 1,
    "src/app/(studio)/styleguide/Vitrine.tsx": 2,
    "src/components/fabrication/EncartCout.tsx": 1,
    "src/components/formats/cas-concret/document/texte.ts": 1,
    "src/components/formats/image-video/vue.ts": 1,
    "src/components/generateur/FicheSujet.tsx": 1,
    "src/components/personnages/OngletVoix.tsx": 1,
    "src/components/prononciations/useEcoute.ts": 1,
    "src/components/reglages/montants-euros.ts": 3,
    "src/components/ui/JaugeBudget.tsx": 1,
    "src/components/ui/index.ts": 1
  },
  "workflow-externe": {},
  "haiku": {
    "outils/gardes/fiches.mjs": 1,
    "src/fournisseurs/claude/tarifs.ts": 1,
    "src/moteurs/montage-tableau/decoupage.ts": 1,
    "src/services/tableau-creation.ts": 1,
    "src/services/tableau-scripts/consignes.ts": 3,
    "src/services/tableau-scripts/index.ts": 1
  },
  "purge": {
    "outils/maquettes-variete/rendre.mjs": 1,
    "outils/maquettes-variete/serveur.sh": 3,
    "src/app/(studio)/bibliotheque/actions.ts": 1,
    "src/app/(studio)/calendrier/historique/page.tsx": 1,
    "src/app/(studio)/carrousels/page.tsx": 3,
    "src/components/bibliotheque/ElementsRanges.tsx": 1,
    "src/domaine/depots.ts": 1,
    "src/domaine/image-video/reserve.ts": 1,
    "src/domaine/libelles.ts": 1,
    "src/domaine/scripts-tableau.ts": 1,
    "src/domaine/site-videos/contrat.ts": 1,
    "src/domaine/types.ts": 4,
    "src/donnees/postgres/index.ts": 1,
    "src/formats/cas-concret/catalogue/compte-rendu-visio.ts": 2,
    "src/fournisseurs/publication/zernio-client.ts": 1,
    "src/fournisseurs/site/types.ts": 1,
    "src/services/annulation-video.ts": 1,
    "src/services/bibliotheque.ts": 1,
    "src/services/boucle.ts": 1,
    "src/services/cas-concret-traites.ts": 1,
    "src/services/corbeille.ts": 7,
    "src/services/journal-envoi-base.ts": 1,
    "src/services/journal-sensible.ts": 1,
    "src/services/migrations.ts": 1,
    "src/services/modeles.ts": 1,
    "src/services/parcours-mot.ts": 1,
    "src/services/site-videos.ts": 1,
    "src/services/suppression-video.ts": 2,
    "src/services/tableau-scripts/index.ts": 1,
    "src/services/videos.ts": 2,
    "src/services/zernio.ts": 1,
    "src/visuels/services/corbeille.ts": 5
  },
  "date-buffer": {
    "src/app/(studio)/reglages/actions-zernio.ts": 1,
    "src/components/migration/EcranMigration.tsx": 1,
    "src/components/migration/Frise.tsx": 1
  },
  "push": {
    "src/components/coquille/EnregistrementPwa.tsx": 3,
    "src/fournisseurs/catalogue.ts": 1,
    "src/fournisseurs/notification/inscription.ts": 3,
    "src/fournisseurs/notification/push.ts": 5
  }
};

const sous = (...d) => (c) => d.some((x) => c.startsWith(x));
const code = /\.(?:tsx?|mjs|cjs|js|jsx|sh|ya?ml|json)$/;
const estTest = (c) => /(^|\/)tests?\//.test(c) || /\.test\.[a-z]+$/.test(c) || c.startsWith("outils/gardes/regles-de-fer");
const COMMENTAIRE = /^\s*(?:\/\/|\/?\*|#)/;

const SYMBOLE = "(?:€|&euro;)";
const MONTANT = /\d[\d  .,]*\s?(?:€|\$|EUR\b|USD\b|euros?\b|dollars?\b)|(?:€|\$)\s?\d/i;
// Symbole « euro » n'importe où dans le code (avant ou après une expression, entité HTML, concaténation, propriété) ;
// mot « euros » ou symbole « dollar » collé après une expression ; « dollar » avant une interpolation ; ligne qui ne
// porte que le symbole (symbole sur la ligne suivante) ; formateurs de montant du Studio (src/lib/montants.ts) et
// composants de coût ou de budget ; devise désignée dans un format monétaire.
const SYMBOLE_EURO = new RegExp(SYMBOLE);
const SYMBOLE_APRES_EXPRESSION = /\}\s*(?:&nbsp;|&#160;|\s)*(?:EUR\b|USD\b|euros?\b|dollars?\b|\$(?=[`'"<\s]|$))/i;
// Unité ou symbole SEUL (chaîne, élément, ligne) : « $ », « euros », « dollars », "EUR", "USD" (relecture opus-v1-y1).
const UNITE_SEULE = /['"`]\s*(?:\$|euros|dollars)\s*['"`]|>\s*(?:\$|euros|dollars)\s*<|['"`](?:EUR|USD)['"`]|^\s*(?:&nbsp;|\s)*(?:euros|dollars)\s*(?:<\/\w+>\s*)*[.,;)]*\s*$/i;
const DOLLAR_AVANT_EXPRESSION = /\$\s?§\{|\$\s?\{/;
const FORMATEUR_MONTANT = /\b(?:formaterMontant|usdVersEur|centimesAuSuperieur|centimesDuPlafond)\b|\beuros\(|\bEncartCout\b|\bJaugeBudget\b|lib\/montants/;
const FORMAT_MONNAIE = /style\s*:\s*['"`]currency['"`]|\bcurrency\s*:|\bdevise\s*:\s*['"`]?(?:EUR|USD)/i;
// Un montant : écrit en dur, calculé puis suivi du symbole, appelé par un formateur ou formaté en monnaie. Les `${`
// d'interpolation sont neutralisées d'abord pour qu'un « $ » collé à une accolade ne passe pas pour un dollar.
const estMontant = (l) => {
  const n = l.replaceAll("${", "§{");
  return MONTANT.test(n) || SYMBOLE_EURO.test(n) || SYMBOLE_APRES_EXPRESSION.test(n) || /\$\s?§\{/.test(n) || FORMATEUR_MONTANT.test(n) || FORMAT_MONNAIE.test(n) || UNITE_SEULE.test(n);
};
const BUFFER_DATE = /(?:\b18\/11\b|\b20\/11\b|2026-11-18|2026-11-20|\b(?:18|20)\s+novembre\b)/i;
// Dépôt visé par une commande : refusé sauf le dépôt du workflow lui-même (${{ github.repository }}).
const DEPOT_SOI = /^['"]?\/?(?:repos\/)?\$\{\{\s*github\.repository\s*\}\}/;
const vise = (l, motif) => { const m = motif.exec(l); return !!m && !DEPOT_SOI.test(m[1] ?? ""); };
const estRunPrive = (l) =>
  /\bgit\s+clone\b|github\.com\/[\w.-]+\/[\w.-]+/.test(l) ||
  vise(l, /\bgh\s+repo\s+clone\s+([^\n]*)/) ||
  vise(l, /\bgh\s+api\b[^\n]*?\s['"]?(\/?repos\/[^\n]*)/) ||
  vise(l, /\bgh\b[^\n]*?\s(?:-R|--repo)[\s=]+([^\n]*)/);

const PUSH_CODE = /web-?push|sendNotification|PushManager|pushManager\.subscribe/;

// Chaque règle : { portee(chemin) -> bool, ligne(texte, contenuComplet) -> bool, ignorerCommentaires? }
const DEFINITIONS = {
  montant: {
    portee: (c) => sous("src/app/", "src/components/")(c) && /\.tsx?$/.test(c) && !estTest(c),
    ligne: (l) => estMontant(l),
    ignorerCommentaires: true,
  },
  "workflow-externe": {
    portee: (c) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(c),
    ligne: (l) => {
      if (COMMENTAIRE.test(l)) return false;
      if (/^\s*(?:-\s*)?repository:\s*\S/.test(l)) return true;
      const m = /\buses:\s*['"]?([^\s'"#]+)/.exec(l);
      if (m) return !/^(?:actions\/|pnpm\/|\.\/)/.test(m[1]);
      return estRunPrive(l);
    },
  },
  haiku: {
    portee: (c) => (sous("src/", "scripts/", ".github/")(c) || /^outils\/(?!gardes\/regles-de-fer)/.test(c)) && code.test(c) && !estTest(c),
    ligne: (l) => /haiku/i.test(l),
  },
  purge: {
    portee: (c) => (sous("src/", "scripts/", ".github/")(c) || c.startsWith("outils/")) && code.test(c) && !estTest(c),
    ligne: (l) => /\bpurg\w*|\brm\s+-[a-z]*r[a-z]*f|\bdrop\s+table|\btruncate\s+table|\bgit\s+clean\b/i.test(l),
  },
  "date-buffer": {
    portee: (c) => (sous("src/", "scripts/", ".github/")(c) || c.startsWith("outils/")) && code.test(c) && !estTest(c),
    ligne: (l) => /buffer/i.test(l) && BUFFER_DATE.test(l),
  },
  push: {
    portee: (c) => ((sous("src/", "scripts/")(c) || /^outils\/(?!gardes\/regles-de-fer)/.test(c)) && code.test(c) && !estTest(c)) || /^\.github\/workflows\//.test(c),
    ligne: (l, c) => (c.startsWith(".github/") ? !COMMENTAIRE.test(l) && /\bgit\s+push\b/.test(l) : PUSH_CODE.test(l)),
  },
};

export function lireMots(env = process.env) {
  let brut = env.MOTS_FONDATEUR ?? "";
  const f = env.MOTS_FONDATEUR_FICHIER;
  if (f && fs.existsSync(f)) brut += "," + fs.readFileSync(f, "utf8").split(/\r?\n/).join(",");
  return [...new Set(brut.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean))];
}

const normaliser = (c) => String(c).replaceAll("\\", "/").replace(/^(?:\.\/)+/, "");

/** Exception d'un fichier : un nombre d'occurrences tolérées (objet { chemin: n }) ; une liste de chemins seule (ancienne
 *  forme) tolère un nombre quelconque. Le nombre ne peut que baisser : un dépassement est rouge. */
const plafond = (liste, chemin) => {
  if (Array.isArray(liste)) return liste.includes(chemin) ? Infinity : undefined;
  return liste && Object.hasOwn(liste, chemin) ? liste[chemin] : undefined;
};
const chemins = (liste) => (Array.isArray(liste) ? liste : Object.keys(liste ?? {}));

export function controler(fichiers, options = {}) {
  const exceptions = options.exceptions ?? EXCEPTIONS;
  const mots = (options.mots ?? []).map((m) => m.toLowerCase());
  const defauts = [];
  const nonVerifiees = [];
  const vus = new Set(); // couples règle|fichier où l'exception a encore servi
  for (const f of fichiers) {
    const chemin = normaliser(f.chemin);
    const lignes = typeof f.contenu === "string" ? f.contenu.split(/\r?\n/) : [];
    for (const [regle, d] of Object.entries(DEFINITIONS)) {
      if (!d.portee(chemin)) continue;
      const trouvees = [];
      lignes.forEach((l, i) => { if (!(d.ignorerCommentaires && COMMENTAIRE.test(l)) && d.ligne(l, chemin)) trouvees.push(i + 1); });
      const max = plafond(exceptions[regle], chemin);
      if (max !== undefined) {
        if (trouvees.length) vus.add(`${regle}|${chemin}`);
        if (trouvees.length > max) defauts.push({ regle: "exception-depassee", fichier: chemin, ligne: trouvees[max], detail: `${regle} : ${trouvees.length} occurrence(s), ${max} tolérée(s)` });
      } else if (trouvees.length) defauts.push({ regle, fichier: chemin, ligne: trouvees[0] });
    }
    if (mots.length && plafond(exceptions["nom-fondateur"], chemin) === undefined) {
      const nom = chemin.toLowerCase();
      const i = lignes.findIndex((l) => mots.some((m) => l.toLowerCase().includes(m)));
      if (mots.some((m) => nom.includes(m))) defauts.push({ regle: "nom-fondateur", fichier: chemin, ligne: 0 });
      else if (i >= 0) defauts.push({ regle: "nom-fondateur", fichier: chemin, ligne: i + 1 });
    }
  }
  // Exception périmée : listée, mais le fichier ne contient plus le motif (ou n'existe plus si la liste est complète).
  const presents = new Map(fichiers.map((f) => [normaliser(f.chemin), f.contenu]));
  for (const [regle, liste] of Object.entries(exceptions)) {
    if (regle === "nom-fondateur") continue;
    for (const chemin of chemins(liste)) {
      if (vus.has(`${regle}|${chemin}`)) continue;
      if (!presents.has(chemin) && !options.listeComplete) continue;
      defauts.push({ regle: "exception-perimee", fichier: chemin, ligne: 0, detail: regle });
    }
  }
  if (!mots.length) nonVerifiees.push("nom-fondateur");
  return { defauts, nonVerifiees };
}

function fichiersVersionnes() {
  const liste = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  return liste.flatMap((chemin) => {
    try {
      if (!fs.existsSync(chemin) || fs.statSync(chemin).size > 2_000_000) return [{ chemin, contenu: null }];
      const b = fs.readFileSync(chemin);
      return [{ chemin, contenu: b.includes(0) ? null : b.toString("utf8") }];
    } catch { return [{ chemin, contenu: null }]; }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  const r = controler(fichiersVersionnes(), { mots: lireMots(), listeComplete: true });
  if (args.includes("--json")) console.log(JSON.stringify(r));
  else {
    for (const d of r.defauts) console.log(`ROUGE ${d.regle} : ${d.fichier}${d.ligne ? `:${d.ligne}` : ""}`);
    for (const n of r.nonVerifiees) if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Règle non vérifiée::${n} : liste de mots non fournie, cette règle n'a PAS été contrôlée`);
    for (const n of r.nonVerifiees) console.log(`NON VÉRIFIÉE ${n} : liste de mots non fournie (MOTS_FONDATEUR)`);
    console.log(`${r.defauts.length} défaut(s)`);
  }
  process.exit(r.defauts.length || (args.includes("--strict") && r.nonVerifiees.length) ? 1 : 0);
}
