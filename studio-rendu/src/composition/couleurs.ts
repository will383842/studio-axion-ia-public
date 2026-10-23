/**
 * GARDE-FOU DES COULEURS (10/10, « zoom demandé = image cassée »). Une composition face caméra 10 bits avec une carte
 * plein écran sortait toute l'image filmée en jaune et magenta (FFmpeg 8 : voir `image-ffmpeg.ts`), et rien ne le
 * voyait : la note VMAF compare l'export au master, déjà cassé. Ici, l'export est comparé à la PRISE ÉTALONNÉE (la
 * passe image, en amont de toute composition) aux mêmes instants : chrominance moyenne (U, V) et sa teinte, dans la
 * moitié haute du cadre (visage, mur ; jamais la ligne des sous-titres).
 *
 * Mesure : une image décodée par FFmpeg (matrice BT.709 et plage tv EXPLICITES), réduite par moyenne de zone, en YUV
 * 4:4:4 8 bits. Les parties de calcul sont PURES (testées) ; `mesurerCouleurs` lance FFmpeg.
 */
import { spawn } from "node:child_process";

/** Zone relative d'une image (fractions de largeur et de hauteur). */
export interface Zone {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Cadre en pixels de la source (le plan montré, recadré dans la prise étalonnée). */
export interface CadrePx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Une paire comparée : instant de l'export, instant de la référence et cadre du plan dans la référence. */
export interface PaireCouleurs {
  exportSec: number;
  referenceSec: number;
  cadre?: CadrePx;
}

export interface MoyennesYuv {
  y: number;
  u: number;
  v: number;
}

/** Moitié haute du cadre, sans les bords (vignette) : visage et mur, jamais les sous-titres (55-72 % de la hauteur). */
export const ZONE_COULEURS: Zone = { x: 0.1, y: 0.06, largeur: 0.8, hauteur: 0.42 };

/**
 * Seuils (8 bits) : l'écart de chrominance normal entre export et prise étalonnée (grain en luminance, vignette, LUT
 * des B-roll absente des plans filmés, compression) reste sous 3 ; la panne du 10/10 en donnait 60 à 90.
 */
export const SEUILS_COULEURS = { ecartUV: 10, ecartTeinteDeg: 25, chromaMinTeinte: 6 } as const;

const TAILLE = { largeur: 64, hauteur: 112 };

/** Moyennes Y, U, V d'une image YUV 4:4:4 8 bits planaire (`largeur` × `hauteur`) dans une zone relative. PUR. */
export function moyennesYuv(donnees: Uint8Array, largeur: number, hauteur: number, zone: Zone = { x: 0, y: 0, largeur: 1, hauteur: 1 }): MoyennesYuv {
  const n = largeur * hauteur;
  if (donnees.length < 3 * n) throw new Error(`image incomplète (${donnees.length} octets pour ${3 * n})`);
  const x0 = Math.max(0, Math.floor(zone.x * largeur));
  const x1 = Math.min(largeur, Math.max(x0 + 1, Math.round((zone.x + zone.largeur) * largeur)));
  const y0 = Math.max(0, Math.floor(zone.y * hauteur));
  const y1 = Math.min(hauteur, Math.max(y0 + 1, Math.round((zone.y + zone.hauteur) * hauteur)));
  let y = 0;
  let u = 0;
  let v = 0;
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++) {
      const k = j * largeur + i;
      y += donnees[k];
      u += donnees[n + k];
      v += donnees[2 * n + k];
    }
  const c = (x1 - x0) * (y1 - y0);
  return { y: y / c, u: u / c, v: v / c };
}

/** Teinte (degrés) de la chrominance moyenne : angle de (U − 128, V − 128). PUR. */
export function teinteDeg(m: MoyennesYuv): number {
  return ((Math.atan2(m.v - 128, m.u - 128) * 180) / Math.PI + 360) % 360;
}

/** Écart de chrominance (8 bits) et de teinte entre deux mesures ; la teinte n'est jugée que sur une image colorée. PUR. */
export function ecartCouleurs(a: MoyennesYuv, b: MoyennesYuv): { ecartUV: number; ecartTeinteDeg: number | null } {
  const ecartUV = Math.hypot(a.u - b.u, a.v - b.v);
  const chroma = (m: MoyennesYuv) => Math.hypot(m.u - 128, m.v - 128);
  if (Math.min(chroma(a), chroma(b)) < SEUILS_COULEURS.chromaMinTeinte) return { ecartUV, ecartTeinteDeg: null };
  const d = Math.abs(teinteDeg(a) - teinteDeg(b)) % 360;
  return { ecartUV, ecartTeinteDeg: Math.min(d, 360 - d) };
}

const mediane = (x: number[]) => {
  const t = [...x].sort((a, b) => a - b);
  return t.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : 0;
};
const arrondi = (x: number) => Math.round(x * 10) / 10;

/**
 * Verdict sur les paires mesurées (médianes : une image isolée ne décide pas). `couleursAberrantes` = 1 au-delà d'un
 * seuil ; mesures arrondies au dixième. PUR.
 */
export function verdictCouleurs(paires: { export: MoyennesYuv; reference: MoyennesYuv }[]): Record<string, number> {
  if (!paires.length) return { couleursPaires: 0 };
  const ecarts = paires.map((p) => ecartCouleurs(p.export, p.reference));
  const uv = mediane(ecarts.map((e) => e.ecartUV));
  const teintes = ecarts.map((e) => e.ecartTeinteDeg).filter((x): x is number => x !== null);
  const teinte = teintes.length ? mediane(teintes) : null;
  const aberrantes = uv > SEUILS_COULEURS.ecartUV || (teinte !== null && teinte > SEUILS_COULEURS.ecartTeinteDeg);
  return {
    couleursPaires: paires.length,
    couleursEcartUV: arrondi(uv),
    couleursEcartUVMax: arrondi(Math.max(...ecarts.map((e) => e.ecartUV))),
    ...(teinte !== null ? { couleursEcartTeinteDeg: arrondi(teinte) } : {}),
    couleursAberrantes: aberrantes ? 1 : 0,
  };
}

/** Filtre d'une image : cadre du plan (pixels de la source), zone relative, réduction par moyenne, YUV BT.709 tv. PUR. */
export function filtreMesure(zone: Zone, cadre?: CadrePx): string {
  const pair = (x: number) => 2 * Math.max(1, Math.round(x / 2));
  const recadre = cadre ? `crop=${pair(cadre.largeur)}:${pair(cadre.hauteur)}:${Math.max(0, Math.round(cadre.x))}:${Math.max(0, Math.round(cadre.y))},` : "";
  const z = `crop=iw*${zone.largeur.toFixed(4)}:ih*${zone.hauteur.toFixed(4)}:iw*${zone.x.toFixed(4)}:ih*${zone.y.toFixed(4)}`;
  return `${recadre}${z},scale=${TAILLE.largeur}:${TAILLE.hauteur}:flags=area:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv,format=yuv444p`;
}

/** Une image de `fichier` (local ou adresse signée) à `instantSec`, mesurée dans `zone` (après le cadre éventuel). */
export function mesurerCouleurs(ffmpeg: string, fichier: string, instantSec: number, zone: Zone = ZONE_COULEURS, cadre?: CadrePx, signal?: AbortSignal): Promise<MoyennesYuv> {
  // Comme `miniature` (relecture sécurité R45) : les seuls protocoles de l'adresse, démultiplexeur mov / mp4 imposé.
  const protocoles = /^https:\/\//i.test(fichier) ? "https,tls,tcp" : /^http:\/\//i.test(fichier) ? "http,tcp" : "file";
  const args = ["-v", "error", "-nostdin", "-ss", Math.max(0, instantSec).toFixed(3), "-protocol_whitelist", protocoles, "-f", "mov", "-i", fichier, "-frames:v", "1", "-an", "-vf", filtreMesure(zone, cadre), "-f", "rawvideo", "-"];
  return new Promise((ok, ko) => {
    const p = spawn(ffmpeg, args, { signal, windowsHide: true });
    const morceaux: Buffer[] = [];
    let erreurs = "";
    p.stdout.on("data", (d: Buffer) => morceaux.push(d));
    p.stderr.on("data", (d: Buffer) => (erreurs = (erreurs + d.toString()).slice(-2000)));
    p.on("error", ko);
    p.on("close", (code) => {
      if (code !== 0) return ko(new Error(`mesure des couleurs impossible (${code}) : ${erreurs.split(/\r?\n/).filter(Boolean).pop() ?? ""}`));
      try {
        ok(moyennesYuv(new Uint8Array(Buffer.concat(morceaux)), TAILLE.largeur, TAILLE.hauteur));
      } catch (e) {
        ko(e);
      }
    });
  });
}

/** Mesure toutes les paires (export ↔ référence) puis rend le verdict (mesures numériques de la composition). */
export async function controlerCouleurs(ffmpeg: string, video: string, reference: string, paires: PaireCouleurs[], signal?: AbortSignal): Promise<Record<string, number>> {
  const mesurees: { export: MoyennesYuv; reference: MoyennesYuv }[] = [];
  for (const p of paires) {
    const [e, r] = await Promise.all([mesurerCouleurs(ffmpeg, video, p.exportSec, ZONE_COULEURS, undefined, signal), mesurerCouleurs(ffmpeg, reference, p.referenceSec, ZONE_COULEURS, p.cadre, signal)]);
    mesurees.push({ export: e, reference: r });
  }
  return verdictCouleurs(mesurees);
}
