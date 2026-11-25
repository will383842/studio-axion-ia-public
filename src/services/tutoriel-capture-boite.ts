import "server-only";
/**
 * POSTE-3 : la boîte aux lettres de la capture automatique, vue du Studio (plan « poste relié » du 25/11, sections 3 et 4).
 * Le Studio y écrit ses demandes et y relit les réponses du veilleur de l'hôte. Tout ce qui revient de la boîte est HOSTILE
 * (un poste de capture compromis a pu le fabriquer) : `lstat`, `O_NOFOLLOW`, `fstat` (fichier ordinaire, un seul nom, taille
 * bornée), noms en liste fermée, signature du MP4. Aucun appelant en production dans ce lot ; aucun réglage ; aucun appel payant.
 * Toutes les fonctions prennent la racine (défaut `RACINE_BOITE_STUDIO`) et un `fs` injectable pour les tests.
 */
import * as nodeFs from "node:fs";
import { join } from "node:path";
import {
  BORNES,
  DOSSIER_APERCU,
  FICHIERS_DEMANDE,
  FICHIERS_REPONSE,
  POULS_MAX_MS,
  RACINE_BOITE_STUDIO,
  dossierPrep,
  estEmpreinteValide,
  estIdValide,
  estNomImageValide,
  estTypeDemande,
  lireEtat,
  nomDossier,
  signatureMp4,
  type CodeReponse,
  type StatutReponse,
  type TypeDemande,
} from "../moteurs/montage-tutoriel-outil/capture-auto/contrat";

/** Sous-ensemble de `node:fs` utilisé ici (injectable). */
export type SystemeFichiers = Pick<
  typeof nodeFs,
  "lstatSync" | "readdirSync" | "mkdirSync" | "openSync" | "fstatSync" | "readSync" | "writeSync" | "fsyncSync" | "ftruncateSync" | "closeSync" | "renameSync" | "rmSync"
>;
const FS_REEL: SystemeFichiers = nodeFs;

export type EtatBoite = "non-prete" | "eteinte" | "prete";
export const MAX_TENTATIVES = 2;

/** Erreur de la boîte : `code` est un code de la liste fermée du contrat (`FILM_INVALIDE` pour toute réponse suspecte). */
export class ErreurBoite extends Error {
  constructor(
    readonly code: CodeReponse,
    message: string,
  ) {
    super(message);
    this.name = "ErreurBoite";
  }
}
const invalide = (m: string): never => {
  throw new ErreurBoite("FILM_INVALIDE", m);
};
const demandeInvalide = (m: string): never => {
  throw new ErreurBoite("DEMANDE_INVALIDE", m);
};

const { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_NONBLOCK } = nodeFs.constants;

function lstatOuNul(fs: SystemeFichiers, chemin: string): nodeFs.Stats | null {
  try {
    return fs.lstatSync(chemin);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Lit un fichier ordinaire, sans suivre de lien, un seul nom, taille ≤ `borne` ; sinon `null` (jamais d'exception de taille). */
function lireFichierSur(fs: SystemeFichiers, chemin: string, borne: number): { ok: true; octets: Buffer } | { ok: false; raison: string } {
  const avant = lstatOuNul(fs, chemin);
  if (!avant) return { ok: false, raison: "absent" };
  if (!avant.isFile()) return { ok: false, raison: "pas un fichier ordinaire" };
  let fd: number;
  try {
    fd = fs.openSync(chemin, O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  } catch {
    return { ok: false, raison: "ouverture refusée" };
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return { ok: false, raison: "pas un fichier ordinaire" };
    if (st.nlink !== 1) return { ok: false, raison: "lien physique" };
    if (st.ino !== avant.ino || st.dev !== avant.dev) return { ok: false, raison: "fichier remplacé" };
    if (st.size > borne) return { ok: false, raison: "fichier trop gros" };
    const tampon = Buffer.alloc(st.size);
    let lu = 0;
    while (lu < tampon.length) {
      const n = fs.readSync(fd, tampon, lu, tampon.length - lu, lu);
      if (n === 0) break;
      lu += n;
    }
    return { ok: true, octets: lu === tampon.length ? tampon : tampon.subarray(0, lu) };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      /* rien à faire */
    }
  }
}

export function etatBoite(racine: string = RACINE_BOITE_STUDIO, fs: SystemeFichiers = FS_REEL, maintenant: () => number = Date.now): EtatBoite {
  try {
    const pret = lstatOuNul(fs, join(racine, "PRET"));
    const demandes = lstatOuNul(fs, join(racine, "demandes"));
    if (!pret || !pret.isFile() || !demandes || !demandes.isDirectory()) return "non-prete";
    const pouls = lireFichierSur(fs, join(racine, "pouls"), 128);
    if (!pouls.ok) return "eteinte";
    const date = Date.parse(pouls.octets.toString("utf8").trim());
    if (!Number.isFinite(date) || Math.abs(maintenant() - date) > POULS_MAX_MS) return "eteinte";
    return "prete";
  } catch {
    return "non-prete";
  }
}

/** Vrai si `demandes/` contient une entrée quelconque (y compris `.prep-*`). Illisible : vrai (prudence). */
export function demandeEnVol(racine: string = RACINE_BOITE_STUDIO, fs: SystemeFichiers = FS_REEL): boolean {
  try {
    return fs.readdirSync(join(racine, "demandes")).length > 0;
  } catch {
    return true;
  }
}

export function tentatives(racine: string, id: string, fs: SystemeFichiers = FS_REEL): number {
  if (!estIdValide(id)) return MAX_TENTATIVES;
  const lu = lireFichierSur(fs, join(racine, "echecs", `${id}.json`), 1024);
  if (!lu.ok) return lu.raison === "absent" ? 0 : MAX_TENTATIVES;
  try {
    const n = (JSON.parse(lu.octets.toString("utf8")) as { tentatives?: unknown }).tentatives;
    return typeof n === "number" && Number.isInteger(n) && n >= 0 ? Math.min(n, 1000) : MAX_TENTATIVES;
  } catch {
    return MAX_TENTATIVES;
  }
}

/** Note un échec de plus et rend le nouveau total. */
export function noterEchec(racine: string, id: string, fs: SystemeFichiers = FS_REEL): number {
  if (!estIdValide(id)) throw new ErreurBoite("DEMANDE_INVALIDE", "Identifiant de demande invalide.");
  const total = tentatives(racine, id, fs) + 1;
  const chemin = join(racine, "echecs", `${id}.json`);
  const octets = Buffer.from(JSON.stringify({ tentatives: total }));
  let fd: number;
  try {
    fd = fs.openSync(chemin, O_WRONLY | O_CREAT | O_NOFOLLOW, 0o600);
  } catch {
    throw new ErreurBoite("DEMANDE_INVALIDE", "Les tentatives n'ont pas pu être notées.");
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.nlink !== 1) throw new ErreurBoite("DEMANDE_INVALIDE", "Fichier de tentatives refusé.");
    fs.ftruncateSync(fd, 0);
    fs.writeSync(fd, octets, 0, octets.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return total;
}

function retirerSansSuivre(fs: SystemeFichiers, chemin: string): void {
  if (lstatOuNul(fs, chemin)) fs.rmSync(chemin, { recursive: true, force: true });
}

/**
 * Écrit une demande : noms (ensemble EXACT du type) et tailles contrôlés AVANT toute écriture ; `.prep-<id>` (0700, doit être neuf),
 * chaque fichier en création exclusive sans suivre de lien (0600), `fsync`, puis `rename` vers `demandes/<type>--<id>` (doit être absent).
 */
export function ecrireDemande(
  racine: string,
  type: TypeDemande,
  id: string,
  fichiers: Record<string, Uint8Array>,
  fs: SystemeFichiers = FS_REEL,
): void {
  if (!estTypeDemande(type)) return demandeInvalide("Type de demande inconnu.");
  if (!estIdValide(id)) return demandeInvalide("Identifiant de demande invalide.");
  const permis = FICHIERS_DEMANDE[type];
  const noms = Object.keys(fichiers);
  if (noms.length !== Object.keys(permis).length || noms.some((n) => !Object.prototype.hasOwnProperty.call(permis, n))) {
    return demandeInvalide("Les fichiers de la demande ne sont pas ceux du contrat.");
  }
  for (const n of noms) {
    const f = fichiers[n];
    if (!(f instanceof Uint8Array)) return demandeInvalide("Contenu de demande invalide.");
    if (f.length > permis[n]!) throw new ErreurBoite("TROP_GROS", `« ${n} » dépasse la taille permise.`);
  }
  if (noms.includes("attendue.txt") && !estEmpreinteValide(Buffer.from(fichiers["attendue.txt"]!).toString("utf8").trim())) {
    return demandeInvalide("L'empreinte attendue est invalide.");
  }
  const nom = nomDossier(type, id);
  const cible = join(racine, "demandes", nom);
  const prep = join(racine, "demandes", dossierPrep(id));
  if (lstatOuNul(fs, cible) || lstatOuNul(fs, join(racine, "reponses", nom)) || lstatOuNul(fs, prep)) {
    return demandeInvalide("Cette demande existe déjà.");
  }
  if (tentatives(racine, id, fs) >= MAX_TENTATIVES) return demandeInvalide("Trop de tentatives pour cette demande.");
  fs.mkdirSync(prep, { mode: 0o700 }); // non récursif : échoue si présent
  try {
    for (const n of noms) {
      const fd = fs.openSync(join(prep, n), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
      try {
        const octets = fichiers[n]!;
        let ecrit = 0;
        while (ecrit < octets.length) ecrit += fs.writeSync(fd, octets, ecrit, octets.length - ecrit);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
    if (lstatOuNul(fs, cible)) return demandeInvalide("Cette demande existe déjà.");
    fs.renameSync(prep, cible);
  } catch (e) {
    try {
      retirerSansSuivre(fs, prep);
    } catch {
      /* le dossier de préparation restant bloquera la demande suivante : voulu */
    }
    throw e;
  }
}

export interface ReponseBoite {
  statut: StatutReponse;
  code: CodeReponse;
  /** Noms du contrat (`apercu/<nom>.png` pour les images) vers octets lus. */
  fichiers: Record<string, Buffer>;
}

/**
 * Relit la réponse d'une demande : `null` si elle n'est pas encore là ; `ErreurBoite("FILM_INVALIDE")` à la moindre anomalie
 * (dossier en lien, nom hors liste, lien, lien physique, fichier trop gros, signature MP4 fausse, fichier manquant pour un `ok`).
 */
export function lireReponse(racine: string, type: TypeDemande, id: string, fs: SystemeFichiers = FS_REEL): ReponseBoite | null {
  const nom = nomDossier(type, id);
  const dossier = join(racine, "reponses", nom);
  const st = lstatOuNul(fs, dossier);
  if (!st) return null;
  if (!st.isDirectory()) return invalide("Le dossier de réponse n'est pas un vrai dossier.");
  const permis = FICHIERS_REPONSE[type];
  const noms = fs.readdirSync(dossier);
  if (noms.length > Object.keys(permis).length + 1) return invalide("Trop d'éléments dans la réponse.");
  const fichiers: Record<string, Buffer> = {};
  for (const n of noms) {
    if (n === DOSSIER_APERCU && type === "apercu") continue;
    if (!Object.prototype.hasOwnProperty.call(permis, n)) return invalide(`Nom inattendu dans la réponse : « ${n} ».`);
    const lu = lireFichierSur(fs, join(dossier, n), permis[n]!);
    if (!lu.ok) return invalide(`« ${n} » refusé : ${lu.raison}.`);
    fichiers[n] = lu.octets;
  }
  if (!fichiers["etat.txt"]) return invalide("Le fichier d'état manque.");
  const etat = lireEtat(fichiers["etat.txt"].toString("utf8"));
  if (!etat.ok) return invalide(`État refusé : ${etat.raison}`);

  if (etat.statut === "ok") {
    for (const requis of Object.keys(permis)) if (!fichiers[requis]) return invalide(`« ${requis} » manque.`);
    if (type !== "apercu" && !signatureMp4(fichiers["navigation.mp4"]!.subarray(0, 16))) return invalide("Le film n'est pas un MP4.");
  }
  if (noms.includes(DOSSIER_APERCU) && type === "apercu") {
    const sous = join(dossier, DOSSIER_APERCU);
    const sst = lstatOuNul(fs, sous);
    if (!sst || !sst.isDirectory()) return invalide("Le dossier d'images n'est pas un vrai dossier.");
    const images = fs.readdirSync(sous);
    if (images.length > BORNES.pngMax) return invalide("Trop d'images.");
    for (const img of images) {
      if (!estNomImageValide(img)) return invalide(`Nom d'image inattendu : « ${img} ».`);
      const lu = lireFichierSur(fs, join(sous, img), BORNES.png);
      if (!lu.ok) return invalide(`Image « ${img} » refusée : ${lu.raison}.`);
      fichiers[`${DOSSIER_APERCU}/${img}`] = lu.octets;
    }
  }
  return { statut: etat.statut, code: etat.code, fichiers };
}

/** Efface la réponse sans suivre de lien (un lien posé dedans est retiré, jamais sa cible). */
export function effacerReponse(racine: string, type: TypeDemande, id: string, fs: SystemeFichiers = FS_REEL): void {
  retirerSansSuivre(fs, join(racine, "reponses", nomDossier(type, id)));
}


