// T-EXT-03 : gardes du lanceur de capture. Pur : aucune lecture de disque, aucun réseau, aucun navigateur.
// Le lanceur ne tourne que dans une session cloud ou en CI, et ne charge QUE des fichiers locaux de la maquette.
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const MESSAGE_ENVIRONNEMENT_INTERDIT = "Capture interdite ici : seulement dans le cloud ou la CI, jamais sur le PC.";

/** Racines permises par défaut (relatives au dépôt ; résolues à l'usage). */
export const RACINES_PAR_DEFAUT: readonly string[] = [
  "outils/maquettes-tableaux-de-bord/",
  "src/app/polices/manrope-latin.woff2",
];

export type Verdict = { ok: true } | { ok: false; raison: string };

/** Fichiers que Docker et Podman posent dans un conteneur : l'indice que le lanceur lit sur le disque (la garde reste pure). */
export const INDICES_CONTENEUR: readonly string[] = ["/.dockerenv", "/run/.containerenv"];

/** `existe` est injecté (le lanceur passe `fs.existsSync`) : vrai si l'un des fichiers témoins d'un conteneur est présent. */
export function indicesConteneur(existe: (chemin: string) => boolean): boolean {
  try {
    return INDICES_CONTENEUR.some((c) => existe(c));
  } catch {
    return false;
  }
}

/**
 * Vrai seulement dans la CI, une session cloud, ou le conteneur de capture, et jamais sous Windows (le PC de Williams).
 * macOS : refusé pour la voie `CAPTURE_CONTENEUR` (linux seulement), mais ACCEPTÉ avec `CI=true` ou `CLAUDE_CODE_REMOTE=true`
 * (exécuteurs CI macOS) ; c'est le comportement d'avant 51c, `jugerPoste` refuse darwin de son côté.
 * `CAPTURE_CONTENEUR` doit valoir exactement « true » ET le lanceur doit avoir vu un fichier témoin de conteneur
 * (`indicesConteneur`) : poser la variable seule sur un PC ne suffit pas. Sans 3e paramètre : refusé (rétro-compatible).
 */
export function environnementAutorise(
  env: Record<string, string | undefined>,
  plateforme: string,
  conteneurDetecte: boolean = false,
): Verdict {
  const cloud = env.CI === "true" || env.CLAUDE_CODE_REMOTE === "true";
  const conteneur = env.CAPTURE_CONTENEUR === "true" && conteneurDetecte === true && plateforme === "linux";
  if (plateforme === "win32" || !(cloud || conteneur)) {
    return { ok: false, raison: MESSAGE_ENVIRONNEMENT_INTERDIT };
  }
  return { ok: true };
}

function sousRacine(chemin: string, racine: string): boolean {
  const r = resolve(racine);
  return chemin === r || chemin.startsWith(r.endsWith(sep) ? r : r + sep);
}

/** `file://` sous une racine (`..` refusé), `about:blank` et `data:` ; tout le reste (http, https, ws, wss, ftp…) est refusé. */
export function adresseAutorisee(url: string, racines: readonly string[] = RACINES_PAR_DEFAUT): boolean {
  try {
    if (url === "about:blank") return true;
    if (/^data:/i.test(url)) return true;
    if (!/^file:\/\//i.test(url)) return false;
    // `..` refusé même encodé : on regarde le texte brut AVANT toute normalisation de l'URL.
    const brut = decodeURIComponent(url.slice("file://".length));
    if (brut.split(/[\\/]/).includes("..")) return false;
    const chemin = resolve(fileURLToPath(url));
    return racines.some((r) => sousRacine(chemin, isAbsolute(r) ? r : resolve(r)));
  } catch {
    return false;
  }
}

/**
 * Comme `adresseAutorisee`, mais sur le chemin RÉEL : `realpath` est injecté (le lanceur passe `fs.realpathSync.native`).
 * Refuse tout lien symbolique sous la racine (un lien vers /proc/self/environ, /etc/passwd ou /app ne sort jamais ; un lien
 * « interne » est refusé aussi : le plus sûr, une maquette n'a aucun besoin de liens), et refuse si la résolution échoue
 * (fichier absent). La racine elle-même peut être un lien (choix de l'opérateur) : on compare au `realpath` de la racine.
 */
export function adresseAutoriseeReelle(
  url: string,
  racines: readonly string[],
  realpath: (chemin: string) => string,
): boolean {
  if (!adresseAutorisee(url, racines)) return false;
  if (!/^file:\/\//i.test(url)) return true; // about:blank, data:
  try {
    const chemin = resolve(fileURLToPath(url));
    for (const r of racines) {
      const racine = isAbsolute(r) ? r : resolve(r);
      if (!sousRacine(chemin, racine)) continue;
      const attendu = resolve(realpath(racine), relative(resolve(racine), chemin));
      if (realpath(chemin) === attendu) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Ce que `deciderRequete` lit d'un `stat` (le lanceur passe `fs.statSync`) : fichier ordinaire, un seul nom. */
export interface InfosFichier {
  isFile(): boolean;
  nlink: number;
}

/**
 * Décision pure d'une requête du navigateur : « continuer » ou « refuser ». Tout ce qui n'est pas explicitement bon est refusé.
 * Adresse permise (`adresseAutoriseeReelle`, chemin réel par `realpath` injecté) ET, pour `file://`, un fichier ordinaire
 * (`isFile()`) avec un seul nom (`nlink === 1` : un lien physique vers un fichier hors racine, que `realpath` ne voit pas, est refusé).
 * Toute exception (fichier absent, `stat` en échec) : refusé.
 */
export function deciderRequete(
  url: string,
  racines: readonly string[],
  realpath: (chemin: string) => string,
  stat: (chemin: string) => InfosFichier,
): "continuer" | "refuser" {
  try {
    if (!adresseAutoriseeReelle(url, racines, realpath)) return "refuser";
    if (!/^file:\/\//i.test(url)) return "continuer"; // about:blank, data:
    const infos = stat(resolve(fileURLToPath(url)));
    return infos.isFile() === true && infos.nlink === 1 ? "continuer" : "refuser";
  } catch {
    return "refuser";
  }
}
