/**
 * SONDE Z1-C — LISTE DES COMPTES ZERNIO (LECTURE SEULE, GRATUIT).
 *
 * Lit, par le client à liste fermée, les comptes connectés à Zernio, puis pour chaque compte Facebook ses pages et pour
 * chaque compte LinkedIn ses organisations. Écrit le tout dans un fichier PRIVÉ, HORS du dépôt (dépôt public : aucun
 * identifiant de compte, de page ou d'organisation n'y entre jamais). À l'écran : des nombres seulement.
 *
 * Usage (racine du dépôt), la clé chargée dans l'environnement du SEUL processus, jamais affichée ni écrite :
 *   ZERNIO_API_KEY=… pnpm exec tsx outils/zernio/comptes.mts [chemin de sortie]
 * Sortie par défaut : ~/.studio-axion/prive/zernio-comptes.json (droits 600, dossier 700).
 *
 * Sécurité : l'interrupteur d'envoi est forcé à FAUX dans ce client : toute écriture est refusée avant le réseau.
 */
import { chmodSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { creerClientZernio, type CompteZernio } from "../../src/fournisseurs/publication/zernio-client";
import { estErreurZernio } from "../../src/fournisseurs/publication/zernio-erreurs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_DEPOT = resolve(ICI, "..", "..");
const SORTIE = resolve(process.argv[2] ?? join(homedir(), ".studio-axion", "prive", "zernio-comptes.json"));

/** Vrai si `chemin` est dans le dossier `parent` (ou est ce dossier). */
function estDans(chemin: string, parent: string): boolean {
  const rel = relative(parent, chemin);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Chemin réel du dossier de sortie le plus proche qui existe (liens symboliques résolus). */
function dossierReel(chemin: string): string {
  let d = dirname(chemin);
  for (;;) {
    try {
      return realpathSync(d);
    } catch {
      const parent = dirname(d);
      if (parent === d) return d;
      d = parent;
    }
  }
}

function arreter(message: string): never {
  console.error(message);
  process.exit(1);
}

const cle = process.env.ZERNIO_API_KEY?.trim();
if (!cle) arreter("ZERNIO_API_KEY absente de l'environnement : rien n'est lu.");
if (estDans(SORTIE, RACINE_DEPOT) || estDans(dossierReel(SORTIE), realpathSync(RACINE_DEPOT))) {
  arreter("Sortie refusée : le fichier doit être écrit HORS du dépôt (dépôt public).");
}

const client = creerClientZernio({ cle, envoiAutorise: () => false });

interface CompteRelu {
  compte: CompteZernio;
  pagesFacebook?: unknown[];
  organisationsLinkedin?: unknown[];
  erreur?: string;
}

try {
  const comptes = await client.listerComptes();
  const releve: CompteRelu[] = [];
  for (const compte of comptes) {
    const ligne: CompteRelu = { compte };
    try {
      if (compte.platform === "facebook") ligne.pagesFacebook = await client.pagesFacebook(compte._id);
      if (compte.platform === "linkedin") ligne.organisationsLinkedin = await client.organisationsLinkedin(compte._id);
    } catch (e) {
      ligne.erreur = estErreurZernio(e) ? `${e.code} : ${e.message}` : "erreur inconnue";
    }
    releve.push(ligne);
  }

  mkdirSync(dirname(SORTIE), { recursive: true, mode: 0o700 });
  writeFileSync(SORTIE, JSON.stringify({ releveLe: new Date().toISOString(), comptes: releve }, null, 2) + "\n", { mode: 0o600 });
  chmodSync(SORTIE, 0o600);

  // À l'écran : des nombres, jamais un identifiant ni la clé.
  const parReseau = new Map<string, number>();
  for (const { compte } of releve) parReseau.set(compte.platform, (parReseau.get(compte.platform) ?? 0) + 1);
  const pages = releve.reduce((n, r) => n + (r.pagesFacebook?.length ?? 0), 0);
  const orgs = releve.reduce((n, r) => n + (r.organisationsLinkedin?.length ?? 0), 0);
  const erreurs = releve.filter((r) => r.erreur).length;
  console.log(`Comptes : ${releve.length} (${[...parReseau].map(([r, n]) => `${r} ${n}`).join(", ") || "aucun"})`);
  console.log(`Pages Facebook : ${pages} · Organisations LinkedIn : ${orgs}${erreurs ? ` · lectures en erreur : ${erreurs}` : ""}`);
  console.log("Relevé écrit dans le fichier privé demandé (hors dépôt).");
} catch (e) {
  arreter(estErreurZernio(e) ? `Lecture impossible (${e.code}) : ${e.message}` : "Lecture impossible (erreur inconnue).");
}
