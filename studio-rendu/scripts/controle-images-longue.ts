/**
 * BANC IMAGES DE LA VIDÉO LONGUE (lot QUALL-4) : repère les passages « vides » d'une vidéo rendue, sans IA.
 * `ffmpeg -vf fps=4,scale=480:270 -f rawvideo -pix_fmt rgb24 -` ; par image, la couleur de fond est la plus fréquente
 * (pas de 8) ; on mesure la part de pixels qui s'en écartent de plus de 24, au-dessus de y = 225 (hors bande des
 * sous-titres). Une image est « vide » sous 3 % ; plus d'une seconde de suite → échec (code de sortie 1).
 *
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/controle-images-longue.ts <video.mp4>
 */
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const LARGEUR_BANC = 480;
export const HAUTEUR_BANC = 270;
export const FPS_BANC = 4;
/** Les sous-titres occupent le bas de l'image (900/1080 × 270 = 225) : on ne les compte pas. */
export const Y_MAX_BANC = 225;
export const ECART_PIXEL = 24;
export const PART_VIDE = 0.03;
/** « Vide » seulement au-delà de 1 s de suite. */
export const DUREE_VIDE_MAX_S = 1;

/** Part (0 à 1) des pixels au-dessus de `yMax` qui s'écartent de plus de `ecart` de la couleur de fond (la plus fréquente, pas 8). PURE. */
export function partNonFond(rgb: Uint8Array, largeur: number, hauteur: number, yMax = Y_MAX_BANC, ecart = ECART_PIXEL): number {
  const lignes = Math.min(hauteur, yMax);
  const total = lignes * largeur;
  if (total === 0) return 0;
  const seaux = new Map<number, { n: number; r: number; v: number; b: number }>();
  for (let i = 0; i < total; i++) {
    const r = rgb[i * 3];
    const v = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const cle = ((r >> 3) << 10) | ((v >> 3) << 5) | (b >> 3);
    const s = seaux.get(cle);
    if (s) {
      s.n++;
      s.r += r;
      s.v += v;
      s.b += b;
    } else seaux.set(cle, { n: 1, r, v, b });
  }
  let fond = { n: 0, r: 0, v: 0, b: 0 };
  for (const s of seaux.values()) if (s.n > fond.n) fond = s;
  const [fr, fv, fb] = [fond.r / fond.n, fond.v / fond.n, fond.b / fond.n];
  let autres = 0;
  for (let i = 0; i < total; i++) {
    if (Math.max(Math.abs(rgb[i * 3] - fr), Math.abs(rgb[i * 3 + 1] - fv), Math.abs(rgb[i * 3 + 2] - fb)) > ecart) autres++;
  }
  return autres / total;
}

export interface PassageVide {
  debutS: number;
  finS: number;
}

/** Plages d'images « vides » (part < `seuil`) plus longues que `dureeMaxS`, pour des images prises à `fps`. PURE. */
export function reperesVides(parts: readonly number[], fps = FPS_BANC, seuil = PART_VIDE, dureeMaxS = DUREE_VIDE_MAX_S): PassageVide[] {
  const vides: PassageVide[] = [];
  let debut = -1;
  const clore = (fin: number) => {
    if (debut >= 0 && (fin - debut) / fps > dureeMaxS) vides.push({ debutS: debut / fps, finS: fin / fps });
    debut = -1;
  };
  parts.forEach((p, i) => {
    if (p < seuil) {
      if (debut < 0) debut = i;
    } else clore(i);
  });
  clore(parts.length);
  return vides;
}

/** Analyse une vidéo par ffmpeg (en flux : une image à la fois), renvoie la part de non-fond de chaque image. */
export function analyserVideo(chemin: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const octetsImage = LARGEUR_BANC * HAUTEUR_BANC * 3;
    const ff = spawn("ffmpeg", ["-v", "error", "-i", chemin, "-vf", `fps=${FPS_BANC},scale=${LARGEUR_BANC}:${HAUTEUR_BANC}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const parts: number[] = [];
    let reste: Buffer = Buffer.alloc(0);
    let erreur = "";
    ff.stderr.on("data", (d: Buffer) => (erreur += d.toString()));
    ff.stdout.on("data", (d: Buffer) => {
      reste = reste.length ? Buffer.concat([reste, d]) : d;
      while (reste.length >= octetsImage) {
        parts.push(partNonFond(reste.subarray(0, octetsImage), LARGEUR_BANC, HAUTEUR_BANC));
        reste = reste.subarray(octetsImage);
      }
    });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve(parts) : reject(new Error(`ffmpeg a échoué (code ${code}) : ${erreur.trim()}`))));
  });
}

async function principal(): Promise<void> {
  const chemin = process.argv[2];
  if (!chemin) {
    console.error("Usage : npx tsx scripts/controle-images-longue.ts <video.mp4>");
    process.exit(2);
  }
  const parts = await analyserVideo(chemin);
  const vides = reperesVides(parts);
  const moyenne = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  console.log(`${chemin} : ${parts.length} images à ${FPS_BANC}/s, part moyenne de non-fond ${(moyenne * 100).toFixed(1)} %, minimum ${(Math.min(...parts, 1) * 100).toFixed(1)} %`);
  if (vides.length === 0) {
    console.log("Aucun passage vide.");
    return;
  }
  console.log("Passages vides (moins de 3 % de contenu pendant plus de 1 s) :");
  console.table(vides.map((v) => ({ debut_s: v.debutS.toFixed(2), fin_s: v.finS.toFixed(2), duree_s: (v.finS - v.debutS).toFixed(2) })));
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  });
}
