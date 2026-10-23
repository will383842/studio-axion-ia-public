/**
 * Entrées d'une composition (lot M4) : nom de fichier local de chaque entrée (extension gardée : le navigateur et
 * FFmpeg reconnaissent le type), et remplacement des références `entree:<nom>` des propriétés par une adresse
 * locale. PUR, testé.
 */
import { extname } from "node:path";
import { PREFIXE_ENTREE } from "../../../src/briques/composition/scene.js";

const EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".webm", ".mp4", ".mov", ".wav", ".mp3", ".m4a", ".cube"]);

/** Fichier local d'une entrée : son nom, plus l'extension lue dans le chemin de l'adresse (sans la signature). */
export function fichierEntree(nom: string, url: string): string {
  let chemin = url;
  try {
    chemin = new URL(url).pathname;
  } catch {
    /* adresse relative : gardée telle quelle */
  }
  const ext = extname(chemin).toLowerCase();
  const propre = nom.replace(/[^a-z0-9-]/gi, "-");
  return EXTENSIONS.has(ext) ? `${propre}${ext}` : propre;
}

/** Remplace chaque chaîne `entree:<nom>` (à toute profondeur) par `adresses[nom]`. Une entrée inconnue est une erreur. */
export function remplacerReferences<T>(valeur: T, adresses: Record<string, string>): T {
  if (typeof valeur === "string") {
    if (!valeur.startsWith(PREFIXE_ENTREE)) return valeur;
    const nom = valeur.slice(PREFIXE_ENTREE.length);
    if (!(nom in adresses)) throw new Error(`Entrée « ${nom} » absente de la demande.`);
    return adresses[nom] as T;
  }
  if (Array.isArray(valeur)) return valeur.map((v) => remplacerReferences(v, adresses)) as T;
  if (valeur && typeof valeur === "object") return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, remplacerReferences(v, adresses)])) as T;
  return valeur;
}
