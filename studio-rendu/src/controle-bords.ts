/**
 * BORDS NOIRS D'UNE VIDÉO EXPORTÉE (11/10, défaut de l'essai réel du tableau animé : une bande noire de 8 px au bord
 * droit, colonnes 1072 à 1079, venue de la conversion `yuv420p → gbrp` du FFmpeg 8.1.1 ; voir `grapheExport`).
 *
 * Une colonne (ou une rangée) de bord est « noire » quand AUCUN de ses pixels ne dépasse le seuil de luminance : un
 * décor sombre a toujours quelques pixels plus clairs, une bande ajoutée n'en a aucun. On compte les colonnes noires
 * CONSÉCUTIVES depuis chaque bord (gauche, droite) et les rangées depuis le haut et le bas.
 *
 * `bordsNoirs` est PUR (testé sur des images fabriquées) ; `mesurerBordsNoirs` lit quelques images du fichier par
 * FFmpeg (luminance 8 bits) et garde, pour chaque bord, le plus grand nombre trouvé.
 */
import { spawn } from "node:child_process";

/** Luminance (8 bits, plage TV : noir = 16) sous laquelle tout pixel d'une ligne de bord la rend « noire ». */
export const SEUIL_BORD_NOIR = 32;

export interface BordsNoirs {
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
}

/** Bords noirs d'une image en niveaux de gris (une valeur 0-255 par pixel, rangée après rangée). */
export function bordsNoirs(gris: Uint8Array, largeur: number, hauteur: number, seuil = SEUIL_BORD_NOIR): BordsNoirs {
  if (gris.length < largeur * hauteur) throw new Error(`Image incomplète : ${gris.length} octets pour ${largeur} × ${hauteur}.`);
  const colonneNoire = (x: number) => {
    for (let y = 0; y < hauteur; y++) if (gris[y * largeur + x] > seuil) return false;
    return true;
  };
  const rangeeNoire = (y: number) => {
    const d = y * largeur;
    for (let x = 0; x < largeur; x++) if (gris[d + x] > seuil) return false;
    return true;
  };
  const compter = (n: number, noire: (i: number) => boolean) => {
    let k = 0;
    while (k < n && noire(k)) k++;
    return k;
  };
  return {
    gauche: compter(largeur, (i) => colonneNoire(i)),
    droite: compter(largeur, (i) => colonneNoire(largeur - 1 - i)),
    haut: compter(hauteur, (i) => rangeeNoire(i)),
    bas: compter(hauteur, (i) => rangeeNoire(hauteur - 1 - i)),
  };
}

/** Une image du fichier (luminance 8 bits) à `instantSec`. */
async function imageGrise(ffmpeg: string, fichier: string, instantSec: number, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const p = spawn(ffmpeg, ["-v", "error", "-nostdin", "-ss", instantSec.toFixed(3), "-i", fichier, "-frames:v", "1", "-an", "-vf", "format=gray", "-f", "rawvideo", "-"], { signal });
    const morceaux: Buffer[] = [];
    let erreurs = "";
    p.stdout.on("data", (b: Buffer) => morceaux.push(b));
    p.stderr.on("data", (b: Buffer) => (erreurs += b.toString()));
    p.on("error", rejeter);
    p.on("close", (code) => (code === 0 ? resoudre(Buffer.concat(morceaux)) : rejeter(new Error(`Lecture d'une image de ${fichier} impossible : ${erreurs.slice(-300)}`))));
  });
}

/**
 * Bords noirs d'une vidéo : quelques images (par défaut à 10 %, 50 % et 90 % de la durée), le plus grand nombre de
 * lignes noires trouvé pour chaque bord.
 */
export async function mesurerBordsNoirs(o: { ffmpeg: string; fichier: string; largeur: number; hauteur: number; dureeSec: number; parts?: readonly number[]; signal?: AbortSignal }): Promise<BordsNoirs> {
  const res: BordsNoirs = { gauche: 0, droite: 0, haut: 0, bas: 0 };
  for (const part of o.parts ?? [0.1, 0.5, 0.9]) {
    const image = await imageGrise(o.ffmpeg, o.fichier, Math.max(0, o.dureeSec * part), o.signal);
    const b = bordsNoirs(image, o.largeur, o.hauteur);
    for (const k of ["gauche", "droite", "haut", "bas"] as const) res[k] = Math.max(res[k], b[k]);
  }
  return res;
}

/** Mesures à joindre à celles de l'export (noms stables, lus par le studio). */
export function mesuresBords(b: BordsNoirs): Record<string, number> {
  return { bordNoirGauche: b.gauche, bordNoirDroite: b.droite, bordNoirHaut: b.haut, bordNoirBas: b.bas };
}
