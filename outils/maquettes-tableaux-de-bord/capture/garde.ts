// T-EXT-03 : gardes du lanceur de capture. Pur : aucune lecture de disque, aucun réseau, aucun navigateur.
// Le lanceur ne tourne que dans une session cloud ou en CI, et ne charge QUE des fichiers locaux de la maquette.
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const MESSAGE_ENVIRONNEMENT_INTERDIT = "Capture interdite ici : seulement dans le cloud ou la CI, jamais sur le PC.";

/** Racines permises par défaut (relatives au dépôt ; résolues à l'usage). */
export const RACINES_PAR_DEFAUT: readonly string[] = [
  "outils/maquettes-tableaux-de-bord/",
  "src/app/polices/manrope-latin.woff2",
];

export type Verdict = { ok: true } | { ok: false; raison: string };

/** Vrai seulement dans la CI ou une session cloud, et jamais sous Windows (le PC de Williams). */
export function environnementAutorise(env: Record<string, string | undefined>, plateforme: string): Verdict {
  const cloud = env.CI === "true" || env.CLAUDE_CODE_REMOTE === "true";
  if (!cloud || plateforme === "win32") return { ok: false, raison: MESSAGE_ENVIRONNEMENT_INTERDIT };
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
